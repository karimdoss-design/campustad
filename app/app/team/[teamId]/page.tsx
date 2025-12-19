"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Team = { id: string; name: string; university: string | null };
type TeamPlayer = { team_id: string; player_id: string };
type Player = { id: string; display_name: string; university: string | null; position: string | null };
type PlayerStat = { player_id: string; goals: number; assists: number; motms: number; matches_played: number };

export default function TeamPage({ params }: { params: { teamId: string } }) {
  const teamId = params.teamId;

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);

  const statByPlayerId = useMemo(() => {
    const m = new Map<string, PlayerStat>();
    stats.forEach((s) => m.set(s.player_id, s));
    return m;
  }, [stats]);

  async function load() {
    setLoading(true);

    const { data: t } = await supabase.from("teams").select("id,name,university").eq("id", teamId).single();
    setTeam((t as Team) || null);

    const { data: tp } = await supabase.from("team_players").select("team_id,player_id").eq("team_id", teamId);
    const ids = ((tp as TeamPlayer[]) || []).map((x) => x.player_id);

    if (ids.length === 0) {
      setPlayers([]);
      setStats([]);
      setLoading(false);
      return;
    }

    const { data: p } = await supabase
      .from("players")
      .select("id,display_name,university,position")
      .in("id", ids)
      .order("display_name");
    setPlayers((p as Player[]) || []);

    const { data: s } = await supabase
      .from("player_stats")
      .select("player_id,goals,assists,motms,matches_played")
      .in("player_id", ids);
    setStats((s as PlayerStat[]) || []);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="text-white/80 hover:text-white underline">
            ← Back to Home
          </Link>
          <button
            onClick={load}
            className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
          >
            Refresh
          </button>
        </div>

        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-2xl font-bold">{team?.name || "Team"}</div>
          <div className="text-white/70">{team?.university || "—"}</div>
        </div>

        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">Roster & Stats</div>

          {players.length === 0 ? (
            <div className="text-white/70">No players assigned yet.</div>
          ) : (
            <div className="space-y-2">
              {players.map((p) => {
                const s = statByPlayerId.get(p.id) || {
                  player_id: p.id,
                  goals: 0,
                  assists: 0,
                  motms: 0,
                  matches_played: 0,
                };

                return (
                  <div
                    key={p.id}
                    className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold">{p.display_name}</div>
                      <div className="text-white/60 text-xs">
                        {p.position || "—"} • {p.university || "—"}
                      </div>
                    </div>

                    <div className="flex gap-3 text-sm">
                      <StatPill label="MP" value={s.matches_played} />
                      <StatPill label="G" value={s.goals} />
                      <StatPill label="A" value={s.assists} />
                      <StatPill label="MOTM" value={s.motms} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-white/50 text-xs">
          Stats update automatically after admin adds goal events + finishes matches.
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#111c44] border border-white/10 rounded-xl px-3 py-2 font-bold">
      <span className="text-white/60 font-semibold mr-2">{label}</span>
      {value ?? 0}
    </div>
  );
}
