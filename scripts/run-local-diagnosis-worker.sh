#!/bin/zsh
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
export LOCAL_WORKER_TOKEN="$(/usr/bin/security find-generic-password -a "$USER" -s com.repairscout.local-worker -w)"
export REPAIRSCOUT_API_URL="${REPAIRSCOUT_API_URL:-https://repairscout-smoky.vercel.app}"
export REPAIRSCOUT_WORKER_ID="${REPAIRSCOUT_WORKER_ID:-$(/usr/sbin/scutil --get LocalHostName 2>/dev/null || /bin/hostname)-repairscout}"
export OLLAMA_DIAGNOSIS_URL="${OLLAMA_DIAGNOSIS_URL:-http://127.0.0.1:11434}"
export OLLAMA_DIAGNOSIS_MODEL="${OLLAMA_DIAGNOSIS_MODEL:-qwen2.5:7b}"
export BRAINOS_HEALTH_URL="${BRAINOS_HEALTH_URL:-http://127.0.0.1:8000/api/health}"

cd "$repo_dir"
exec /opt/homebrew/bin/node scripts/local-diagnosis-worker.mjs
