# Host T3 code on railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/t3-code?referralCode=UEjeDc&utm_medium=integration&utm_source=template&utm_campaign=generic)

# Setup

1. Click the button above to deploy the application to Railway.
2. Once the application is deployed you will need to get the connection token. You will find that in deploy logs of the latest deployment. On migrations to a different location, you will need to redeploy
3. Open The public link from railway. You need to click on the instance, settings and there it should be
4. Once you open the public url set by Railway, you will need to put this token there. 
5. After that press ctrl + j or cmd + j do `codex login --device-auth` to login to the codex cli.

## Browser

Agents can use T3 Code's built-in browser (the `preview_*` tools): it runs headless on the server and streams into the T3 UI. The image ships the system libraries it needs; T3 downloads the browser itself (~120 MB, into `~/.t3` on the volume) the first time an agent opens a page, so that first call may ask to retry after a minute.

You are free to setup other developer tools, mcps and connectors as you wish.
