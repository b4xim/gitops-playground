const express = require('express');
const os = require('os');
const Redis = require('ioredis');
const logger = require('./logger');

// Configuration from environment variables
const PORT = parseInt(process.env.PORT || '8080', 10);
const APP_VERSION = process.env.APP_VERSION || 'v1.0.0';
const APP_ENV = process.env.APP_ENV || 'local';
const THEME_COLOR = process.env.THEME_COLOR || '#2563eb';
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || 'Welcome to GitOps Playground!';
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

const app = express();

// Redis Client initialization
const redisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  retryStrategy(times) {
    const delay = Math.min(times * 500, 3000);
    logger.warn('Reconnecting to Redis', { attempt: times, delayMs: delay });
    return delay;
  },
  lazyConnect: false
};

const redis = new Redis(redisOptions);

let redisConnected = false;

redis.on('connect', () => {
  redisConnected = true;
  logger.info('Connected to Redis', { host: REDIS_HOST, port: REDIS_PORT });
});

redis.on('ready', () => {
  redisConnected = true;
  logger.info('Redis client is ready');
});

redis.on('error', (err) => {
  redisConnected = false;
  logger.error('Redis error occurred', { error: err.message });
});

redis.on('close', () => {
  redisConnected = false;
  logger.warn('Redis connection closed');
});

// Middleware: CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware: Structured JSON Request Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });
  });
  next();
});

// --- Liveness Probe ---
// Returns 200 as long as the process is alive
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// --- Readiness Probe ---
// Returns 200 if Redis is reachable, 503 if Redis is down
app.get('/readyz', async (req, res) => {
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      return res.status(200).json({
        status: 'ready',
        redis: 'connected',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    }
    throw new Error(`Unexpected Redis ping response: ${pong}`);
  } catch (err) {
    logger.warn('Readiness probe failed', { error: err.message });
    return res.status(503).json({
      status: 'not_ready',
      redis: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// --- API: Info ---
// Returns configuration, pod hostname, version, theme color, etc.
app.get('/api/info', (req, res) => {
  res.status(200).json({
    version: APP_VERSION,
    hostname: os.hostname(),
    environment: APP_ENV,
    themeColor: THEME_COLOR,
    message: WELCOME_MESSAGE,
    timestamp: new Date().toISOString()
  });
});

// --- API: Visits ---
// Increments and returns the Redis counter
app.get('/api/visits', async (req, res) => {
  try {
    const visits = await redis.incr('gitops:visits');
    res.status(200).json({
      visits: parseInt(visits, 10),
      hostname: os.hostname(),
      version: APP_VERSION,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to increment visit counter in Redis', { error: err.message });
    res.status(503).json({
      error: 'Redis unavailable',
      message: err.message,
      hostname: os.hostname(),
      version: APP_VERSION,
      timestamp: new Date().toISOString()
    });
  }
});

// Start Server
const server = app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    version: APP_VERSION,
    env: APP_ENV,
    hostname: os.hostname(),
    themeColor: THEME_COLOR
  });
});

// Graceful Shutdown handling
let isShuttingDown = false;

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}, initiating graceful shutdown...`, { signal });

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed, closing Redis connection...');
    try {
      await redis.quit();
      logger.info('Redis connection closed successfully');
    } catch (err) {
      logger.error('Error closing Redis connection', { error: err.message });
    }
    logger.info('Graceful shutdown complete. Exiting.');
    process.exit(0);
  });

  // Force exit after 10 seconds if connections refuse to close
  setTimeout(() => {
    logger.error('Forced shutdown timeout exceeded, terminating process.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
