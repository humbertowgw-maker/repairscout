#!/bin/zsh
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
config_file="$HOME/Library/Application Support/RepairScout/worker.env"
if [[ ! -r "$config_file" ]]; then
  echo "Missing private worker configuration: $config_file" >&2
  exit 1
fi
source "$config_file"
export LOCAL_WORKER_TOKEN
export REPAIRSCOUT_API_URL="${REPAIRSCOUT_API_URL:-https://repairscout-smoky.vercel.app}"
export REPAIRSCOUT_WORKER_ID="${REPAIRSCOUT_WORKER_ID:-$(/usr/sbin/scutil --get LocalHostName 2>/dev/null || /bin/hostname)-repairscout}"
export OLLAMA_DIAGNOSIS_URL="${OLLAMA_DIAGNOSIS_URL:-http://127.0.0.1:11434}"
export OLLAMA_DIAGNOSIS_MODEL="${OLLAMA_DIAGNOSIS_MODEL:-qwen2.5:7b}"
export BRAINOS_HEALTH_URL="${BRAINOS_HEALTH_URL:-http://127.0.0.1:8000/api/health}"

cd "$repo_dir"
exec /opt/homebrew/bin/node scripts/local-diagnosis-worker.mjs
