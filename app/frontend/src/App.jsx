import React, { useState, useEffect, useRef, useCallback } from 'react';

// Helper to convert hex color to RGB values for CSS rgba()
function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return '37, 99, 235';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

export default function App() {
  const [info, setInfo] = useState(null);
  const [visits, setVisits] = useState(null);
  const [health, setHealth] = useState({ healthy: false, loading: true, latency: 0, error: null });
  const [refreshInterval, setRefreshInterval] = useState(3000); // default 3 seconds
  const [autoIncrementVisits, setAutoIncrementVisits] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [flashHostname, setFlashHostname] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [seenPods, setSeenPods] = useState({}); // hostname -> { count, firstSeen, lastSeen }

  const prevHostnameRef = useRef(null);

  // Apply dynamic theme color to root CSS variables
  useEffect(() => {
    if (info?.themeColor) {
      document.documentElement.style.setProperty('--theme-color', info.themeColor);
      document.documentElement.style.setProperty('--theme-color-rgb', hexToRgb(info.themeColor));
    }
  }, [info?.themeColor]);

  const fetchData = useCallback(async (shouldIncrement = false) => {
    const startTime = performance.now();
    try {
      // 1. Fetch Backend Info
      const infoRes = await fetch('/api/info');
      if (!infoRes.ok) throw new Error(`HTTP ${infoRes.status} on /api/info`);
      const infoData = await infoRes.json();
      setInfo(infoData);

      // Check for hostname change during rolling deployment
      if (prevHostnameRef.current && prevHostnameRef.current !== infoData.hostname) {
        setFlashHostname(true);
        setTimeout(() => setFlashHostname(false), 1200);
      }
      prevHostnameRef.current = infoData.hostname;

      // Update seen pods history
      setSeenPods(prev => {
        const existing = prev[infoData.hostname] || { count: 0, firstSeen: new Date().toLocaleTimeString() };
        return {
          ...prev,
          [infoData.hostname]: {
            count: existing.count + 1,
            firstSeen: existing.firstSeen,
            lastSeen: new Date().toLocaleTimeString()
          }
        };
      });

      // 2. Fetch Readiness/Health Check
      const readyRes = await fetch('/readyz');
      const latency = Math.round(performance.now() - startTime);
      if (readyRes.ok) {
        setHealth({ healthy: true, loading: false, latency, error: null });
      } else {
        const errorData = await readyRes.json().catch(() => ({}));
        setHealth({
          healthy: false,
          loading: false,
          latency,
          error: errorData.error || `HTTP ${readyRes.status}`
        });
      }

      // 3. Fetch Visits (increment if requested or auto-increment enabled)
      if (shouldIncrement || autoIncrementVisits) {
        const visitRes = await fetch('/api/visits');
        if (visitRes.ok) {
          const visitData = await visitRes.json();
          setVisits(visitData.visits);
        }
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      const latency = Math.round(performance.now() - startTime);
      setHealth({
        healthy: false,
        loading: false,
        latency,
        error: err.message
      });
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [autoIncrementVisits]);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, []);

  // Polling Interval
  useEffect(() => {
    if (refreshInterval === 0) return;
    const timer = setInterval(() => {
      fetchData(false);
    }, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, fetchData]);

  const handleCopyHostname = () => {
    if (info?.hostname) {
      navigator.clipboard.writeText(info.hostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleIncrementVisit = async () => {
    try {
      const res = await fetch('/api/visits');
      if (res.ok) {
        const data = await res.json();
        setVisits(data.visits);
      }
    } catch (err) {
      console.error('Failed to increment visits:', err);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon">🐙</div>
          <div className="brand-title">
            <h1>GitOps Playground</h1>
            <p className="brand-subtitle">ArgoCD Multi-Tier Observability Demo</p>
          </div>
        </div>

        <div className="header-badges">
          {/* Version Badge */}
          <div className="badge badge-version" title="Configured via APP_VERSION">
            🚀 {info?.version || 'Loading...'}
          </div>

          {/* Environment Badge */}
          <div className="badge badge-env" title="Configured via APP_ENV">
            🌍 {info?.environment || 'unknown'}
          </div>

          {/* Health Status Indicator */}
          <div className={`badge-status ${health.healthy ? 'healthy' : 'unhealthy'}`}>
            <span className={`status-dot ${health.healthy ? 'healthy' : 'unhealthy'}`}></span>
            <span>
              {health.loading
                ? 'Connecting...'
                : health.healthy
                ? `Backend Ready (${health.latency}ms)`
                : `Backend Degraded (${health.error || 'Failed'})`}
            </span>
          </div>
        </div>
      </header>

      {/* Controls Bar */}
      <div className="controls-bar">
        <div className="refresh-control">
          <span>⚡ Auto-refresh:</span>
          <select
            className="refresh-select"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
          >
            <option value={1000}>Every 1s (Fast rollout view)</option>
            <option value={2000}>Every 2s</option>
            <option value={3000}>Every 3s (Default)</option>
            <option value={5000}>Every 5s</option>
            <option value={0}>Off (Manual only)</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', marginLeft: '0.5rem' }}>
            <input
              type="checkbox"
              checked={autoIncrementVisits}
              onChange={(e) => setAutoIncrementVisits(e.target.checked)}
            />
            <span>Auto-increment visits</span>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastUpdated && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Last sync: {lastUpdated}
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => fetchData(false)}>
            🔄 Refresh Now
          </button>
        </div>
      </div>

      {/* Welcome Message Banner */}
      <div className="welcome-banner">
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
            WELCOME_MESSAGE ConfigMap
          </div>
          <div className="welcome-banner-text">
            {info?.message || 'Loading message from backend...'}
          </div>
        </div>
        <div className="theme-preview">
          <span>THEME_COLOR:</span>
          <span className="theme-swatch" style={{ backgroundColor: info?.themeColor || '#2563eb' }}></span>
          <span>{info?.themeColor || '#2563eb'}</span>
        </div>
      </div>

      {/* Main Dashboard Cards */}
      <div className="dashboard-grid">
        {/* Pod Hostname Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Backend Pod Hostname</span>
            <span className="card-icon">☸️</span>
          </div>
          <div className={`hostname-display ${flashHostname ? 'flash' : ''}`}>
            <span className="hostname-text">{info?.hostname || 'Resolving...'}</span>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyHostname}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="card-subtitle">
            Updates instantly when traffic shifts across replica pods during a GitOps sync.
          </p>
        </div>

        {/* Redis Visit Counter Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Redis Visit Counter</span>
            <span className="card-icon">📊</span>
          </div>
          <div className="card-value">
            {visits !== null ? visits.toLocaleString() : '---'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
            <span className="card-subtitle">Persisted state in Redis tier</span>
            <button className="btn btn-primary btn-sm" onClick={handleIncrementVisit}>
              + Increment
            </button>
          </div>
        </div>

        {/* Health Check Details */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Probe Diagnostics</span>
            <span className="card-icon">🩺</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Liveness (/healthz):</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Active</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Readiness (/readyz):</span>
              <span style={{ color: health.healthy ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                {health.healthy ? 'Redis Connected' : 'Redis Down / Degraded'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Response Latency:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{health.latency} ms</span>
            </div>
          </div>
          <p className="card-subtitle">
            Used by Kubernetes probes and ArgoCD health assessment.
          </p>
        </div>
      </div>

      {/* Rollout Tracker: Active Pods Seen */}
      <div className="rollout-section">
        <div className="rollout-header">
          <div className="rollout-title">
            <span>🔄</span> Pod Load Balancing & Rollout Tracker
          </div>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            {Object.keys(seenPods).length} unique pod{Object.keys(seenPods).length === 1 ? '' : 's'} responding
          </span>
        </div>
        <div className="rollout-list">
          {Object.entries(seenPods).map(([podName, stats]) => {
            const isActive = podName === info?.hostname;
            return (
              <div key={podName} className={`rollout-item ${isActive ? 'active' : ''}`}>
                <div className="pod-tag">
                  <span>{isActive ? '👉' : '◽'}</span>
                  <span style={{ fontWeight: isActive ? 700 : 400 }}>{podName}</span>
                  {isActive && <span style={{ color: 'var(--theme-color)', fontSize: '0.75rem' }}>(current)</span>}
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    First seen: {stats.firstSeen}
                  </span>
                  <span className="pod-count">{stats.count} requests</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible Raw API Inspector */}
      <button className="json-toggle" onClick={() => setShowRawJson(!showRawJson)}>
        <span>{showRawJson ? '▼' : '▶'}</span>
        <span>Inspect Raw Backend API JSON Payload</span>
      </button>

      {showRawJson && (
        <pre className="json-panel">
          {JSON.stringify({ info, visits, healthCheck: health }, null, 2)}
        </pre>
      )}

      {/* Footer */}
      <footer className="footer">
        <p>GitOps Playground Demo App • Designed for ArgoCD, Kind, and EKS learning</p>
      </footer>
    </div>
  );
}
