import Link from "next/link";

export default function RootNotFound() {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#F9F5F0",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 400 }}>
            <div
              style={{
                fontSize: 72,
                fontWeight: 800,
                color: "#5D4037",
                lineHeight: 1,
              }}
            >
              404
            </div>
            <p
              style={{
                marginTop: 16,
                fontSize: 18,
                color: "#8D6E63",
                lineHeight: 1.6,
              }}
            >
              Esta página se ha perdido en una aventura.
            </p>
            <Link
              href="/es"
              style={{
                display: "inline-block",
                marginTop: 24,
                padding: "12px 32px",
                background: "#D2691E",
                color: "white",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
