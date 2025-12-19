"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  name: string;
  role: "admin" | "player" | "fan";
  status: "pending" | "active" | "rejected";
  university: string | null;
};

type RosterPlayer = {
  id: string;
  full_name: string;
  university: string | null;
  position: string | null;
  linked_profile_id: string | null;
};

type PlayerStats = {
  player_id: string;
  matches_played: number;
  goals: number;
  assists: number;
  motm: number;
};

type Team = {
  id: string;
  name: string;
};

export default function MyStatsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [roster, setRoster] = useState<RosterPlayer | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  async function load() {
    setError("");

    // Must be logged in
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;

    if (!user) {
      router.replace("/register");
      return;
    }

    // Load profile
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id,name,role,status,university")
      .eq("id", user.id)
      .single();

    if (profErr) {
      setError(profErr.message);
      setLoading(false);
      return;
    }

    const p = prof as Profile;
    setProfile(p);

    // ✅ PLAYERS ONLY: fans/admin cannot see this page
    if (p.role !== "player") {
      router.replace("/app");
      return;
    }

    // Pending players go to waiting
    if (p.status === "pending") {
      router.replace("/waiting");
      return;
    }

    // Rejected players also go to register/app (your choice)
    if (p.status === "rejected") {
      router.replace("/register");
      return;
    }

    // Find roster player linked to this login
    const { data: rp, error: rpErr } = await supabase
      .from("players")
      .select("id,full_name,university,position,linked_profile_id")
      .eq("linked_profile_id", user.id)
      .maybeSingle();

    if (rpErr) {
      setError(rpErr.message);
      setLoading(false);
      return;
    }

    // Not linked yet
    if (!rp) {
      setRoster(null);
      setStats(null);
      setTeam(null);
      setLoading(false);
      return;
    }

    const rosterPlayer = rp as RosterPlayer;
    setRoster(rosterPlayer);

    // Load stats
    const { data: st, error: stErr } = await supabase
      .from("player_stats")
      .select("player_id,matches_played,goals,assists,motm")
      .eq("player_id", rosterPlayer.id)
      .maybeSingle();

    if (stErr) {
      setError(stErr.message);
      setLoading(false);
      return;
    }

    setStats((st as PlayerStats) || null);

    // Load team (team_players join teams)
    const { data: tp, error: tpErr } = await supabase
      .from("team_players")
      .select("team_id, teams(id,name)")
      .eq("player_id", rosterPlayer.id)
      .maybeSingle();

    if (tpErr) {
      setError(tpErr.message);
      setLoading(false);
      return;
    }

    if (tp?.teams) setTeam(tp.teams as Team);
    else setTeam(null);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1530] text-white p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Stats</h1>
            <p className="text-white/70">Your Campustad player profile.</p>
          </div>
          <button
            onClick={load}
            className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
          >
            Refresh
          </button>
        </div>

        {error && <div className="text-red-400">{error}</div>}

        {!roster ? (
          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
            <div className="text-lg font-bold">Not linked yet</div>
            <div className="text-white/70">
              Your account is approved, but the admin hasn’t linked your login to
              your roster player yet.
            </div>
            <div className="text-white/60 text-sm mt-2">
              Ask admin to link you at: <b>/admin/link-player</b>
            </div>
          </div>
        ) : (
          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-4">
            <div>
              <div className="text-2xl font-bold">{roster.full_name}</div>
              <div className="text-white/70">
                {(roster.university || profile?.university || "—")} •{" "}
                {(roster.position || "—")}
              </div>
              <div className="text-white/60 text-sm mt-1">
                Team: <b>{team?.name || "Not assigned yet"}</b>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Matches" value={stats?.matches_played ?? 0} />
              <StatCard label="Goals" value={stats?.goals ?? 0} />
              <StatCard label="Assists" value={stats?.assists ?? 0} />
              <StatCard label="MOTM" value={stats?.motm ?? 0} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4">
      <div className="text-white/70 text-sm">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
