"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Team = { id: string; name: string };
type Group = { id: string; name: string };

type MatchRow = {
  id: string;
  stage: "group" | "knockout";
  group_id: string | null;
  knockout_round: string | null;

  home_team_id: string;
  away_team_id: string;

  start_time: string | null;
  status: "scheduled" | "finished";
  home_score: number | null;
  away_score: number | null;

  motm_player_id: string | null;
};

type Player = { id: string; display_name: string | null; full_name: string | null };

type GoalRow = {
  id: string;
  match_id: string;
  scoring_team_id: string;
  scorer_player_id: string;
  assist_player_id: string | null;
  minute: number | null;
  created_at: string;
};

function fmtKickoff(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function safePlayerName(p: Player | null | undefined) {
  const n =
    (p?.display_name && p.display_name.trim()) ||
    (p?.full_name && p.full_name.trim()) ||
    "";
  return n || "Unknown";
}

export default function MatchesPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);

  // ✅ only one match open at a time
  const [openMatchId, setOpenMatchId] = useState<string | null>(null);

  // used to avoid spamming reloads when many events fire
  const reloadTimer = useRef<number | null>(null);

  function scheduleReload() {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => {
      load();
    }, 250);
  }

  async function load() {
    setErr("");

    // Only show full-page loader the first time
    setLoading((prev) => prev || matches.length === 0);

    const { data: t, error: tErr } = await supabase.from("teams").select("id,name").order("name");
    if (tErr) return fail(tErr.message);
    setTeams((t as Team[]) || []);

    const { data: g, error: gErr } = await supabase.from("groups").select("id,name").order("name");
    if (gErr) return fail(gErr.message);
    setGroups((g as Group[]) || []);

    // ✅ FIX: fetch full_name too + don’t rely on display_name existing
    const { data: p, error: pErr } = await supabase
      .from("players")
      .select("id,display_name,full_name")
      .order("created_at", { ascending: true });
    if (pErr) return fail(pErr.message);
    setPlayers((p as Player[]) || []);

    const { data: m, error: mErr } = await supabase
      .from("matches")
      .select(
        "id,stage,group_id,knockout_round,home_team_id,away_team_id,start_time,status,home_score,away_score,motm_player_id"
      )
      .order("start_time", { ascending: true, nullsFirst: false });

    if (mErr) return fail(mErr.message);
    setMatches((m as MatchRow[]) || []);

    const { data: gl, error: glErr } = await supabase
      .from("match_goals")
      .select("id,match_id,scoring_team_id,scorer_player_id,assist_player_id,minute,created_at")
      .order("created_at", { ascending: true });

    if (glErr) return fail(glErr.message);
    setGoals((gl as GoalRow[]) || []);

    setLoading(false);
  }

  function fail(message: string) {
    setErr(message);
    setLoading(false);
  }

  // initial load
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ LIVE SUBSCRIPTIONS: when admin changes matches/goals/teams/players => reload
  useEffect(() => {
    const channel = supabase
      .channel("app_matches_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "match_goals" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => scheduleReload())
      .subscribe();

    // backup auto-refresh every 25s (useful if websocket drops)
    const interval = window.setInterval(() => scheduleReload(), 25_000);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [teams]);

  const groupName = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  // ✅ FIX: map id -> (display_name || full_name)
  const playerName = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => {
      m.set(p.id, safePlayerName(p));
    });
    return m;
  }, [players]);

  const goalsByMatch = useMemo(() => {
    const map = new Map<string, GoalRow[]>();
    goals.forEach((g) => {
      if (!map.has(g.match_id)) map.set(g.match_id, []);
      map.get(g.match_id)!.push(g);
    });

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ma = a.minute ?? 10_000;
        const mb = b.minute ?? 10_000;
        if (ma !== mb) return ma - mb;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      map.set(k, arr);
    }

    return map;
  }, [goals]);

  const upcoming = useMemo(() => matches.filter((m) => m.status !== "finished"), [matches]);
  const finished = useMemo(() => matches.filter((m) => m.status === "finished"), [matches]);

  if (loading) return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Matches</h1>
            <p className="text-white/60 text-sm">Live updates • Click a match to see scorers, assists, and MOTM.</p>
          </div>
          <button onClick={load} className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold">
            Refresh
          </button>
        </div>

        {err && <div className="text-red-400">{err}</div>}

        {/* UPCOMING */}
        <Section title="Upcoming Matches">
          {upcoming.length === 0 ? (
            <div className="text-white/70">No upcoming matches.</div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((m) => (
                <MatchCard
                  key={m.id}
                  m={m}
                  open={openMatchId === m.id}
                  setOpen={(v) => setOpenMatchId(v ? m.id : null)}
                  teamName={teamName}
                  groupName={groupName}
                  playerName={playerName}
                  goals={goalsByMatch.get(m.id) || []}
                />
              ))}
            </div>
          )}
        </Section>

        {/* FINISHED */}
        <Section title="Finished Matches">
          {finished.length === 0 ? (
            <div className="text-white/70">No finished matches yet.</div>
          ) : (
            <div className="space-y-3">
              {finished.map((m) => (
                <MatchCard
                  key={m.id}
                  m={m}
                  open={openMatchId === m.id}
                  setOpen={(v) => setOpenMatchId(v ? m.id : null)}
                  teamName={teamName}
                  groupName={groupName}
                  playerName={playerName}
                  goals={goalsByMatch.get(m.id) || []}
                />
              ))}
            </div>
          )}
        </Section>

        <div className="text-white/40 text-xs">
          Tip: If multiple changes happen quickly (score + goals + MOTM), the page auto-updates once after a short delay.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
      <div className="text-xl font-bold mb-3">{title}</div>
      {children}
    </div>
  );
}

