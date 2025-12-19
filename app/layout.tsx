import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campustad",
  description: "Campustad Tournament",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#07102a] text-white">{children}</body>
    </html>
  );
}
