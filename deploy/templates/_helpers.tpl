{{/*
Expand the name of the chart.
*/}}
{{- define "gitops-playground.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "gitops-playground.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label
*/}}
{{- define "gitops-playground.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "gitops-playground.labels" -}}
helm.sh/chart: {{ include "gitops-playground.chart" . }}
{{ include "gitops-playground.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "gitops-playground.selectorLabels" -}}
app.kubernetes.io/name: {{ include "gitops-playground.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "gitops-playground.backendSelectorLabels" -}}
{{ include "gitops-playground.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "gitops-playground.frontendSelectorLabels" -}}
{{ include "gitops-playground.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Redis selector labels
*/}}
{{- define "gitops-playground.redisSelectorLabels" -}}
{{ include "gitops-playground.selectorLabels" . }}
app.kubernetes.io/component: redis
{{- end }}
