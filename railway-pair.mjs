// Pairing page at /railway-pair. After signing in with T3_SETUP_PASSWORD, it
// mints a one-time T3 pairing link with a QR code, so nobody has to copy a
// token out of the deploy logs. nginx sends everything else straight to T3,
// which authenticates the API, WebSocket and terminals.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

// Screenshot of where T3_SETUP_PASSWORD is, shown on the sign-in page.
const passwordImage = readFileSync(new URL("./railway-pair-password.jpg", import.meta.url));

const sha256 = (s) => createHash("sha256").update(s).digest();
const expected = sha256(process.env.T3_SETUP_PASSWORD ?? "");
if (!process.env.T3_SETUP_PASSWORD) throw new Error("T3_SETUP_PASSWORD is required");
// start.sh generated the password because the variable isn't set in Railway.
const generated = process.env.T3_SETUP_PASSWORD_GENERATED === "1";

// Signing in sets a short-lived cookie so reloading the page mints a new link
// without asking again. The key is per process: a restart signs everyone out.
const COOKIE = "railway_pair";
const SESSION_MS = 15 * 60_000;
const key = randomBytes(32);
const sign = (expires) => createHmac("sha256", key).update(String(expires)).digest("base64url");
const newSession = () => {
  const expires = Date.now() + SESSION_MS;
  return `${expires}.${sign(expires)}`;
};
const validSession = (cookieHeader = "") => {
  const value = cookieHeader.match(new RegExp(`(?:^|;)\\s*${COOKIE}=([^;]*)`))?.[1] ?? "";
  const [expires, mac = ""] = value.split(".");
  if (!(Number(expires) > Date.now())) return false;
  const want = Buffer.from(sign(expires));
  const got = Buffer.from(mac);
  return got.length === want.length && timingSafeEqual(got, want);
};

const run = (cmd, args) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: 30_000 }, (err, stdout) => (err ? reject(err) : resolve(stdout))),
  );
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4096) reject(new Error("body too large")), req.destroy();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const layout = (title, body) => `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #111; background: #fff }
  a { color: #7c3aed; font-weight: 600; text-underline-offset: .2em }
  a.button, button { display: inline-block; padding: .7rem 1.2rem; background: #111; color: #fff; border: 0; border-radius: .5rem; font: inherit; text-decoration: none; cursor: pointer }
  input { font: inherit; padding: .6rem .8rem; border: 1px solid #999; border-radius: .5rem; width: 100%; max-width: 22rem; box-sizing: border-box; background: inherit; color: inherit }
  code { word-break: break-all; background: #f2f2f2; padding: .2rem .4rem; border-radius: .3rem }
  ol li { margin: .3rem 0 }
  img { width: 100%; height: auto; border-radius: .5rem; border: 1px solid #8884 }
  .error { color: #b00020; font-weight: 600 }
  .muted { opacity: .75 }
  svg { width: 16rem; height: auto }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #eee } a.button, button { background: #eee; color: #111 }
    a { color: #c4b5fd } code { background: #222 } .error { color: #ff6b81 }
  }
</style>
${body}`;

const passwordForm = (error) => `${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
<form method="post" action="/railway-pair">
  <p><label for="password"><b>Setup password</b></label><br>
  <input id="password" name="password" type="password" autocomplete="current-password" autofocus required></p>
  <p><button type="submit">Continue</button></p>
</form>`;

const variablesImage = `<p><img src="/railway-pair/password.jpg" width="1200" height="407"
  alt="Railway project canvas with the railway-t3-code service selected, its Variables tab open, and the copy icon next to T3_SETUP_PASSWORD"></p>`;

const loginPage = (error) =>
  layout(
    "Sign in to pair with T3 Code",
    `<h1>Pair a device with T3 Code</h1>
<p>This browser isn't connected to this T3 Code server yet. Enter the setup password to get a pairing link.</p>
${passwordForm(error)}
<h2>Where do I find the password?</h2>
<ol>
  <li>Open your project on <a href="https://railway.com/dashboard" target="_blank" rel="noopener">railway.com</a>.</li>
  <li>Click the T3 Code service on the canvas (named <b>railway-t3-code</b> unless you renamed it).</li>
  <li>Open the <b>Variables</b> tab.</li>
  <li>Find <code>T3_SETUP_PASSWORD</code> and click the copy icon next to it (or the eye icon to show it).</li>
  <li>Paste it above.</li>
</ol>
${variablesImage}`,
  );

