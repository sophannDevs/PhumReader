"use client"

// Last resort: replaces the root layout, so it brings its own <html> and <body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 16 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#71717a", margin: "0 0 16px" }}>PhumReader hit an unexpected error. Please try again.</p>
          <button
            onClick={reset}
            style={{ height: 40, padding: "0 20px", borderRadius: 8, border: 0, background: "#00dc64", color: "#04210f", fontWeight: 600, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  )
}
