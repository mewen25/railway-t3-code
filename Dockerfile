FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/data/home
ENV WORKSPACE_DIR=/data/workspaces
# Railway runs the container as root. Claude Code refuses
# --dangerously-skip-permissions as root unless it is told it is sandboxed.
ENV IS_SANDBOX=1
# T3's built-in headless browser: Chrome won't start its sandbox as root,
# so run it unsandboxed (the container is the isolation boundary).
ENV T3CODE_SERVER_BROWSER_SANDBOX=0

# libnss3..fonts-*: libraries and fonts for T3's built-in headless browser
# (chrome-headless-shell, which T3 downloads into ~/.t3 on first use).
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    curl \
    ca-certificates \
    bash \
    tini \
    build-essential \
    python3 \
    libnss3 \
    libglib2.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libdbus-1-3 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    libexpat1 \
    fonts-liberation \
    fonts-noto-color-emoji \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Codex CLI and T3 Code.
RUN npm install --global \
    @openai/codex@latest \
    t3@latest

COPY start.sh /usr/local/bin/start-t3
RUN chmod +x /usr/local/bin/start-t3

WORKDIR /data/workspaces

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/start-t3"]