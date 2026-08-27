#!/bin/zsh
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
label="com.repairscout.local-diagnosis-worker"
plist_path="$HOME/Library/LaunchAgents/${label}.plist"
log_dir="$HOME/Library/Logs/RepairScout"
config_dir="$HOME/Library/Application Support/RepairScout"
config_file="$config_dir/worker.env"

if [[ -z "${LOCAL_WORKER_TOKEN:-}" ]]; then
  if [[ -r "$config_file" ]]; then
    source "$config_file"
  else
    read -r -s "LOCAL_WORKER_TOKEN?Paste the RepairScout local worker token: "
    echo
  fi
fi
if [[ ${#LOCAL_WORKER_TOKEN} -lt 24 ]]; then
  echo "Worker token must contain at least 24 characters." >&2
  exit 1
fi

/bin/mkdir -p "$HOME/Library/LaunchAgents" "$log_dir" "$config_dir"
/usr/bin/printf 'LOCAL_WORKER_TOKEN=%s\n' "$LOCAL_WORKER_TOKEN" > "$config_file"
/bin/chmod 600 "$config_file"

/usr/bin/python3 - "$plist_path" "$repo_dir" "$log_dir" <<'PY'
import plistlib, sys
path, repo, logs = sys.argv[1:]
payload = {
    "Label": "com.repairscout.local-diagnosis-worker",
    "ProgramArguments": [f"{repo}/scripts/run-local-diagnosis-worker.sh"],
    "RunAtLoad": True,
    "KeepAlive": True,
    "ThrottleInterval": 10,
    "StandardOutPath": f"{logs}/local-worker.log",
    "StandardErrorPath": f"{logs}/local-worker-error.log",
}
with open(path, "wb") as handle:
    plistlib.dump(payload, handle)
PY

/bin/chmod 644 "$plist_path"
/bin/chmod +x "$repo_dir/scripts/run-local-diagnosis-worker.sh"
/bin/launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
/bin/launchctl bootstrap "gui/$(id -u)" "$plist_path"
/bin/launchctl kickstart -k "gui/$(id -u)/$label"
/usr/bin/plutil -lint "$plist_path"
echo "RepairScout local diagnosis worker installed and running quietly."
