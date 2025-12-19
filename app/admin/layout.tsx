"use client";

import { ReactNode } from "react";

/* ---------- Background SVG layers (same style as app) ---------- */
const pitchLinesSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <g fill="none" stroke="#bfe9ff" stroke-width="2" opacity="0.28">
    <rect x="90" y="90" width="1020" height="620" rx="28"/>
    <line x1="600" y1="90" x2="600" y2="710"/>
    <circle cx="600" cy="400" r="92"/>
    <circle cx="600" cy="400" r="6" fill="#bfe9ff" opacity="0.35"/>
    <rect x="90" y="240" width="150" height="320" rx="18"/>
    <rect x="960" y="240" width="150" height="320" rx="18"/>
    <rect x="90" y="315" width="60" height="170" rx="14" opacity="0.18"/>
    <rect x="1050" y="315" width="60" height="170" rx="14" opacity="0.18"/>
    <path d="M90 400h40" opacity="0.25"/>
    <path d="M1110 400h-40" opacity="0.25"/>
  </g>
</svg>
`);

function StadiumBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Baby-blue stadium lighting */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(70% 45% at 50% -10%, rgba(120, 200, 255, 0.35), transparent 60%),
            radial-gradient(80% 55% at 50% 115%, rgba(90, 180, 255, 0.28), transparent 65%),
            linear-gradient(180deg, #07102a 0%, #0b1530 45%, #07102a 100%)
          `,
        }}
      />

      {/* Top corner floodlights */}
      <div
        className="absolute -top-28 -left-32 w-[560px] h-[560px]"
        style={{
          background: "radial-gradient(circle at 55% 55%, rgba(120,200,255,0.36), transparent 62%)",
          filter: "blur(10px)",
          opacity: 0.9,
        }}
      />
      <div
        className="absolute -top-28 -right-32 w-[560px] h-[560px]"
        style={{
          background: "radial-gradient(circle at 45% 55%, rgba(120,200,255,0.34), transparent 62%)",
          filter: "blur(10px)",
          opacity: 0.9,
        }}
      />

      {/* Bottom haze */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[48%]"
        style={{
          background: `
            radial-gradient(70% 60% at 50% 100%, rgba(120,200,255,0.22), transparent 70%),
            linear-gradient(180deg, transparent 0%, rgba(120,200,255,0.06) 100%)
          `,
          opacity: 0.95,
        }}
      />

      {/* Pitch lines overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,${pitchLinesSvg}")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "min(1200px, 92vw) auto",
          opacity: 0.22,
          mixBlendMode: "screen",
          filter: "drop-shadow(0 0 18px rgba(120,200,255,0.25))",
        }}
      />

      {/* Subtle diagonal speed lines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(120deg, rgba(120,200,255,0.05) 0px, rgba(120,200,255,0.05) 1px, transparent 1px, transparent 18px)",
          opacity: 0.14,
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07102a] text-white relative overflow-hidden">
      <StadiumBackground />

      {/* ✅ Admin content stays above background */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
