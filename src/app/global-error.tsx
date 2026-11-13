"use client";

/** Last-resort error page when the root layout itself fails. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1>Something broke</h1>
          <p>Flexit couldn&apos;t load. It&apos;s probably temporary.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: "#ff5a1f", fontWeight: 700 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