const setPasswordPage = (error) =>
  layout(
    "Set a setup password for T3 Code",
    `<h1>Set a setup password first</h1>
<p>The <code>T3_SETUP_PASSWORD</code> variable isn't set on this Railway service, so the server is using a password
it generated itself. Set your own to pair devices with this T3 Code server:</p>
<ol>
  <li>Open your project on <a href="https://railway.com/dashboard" target="_blank" rel="noopener">railway.com</a>.</li>
  <li>Click the T3 Code service on the canvas (named <b>railway-t3-code</b> unless you renamed it).</li>
  <li>Open the <b>Variables</b> tab and click <b>New Variable</b>.</li>
  <li>Name it <code>T3_SETUP_PASSWORD</code>, enter a long password as the value and click <b>Add</b>.</li>
  <li>Click <b>Deploy</b> to apply the change. Once the service is back online, reload this page and sign in with that password.</li>
</ol>
${variablesImage}
<details${error ? " open" : ""}>
  <summary>Use the generated password instead</summary>
  <p>Open the service's <b>Deployments</b> tab, view the latest deployment's logs and copy the password from the line
  <code>T3_SETUP_PASSWORD is not set; using generated password: &hellip;</code></p>
  ${passwordForm(error)}
</details>`,
  );

const signInPage = generated ? setPasswordPage : loginPage;
const wrongPassword = generated
  ? "That password isn't right. Copy it again from the deploy logs."
  : "That password isn't right. Copy it again from the Variables tab.";

const pairPage = (link, qrSvg) =>
  layout(
    "Pair with T3 Code",
    `<h1>Pair a device with T3 Code</h1>
<p>This link works for <b>one</b> device and expires in 15 minutes. Reload the page for a new one.</p>
<p><a class="button" href="${escapeHtml(link)}">Pair this browser</a></p>
<p><b>Phone (T3 Code app):</b> Settings &rarr; Environments &rarr; Add, then scan:</p>
${qrSvg}
<p><b>Desktop app or app.t3.codes:</b> Settings &rarr; Connections &rarr; Add environment, and paste:</p>
<p><code>${escapeHtml(link)}</code></p>
<p>Treat this link like a password.</p>`,
  );

const html = (res, status, body, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    ...headers,
  });
  res.end(body);
};

createServer(async (req, res) => {
  const proto = (req.headers["x-forwarded-proto"] ?? "http").split(",")[0].trim();

  if (req.url === "/railway-pair/password.jpg") {
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" });
    return res.end(passwordImage);
  }

  if (req.method === "POST") {
    let password = "";
    try {
      password = new URLSearchParams(await readBody(req)).get("password") ?? "";
    } catch {
      return html(res, 400, signInPage("Something went wrong, please try again."));
    }
    if (!timingSafeEqual(sha256(password), expected)) {
      await sleep(1000);
      return html(res, 401, signInPage(wrongPassword));
    }
    const secure = proto === "https" ? "; Secure" : "";
    res.writeHead(303, {
      Location: "/railway-pair",
      "Set-Cookie": `${COOKIE}=${newSession()}; Path=/railway-pair; Max-Age=${SESSION_MS / 1000}; HttpOnly; SameSite=Strict${secure}`,
      "Cache-Control": "no-store",
    });
    return res.end();
  }

  if (!validSession(req.headers.cookie)) return html(res, 200, signInPage());

  try {
    const issued = JSON.parse(
      await run("t3", ["auth", "pairing", "create", "--json", "--ttl", "15m", "--label", "Railway pairing page"]),
    );
    if (!issued.credential) throw new Error("t3 returned no pairing credential");
    const link = `${proto}://${req.headers.host}/pair#token=${encodeURIComponent(issued.credential)}`;
    const qrSvg = await run("qrencode", ["-t", "SVG", "-m", "2", "-s", "6", "-o", "-", link]);
    html(res, 200, pairPage(link, qrSvg));
  } catch (err) {
    console.error("railway-pair:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Could not create a pairing link; check the deploy logs.\n");
  }
}).listen(3774, "127.0.0.1");