function MatchCard({
  m,
  open,
  setOpen,
  teamName,
  groupName,
  playerName,
  goals,
}: {
  m: MatchRow;
  open: boolean;
  setOpen: (v: boolean) => void;
  teamName: Map<string, string>;
  groupName: Map<string, string>;
  playerName: Map<string, string>;
  goals: GoalRow[];
}) {
  const home = teamName.get(m.home_team_id) || "TBD";
  const away = teamName.get(m.away_team_id) || "TBD";

  const meta =
    m.stage === "group"
      ? `Group • ${m.group_id ? groupName.get(m.group_id) || "—" : "—"}`
      : `Knockout${m.knockout_round ? ` • ${m.knockout_round}` : ""}`;

  const score = m.home_score == null || m.away_score == null ? "—" : `${m.home_score} - ${m.away_score}`;

  const motm = m.motm_player_id ? playerName.get(m.motm_player_id) || "Unknown" : null;

  return (
    <div className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4">
      <button onClick={() => setOpen(!open)} className="w-full text-left" title="Click to open match details">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div>
            <div className="text-lg font-bold">
              {home} <span className="text-white/60 font-normal">vs</span> {away}
            </div>
            <div className="text-white/60 text-sm">
              {meta} • {fmtKickoff(m.start_time)} • <b>{m.status}</b>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="font-bold text-lg">{score}</div>
            <div className="text-white/60 text-sm">{open ? "▲" : "▼"}</div>
          </div>
        </div>
      </button>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="bg-[#111c44] border border-white/10 rounded-xl p-3">
            <div className="font-bold">MOTM</div>
            <div className="text-white/70 text-sm">
              {motm ? motm : <span className="text-white/50">No MOTM set yet.</span>}
            </div>
          </div>

          <div className="bg-[#111c44] border border-white/10 rounded-xl p-3">
            <div className="font-bold mb-2">Goals</div>

            {goals.length === 0 ? (
              <div className="text-white/50 text-sm">No goals recorded for this match.</div>
            ) : (
              <div className="space-y-2">
                {goals.map((g) => {
                  const scorer = playerName.get(g.scorer_player_id) || "Unknown";
                  const assist = g.assist_player_id ? playerName.get(g.assist_player_id) || "Unknown" : null;
                  const t = teamName.get(g.scoring_team_id) || "Team";
                  const min = g.minute != null ? `${g.minute}'` : "";

                  return (
                    <div key={g.id} className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3">
                      <div className="text-white/60 text-xs">
                        {t} {min ? `• ${min}` : ""}
                      </div>
                      <div className="font-bold">
                        ⚽ {scorer}
                        {assist ? <span className="text-white/60 font-normal"> (assist: {assist})</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
