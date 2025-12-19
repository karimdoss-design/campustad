"use client";

import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Role = "player" | "fan" | "admin" | null;

/* ---------- Icons ---------- */
function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? "opacity-100" : "opacity-80"}>
      <path
        d="M4 10.5L12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 20v-9.5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M9.5 21V14h5v7" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconMe({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? "opacity-100" : "opacity-80"}>
      <path
        d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M4.5 20.5c1.7-4.2 13.3-4.2 15 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconTable({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? "opacity-100" : "opacity-80"}>
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconMatches({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? "opacity-100" : "opacity-80"}>
      <path
        d="M7 4h10a2 2 0 0 1 2 2v6a7 7 0 0 1-7 7H9a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconPredict({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? "opacity-100" : "opacity-80"}>
      <path
        d="M12 3l2.2 6.3H21l-5.2 3.8L17.9 20 12 16.4 6.1 20l2.1-6.9L3 9.3h6.8L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconNews({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={active ? "opacity-100" : "opacity-80"}>
      <path
        d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M8 8h8M8 12h8M8 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => JSX.Element;
  showUnread?: boolean;
};

type UniLogo = {
  src: string;
  x: string;
  y: string;
  size: number;
  rot: number;
  opacity: number;
  center?: boolean; // ✅ fix: optional
};

/* ---------- Pitch SVG (pure CSS/SVG) ---------- */
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
  const logos: UniLogo[] = [
    { src: "/unis/guc.png", x: "10%", y: "16%", size: 220, rot: -12, opacity: 0.08 },
    { src: "/unis/bue.png", x: "78%", y: "18%", size: 220, rot: 10, opacity: 0.08 },
    { src: "/unis/auc.png", x: "14%", y: "74%", size: 240, rot: 8, opacity: 0.085 },
    { src: "/unis/coventry.png", x: "80%", y: "74%", size: 220, rot: -10, opacity: 0.08 },
    { src: "/unis/giu.png", x: "50%", y: "52%", size: 340, rot: 0, opacity: 0.06, center: true },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* baby-blue stadium lighting */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(70% 45% at 50% -10%, rgba(120,200,255,0.35), transparent 60%),
            radial-gradient(80% 55% at 50% 115%, rgba(90,180,255,0.28), transparent 65%),
            linear-gradient(180deg, #07102a 0%, #0b1530 45%, #07102a 100%)
          `,
        }}
      />

      {/* floodlights */}
      <div
        className="absolute -top-28 -left-32 w-[560px] h-[560px]"
        style={{
          background: "radial-gradient(circle at 55% 55%, rgba(120,200,255,0.36), transparent 62%)",
          filter: "blur(10px)",
          opacity: 0.95,
        }}
      />
      <div
        className="absolute -top-28 -right-32 w-[560px] h-[560px]"
        style={{
          background: "radial-gradient(circle at 45% 55%, rgba(120,200,255,0.34), transparent 62%)",
          filter: "blur(10px)",
          opacity: 0.95,
        }}
      />

      {/* bottom haze */}
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

      {/* pitch lines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,${pitchLinesSvg}")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "min(1200px, 92vw) auto",
          opacity: 0.22,
          mixBlendMode: "screen",
          filter: "drop-shadow(0 0 18px rgba(120,200,255,0.22))",
        }}
      />

      {/* diagonal speed lines */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(120deg, rgba(120,200,255,0.05) 0px, rgba(120,200,255,0.05) 1px, transparent 1px, transparent 18px)",
          opacity: 0.14,
          mixBlendMode: "screen",
        }}
      />

      {/* university logos watermark */}
      {logos.map((l, idx) => (
        <div
          key={idx}
          className="absolute"
          style={{
            left: l.x,
            top: l.y,
            transform: `translate(${l.center ? "-50%" : "0"}, ${l.center ? "-50%" : "0"}) rotate(${l.rot}deg)`,
            width: l.size,
            height: l.size,
            opacity: l.opacity,
            mixBlendMode: "screen",
            filter: "blur(0.2px) drop-shadow(0 0 22px rgba(120,200,255,0.22))",
          }}
        >
          <img src={l.src} alt="" className="w-full h-full object-contain" draggable={false} />
        </div>
      ))}
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hasUnreadNews, setHasUnreadNews] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setRole(null);
        setStatus(null);
        return;
      }

      const { data: prof } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();

      setRole((prof?.role as Role) ?? null);
      setStatus(prof?.status ?? null);

      if (prof?.role === "player" && prof?.status === "pending") {
        router.replace("/waiting");
      }
    })();
  }, [router]);

  // unread dot checker
  useEffect(() => {
    let channel: any = null;
    let timer: any = null;

    async function checkUnread() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) return setHasUnreadNews(false);

      const { data: lastPost } = await supabase
        .from("news_posts")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastPost?.created_at) return setHasUnreadNews(false);

      const { data: readRow } = await supabase.from("news_reads").select("last_seen_at").eq("user_id", user.id).maybeSingle();

      const lastSeen = readRow?.last_seen_at ? new Date(readRow.last_seen_at).getTime() : 0;
      const lastCreated = new Date(lastPost.created_at).getTime();

      setHasUnreadNews(lastCreated > lastSeen);
    }

    (async () => {
      await checkUnread();
      channel = supabase
        .channel("nav-news")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "news_posts" }, () => checkUnread())
        .subscribe();
      timer = setInterval(checkUnread, 8000);
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (timer) clearInterval(timer);
    };
  }, []);

  const hideNav = pathname.startsWith("/admin") || pathname.startsWith("/register") || pathname.startsWith("/waiting");

  return (
    <div className="min-h-screen text-white pb-24 relative bg-[#07102a] overflow-hidden">
      <StadiumBackground />
      <div className="relative z-10">{children}</div>
      {!hideNav && <BottomNav role={role} status={status} pathname={pathname} hasUnreadNews={hasUnreadNews} />}
    </div>
  );
}

function BottomNav({
  role,
  status,
  pathname,
  hasUnreadNews,
}: {
  role: Role;
  status: string | null;
  pathname: string;
  hasUnreadNews: boolean;
}) {
  const items: NavItem[] =
    role === "player" && status === "active"
      ? [
          { href: "/app/me", label: "Me", icon: (a) => <IconMe active={a} /> },
          { href: "/app", label: "Home", icon: (a) => <IconHome active={a} /> },
          { href: "/app/standings", label: "Table", icon: (a) => <IconTable active={a} /> },
          { href: "/app/matches", label: "Matches", icon: (a) => <IconMatches active={a} /> },
          { href: "/app/predict", label: "Predict", icon: (a) => <IconPredict active={a} /> },
          { href: "/app/news", label: "News", icon: (a) => <IconNews active={a} />, showUnread: true },
        ]
      : [
          { href: "/app", label: "Home", icon: (a) => <IconHome active={a} /> },
          { href: "/app/standings", label: "Table", icon: (a) => <IconTable active={a} /> },
          { href: "/app/matches", label: "Matches", icon: (a) => <IconMatches active={a} /> },
          { href: "/app/predict", label: "Predict", icon: (a) => <IconPredict active={a} /> },
          { href: "/app/news", label: "News", icon: (a) => <IconNews active={a} />, showUnread: true },
        ];

  const activeIndex = useMemo(() => {
    const i = items.findIndex((it) => pathname === it.href || (it.href !== "/app" && pathname.startsWith(it.href)));
    return i < 0 ? 0 : i;
  }, [items, pathname]);

  const w = 100 / items.length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* nav glow */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
        style={{
          background: "radial-gradient(70% 140% at 50% 100%, rgba(120,200,255,0.45), transparent 70%)",
        }}
      />

      <div className="max-w-4xl mx-auto px-4 pb-5">
        <div className="relative bg-[#0b1430]/75 backdrop-blur-xl border border-white/10 rounded-[24px] px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
          {/* Animated sliding highlight */}
          <div
            className="absolute top-3 bottom-3 rounded-2xl border border-blue-400/25"
            style={{
              left: `calc(${w}% * ${activeIndex})`,
              width: `${w}%`,
              transition: "left 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
              background: "linear-gradient(180deg, rgba(59,130,246,0.28), rgba(59,130,246,0.10))",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          />

          <div className="relative flex justify-between gap-1">
            {items.map((it) => {
              const active = pathname === it.href || (it.href !== "/app" && pathname.startsWith(it.href));
              const showDot = it.showUnread && hasUnreadNews;

              return (
                <Link key={it.href} href={it.href} className="relative flex-1 rounded-2xl px-2 py-2 transition">
                  <div className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition ${active ? "" : "hover:bg-white/5"}`}>
                    <div className={`text-white ${active ? "opacity-100" : "opacity-80"}`}>{it.icon(active)}</div>
                    <div className={`text-[11px] font-extrabold ${active ? "text-white" : "text-white/70"}`}>{it.label}</div>
                  </div>

                  {showDot ? (
                    <span className="absolute top-2 right-4 w-2.5 h-2.5 rounded-full bg-blue-300 shadow-[0_0_16px_rgba(120,200,255,0.95)]" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
