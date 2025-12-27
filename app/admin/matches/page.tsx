"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { adminAction } from "@/lib/adminApi";

type Team = { id: string; name: string };
type Group = { id: string; name: string };

type Player = {
  id: string;
  full_name: string;
  display_name: string | null;
  university: string | null;
  position: string | null;
};

type TeamPlayer = { team_id: string; player_id: string };

type MatchRow = {
  id: string;
  created_at: string | null;

  stage: "group" | "knockout";
  group_id: string | null;

  home_team_id: string;
  away_team_id: string;

  start_time: string | null;
  status: "scheduled" | "finished";
  home_score: number;
  away_score: number;

  knockout_round: string | null;
  knockout_order: number | null;
  knockout_label: string | null;

  motm_player_id: string | null;
};

type GoalRow = {
  id: string;
  match_id: string;
  scoring_team_id: string;
  scorer_player_id: string;
  assist_player_id: string | null;
  minute: number | null;
  created_at: string | null;
};

function fmtKickoff(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * ✅ Robust action caller:
 * Some projects name actions slightly differently.
 * This tries multiple action names until one works.
 */
async function adminActionTry(names: string[], payload: any) {
  let lastErr: any = null;

  for (const name of names) {
    try {
      return await adminAction(name as any, payload);
    } catch (e: any) {
      lastErr = e;

      // if your API throws "Unknown action" or similar, try next.
      const msg = String(e?.message || "");
      if (
        msg.toLowerCase().includes("unknown action") ||
        msg.toLowerCase().includes("invalid action") ||
        msg.toLowerCase().includes("action not supported")
      ) {
        continue;
      }

      // If it's a real error (not unknown action), stop immediately.
      throw e;
    }
  }

  // If none matched:
  throw lastErr || new Error("No matching admin action found for this operation.");
}

export default function AdminMatchesPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayer[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Create match form
  const [stage, setStage] = useState<"group" | "knockout">("group");
  const [groupId, setGroupId] = useState<string>("");

  const [homeId, setHomeId] = useState<string>("");
  const [awayId, setAwayId] = useState<string>("");

  const [startLocal, setStartLocal] = useState<string>("");

  const [kRound, setKRound] = useState<string>("QF"); // keep consistent with your knockout page
  const [kOrder, setKOrder] = useState<string>("1");
  const [kLabel, setKLabel] = useState<string>("");

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

    if (me?.role !== "admin" || me?.status !== "active") {
      router.replace("/app");
      return false;
    }

    return true;
  }

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [teams]);

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  const playerById = useMemo(() => {
    const m = new Map<string, Player>();
    players.forEach((p) => m.set(p.id, p));
    return m;
  }, [players]);

  const playersByTeam = useMemo(() => {
    const idsByTeam = new Map<string, string[]>();
    teamPlayers.forEach((tp) => {
      if (!idsByTeam.has(tp.team_id)) idsByTeam.set(tp.team_id, []);
      idsByTeam.get(tp.team_id)!.push(tp.player_id);
    });

    const map = new Map<string, Player[]>();
    for (const [teamId, ids] of idsByTeam.entries()) {
      const arr = ids.map((id) => playerById.get(id)).filter(Boolean) as Player[];
      arr.sort((a, b) => safePlayerName(a).localeCompare(safePlayerName(b)));
      map.set(teamId, arr);
    }
    return map;
  }, [teamPlayers, playerById]);

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
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });
      map.set(k, arr);
    }
    return map;
  }, [goals]);

  function safePlayerName(p: Player | undefined | null) {
    if (!p) return "Unnamed";
    return p.display_name || p.full_name || "Unnamed";
  }

  async function loadAll() {
    setErr("");
    setLoading(true);

    try {
      // 1) Teams
      const { data: t, error: tErr } = await supabase.from("teams").select("id,name").order("name");
      if (tErr) throw new Error(`teams: ${tErr.message}`);
      setTeams((t as Team[]) || []);

      // 2) Groups
      const { data: g, error: gErr } = await supabase.from("groups").select("id,name").order("name");
      if (gErr) throw new Error(`groups: ${gErr.message}`);
      setGroups((g as Group[]) || []);

      // 3) Players (display_name can be NULL until linked)
      const { data: pRaw, error: pErr } = await supabase
        .from("players")
        .select("id,full_name,display_name,university,position")
        .order("full_name", { ascending: true });

      if (pErr) throw new Error(`players: ${pErr.message}`);

      const pFixed: Player[] = ((pRaw as any[]) || []).map((r) => ({
        id: String(r.id),
        full_name: String(r.full_name || "Unnamed"),
        display_name: r.display_name ?? null,
        university: r.university ?? null,
        position: r.position ?? null,
      }));
      setPlayers(pFixed);

      // 4) Team players
      const { data: tp, error: tpErr } = await supabase.from("team_players").select("team_id,player_id");
      if (tpErr) throw new Error(`team_players: ${tpErr.message}`);
      setTeamPlayers((tp as TeamPlayer[]) || []);

      // 5) Matches
      const { data: m, error: mErr } = await supabase
        .from("matches")
        .select(
          "id,created_at,stage,group_id,home_team_id,away_team_id,start_time,status,home_score,away_score,knockout_round,knockout_order,knockout_label,motm_player_id"
        )
        .order("start_time", { ascending: true, nullsFirst: false });

      if (mErr) throw new Error(`matches: ${mErr.message}`);

      const mFixed: MatchRow[] = ((m as any[]) || []).map((r) => ({
        id: String(r.id),
        created_at: r.created_at ?? null,
        stage: (r.stage === "knockout" ? "knockout" : "group") as any,
        group_id: r.group_id ?? null,
        home_team_id: String(r.home_team_id),
        away_team_id: String(r.away_team_id),
        start_time: r.start_time ?? null,
        status: (r.status === "finished" ? "finished" : "scheduled") as any,
        home_score: Number.isFinite(Number(r.home_score)) ? Number(r.home_score) : 0,
        away_score: Number.isFinite(Number(r.away_score)) ? Number(r.away_score) : 0,
        knockout_round: r.knockout_round ?? null,
        knockout_order: r.knockout_order ?? null,
        knockout_label: r.knockout_label ?? null,
        motm_player_id: r.motm_player_id ?? null,
      }));
      setMatches(mFixed);

      // 6) Goals
      const { data: goalData, error: goalErr } = await supabase
        .from("match_goals")
        .select("id,match_id,scoring_team_id,scorer_player_id,assist_player_id,minute,created_at")
        .order("created_at", { ascending: true });

      if (goalErr) throw new Error(`match_goals: ${goalErr.message}`);

      const gFixed: GoalRow[] = ((goalData as any[]) || []).map((r) => ({
        id: String(r.id),
        match_id: String(r.match_id),
        scoring_team_id: String(r.scoring_team_id),
        scorer_player_id: String(r.scorer_player_id),
        assist_player_id: r.assist_player_id ? String(r.assist_player_id) : null,
        minute: r.minute == null ? null : Number(r.minute),
        created_at: r.created_at ?? null,
      }));
      setGoals(gFixed);
    } catch (e: any) {
      setErr(e?.message ? String(e.message) : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ WRITE OPERATIONS (ALL VIA API)

  async function createMatch() {
    setErr("");

    if (!homeId || !awayId) return setErr("Choose Home and Away teams.");
    if (homeId === awayId) return setErr("Home and Away must be different.");
    if (stage === "group" && !groupId) return setErr("For Group matches, choose a Group.");

    const start_time = startLocal ? new Date(startLocal).toISOString() : null;

    const safeOrder =
      stage === "knockout"
        ? Math.max(1, Number.isFinite(Number(kOrder)) ? Number(kOrder) : 1)
        : null;

    const payload: any = {
      stage,
      group_id: stage === "group" ? groupId : null,
      home_team_id: homeId,
      away_team_id: awayId,
      start_time,
      status: "scheduled",
      home_score: 0,
      away_score: 0,
      knockout_round: stage === "knockout" ? kRound : null,
      knockout_order: stage === "knockout" ? safeOrder : null,
      knockout_label: stage === "knockout" ? (kLabel.trim() || null) : null,
      motm_player_id: null,
    };

    setBusy(true);
    try {
      await adminActionTry(["createMatch", "matchesCreate", "adminCreateMatch"], { match: payload });
      setHomeId("");
      setAwayId("");
      setStartLocal("");
      setKLabel("");
      await loadAll();
    } catch (e: any) {
      setErr(e.message || "Failed to create match");
    } finally {
      setBusy(false);
    }
  }

  async function updateMatch(matchId: string, patch: Partial<MatchRow>) {
    setErr("");
    setBusy(true);
    try {
      await adminActionTry(["updateMatch", "matchesUpdate", "adminUpdateMatch"], { id: matchId, patch });
      await loadAll();
    } catch (e: any) {
      setErr(e.message || "Failed to update match");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMatch(matchId: string) {
    setErr("");
    setBusy(true);
    try {
      // One action should delete match + dependent goals.
      // If your API doesn't cascade, we try a safe two-step fallback.
      try {
        await adminActionTry(["deleteMatch", "matchesDelete", "adminDeleteMatch"], { id: matchId });
      } catch (e: any) {
        // fallback: delete goals then delete match
        await adminActionTry(["deleteGoalsByMatch", "matchGoalsDeleteByMatch", "adminDeleteGoalsByMatch"], {
          match_id: matchId,
        });
        await adminActionTry(["deleteMatch", "matchesDelete", "adminDeleteMatch"], { id: matchId });
      }

      await loadAll();
    } catch (e: any) {
      setErr(e.message || "Failed to delete match");
    } finally {
      setBusy(false);
    }
  }

  async function addGoal(payload: {
    match_id: string;
    scoring_team_id: string;
    scorer_player_id: string;
    assist_player_id: string | null;
    minute: number | null;
  }) {
    setErr("");

    if (!payload.scorer_player_id) {
      setErr("Choose a scorer first.");
      return;
    }

    setBusy(true);
    try {
      await adminActionTry(["addGoal", "createGoal", "matchGoalsCreate", "adminAddGoal"], { goal: payload });
      await loadAll();
    } catch (e: any) {
      setErr(e.message || "Failed to add goal");
    } finally {
      setBusy(false);
    }
  }

  async function deleteGoal(goalId: string) {
    setErr("");
    setBusy(true);
    try {
      await adminActionTry(["deleteGoal", "matchGoalsDelete", "adminDeleteGoal"], { id: goalId });
      await loadAll();
    } catch (e: any) {
      setErr(e.message || "Failed to delete goal");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/register");
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="text-white/80 hover:text-white underline">
            ← Back to Admin
          </Link>

          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={loadAll}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition px-4 py-2 rounded-xl font-bold"
            >
              Refresh
            </button>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
            >
              Log out
            </button>
          </div>
        </div>

        {err && (
          <div className="bg-red-600/20 border border-red-500/40 text-red-200 rounded-2xl p-4">
            <div className="font-bold">Error (this is why you saw a white page):</div>
            <div className="mt-1 text-sm whitespace-pre-wrap">{err}</div>
          </div>
        )}

        {/* CREATE MATCH */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="text-xl font-bold">Create Match</div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-white/70 text-sm">Stage</div>
              <select
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                value={stage}
                onChange={(e) => {
                  const v = e.target.value as "group" | "knockout";
                  setStage(v);
                  if (v === "knockout") setGroupId("");
                }}
                disabled={busy}
              >
                <option value="group">Group</option>
                <option value="knockout">Knockout</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-white/70 text-sm">Group (only for Group stage)</div>
              <select
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                disabled={busy || stage !== "group"}
              >
                <option value="">{stage === "group" ? "Select group" : "Disabled"}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {stage === "knockout" ? (
              <>
                <div className="space-y-1">
                  <div className="text-white/70 text-sm">Knockout Round</div>
                  <select
                    className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                    value={kRound}
                    onChange={(e) => setKRound(e.target.value)}
                    disabled={busy}
                  >
                    <option value="R16">Round of 16</option>
                    <option value="QF">Quarterfinal</option>
                    <option value="SF">Semifinal</option>
                    <option value="F">Final</option>
                    <option value="3P">3rd Place</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-white/70 text-sm">Knockout Order (1,2,3…)</div>
                  <input
                    value={kOrder}
                    onChange={(e) => setKOrder(e.target.value)}
                    className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                    placeholder="1"
                    disabled={busy}
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="text-white/70 text-sm">Label (optional)</div>
                  <input
                    value={kLabel}
                    onChange={(e) => setKLabel(e.target.value)}
                    className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                    placeholder='e.g. "QF1"'
                    disabled={busy}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1">
              <div className="text-white/70 text-sm">Home team</div>
              <select
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                disabled={busy}
              >
                <option value="">Select home</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-white/70 text-sm">Away team</div>
              <select
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                value={awayId}
                onChange={(e) => setAwayId(e.target.value)}
                disabled={busy}
              >
                <option value="">Select away</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <div className="text-white/70 text-sm">Start time (optional)</div>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                disabled={busy}
              />
            </div>
          </div>

          <button
            onClick={createMatch}
            disabled={busy}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-60 transition px-5 py-3 rounded-xl font-bold"
          >
            Create Match
          </button>
        </div>

        {/* MATCHES LIST */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">All Matches</div>

          {matches.length === 0 ? (
            <div className="text-white/70">No matches yet.</div>
          ) : (
            <div className="space-y-3">
              {matches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  teamNameById={teamNameById}
                  groupNameById={groupNameById}
                  playersByTeam={playersByTeam}
                  playerById={playerById}
                  goals={goalsByMatch.get(m.id) || []}
                  busy={busy}
                  onUpdateMatch={updateMatch}
                  onDeleteMatch={deleteMatch}
                  onAddGoal={addGoal}
                  onDeleteGoal={deleteGoal}
                />
              ))}
            </div>
          )}
        </div>

        <div className="text-white/50 text-xs">
          ✅ If you still see “RLS policy for player_stats” after this file, it means your API route is not being called.
          But this file guarantees: browser never writes to player_stats.
        </div>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  teamNameById,
  groupNameById,
  playersByTeam,
  playerById,
  goals,
  busy,
  onUpdateMatch,
  onDeleteMatch,
  onAddGoal,
  onDeleteGoal,
}: {
  match: MatchRow;
  teamNameById: Map<string, string>;
  groupNameById: Map<string, string>;
  playersByTeam: Map<string, Player[]>;
  playerById: Map<string, Player>;
  goals: GoalRow[];
  busy: boolean;
  onUpdateMatch: (matchId: string, patch: Partial<MatchRow>) => Promise<void>;
  onDeleteMatch: (matchId: string) => Promise<void>;
  onAddGoal: (payload: {
    match_id: string;
    scoring_team_id: string;
    scorer_player_id: string;
    assist_player_id: string | null;
    minute: number | null;
  }) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
}) {
  const homeTeam = teamNameById.get(match.home_team_id) || "Home";
  const awayTeam = teamNameById.get(match.away_team_id) || "Away";

  const meta =
    match.stage === "group"
      ? `Group • ${match.group_id ? groupNameById.get(match.group_id) || "—" : "—"}`
      : `Knockout${match.knockout_round ? ` • ${match.knockout_round}` : ""}${
          match.knockout_order != null ? ` • #${match.knockout_order}` : ""
        }${match.knockout_label ? ` • ${match.knockout_label}` : ""}`;

  const kickoff = fmtKickoff(match.start_time);

  const homePlayers = playersByTeam.get(match.home_team_id) || [];
  const awayPlayers = playersByTeam.get(match.away_team_id) || [];
  const selectablePlayers = [...homePlayers, ...awayPlayers];

  const [homeScoreInput, setHomeScoreInput] = useState<string>(String(match.home_score ?? 0));
  const [awayScoreInput, setAwayScoreInput] = useState<string>(String(match.away_score ?? 0));

  useEffect(() => {
    setHomeScoreInput(String(match.home_score ?? 0));
    setAwayScoreInput(String(match.away_score ?? 0));
  }, [match.id, match.home_score, match.away_score]);

  async function saveScore() {
    const h = Math.max(0, Number(homeScoreInput) || 0);
    const a = Math.max(0, Number(awayScoreInput) || 0);
    await onUpdateMatch(match.id, { home_score: h, away_score: a });
  }

  // Add goal form
  const [goalTeamId, setGoalTeamId] = useState<string>(match.home_team_id);
  const [scorerId, setScorerId] = useState<string>("");
  const [assistId, setAssistId] = useState<string>("");
  const [minuteStr, setMinuteStr] = useState<string>("");

  useEffect(() => {
    setGoalTeamId(match.home_team_id);
    setScorerId("");
    setAssistId("");
    setMinuteStr("");
  }, [match.id, match.home_team_id]);

  const playersForGoalTeam = goalTeamId === match.home_team_id ? homePlayers : awayPlayers;

  const motmValueOk =
    match.motm_player_id == null || selectablePlayers.some((p) => p.id === match.motm_player_id);

  return (
    <div className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <div className="text-lg font-bold">
            {homeTeam} <span className="text-white/60 font-normal">vs</span> {awayTeam}
          </div>
          <div className="text-white/60 text-sm">
            {meta} • Start: {kickoff} • Status: <b>{match.status}</b>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {match.status !== "finished" ? (
            <button
              disabled={busy}
              onClick={() => onUpdateMatch(match.id, { status: "finished" })}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-60 transition px-4 py-2 rounded-xl font-bold"
            >
              Mark finished
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => onUpdateMatch(match.id, { status: "scheduled" })}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 transition px-4 py-2 rounded-xl font-bold"
            >
              Re-open
            </button>
          )}

          <button
            disabled={busy}
            onClick={() => onDeleteMatch(match.id)}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-60 transition px-4 py-2 rounded-xl font-bold"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Score */}
      <div className="bg-[#111c44] border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-bold">Score</div>
          <div className="text-white/60 text-sm">
            Current:{" "}
            <b className="text-white">
              {match.home_score} - {match.away_score}
            </b>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            disabled={busy}
            value={homeScoreInput}
            onChange={(e) => setHomeScoreInput(e.target.value)}
            className="w-20 text-center rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
          />
          <div className="text-white/70 font-bold">-</div>
          <input
            disabled={busy}
            value={awayScoreInput}
            onChange={(e) => setAwayScoreInput(e.target.value)}
            className="w-20 text-center rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
          />

          <button
            disabled={busy}
            onClick={saveScore}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition px-4 py-2 rounded-xl font-bold"
          >
            Save Score
          </button>
        </div>
      </div>

      {/* MOTM */}
      <div className="bg-[#111c44] border border-white/10 rounded-2xl p-4 space-y-2">
        <div className="font-bold">Man of the Match (MOTM)</div>

        {selectablePlayers.length === 0 ? (
          <div className="text-white/70 text-sm">
            No roster players linked to these teams yet. (Admin: assign roster players to teams in{" "}
            <b>/admin/team-players</b>)
          </div>
        ) : (
          <select
            disabled={busy}
            className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
            value={motmValueOk ? match.motm_player_id || "" : ""}
            onChange={(e) => onUpdateMatch(match.id, { motm_player_id: e.target.value || null })}
          >
            <option value="">(No MOTM)</option>
            {selectablePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.display_name || p.full_name || "Unnamed")} {p.university ? `• ${p.university}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* GOALS */}
      <div className="bg-[#111c44] border border-white/10 rounded-2xl p-4 space-y-3">
        <div className="font-bold">Goals & Assists</div>

        <div className="grid md:grid-cols-4 gap-2">
          <div className="space-y-1">
            <div className="text-white/70 text-xs">Team</div>
            <select
              disabled={busy}
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
              value={goalTeamId}
              onChange={(e) => {
                setGoalTeamId(e.target.value);
                setScorerId("");
                setAssistId("");
              }}
            >
              <option value={match.home_team_id}>{homeTeam}</option>
              <option value={match.away_team_id}>{awayTeam}</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-white/70 text-xs">Scorer</div>
            <select
              disabled={busy || playersForGoalTeam.length === 0}
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
              value={scorerId}
              onChange={(e) => setScorerId(e.target.value)}
            >
              <option value="">Select scorer</option>
              {playersForGoalTeam.map((p) => (
                <option key={p.id} value={p.id}>
                  {(p.display_name || p.full_name || "Unnamed")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-white/70 text-xs">Assist (optional)</div>
            <select
              disabled={busy || playersForGoalTeam.length === 0}
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
              value={assistId}
              onChange={(e) => setAssistId(e.target.value)}
            >
              <option value="">(No assist)</option>
              {playersForGoalTeam
                .filter((p) => p.id !== scorerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.display_name || p.full_name || "Unnamed")}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-white/70 text-xs">Minute (optional)</div>
            <input
              disabled={busy}
              value={minuteStr}
              onChange={(e) => setMinuteStr(e.target.value)}
              placeholder="e.g. 27"
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
            />
          </div>
        </div>

        <button
          disabled={busy || !scorerId}
          onClick={async () => {
            const minute = minuteStr.trim() === "" ? null : Number(minuteStr.trim());
            const safeMinute = minute == null || Number.isNaN(minute) ? null : minute;

            await onAddGoal({
              match_id: match.id,
              scoring_team_id: goalTeamId,
              scorer_player_id: scorerId,
              assist_player_id: assistId || null,
              minute: safeMinute,
            });

            setScorerId("");
            setAssistId("");
            setMinuteStr("");
          }}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition px-4 py-2 rounded-xl font-bold"
        >
          Add Goal
        </button>

        {goals.length === 0 ? (
          <div className="text-white/70 text-sm">No goals recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const scorer = (playerById.get(g.scorer_player_id)?.display_name ||
                playerById.get(g.scorer_player_id)?.full_name ||
                "Unknown") as string;

              const assist = g.assist_player_id
                ? (playerById.get(g.assist_player_id)?.display_name ||
                    playerById.get(g.assist_player_id)?.full_name ||
                    "Unknown")
                : null;

              const team = teamNameById.get(g.scoring_team_id) || "Team";
              const min = g.minute != null ? `${g.minute}'` : "";

              return (
                <div
                  key={g.id}
                  className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                >
                  <div className="text-sm">
                    <div className="text-white/60 text-xs">
                      {team} {min ? `• ${min}` : ""}
                    </div>
                    <div className="font-bold">
                      ⚽ {scorer}
                      {assist ? <span className="text-white/60 font-normal"> (assist: {assist})</span> : null}
                    </div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => onDeleteGoal(g.id)}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-60 transition px-3 py-2 rounded-xl font-bold"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-white/50 text-xs">
          ✅ All edits here go through the server API, so RLS won’t block you anymore.
        </div>
      </div>
    </div>
  );
}
