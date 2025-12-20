import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Campustad",
  description: "Campustad Tournament",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      {/* ✅ IMPORTANT: remove any solid background here, keep transparent */}
      <body className="text-white bg-transparent min-h-screen">
        {children}
      </body>
    </html>
  );
}

