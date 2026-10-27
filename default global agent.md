# This machine: T3 Code container on Railway

You run as user `t3` (passwordless `sudo`) in a Railway container. **Only `/data` persists.** Every restart and redeploy rebuilds everything else from the image: `/usr`, `/etc`, `/opt`, `/tmp`, and all `apt` state.

- `$HOME` is `/data/home` and projects are in `/data/workspaces`. Keep anything that matters there.
- Install tools into `$HOME` so they persist. `~/.local/bin`, `~/.cargo/bin`, `~/go/bin` and `~/.bun/bin` are already on `PATH`:
  - Python CLIs: `uv tool install <pkg>`. Project deps: `uv` or a venv. System `pip install` is blocked (PEP 668).
  - npm CLIs: `npm install -g --prefix ~/.local <pkg>`. A plain `npm install -g` goes to `/opt/npm` and is lost.
  - Other runtimes and tools: use their `$HOME` installers (rustup, `go install`, bun, deno, or a binary dropped into `~/.local/bin`).
- System (apt) packages: `apt-persist install <pkg>...`. It installs now and reinstalls on every boot. Also `apt-persist remove <pkg>...` and `apt-persist list`. A plain `sudo apt-get install` is lost on restart.
- System config outside `$HOME` (an apt repo and its key, files in `/etc`, ...): add the commands to `/data/system/boot.sh`, which runs as root on every boot before the apt packages are restored, and then run it once with `sudo bash /data/system/boot.sh`.
- After a restart the restore runs in the background. If a persisted package is missing, check `/data/system/restore.log`.
- Do not install or update Claude Code, Codex or OpenCode yourself. They are pinned in the image.

## Docker (remote)

There is no local Docker daemon here: the container is unprivileged. If `DOCKER_HOST` is set, `docker` and `docker compose` run on a remote Docker host over SSH. If it's unset there's no Docker at all. Then use `apt-persist` (e.g. `postgresql`, `redis-server`) or a hosted service.

- **Ports:** every port a container publishes (`-p`, compose `ports:`, `-P`) is forwarded to `127.0.0.1:<same port>` here within a few seconds, and dropped when the container stops. Use `127.0.0.1`, not the Docker host's IP. Exceptions:
  - 8080, 3773 and 3774 are taken by this container and are never forwarded. Publish on another port.
  - A port something here already listens on isn't forwarded. Stop the local process or publish on another port.
  - `docker-forward list` shows what's forwarded. `docker-forward add PORT[:HOST_PORT]` forwards something that isn't a published container port.
- **Containers calling back into this container** (your dev server, webhooks, a browser in a container testing your app): run `docker-forward reverse <port>`, then use `http://host.docker.internal:<port>` from the container. On Linux the container needs `--add-host=host.docker.internal:host-gateway` (compose: `extra_hosts: ["host.docker.internal:host-gateway"]`). `localhost` inside a container is that container itself.
- **Files:** bind mounts (`-v ./src:/app`, compose `volumes: - ./x:/y`) mount the Docker host's disk, not files here, so they show up empty or wrong without any error. Instead:
  - `COPY` into the image and rebuild.
  - Use named volumes and `docker cp`.
  - Pipe data in (`docker exec -i ... < file`).
  - Tools that mount your code break the same way, e.g. `supabase functions serve` and dev containers that mount the repo for hot reload.
- **Builds:** `docker build` uploads the build context over SSH. Keep a `.dockerignore` (`node_modules`, `.git`, build output) or builds get slow.
- **Shared and persistent:** the Docker host is shared by every agent and thread, and keeps running across restarts of this container.
  - Run `docker ps` before starting things: reuse a stack that's already running instead of starting a second copy that fights over the same ports.
  - Use distinct compose project names (`-p`) for parallel copies.
  - Clean up what you started (`docker compose down`, `docker rm`). Never prune or stop containers you didn't start.
- **Host networking:** `network_mode: host` and `--network host` refer to the Docker host's network, not this container's.
- **Testcontainers:** `TESTCONTAINERS_HOST_OVERRIDE=127.0.0.1` is set, so published ports resolve through the forwards. Libraries that don't support an `ssh://` `DOCKER_HOST` (e.g. testcontainers-java) won't connect.
- **Supabase:** `supabase start` works, and its URLs (`127.0.0.1:54321` API, `:54322` DB, `:54323` Studio, `:54324` Mailpit) work here as printed. `supabase functions serve` doesn't (see Files). Test edge functions against a hosted project.
