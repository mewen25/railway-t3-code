// Pairing page at /railway-pair. Behind HTTP basic auth (any username,
// T3_SETUP_PASSWORD), it mints a one-time T3 pairing link with a QR code, so
// nobody has to copy a token out of the deploy logs. nginx sends everything
// else straight to T3, which authenticates the API, WebSocket and terminals.
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(s).digest();
const expected = sha256(process.env.T3_SETUP_PASSWORD ?? "");
if (!process.env.T3_SETUP_PASSWORD) throw new Error("T3_SETUP_PASSWORD is required");

const run = (cmd, args) =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { timeout: 30_000 }, (err, stdout) => (err ? reject(err) : resolve(stdout))),
  );
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const passwordFrom = (header = "") => {
  if (!header.startsWith("Basic ")) return "";
  const decoded = Buffer.from(header.slice(6), "base64").toString();
  return decoded.slice(decoded.indexOf(":") + 1);
};

const page = (link, qrSvg) => `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pair with T3 Code</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #111; background: #fff }
  a.button { display: inline-block; padding: .7rem 1.2rem; background: #111; color: #fff; border-radius: .5rem; text-decoration: none }
  code { word-break: break-all; background: #f2f2f2; padding: .2rem .4rem; border-radius: .3rem }
  svg { width: 16rem; height: auto }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee } a.button { background: #eee; color: #111 } code { background: #222 } }
</style>
<h1>Pair a device with T3 Code</h1>
<p>This link works for <b>one</b> device and expires in 15 minutes. Reload the page for a new one.</p>
<p><a class="button" href="${escapeHtml(link)}">Pair this browser</a></p>
<p><b>Phone (T3 Code app):</b> Settings &rarr; Environments &rarr; Add, then scan:</p>
${qrSvg}
<p><b>Desktop app or app.t3.codes:</b> Settings &rarr; Connections &rarr; Add environment, and paste:</p>
<p><code>${escapeHtml(link)}</code></p>
<p>Treat this link like a password.</p>`;

createServer(async (req, res) => {
  if (!timingSafeEqual(sha256(passwordFrom(req.headers.authorization)), expected)) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="T3 Code pairing", charset="UTF-8"' });
    return res.end("Password required: T3_SETUP_PASSWORD from the service's Variables tab.\n");
  }
  try {
    const proto = (req.headers["x-forwarded-proto"] ?? "http").split(",")[0].trim();
    const issued = JSON.parse(
      await run("t3", ["auth", "pairing", "create", "--json", "--ttl", "15m", "--label", "Railway pairing page"]),
    );
    if (!issued.credential) throw new Error("t3 returned no pairing credential");
    const link = `${proto}://${req.headers.host}/pair#token=${encodeURIComponent(issued.credential)}`;
    const qrSvg = await run("qrencode", ["-t", "SVG", "-m", "2", "-s", "6", "-o", "-", link]);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    res.end(page(link, qrSvg));
  } catch (err) {
    console.error("railway-pair:", err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Could not create a pairing link; check the deploy logs.\n");
  }
}).listen(3774, "127.0.0.1");
