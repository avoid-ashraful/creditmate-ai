#!/usr/bin/env bash
# CreditMate local cluster bootstrap: k3d + platform components, all pinned.
#
#   scripts/cluster-up.sh              # cluster + platform components
#   scripts/cluster-up.sh --with-app   # …and install the creditmate chart (local values)
#   scripts/cluster-up.sh --down       # delete the cluster
#
# Prerequisites: docker, k3d, kubectl, helm (pinned local copies in
# ~/workspace/tools are picked up automatically when present there).
# The chart itself is cluster-agnostic; kind works too if you create the
# cluster yourself and run only the platform installs (SKIP_CLUSTER=1).
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-creditmate}"
NAMESPACE="${NAMESPACE:-creditmate}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Pinned tool / chart versions (bump deliberately, in one commit).
K3D_VERSION="v5.7.5"
INGRESS_NGINX_CHART="4.11.3"        # ingress-nginx/ingress-nginx
CERT_MANAGER_VERSION="v1.16.2"      # cert-manager chart version
METRICS_SERVER_CHART="3.12.2"       # metrics-server/metrics-server
KEDA_CHART="2.16.1"                 # kedacore/keda
KUBE_PROM_STACK_CHART="66.3.1"      # prometheus-community/kube-prometheus-stack

for tool in helm kubectl; do
  if ! command -v "$tool" >/dev/null 2>&1 && [ -x "$HOME/workspace/tools/$tool" ]; then
    export PATH="$HOME/workspace/tools:$PATH"
  fi
done
command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
command -v helm >/dev/null || { echo "helm is required (see ~/workspace/tools)" >&2; exit 1; }
command -v kubectl >/dev/null || { echo "kubectl is required" >&2; exit 1; }

if [ "${1:-}" = "--down" ]; then
  k3d cluster delete "$CLUSTER_NAME"
  exit 0
fi

# --- Cluster ---------------------------------------------------------------
if [ "${SKIP_CLUSTER:-0}" != "1" ]; then
  command -v k3d >/dev/null || { echo "k3d $K3D_VERSION is required (or set SKIP_CLUSTER=1 with your own cluster)" >&2; exit 1; }
  if ! k3d cluster list | grep -q "^${CLUSTER_NAME} "; then
    # Traefik disabled: ingress-nginx is the ingress, matching staging/prod.
    k3d cluster create "$CLUSTER_NAME" \
      --k3s-arg "--disable=traefik@server:0" \
      -p "80:80@loadbalancer" -p "443:443@loadbalancer" \
      --agents 1
  fi
fi
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# --- Platform components ----------------------------------------------------
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null
helm repo add jetstack https://charts.jetstack.io >/dev/null
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null
helm repo add kedacore https://kedacore.github.io/charts >/dev/null
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null
helm repo update >/dev/null

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace --version "$INGRESS_NGINX_CHART" --wait

helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace --version "$CERT_MANAGER_VERSION" \
  --set crds.enabled=true --wait

helm upgrade --install metrics-server metrics-server/metrics-server \
  --namespace kube-system --version "$METRICS_SERVER_CHART" \
  --set args="{--kubelet-insecure-tls}" --wait   # k3d kubelet certs are self-signed

helm upgrade --install keda kedacore/keda \
  --namespace keda --create-namespace --version "$KEDA_CHART" --wait

helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace --version "$KUBE_PROM_STACK_CHART" \
  --set grafana.sidecar.dashboards.enabled=true \
  --set grafana.sidecar.dashboards.label=grafana_dashboard \
  --set grafana.sidecar.dashboards.labelValue="1" \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.ruleSelectorNilUsesHelmValues=false \
  --wait

# --- Local TLS issuers (self-signed CA; staging/prod use letsencrypt-prod) --
kubectl apply -f - <<'EOF'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: creditmate-selfsigned
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: creditmate-ca
  namespace: cert-manager
spec:
  isCA: true
  commonName: creditmate-local-ca
  secretName: creditmate-ca-secret
  issuerRef: { name: creditmate-selfsigned, kind: ClusterIssuer }
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: creditmate-ca-issuer
spec:
  ca:
    secretName: creditmate-ca-secret
EOF

echo "Platform ready. Add '127.0.0.1 creditmate.localhost' to /etc/hosts."

# --- App (optional) ----------------------------------------------------------
if [ "${1:-}" = "--with-app" ]; then
  # Local images: build BE/FE and import them into k3d (no push needed):
  #   docker build -t ghcr.io/avoid-ashraful/creditmate-ai-be:local creditmate-ai-be
  #   docker build -t ghcr.io/avoid-ashraful/creditmate-ai-fe:local creditmate-ai-fe   (see chart README FE note)
  #   k3d image import ghcr.io/avoid-ashraful/creditmate-ai-be:local ghcr.io/avoid-ashraful/creditmate-ai-fe:local -c "$CLUSTER_NAME"
  helm upgrade --install creditmate "$REPO_ROOT/charts/creditmate" \
    --namespace "$NAMESPACE" \
    -f "$REPO_ROOT/charts/creditmate/values-local.yaml" \
    ${CREDITMATE_LOCAL_SECRETS:+ -f "$CREDITMATE_LOCAL_SECRETS"} \
    --wait --timeout 10m
  echo "App installed: https://creditmate.localhost"
fi
