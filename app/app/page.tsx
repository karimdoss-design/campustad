"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Team = {
  id: string;
  name: string;
};

type PlayerStats = {
  goals: number | null;
  assists: number | null;
  matches_played: number | null;
};

type PlayerRow = {
  id: string;
  name: string;
  team_id: string | null;
  position: string | null;
  goals: number;
  assists: number;
  matches_played: number;
};

function positionRank(posRaw: string | null) {
  const p = (posRaw || "").toLowerCase().trim();
  if (p.includes("gk") || p.includes("goal")) return 1;
  if (p.includes("def")) return 2;
  if (p.includes("mid")) return 3;
  if (p.includes("for") || p.includes("att") || p.includes("str")) return 4;
  return 9;
}

function posLabel(posRaw: string | null) {
  const p = (posRaw || "").toLowerCase().trim();
  if (p.includes("gk") || p.includes("goal")) return "GK";
  if (p.includes("def")) return "DEF";
  if (p.includes("mid")) return "MID";
  if (p.includes("for") || p.includes("att") || p.includes("str")) return "FWD";
  return posRaw ? posRaw.toUpperCase() : "—";
}

function safeName(x: any) {
  const n =
    x?.display_name ??
    x?.full_name ??
    x?.name ??
    x?.username ??
    x?.email ??
    null;

  return typeof n === "string" && n.trim() ? n.trim() : "Unknown";
}

function statsFrom(pl: any): PlayerStats | null {
  const raw = pl?.player_stats;
  if (!raw) return null;

  // Supabase sometimes returns embedded relations as array
  if (Array.isArray(raw)) return raw[0] ?? null;

  // Or as object
  return raw as PlayerStats;
}

