// Pings every local service and prints one line each. Exit code 1 if any is down.
// Reads backend/.env (plain KEY=value lines); real environment variables win.
import { readFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import net from "node:net";
import tls from "node:tls";

const env = { ...process.env };
try {
  for (const line of readFileSync(new URL("../backend/.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const timeout = (ms) => AbortSignal.timeout(ms);
const tcp = (host, port, send, expect, secure = false) =>
  new Promise((resolve, reject) => {
    const s = secure
      ? tls.connect({ host, port, servername: host, timeout: 5000 })
      : net.connect({ host, port, timeout: 3000 });
    let buf = "";
    s.on(secure ? "secureConnect" : "connect", () => send && s.write(send));
    s.on("data", (d) => {
      buf += d;
      if (buf.includes(expect)) {
        s.end();
        resolve(buf.trim());
      }
    });
    s.on("timeout", () => {
      s.destroy();
      reject(new Error("timeout"));
    });
    s.on("error", reject);
  });

const redisUrl = new URL(env.REDIS_URL || "redis://127.0.0.1:6379");
const meili = env.MEILI_URL || "http://127.0.0.1:7700";
const s3 = env.S3_ENDPOINT || "http://127.0.0.1:9000";
const mailUi = env.MAILPIT_UI_URL || "http://127.0.0.1:8025";

/** S3 HeadBucket with a SigV4 header signature, path-style (R2 and MinIO both accept it). */
async function headBucket(endpoint, bucket, accessKey, secretKey, region) {
  if (!bucket || !accessKey || !secretKey) throw new Error("S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY are required");
  const url = new URL(`${endpoint.replace(/\/+$/, "")}/${bucket}`);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update("").digest("hex");
  const headers = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signed = "host;x-amz-content-sha256;x-amz-date";
  const canonical = `HEAD\n${url.pathname}\n\n${headers}\n${signed}\n${payloadHash}`;
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash("sha256").update(canonical).digest("hex")}`;
  const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
  const key = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  const res = await fetch(url, {
    method: "HEAD",
    headers: {
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
    },
    signal: timeout(8000),
  });
  return res.status;
}

const checks = [
  [
    "Redis",
    async () => {
      const secure = redisUrl.protocol === "rediss:";
      const user = decodeURIComponent(redisUrl.username);
      const pass = decodeURIComponent(redisUrl.password);
      const bulk = (v) => `$${Buffer.byteLength(v)}\r\n${v}\r\n`;
      // AUTH <password>, or AUTH <user> <password> (Upstash uses the user "default").
      const auth = pass
        ? user
          ? `*3\r\n${bulk("AUTH")}${bulk(user)}${bulk(pass)}`
          : `*2\r\n${bulk("AUTH")}${bulk(pass)}`
        : "";
      const port = Number(redisUrl.port || 6379);
      const r = await tcp(redisUrl.hostname, port, auth + "PING\r\n", "PONG", secure);
      return `${secure ? "TLS, " : ""}${r.includes("PONG") ? "PONG" : r}`;
    },
  ],
  [
    "Meilisearch",
    async () => {
      const h = await fetch(`${meili}/health`, { signal: timeout(3000) });
      const j = await h.json();
      if (j.status !== "available") throw new Error(JSON.stringify(j));
      const v = await fetch(`${meili}/version`, {
        headers: { Authorization: `Bearer ${env.MEILI_MASTER_KEY ?? ""}` },
        signal: timeout(3000),
      });
      if (!v.ok) throw new Error(`available, but the master key was refused (${v.status})`);
      return "available, master key accepted";
    },
  ],
  [
    "Object storage (S3 / R2)",
    async () => {
      const host = new URL(s3).hostname;
      if (host === "127.0.0.1" || host === "localhost") {
        const r = await fetch(`${s3}/minio/health/live`, { signal: timeout(3000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return "MinIO live";
      }
      // A real endpoint (Cloudflare R2): a signed HEAD on the bucket proves the keys and the bucket.
      const status = await headBucket(s3, env.S3_BUCKET, env.S3_ACCESS_KEY, env.S3_SECRET_KEY, env.S3_REGION || "auto");
      if (status === 200) return `bucket "${env.S3_BUCKET}" reachable, keys accepted`;
      throw new Error(`HEAD bucket answered ${status} (403 = wrong keys, 404 = no such bucket)`);
    },
  ],
  [
    "Mail (Mailpit)",
    async () => {
      const r = await fetch(`${mailUi}/api/v1/info`, { signal: timeout(3000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      return `up, version ${j.Version}`;
    },
  ],
  [
    "Database (Supabase, via the API)",
    async () => {
      const r = await fetch(`http://localhost:${env.PORT || 8080}/api/v1/health`, { signal: timeout(5000) });
      const j = await r.json();
      return `API health: ${JSON.stringify(j.status ?? j)}`;
    },
  ],
];

let down = 0;
for (const [name, fn] of checks) {
  try {
    console.log(`OK    ${name}: ${await fn()}`);
  } catch (e) {
    down++;
    console.log(`DOWN  ${name}: ${e.cause?.code ?? e.message}`);
  }
}
process.exit(down ? 1 : 0);
