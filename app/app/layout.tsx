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
  icon: (active: boolean) => React.ReactElement;
  showUnread?: boolean;
};

/* ---------- PHOTO BACKGROUND ONLY ---------- */
function DawraLikPhotoBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* ✅ IMPORTANT: must match EXACT file in /public */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("/dawralik-bg.png?v=3")`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          opacity: 0.35,
          filter: "saturate(1.05) contrast(1.05)",
        }}
      />

      {/* dark overlay for readability */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(7,16,42,0.92) 0%, rgba(11,21,48,0.75) 45%, rgba(7,16,42,0.94) 100%)",
        }}
      />

      {/* subtle glow */}
      <div
        className="absolute -top-28 -left-32 w-[560px] h-[560px]"
        style={{
          background: "radial-gradient(circle at 55% 55%, rgba(120,200,255,0.28), transparent 62%)",
          filter: "blur(10px)",
          opacity: 0.9,
        }}
      />
      <div
        className="absolute -top-28 -right-32 w-[560px] h-[560px]"
        style={{
          background: "radial-gradient(circle at 45% 55%, rgba(120,200,255,0.26), transparent 62%)",
          filter: "blur(10px)",
          opacity: 0.9,
        }}
      />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hasUnreadNews, setHasUnreadNews] = useState(false);

  // ✅ keep role/status correct in PWA
  useEffect(() => {
    let sub: any = null;

    async function refreshMe() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        setRole(null);
        setStatus(null);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role,status")
        .eq("id", user.id)
        .maybeSingle();

      setRole((prof?.role as Role) ?? null);
      setStatus(prof?.status ?? null);

      if (prof?.role === "admin" && prof?.status === "active") {
        if (pathname.startsWith("/app")) router.replace("/admin");
        return;
      }

      if (prof?.role === "player" && prof?.status === "pending") {
        router.replace("/waiting");
      }
    }

    refreshMe();

    const { data } = supabase.auth.onAuthStateChange(() => refreshMe());
    sub = data?.subscription;

    return () => sub?.unsubscribe?.();
  }, [router, pathname]);

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

      const { data: readRow } = await supabase
        .from("news_reads")
        .select("last_seen_at")
        .eq("user_id", user.id)
        .maybeSingle();

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
    <div className="min-h-screen text-white pb-24 relative overflow-hidden">
      <DawraLikPhotoBackground />
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
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
        style={{
          background: "radial-gradient(70% 140% at 50% 100%, rgba(120,200,255,0.45), transparent 70%)",
        }}
      />

      <div className="max-w-4xl mx-auto px-4 pb-5">
        <div className="relative bg-[#0b1430]/75 backdrop-blur-xl border border-white/10 rounded-[24px] px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
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
