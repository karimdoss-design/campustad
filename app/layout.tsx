import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "DawraLik",
  description: "DawraLik Tournament",
  applicationName: "DawraLik",
  themeColor: "#07102a",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DawraLik",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* PWA / Android */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#07102a" />

        {/* iOS Add to Home Screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="DawraLik" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>

      {/* ✅ keep transparent so your DawraLikBackground shows */}
      <body className="text-white bg-transparent min-h-screen">{children}</body>
    </html>
  );
}

