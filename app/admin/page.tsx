"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type MeProfile = { role: string; status: string };

export default function AdminHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function requireAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/register");
      return false;
    }

    const { data: me, error } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .single();

    if (error) {
      setErr(error.message);
      return false;
    }

    const prof = me as MeProfile;
    if (prof.role !== "admin" || prof.status !== "active") {
      router.replace("/app");
      return false;
    }

    return true;
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/register");
  }

  const sections = [
    {
      title: "Registrations",
      items: [
        {
          href: "/admin/approve-players",
          name: "Approve Players",
          desc: "Approve / reject pending player signups",
        },
      ],
    },
    {
      title: "Roster & Linking",
      items: [
        {
          href: "/admin/players",
          name: "Roster Players",
          desc: "Create roster players + edit stats (goals/assists/MOTM)",
        },
        {
          href: "/admin/team-players",
          name: "Team Rosters",
          desc: "Assign roster players to teams (who plays for who)",
        },
        {
          href: "/admin/link-player",
          name: "Link Logged-in Players",
          desc: "Link app accounts to roster players",
        },
      ],
    },
    {
      title: "Tournament Setup",
      items: [
        { href: "/admin/teams", name: "Teams", desc: "Create / delete teams" },
        { href: "/admin/groups", name: "Groups", desc: "Create groups and assign teams" },
      ],
    },
    {
      title: "Matches & Knockout",
      items: [
        { href: "/admin/matches", name: "Matches", desc: "Create matches, scores, goals, MOTM" },
        { href: "/admin/knockout", name: "Knockout Bracket", desc: "Set knockout rounds + bracket matches" },
      ],
    },
    {
      title: "Engagement",
      items: [
        { href: "/admin/news", name: "News", desc: "Post text, images, and videos for all users" },
        { href: "/admin/fans", name: "Fans", desc: "Kick / reactivate fans" },
      ],
    },
  ];

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-white/70">Manage Campustad (teams, players, matches, fans).</p>
          </div>
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
          >
            Log out
          </button>
        </div>

        {err && <div className="text-red-400">{err}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          {sections.map((s) => (
            <div key={s.title} className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
              <div className="text-xl font-bold mb-3">{s.title}</div>

              <div className="space-y-2">
                {s.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className="block bg-[#0b1530] border border-[#1f2a60] rounded-xl p-4 hover:border-white/20 transition"
                  >
                    <div className="font-bold">{it.name}</div>
                    <div className="text-white/60 text-sm">{it.desc}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-white/50 text-xs">
          Tip: “Disable” blocks access immediately (recommended instead of deleting).
        </div>
      </div>
    </div>
  );
}
