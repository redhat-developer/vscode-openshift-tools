#!/bin/bash
#-------------------------------------------------------------------------------------------------
#  Local CI runner: executes the act-tailored CI workflow (Linux leg) inside a
#  container, mirroring the GitHub Actions CI run against the host's rootless
#  podman. Everything HOME-related lives inside the ephemeral job container;
#  the repo is the shared workspace and test artifacts land in test-resources/
#  and build/act/artifacts/ on the host.
#
#  Usage:   build/act/run-ci.sh          (from anywhere; resolves the repo root)
#
#  Prerequisites (checked below):
#   - act in PATH (https://github.com/nektos/act)
#   - rootless podman (the job's containers, kind nodes included, run on it)
#-------------------------------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SOCKET="$ROOT/build/act/podman-docker.sock"
SERVICE_PID_FILE="$ROOT/build/act/podman-service.pid"
LOG_DIR="$ROOT/build/act/artifacts"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/act-$(date +%Y%m%d-%H%M%S).log"

command -v act >/dev/null || { echo "act is not installed (see https://github.com/nektos/act)"; exit 1; }

# 2. fail fast on the inotify instance limit: the kind node's systemd needs
#    cgroup inotify watches, and the per-user budget (kernel default 128) is
#    often exhausted by the desktop session alone
INOTIFY_LIMIT=$(cat /proc/sys/fs/inotify/max_user_instances)
if [ "$INOTIFY_LIMIT" -lt 512 ]; then
    INOTIFY_USAGE=$(find /proc/[0-9]*/fd -lname 'anon_inode:inotify' 2>/dev/null | wc -l)
    echo "WARNING: fs.inotify.max_user_instances=$INOTIFY_LIMIT, currently ~$INOTIFY_USAGE in use."
    echo "         The kind node's systemd may fail with 'Too many open files'."
    echo "         Fix (one-time, needs sudo):"
    echo "           sudo sysctl fs.inotify.max_user_instances=1024"
    echo "           echo fs.inotify.max_user_instances=1024 | sudo tee /etc/sysctl.d/99-inotify.conf"
    if [ "$INOTIFY_USAGE" -ge "$INOTIFY_LIMIT" ]; then
        echo "ERROR: inotify instance budget already exhausted; aborting." >&2
        exit 1
    fi
fi

# 1. dedicated docker-compatible podman service, started with the act-specific
#    containers override: containers created through it (the act job container,
#    kind nodes) run without SELinux confinement so they can connect back to
#    this socket — matching the no-SELinux environment of GitHub-hosted runners
if [ -f "$SERVICE_PID_FILE" ]; then
    kill "$(cat "$SERVICE_PID_FILE")" 2>/dev/null || true
    rm -f "$SERVICE_PID_FILE"
fi
rm -f "$SOCKET"

# setsid detaches the service into its own session: it must survive the
# termination of the shell/process group that launched it
CONTAINERS_CONF_OVERRIDE="$ROOT/build/act/containers.conf" \
    setsid nohup podman system service --time=0 "unix://$SOCKET" >/dev/null 2>&1 &
echo $! > "$SERVICE_PID_FILE"

for _ in $(seq 1 30); do
    if curl -s --unix-socket "$SOCKET" http://localhost/_ping >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done
if ! curl -s --unix-socket "$SOCKET" http://localhost/_ping >/dev/null 2>&1; then
    echo "ERROR: podman system service did not come up on $SOCKET" >&2
    exit 1
fi

# 2. SELinux: the job container needs read/write access to the bind-mounted
#    repo. act cannot pass :Z on its bind mount, so the repo is labeled for
#    container access (idempotent). Revert at any time with: restorecon -R .
if command -v getenforce >/dev/null && [ "$(getenforce)" = "Enforcing" ]; then
    echo "SELinux is Enforcing: labeling the repo tree as container_file_t"
    chcon -Rt container_file_t "$ROOT"
fi

# 3. regenerate the workflow if the real one changed after the last generation
node "$ROOT/build/act/generate.js"

# the "Prepare UI Tests" step patches package.json in the shared workspace
# (and its npm install rewrites package-lock.json); restore them afterwards —
# also when act exits non-zero, hence the EXIT trap
restore_workspace_files() {
    if ! git diff --quiet -- package.json package-lock.json 2>/dev/null; then
        echo "Restoring package.json/package-lock.json (patched by the run)"
        git checkout -- package.json package-lock.json
    fi
    # purge artifacts left with unmapped (container subuid) owners: they are
    # regenerable build outputs, and the host user cannot overwrite them
    find out test-resources .nyc_output .vscode-test -nouser -delete 2>/dev/null || true
}
trap restore_workspace_files EXIT
# make Ctrl-C / kill run the EXIT trap (restore + purge) instead of dying silently
trap 'exit 130' INT TERM

# 4. run the Linux leg of the CI workflow; tee everything to a host-side log
echo "Running act (log: $LOG)"
set -o pipefail
DOCKER_HOST="unix://$SOCKET" act push \
    -W "$ROOT/build/act/continuous-integration-workflow.act.yml" \
    -P ubuntu-latest=catthehacker/ubuntu:act-latest \
    --matrix os:ubuntu-latest \
    --container-daemon-socket "unix://$SOCKET" \
    --bind \
    --rm \
    2>&1 | tee "$LOG"

echo "Done. Test artifacts: test-resources/ (extest) and build/act/artifacts/ (run logs)"
