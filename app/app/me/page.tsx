"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Team = { id: string; name: string };
type RosterPlayer = {
  id: string;
  full_name: string;
  display_name: string | null;
  university: string | null;
  position: string | null;
  linked_profile_id: string | null;
};

type PlayerStats = {
  player_id: string;
  matches_played: number | null;
  goals: number | null;
  assists: number | null;
  motm: number | null;
};

export default function MePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [meRoster, setMeRoster] = useState<RosterPlayer | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);

  async function load() {
    setLoading(true);
    setErr("");

    // 1) must be logged in
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.replace("/register");
      return;
    }
    const uid = userData.user.id;

    // 2) find roster player that is linked to this user
    const { data: rp, error: rpErr } = await supabase
      .from("players")
      .select("id,full_name,display_name,university,position,linked_profile_id")
      .eq("linked_profile_id", uid)
      .maybeSingle();

    if (rpErr) {
      setErr(`Roster lookup error: ${rpErr.message}`);
      setLoading(false);
      return;
    }

    if (!rp) {
      setMeRoster(null);
      setTeam(null);
      setStats(null);
      setLoading(false);
      return;
    }

    setMeRoster(rp as RosterPlayer);

    // 3) stats row
    const { data: st, error: stErr } = await supabase
      .from("player_stats")
      .select("player_id,matches_played,goals,assists,motm")
      .eq("player_id", rp.id)
      .maybeSingle();

    if (stErr) {
      setErr(`Stats error: ${stErr.message}`);
    } else {
      setStats((st as PlayerStats) || null);
    }

    // 4) team assignment (team_players uses roster player id)
    const { data: tp, error: tpErr } = await supabase
      .from("team_players")
      .select("team_id")
      .eq("player_id", rp.id)
      .maybeSingle();

    if (tpErr) {
      setErr((prev) => prev ? prev + `\nTeam assignment error: ${tpErr.message}` : `Team assignment error: ${tpErr.message}`);
      setTeam(null);
      setLoading(false);
      return;
    }

    if (!tp?.team_id) {
      setTeam(null);
      setLoading(false);
      return;
    }

    // 5) fetch team name
    const { data: t, error: tErr } = await supabase
      .from("teams")
      .select("id,name")
      .eq("id", tp.team_id)
      .maybeSingle();

    if (tErr) {
      setErr((prev) => prev ? prev + `\nTeam error: ${tErr.message}` : `Team error: ${tErr.message}`);
      setTeam(null);
    } else {
      setTeam((t as Team) || null);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-white/70">Your roster + team + stats.</p>
        </div>

        {err && (
          <div className="bg-red-600/20 border border-red-500/40 text-red-200 rounded-2xl p-4 whitespace-pre-wrap">
            {err}
          </div>
        )}

        {!meRoster ? (
          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
            <div className="font-bold text-lg">Not linked yet</div>
            <div className="text-white/70 text-sm">
              Your account is not linked to a roster player.
              Admin must link you in <b>/admin/link-player</b>.
            </div>
          </div>
        ) : (
          <>
            <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-2">
              <div className="text-xl font-bold">
                {meRoster.display_name || meRoster.full_name}
              </div>
              <div className="text-white/70 text-sm">
                {meRoster.university || "—"} • {meRoster.position || "—"}
              </div>
              <div className="text-white/70 text-sm">
                Team:{" "}
                <b className="text-white">{team?.name || "Unassigned"}</b>
              </div>
            </div>

            <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
              <div className="text-xl font-bold mb-3">My Stats</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox label="Matches" value={stats?.matches_played ?? 0} />
                <StatBox label="Goals" value={stats?.goals ?? 0} />
                <StatBox label="Assists" value={stats?.assists ?? 0} />
                <StatBox label="MOTM" value={stats?.motm ?? 0} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4">
      <div className="text-white/60 text-xs">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
