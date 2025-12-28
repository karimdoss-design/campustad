"use client";

import { ReactNode } from "react";

function DawraLikBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("/dawralik-bg.png")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-[#07102a]/65" />

      {/* Optional: subtle top glow like stadium lighting (keeps your nice vibe) */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 45% at 50% -10%, rgba(120,200,255,0.18), transparent 60%)",
          mixBlendMode: "screen",
          opacity: 0.9,
        }}
      />

      {/* Optional: bottom haze so cards stand out */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[45%]"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 100%, rgba(0,0,0,0.35), transparent 70%)",
          opacity: 0.9,
        }}
      />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-white relative overflow-hidden bg-[#07102a]">
      <DawraLikBackground />

      {/* App content above background */}
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
