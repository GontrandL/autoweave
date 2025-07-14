{{/*
Expand the name of the chart.
*/}}
{{- define "grafana-stack.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "grafana-stack.fullname" -}}
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
Create chart name and version as used by the chart label.
*/}}
{{- define "grafana-stack.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "grafana-stack.labels" -}}
helm.sh/chart: {{ include "grafana-stack.chart" . }}
{{ include "grafana-stack.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: observability
app.kubernetes.io/part-of: autoweave
{{- end }}

{{/*
Selector labels
*/}}
{{- define "grafana-stack.selectorLabels" -}}
app.kubernetes.io/name: {{ include "grafana-stack.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "grafana-stack.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "grafana-stack.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Common annotations
*/}}
{{- define "grafana-stack.annotations" -}}
meta.helm.sh/release-name: {{ .Release.Name }}
meta.helm.sh/release-namespace: {{ .Release.Namespace }}
{{- end }}

{{/*
Tenant-specific labels
*/}}
{{- define "grafana-stack.tenantLabels" -}}
autoweave.com/tenant-id: {{ .Values.global.tenantId | default "default" }}
autoweave.com/environment: {{ .Values.global.environment | default "development" }}
{{- end }}

{{/*
Security context
*/}}
{{- define "grafana-stack.securityContext" -}}
{{- if .Values.global.security.enabled }}
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  capabilities:
    drop:
      - ALL
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
{{- end }}
{{- end }}

{{/*
Resource limits
*/}}
{{- define "grafana-stack.resources" -}}
{{- if .Values.global.resources }}
resources:
  {{- toYaml .Values.global.resources | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Storage class
*/}}
{{- define "grafana-stack.storageClass" -}}
{{- if .Values.global.storage.storageClass }}
storageClassName: {{ .Values.global.storage.storageClass }}
{{- end }}
{{- end }}

{{/*
Ingress TLS configuration
*/}}
{{- define "grafana-stack.ingressTLS" -}}
{{- if .Values.global.ingress.tls }}
tls:
  {{- range .Values.global.ingress.tls }}
  - hosts:
      {{- range .hosts }}
      - {{ . | quote }}
      {{- end }}
    secretName: {{ .secretName }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Network policy selector
*/}}
{{- define "grafana-stack.networkPolicySelector" -}}
{{- if .Values.networkPolicy.enabled }}
podSelector:
  matchLabels:
    {{- include "grafana-stack.selectorLabels" . | nindent 4 }}
{{- end }}
{{- end }}

{{/*
Service monitor labels
*/}}
{{- define "grafana-stack.serviceMonitorLabels" -}}
{{- if .Values.serviceMonitor.enabled }}
{{- range $key, $value := .Values.serviceMonitor.labels }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Alerting rules namespace
*/}}
{{- define "grafana-stack.alertingNamespace" -}}
{{- .Release.Namespace }}
{{- end }}

{{/*
Validate configuration
*/}}
{{- define "grafana-stack.validateConfig" -}}
{{- if not .Values.global.tenantId }}
{{- fail "global.tenantId is required" }}
{{- end }}
{{- if not .Values.global.environment }}
{{- fail "global.environment is required" }}
{{- end }}
{{- end }}

{{/*
Retention period helper
*/}}
{{- define "grafana-stack.retentionPeriod" -}}
{{- if eq .Values.global.environment "production" }}
{{- "168h" }}
{{- else }}
{{- "72h" }}
{{- end }}
{{- end }}

{{/*
Sampling rate helper
*/}}
{{- define "grafana-stack.samplingRate" -}}
{{- if eq .Values.global.environment "production" }}
{{- "0.1" }}
{{- else }}
{{- "1.0" }}
{{- end }}
{{- end }}

{{/*
Database URL helper
*/}}
{{- define "grafana-stack.databaseURL" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "postgres://%s:%s@%s-postgresql:5432/%s?sslmode=disable" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "grafana-stack.fullname" .) .Values.postgresql.auth.database }}
{{- else }}
{{- .Values.grafana.database.url }}
{{- end }}
{{- end }}

{{/*
Redis URL helper
*/}}
{{- define "grafana-stack.redisURL" -}}
{{- if .Values.redis.enabled }}
{{- printf "redis://:%s@%s-redis-master:6379/0" .Values.redis.auth.password (include "grafana-stack.fullname" .) }}
{{- else }}
{{- .Values.global.redis.url }}
{{- end }}
{{- end }}