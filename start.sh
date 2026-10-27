#!/usr/bin/env bash
set -euo pipefail

# Runs as root just long enough to fix the volume and start nginx, then T3 and
# the pairing page run as the t3 user.
export HOME="${HOME:-/data/home}"
export WORKSPACE_DIR="${WORKSPACE_DIR:-/data/workspaces}"
PORT="${PORT:-8080}"

mkdir -p "$HOME" "$WORKSPACE_DIR"
[ -f "$HOME/.bashrc" ] || cp -an /etc/skel/. "$HOME/"
mkdir -p "$HOME/.config" "$HOME/.local/bin" "$HOME/.t3"
# The volume is root-owned on first boot (and on deploys from before the t3 user).
for d in "$HOME" "$WORKSPACE_DIR"; do
  [ "$(stat -c %u "$d")" = 1000 ] || chown -R t3:t3 "$d"
done

as_t3() {
  setpriv --reuid=1000 --regid=1000 --init-groups \
    env HOME="$HOME" USER=t3 LOGNAME=t3 SHELL=/bin/bash "$@"
}

# Password for /railway-pair. Set T3_SETUP_PASSWORD in Railway's Variables tab;
# deploys without it get one generated once and printed below.
if [ -z "${T3_SETUP_PASSWORD:-}" ]; then
  pw_file="$HOME/.config/railway-pair-password"
  [ -s "$pw_file" ] || { head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$pw_file"; chown t3:t3 "$pw_file"; chmod 600 "$pw_file"; }
  T3_SETUP_PASSWORD="$(cat "$pw_file")"
  echo "T3_SETUP_PASSWORD is not set; using generated password: $T3_SETUP_PASSWORD"
  echo "Set T3_SETUP_PASSWORD in the service's Variables to choose your own."
fi

# Optional keys, applied once so a login done in the app is never overwritten.
if [ -n "${OPENAI_API_KEY:-}" ] && ! as_t3 codex login status >/dev/null 2>&1; then
  printenv OPENAI_API_KEY | as_t3 codex login --with-api-key >/dev/null 2>&1 || echo "codex: API-key login failed"
fi
if [ -n "${GH_TOKEN:-}" ]; then
  as_t3 gh auth setup-git >/dev/null 2>&1 || true
fi

# nginx on $PORT: /railway-pair is the password-gated pairing page, everything
# else is T3, which authenticates every API call, WebSocket and terminal itself.
# A browser without T3's session cookie (t3_session_<hash>, or the legacy
# t3_session) opening / is sent to the pairing page instead of T3's sign-in.
cat > /etc/nginx/conf.d/t3.conf <<CFG
map \$http_cookie \$t3_has_session {
  default 0;
  "~(^|;)\\s*t3_session(_[0-9a-f]+)?=" 1;
}
server {
  listen ${PORT} default_server;
  listen [::]:${PORT} default_server;
  client_max_body_size 200m;
  # Relative Location headers: nginx would otherwise add its internal :${PORT}.
  absolute_redirect off;
  location = /healthcheck { proxy_pass http://127.0.0.1:3773/.well-known/t3/environment; }
  location ~ ^/railway-pair(/password\.jpg)?\$ {
    proxy_pass http://127.0.0.1:3774;
    proxy_set_header Host \$http_host;
  }
  location = / {
    if (\$t3_has_session = 0) { return 302 /railway-pair; }
    proxy_pass http://127.0.0.1:3773;
    proxy_set_header Host \$http_host;
  }
  location / {
    proxy_pass http://127.0.0.1:3773;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$http_connection;
    proxy_set_header Host \$http_host;
    proxy_buffering off;
    proxy_read_timeout 1d;
    proxy_send_timeout 1d;
  }
}
CFG
nginx

T3_SETUP_PASSWORD="$T3_SETUP_PASSWORD" as_t3 node /opt/railway-pair.mjs &
unset T3_SETUP_PASSWORD

# Railway counts the kernel's cache of files this container touched as its
# memory and never frees it without pressure (one npm install = hundreds of MB).
( while sleep 900; do nice -n 19 drop-file-cache /data /tmp || true; done ) &

cd "$WORKSPACE_DIR"

echo "Starting T3 Code $(t3 --version 2>/dev/null)"
echo "Workspace: $WORKSPACE_DIR"
echo "Pair a device at https://<your-domain>/railway-pair"

# `t3 serve` prints a one-time admin token + QR at boot. Pairing goes through
# /railway-pair instead, so keep the token out of the deploy logs.
exec setpriv --reuid=1000 --regid=1000 --init-groups \
  env HOME="$HOME" USER=t3 LOGNAME=t3 SHELL=/bin/bash \
  t3 serve --host 0.0.0.0 --port 3773 "$WORKSPACE_DIR" \
  > >(sed -u -e '/^Token: /d' -e 's/token=[^ "&]*/token=<redacted>/g' -e '/^[ █▀▄]*$/d') 2>&1
