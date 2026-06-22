#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/liqiang-0443/shijiebei.git}"
APP_DIR="${APP_DIR:-/opt/shijiebei}"
DATA_DIR="${DATA_DIR:-/data/shijiebei}"
PORT="${PORT:-80}"
IMAGE_NAME="${IMAGE_NAME:-shijiebei}"
CONTAINER_NAME="${CONTAINER_NAME:-shijiebei}"

log() {
  printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Please run as root, or use: sudo bash scripts/deploy-vps.sh"
    exit 1
  fi
}

install_packages() {
  if command -v git >/dev/null 2>&1 && command -v docker >/dev/null 2>&1; then
    return
  fi

  log "Installing required packages"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y git ca-certificates curl docker.io
    systemctl enable --now docker || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y git ca-certificates curl docker
    systemctl enable --now docker || true
  elif command -v yum >/dev/null 2>&1; then
    yum install -y git ca-certificates curl docker
    systemctl enable --now docker || true
  else
    echo "Unsupported Linux package manager. Please install git and docker first."
    exit 1
  fi
}

sync_code() {
  log "Syncing code to ${APP_DIR}"
  if [ -d "${APP_DIR}/.git" ]; then
    git -C "${APP_DIR}" fetch origin main
    git -C "${APP_DIR}" reset --hard origin/main
  else
    rm -rf "${APP_DIR}"
    git clone "${REPO_URL}" "${APP_DIR}"
  fi
}

build_and_run() {
  log "Preparing data dir ${DATA_DIR}"
  mkdir -p "${DATA_DIR}"

  log "Building Docker image ${IMAGE_NAME}"
  docker build -t "${IMAGE_NAME}" "${APP_DIR}"

  log "Restarting container ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    -p "${PORT}:4318" \
    -e PORT=4318 \
    -e DATA_DIR=/data \
    -e DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}" \
    -e DEEPSEEK_MODEL="${DEEPSEEK_MODEL:-deepseek-v4-pro}" \
    -v "${DATA_DIR}:/data" \
    "${IMAGE_NAME}"
}

trigger_analysis_after_deploy() {
  log "Triggering deployment analysis snapshot"
  for attempt in $(seq 1 20); do
    if docker exec "${CONTAINER_NAME}" wget -qO- --post-data='' http://127.0.0.1:4318/api/analysis/deploy >/dev/null 2>&1; then
      log "Analysis snapshot triggered"
      return
    fi
    sleep 1
  done
  log "Analysis trigger did not complete; the next scheduled analysis will retry"
}

print_result() {
  public_ip="$(curl -fsS --max-time 3 https://api.ipify.org || hostname -I | awk '{print $1}')"
  if [ "${PORT}" = "80" ]; then
    front_url="http://${public_ip}/"
  else
    front_url="http://${public_ip}:${PORT}/"
  fi
  log "Deployment complete"
  echo "Front: ${front_url}"
  echo "Data dir: ${DATA_DIR}"
  echo
  echo "Useful commands:"
  echo "  docker logs -f ${CONTAINER_NAME}"
  echo "  docker restart ${CONTAINER_NAME}"
}

require_root
install_packages
sync_code
build_and_run
trigger_analysis_after_deploy
print_result