export default function HomePage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function doLogout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // even if signout fails, still go to register
    }
    router.replace("/register");
  }

  async function load() {
    setLoading(true);
    setErr("");

    // 1) TEAMS
    const { data: t, error: tErr } = await supabase
      .from("teams")
      .select("id,name")
      .order("name");

    if (tErr) {
      setErr(`Teams error: ${tErr.message}`);
      setLoading(false);
      return;
    }
    setTeams((t as Team[]) || []);

    // 2) TEAM PLAYERS + PLAYER + STATS
    const { data: tp, error: tpErr } = await supabase
      .from("team_players")
      .select(
        `
        team_id,
        players (
          id,
          full_name,
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
      setErr(`Team players error: ${tpErr.message}`);
      setLoading(false);
      return;
    }

    const flatAssigned: PlayerRow[] = [];
    (tp || []).forEach((row: any) => {
      const pl = row?.players;
      if (!pl) return;

      const s = statsFrom(pl);

      flatAssigned.push({
        id: pl.id,
        name: safeName(pl),
        team_id: row.team_id ?? null,
        position: pl.position ?? null,
        goals: Number(s?.goals ?? 0),
        assists: Number(s?.assists ?? 0),
        matches_played: Number(s?.matches_played ?? 0),
      });
    });

    // 3) ALSO FETCH ALL ROSTER PLAYERS
    const { data: allP, error: allPErr } = await supabase
      .from("players")
      .select(
        `
        id,
        full_name,
        display_name,
        position,
        player_stats (
          goals,
          assists,
          matches_played
        )
      `
      )
      .order("created_at", { ascending: true });

    if (allPErr) {
      setPlayers(flatAssigned);
      setLoading(false);
      return;
    }

    // Map team assignment by player_id from tp (team_players)
    const assignedTeamByPlayer = new Map<string, string>();
    (tp || []).forEach((row: any) => {
      const pl = row?.players;
      if (!pl?.id) return;
      if (row?.team_id) assignedTeamByPlayer.set(pl.id, row.team_id);
    });

    const allFlat: PlayerRow[] = (allP || []).map((pl: any) => {
      const s = statsFrom(pl);
      return {
        id: pl.id,
        name: safeName(pl),
        team_id: assignedTeamByPlayer.get(pl.id) ?? null,
        position: pl.position ?? null,
        goals: Number(s?.goals ?? 0),
        assists: Number(s?.assists ?? 0),
        matches_played: Number(s?.matches_played ?? 0),
      };
    });

    setPlayers(allFlat);
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
      if (!p.team_id) return;
      if (!map.has(p.team_id)) map.set(p.team_id, []);
      map.get(p.team_id)!.push(p);
    });

    for (const [teamId, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ra = positionRank(a.position);
        const rb = positionRank(b.position);
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
      map.set(teamId, arr);
    }

    return map;
  }, [players]);

  const unassignedPlayers = useMemo(() => {
    const arr = players.filter((p) => !p.team_id);
    arr.sort((a, b) => a.name.localeCompare(b.name));
    return arr;
  }, [players]);

  const topScorers = useMemo(() => {
    const arr = [...players].filter((p) => p.team_id);
    arr.sort((a, b) => {
      if (b.goals !== a.goals) return b.goals - a.goals;
      if (b.assists !== a.assists) return b.assists - a.assists;
      return a.name.localeCompare(b.name);
    });
    return arr.slice(0, 10);
  }, [players]);

  const topAssisters = useMemo(() => {
    const arr = [...players].filter((p) => p.team_id);
    arr.sort((a, b) => {
      if (b.assists !== a.assists) return b.assists - a.assists;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return a.name.localeCompare(b.name);
    });
    return arr.slice(0, 10);
  }, [players]);

  if (loading) {
    return <div className="min-h-screen text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {err && (
          <div className="bg-red-600/20 border border-red-500/40 text-red-200 rounded-2xl p-4">
            {err}
          </div>
        )}

        {/* Leaderboards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-[#111c44]/75 backdrop-blur border border-white/10 rounded-2xl p-5">
            <div className="text-xl font-bold mb-3">Top Scorers</div>
            {topScorers.length === 0 ? (
              <div className="text-white/70">No team players yet.</div>
            ) : (
              <div className="space-y-2">
                {topScorers.map((p, i) => (
                  <div
                    key={p.id}
                    className="bg-[#0b1530]/65 border border-[#1f2a60]/70 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-white/60 w-6">{i + 1}</div>
                      <div>
                        <div className="font-bold">{p.name}</div>
                        <div className="text-white/60 text-xs">
                          {p.team_id ? teamNameById.get(p.team_id) || "—" : "—"} • {posLabel(p.position)}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold">⚽ {p.goals}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#111c44]/75 backdrop-blur border border-white/10 rounded-2xl p-5">
            <div className="text-xl font-bold mb-3">Top Assisters</div>
            {topAssisters.length === 0 ? (
              <div className="text-white/70">No team players yet.</div>
            ) : (
              <div className="space-y-2">
                {topAssisters.map((p, i) => (
                  <div
                    key={p.id}
                    className="bg-[#0b1530]/65 border border-[#1f2a60]/70 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-white/60 w-6">{i + 1}</div>
                      <div>
                        <div className="font-bold">{p.name}</div>
                        <div className="text-white/60 text-xs">
                          {p.team_id ? teamNameById.get(p.team_id) || "—" : "—"} • {posLabel(p.position)}
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
        <div className="bg-[#111c44]/75 backdrop-blur border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Teams</h1>

            {/* ✅ Buttons on the right */}
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
              >
                Refresh
              </button>

              <button
                onClick={doLogout}
                className="bg-white/10 hover:bg-white/15 transition px-4 py-2 rounded-xl font-bold border border-white/10"
                title="Logout"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className={`p-4 rounded-2xl border transition text-left ${
                  selectedTeam === t.id
                    ? "bg-blue-600/50 border-blue-400/40"
                    : "bg-[#0b1530]/65 border-[#1f2a60]/70 hover:border-white/20"
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
          <div className="bg-[#111c44]/75 backdrop-blur border border-white/10 rounded-2xl p-5">
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
                    className="bg-[#0b1530]/65 border border-[#1f2a60]/70 rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold">
                        {p.name}{" "}
                        <span className="text-white/60 font-normal">• {posLabel(p.position)}</span>
                      </div>
                      <div className="text-white/50 text-xs">Ordered: GK → DEF → MID → FWD</div>
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

        {/* Unassigned roster players */}
        {unassignedPlayers.length > 0 && (
          <div className="bg-[#111c44]/55 backdrop-blur border border-white/10 rounded-2xl p-5">
            <h2 className="text-xl font-bold mb-2">Unassigned Players</h2>
            <div className="text-white/60 text-sm mb-3">
              These were created by admin but not added to a team yet.
            </div>

            <div className="space-y-2">
              {unassignedPlayers.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#0b1530]/55 border border-[#1f2a60]/60 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-white/60 text-xs">{posLabel(p.position)}</div>
                  </div>
                  <div className="text-sm text-white/70">
                    ⚽ {p.goals} • 🅰 {p.assists} • 🎮 {p.matches_played}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
