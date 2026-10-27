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
- No Docker daemon: the container is unprivileged.
