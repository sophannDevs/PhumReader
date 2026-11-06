// Pings every local service and prints one line each. Exit code 1 if any is down.
// Reads backend/.env (plain KEY=value lines); real environment variables win.
import { readFileSync } from "node:fs";
import net from "node:net";

const env = { ...process.env };
try {
  for (const line of readFileSync(new URL("../backend/.env", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const timeout = (ms) => AbortSignal.timeout(ms);
const tcp = (host, port, send, expect) =>
  new Promise((resolve, reject) => {
    const s = net.connect({ host, port, timeout: 3000 });
    let buf = "";
    s.on("connect", () => send && s.write(send));
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

const checks = [
  [
    "Redis",
    async () => {
      if (redisUrl.protocol === "rediss:") return "TLS (Upstash): not pinged here";
      const auth = redisUrl.password
        ? `*2\r\n$4\r\nAUTH\r\n$${redisUrl.password.length}\r\n${redisUrl.password}\r\n`
        : "";
      const r = await tcp(redisUrl.hostname, Number(redisUrl.port || 6379), auth + "PING\r\n", "PONG");
      return r.includes("PONG") ? "PONG" : r;
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
    "Object storage (MinIO / R2)",
    async () => {
      const r = await fetch(`${s3}/minio/health/live`, { signal: timeout(3000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return "live";
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
