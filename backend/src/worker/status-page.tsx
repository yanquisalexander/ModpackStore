/** @jsxImportSource @hono/hono/jsx */

export interface StatusPageData {
  status: string
  startedAt: number
  completed: number
  failed: number
  activeJobId: string | null
  queueName: string
  jobCounts: {
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
  }
  memory: { rss: number; heapTotal: number; heapUsed: number }
  systemMemory: { total: number; free: number }
  cpuCores: number
}

const css = `
body { font-family: sans-serif; padding: 20px; background: #f5f5f5; }
h1 { margin-bottom: 4px; }
table { border-collapse: collapse; margin: 12px 0; background: #fff; }
td, th { border: 1px solid #ccc; padding: 6px 12px; text-align: left; }
th { background: #eee; font-weight: 600; }
.status { font-weight: bold; }
pre { background: #111; color: #0f0; padding: 8px; max-height: 400px; overflow-y: auto; font-size: 13px; border-radius: 4px; }
`

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h || d) parts.push(`${h}h`)
  parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(" ")
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i]
}

export function StatusPage({ stats }: { stats: StatusPageData }) {
  const uptime = Date.now() - stats.startedAt

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta httpEquiv="refresh" content="10" />
        <title>Worker Status</title>
        <style>{css}</style>
      </head>
      <body>
        <h1>Modpack Store Worker</h1>
        <p class="status">
          Status: {stats.status} &mdash; Uptime: {formatDuration(uptime)}
        </p>

        <h2>System</h2>
        <table>
          <tr><th>CPU cores</th><td>{stats.cpuCores}</td></tr>
          <tr><th>Memory (heap)</th><td>{formatBytes(stats.memory.heapUsed)} / {formatBytes(stats.memory.heapTotal)}</td></tr>
          <tr><th>Memory (RSS)</th><td>{formatBytes(stats.memory.rss)}</td></tr>
          <tr><th>RAM (system)</th><td>{formatBytes(stats.systemMemory.free)} / {formatBytes(stats.systemMemory.total)} free</td></tr>
        </table>

        <h2>Queue: {stats.queueName}</h2>
        <table>
          <tr><th>Waiting</th><td>{stats.jobCounts.waiting}</td></tr>
          <tr><th>Active</th><td>{stats.jobCounts.active}</td></tr>
          <tr><th>Completed</th><td>{stats.jobCounts.completed}</td></tr>
          <tr><th>Failed</th><td>{stats.jobCounts.failed}</td></tr>
          <tr><th>Delayed</th><td>{stats.jobCounts.delayed}</td></tr>
        </table>

        <h2>Jobs Processed (this session)</h2>
        <table>
          <tr><th>Completed</th><td>{stats.completed}</td></tr>
          <tr><th>Failed</th><td>{stats.failed}</td></tr>
        </table>

        <h2>Active Job</h2>
        <p>{stats.activeJobId ?? "none"}</p>

        <hr />

        <h2>Log</h2>
        <pre id="log">Connecting to log stream...</pre>

        <p><small>Auto-refreshes every 10s</small></p>
      </body>
      <script dangerouslySetInnerHTML={{
        __html: `
        const el = document.getElementById("log");
        const es = new EventSource("/status/stream");
        es.onmessage = (e) => {
          if (el.textContent === "Connecting to log stream...") el.textContent = "";
          el.textContent += e.data + "\\n";
          el.scrollTop = el.scrollHeight;
        };
        es.onerror = () => {
          el.textContent += "[Log stream disconnected]\\n";
        };
      `}} />
    </html>
  )
}
