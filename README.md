# Deploy and Host T3 Code on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/t3-code?referralCode=UEjeDc&utm_medium=integration&utm_source=template&utm_campaign=generic)

This template is a simple docker file allowing you to host a t3 code instance publicly on railway. It will allow you to run your agents remotely and connect using a pairing link. Claude Code, Codex and OpenCode come preinstalled.

https://github.com/tpkowastaken/railway-t3-code

## About Hosting - Setup

1. Add this template
2. Once the application is deployed, copy **T3_SETUP_PASSWORD** from the service's Variables tab
3. Open the public link from railway with **/railway-pair** at the end (for example https://your-domain.up.railway.app/railway-pair). You need to click on the instance, settings and there it should be
4. Sign in with any username and that password, then click **Pair this browser**. For your phone, scan the QR code in the T3 Code app (Settings → Environments → Add). Reload the page for a new link for each device
5. After that press ctrl + j or cmd + j do 

```
codex login --device-auth
```

to login to the codex cli or

```
claude auth login
```

for claude.

You are free to setup other developer tools, mcps and connectors as you wish. I recommend using claude or codex to setup the other tools.

## Common Use Cases

- Going to work and then closing your laptop
- Using your phone to code
- It has browser preinstalled so that the agent can access and check itself even when you close the lid of your laptop

## Dependencies for T3 Code Hosting

- You will need to have an ai subscription that works with one of the providers supported with T3 code. Chatgpt or claude for example. OpenCode's free models work without one.

## Why Deploy T3 Code on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying T3 Code on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.

It's a one click setup for an ai agent where you own the data.

## Disclaimer

This is not affiliated with Theo and is very hobby-ish. You are welcomed to fork, expand and contribute.
