{{/*
Component names are fixed (creditmate-*) to match the existing monitoring
rules, dashboards and Kustomize manifests they replace.
*/}}
{{- define "creditmate.apiName" -}}creditmate-backend{{- end -}}
{{- define "creditmate.frontendName" -}}creditmate-frontend{{- end -}}
{{- define "creditmate.workerName" -}}creditmate-celery-worker{{- end -}}
{{- define "creditmate.beatName" -}}creditmate-celery-beat{{- end -}}
{{- define "creditmate.postgresName" -}}creditmate-postgres{{- end -}}
{{- define "creditmate.redisName" -}}creditmate-redis{{- end -}}
{{- define "creditmate.configName" -}}creditmate-config{{- end -}}

{{- define "creditmate.dbHost" -}}
{{- if .Values.postgres.enabled -}}{{ include "creditmate.postgresName" . }}{{- else -}}{{ .Values.config.dbHost }}{{- end -}}
{{- end -}}
{{- define "creditmate.redisHost" -}}
{{- if .Values.redis.enabled -}}{{ include "creditmate.redisName" . }}{{- else -}}{{ .Values.config.redisHost }}{{- end -}}
{{- end -}}
{{- define "creditmate.backendSecretName" -}}
{{- if or .Values.secrets.create .Values.externalSecrets.enabled -}}creditmate-backend-secrets{{- else -}}{{ .Values.secrets.existingSecret }}{{- end -}}
{{- end -}}

{{- define "creditmate.labels" -}}
app.kubernetes.io/part-of: creditmate
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "creditmate.backendEnvFrom" -}}
envFrom:
  - configMapRef:
      name: {{ include "creditmate.configName" . }}
  - secretRef:
      name: {{ include "creditmate.backendSecretName" . }}
{{- end -}}

{{- define "creditmate.podSecurityContext" -}}
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  runAsGroup: 10001
  seccompProfile:
    type: RuntimeDefault
{{- end -}}

{{- define "creditmate.containerSecurityContext" -}}
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: ["ALL"]
{{- end -}}
