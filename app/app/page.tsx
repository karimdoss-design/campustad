"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Team = {
  id: string;
  name: string;
};

type PlayerRow = {
  id: string;
  display_name: string;
  team_id: string;
  position: string | null;
  goals: number;
  assists: number;
  matches_played: number;
};

function positionRank(posRaw: string | null) {
  const p = (posRaw || "").toLowerCase().trim();

  // Accept multiple spellings
  if (p.includes("gk") || p.includes("goal")) return 1; // Goalkeeper
  if (p.includes("def")) return 2; // Defender
  if (p.includes("mid")) return 3; // Midfielder
  if (p.includes("for") || p.includes("att") || p.includes("str")) return 4; // Forward/Attacker/Striker

  return 9; // Unknown / other
}

function posLabel(posRaw: string | null) {
  const p = (posRaw || "").toLowerCase().trim();
  if (p.includes("gk") || p.includes("goal")) return "GK";
  if (p.includes("def")) return "DEF";
  if (p.includes("mid")) return "MID";
  if (p.includes("for") || p.includes("att") || p.includes("str")) return "FWD";
  return posRaw ? posRaw.toUpperCase() : "—";
}

export default function HomePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");

    const { data: t, error: tErr } = await supabase
      .from("teams")
      .select("id,name")
      .order("name");

    if (tErr) {
      setErr(tErr.message);
      setLoading(false);
      return;
    }
    setTeams((t as Team[]) || []);

    // Pull roster players + their stats through team_players relation
    const { data: tp, error: tpErr } = await supabase
      .from("team_players")
      .select(
        `
        team_id,
        players (
          id,
          display_name,
          position,
          player_stats (
            goals,
            assists,
            matches_played
          )
        )
      `
      );

    if (tpErr) {
      setErr(tpErr.message);
      setLoading(false);
      return;
    }

    const flat: PlayerRow[] = [];
    (tp || []).forEach((row: any) => {
      const pl = row.players;
      if (!pl) return;

      flat.push({
        id: pl.id,
        display_name: pl.display_name,
        team_id: row.team_id,
        position: pl.position ?? null,
        goals: pl.player_stats?.goals ?? 0,
        assists: pl.player_stats?.assists ?? 0,
        matches_played: pl.player_stats?.matches_played ?? 0,
      });
    });

    setPlayers(flat);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [teams]);

  const playersByTeam = useMemo(() => {
    const map = new Map<string, PlayerRow[]>();
    players.forEach((p) => {
      if (!map.has(p.team_id)) map.set(p.team_id, []);
      map.get(p.team_id)!.push(p);
    });

    // Sort per team: GK, DEF, MID, FWD, then name
    for (const [teamId, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ra = positionRank(a.position);
        const rb = positionRank(b.position);
        if (ra !== rb) return ra - rb;
        return a.display_name.localeCompare(b.display_name);
      });
      map.set(teamId, arr);
    }

    return map;
  }, [players]);

  const topScorers = useMemo(() => {
    const arr = [...players];
    arr.sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.display_name.localeCompare(b.display_name);
    });
    return arr.slice(0, 10);
  }, [players]);

  const topAssisters = useMemo(() => {
    const arr = [...players];
    arr.sort((a, b) => {
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return a.display_name.localeCompare(b.display_name);
    });
    return arr.slice(0, 10);
  }, [players]);

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {err && <div className="text-red-400">{err}</div>}

        {/* Leaderboards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
            <div className="text-xl font-bold mb-3">Top Scorers</div>
            {topScorers.length === 0 ? (
              <div className="text-white/70">No players yet.</div>
            ) : (
              <div className="space-y-2">
                {topScorers.map((p, i) => (
                  <div
                    key={p.id}
                    className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-white/60 w-6">{i + 1}</div>
                      <div>
                        <div className="font-bold">{p.display_name}</div>
                        <div className="text-white/60 text-xs">
                          {teamNameById.get(p.team_id) || "—"} • {posLabel(p.position)}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold">⚽ {p.goals}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
            <div className="text-xl font-bold mb-3">Top Assisters</div>
            {topAssisters.length === 0 ? (
              <div className="text-white/70">No players yet.</div>
            ) : (
              <div className="space-y-2">
                {topAssisters.map((p, i) => (
                  <div
                    key={p.id}
                    className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-white/60 w-6">{i + 1}</div>
                      <div>
                        <div className="font-bold">{p.display_name}</div>
                        <div className="text-white/60 text-xs">
                          {teamNameById.get(p.team_id) || "—"} • {posLabel(p.position)}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold">🅰 {p.assists}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Teams</h1>
            <button
              onClick={load}
              className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
            >
              Refresh
            </button>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className={`p-4 rounded-2xl border transition text-left ${
                  selectedTeam === t.id
                    ? "bg-blue-600 border-blue-500"
                    : "bg-[#0b1530] border-[#1f2a60] hover:border-white/20"
                }`}
              >
                <div className="font-bold text-lg">{t.name}</div>
                <div className="text-white/60 text-sm">
                  Players: {(playersByTeam.get(t.id) || []).length}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected team players */}
        {selectedTeam && (
          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
            <h2 className="text-xl font-bold mb-3">
              {teamNameById.get(selectedTeam) || "Team"} • Squad
            </h2>

            {(playersByTeam.get(selectedTeam) || []).length === 0 ? (
              <div className="text-white/70">No players in this team.</div>
            ) : (
              <div className="space-y-2">
                {(playersByTeam.get(selectedTeam) || []).map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold">
                        {p.display_name}{" "}
                        <span className="text-white/60 font-normal">• {posLabel(p.position)}</span>
                      </div>
                      <div className="text-white/50 text-xs">
                        Ordered: GK → DEF → MID → FWD
                      </div>
                    </div>

                    <div className="text-sm text-white/70">
                      ⚽ {p.goals} • 🅰 {p.assists} • 🎮 {p.matches_played}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
