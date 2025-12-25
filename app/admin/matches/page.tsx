"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Team = { id: string; name: string };
type Group = { id: string; name: string };

// We load players from roster (players table)
type Player = {
  id: string;
  display_name: string;
  university: string | null;
  position: string | null;
};

// Many schemas use team_players(team_id, player_id)
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

  // Optional columns (some DBs may not have them)
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
 * Optional: call a Supabase RPC if it exists, but NEVER break the page if not.
 * If you later add SQL functions like:
 *  - recalc_match_stats(match_id uuid)
 *  - grade_predictions_for_match(match_id uuid)
 * this page will automatically use them.
 */
async function maybeRpc(fnName: string, args: Record<string, any>) {
  try {
    const { error } = await supabase.rpc(fnName as any, args as any);
    // If function doesn't exist, Supabase often returns 42883 (undefined_function)
    if (error) {
      // ignore missing function; show other errors in console
      if (String((error as any).code) === "42883") return;
      console.warn(`[RPC ${fnName}]`, error);
    }
  } catch (e) {
    console.warn(`[RPC ${fnName}] crashed`, e);
  }
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
  const [err, setErr] = useState("");

  // Create match form
  const [stage, setStage] = useState<"group" | "knockout">("group");
  const [groupId, setGroupId] = useState<string>("");

  const [homeId, setHomeId] = useState<string>("");
  const [awayId, setAwayId] = useState<string>("");

  const [startLocal, setStartLocal] = useState<string>("");

  const [kRound, setKRound] = useState<string>("Quarterfinal");
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
      arr.sort((a, b) => a.display_name.localeCompare(b.display_name));
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

      // 3) Players (try display_name, fallback full_name)
      const { data: pRaw, error: pErr } = await supabase
        .from("players")
        .select("id,display_name,full_name,university,position")
        .order("display_name", { ascending: true });

      if (pErr) throw new Error(`players: ${pErr.message}`);

      const pFixed: Player[] = ((pRaw as any[]) || []).map((r) => ({
        id: String(r.id),
        display_name: String(r.display_name || r.full_name || "Unnamed"),
        university: r.university ?? null,
        position: r.position ?? null,
      }));
      setPlayers(pFixed);

      // 4) Team players
      const { data: tp, error: tpErr } = await supabase.from("team_players").select("team_id,player_id");
      if (tpErr) throw new Error(`team_players: ${tpErr.message}`);
      setTeamPlayers((tp as TeamPlayer[]) || []);

      // 5) Matches (try full select; fallback if columns missing)
      let mData: any[] | null = null;

      const fullSelect =
        "id,created_at,stage,group_id,home_team_id,away_team_id,start_time,status,home_score,away_score,knockout_round,knockout_order,knockout_label,motm_player_id";

      const basicSelect =
        "id,created_at,stage,group_id,home_team_id,away_team_id,start_time,status,home_score,away_score";

      const fullTry = await supabase
        .from("matches")
        .select(fullSelect)
        .order("start_time", { ascending: true, nullsFirst: false });

      if (fullTry.error) {
        // fallback
        const basicTry = await supabase
          .from("matches")
          .select(basicSelect)
          .order("start_time", { ascending: true, nullsFirst: false });

        if (basicTry.error) throw new Error(`matches: ${basicTry.error.message}`);
        mData = (basicTry.data as any[]) || [];
      } else {
        mData = (fullTry.data as any[]) || [];
      }

      const mFixed: MatchRow[] = (mData || []).map((r) => ({
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

      // 6) Goals (table name: match_goals, fallback to match_goals minimal)
      const goalTry = await supabase
        .from("match_goals")
        .select("id,match_id,scoring_team_id,scorer_player_id,assist_player_id,minute,created_at")
        .order("created_at", { ascending: true });

      if (goalTry.error) throw new Error(`match_goals: ${goalTry.error.message}`);

      const gFixed: GoalRow[] = ((goalTry.data as any[]) || []).map((r) => ({
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

  async function createMatch() {
    setErr("");

    if (!homeId || !awayId) return setErr("Choose Home and Away teams.");
    if (homeId === awayId) return setErr("Home and Away must be different.");
    if (stage === "group" && !groupId) return setErr("For Group matches, choose a Group.");

    const start_time = startLocal ? new Date(startLocal).toISOString() : null;

    const safeOrder =
      stage === "knockout"
        ? Math.max(1, Number.isFinite(Number(kOrder)) ? Number(kOrder) : 1)
        : 0;

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

    const { data, error } = await supabase.from("matches").insert(payload).select("id").single();
    if (error) return setErr(error.message);

    // optional: recalc
    if (data?.id) {
      await maybeRpc("recalc_match_stats", { match_id: data.id });
      await maybeRpc("grade_predictions_for_match", { match_id: data.id });
    }

    setHomeId("");
    setAwayId("");
    setStartLocal("");
    setKLabel("");
    await loadAll();
  }

  async function updateScore(matchId: string, home: number, away: number) {
    setErr("");
    const { error } = await supabase.from("matches").update({ home_score: home, away_score: away }).eq("id", matchId);
    if (error) return setErr(error.message);

    await maybeRpc("recalc_match_stats", { match_id: matchId });
    await maybeRpc("grade_predictions_for_match", { match_id: matchId });
    await loadAll();
  }

  async function setStatus(matchId: string, status: "scheduled" | "finished") {
    setErr("");
    const { error } = await supabase.from("matches").update({ status }).eq("id", matchId);
    if (error) return setErr(error.message);

    await maybeRpc("recalc_match_stats", { match_id: matchId });
    await maybeRpc("grade_predictions_for_match", { match_id: matchId });
    await loadAll();
  }

  async function deleteMatch(matchId: string) {
    setErr("");

    // delete goals first (safe)
    const { error: gErr } = await supabase.from("match_goals").delete().eq("match_id", matchId);
    if (gErr) return setErr(gErr.message);

    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) return setErr(error.message);

    await maybeRpc("recalc_match_stats", { match_id: matchId });
    await loadAll();
  }

  async function setMotm(matchId: string, motmId: string | null) {
    setErr("");
    const { error } = await supabase.from("matches").update({ motm_player_id: motmId }).eq("id", matchId);
    if (error) return setErr(error.message);

    await maybeRpc("recalc_match_stats", { match_id: matchId });
    await loadAll();
  }

  async function addGoal(payload: {
    match_id: string;
    scoring_team_id: string;
    scorer_player_id: string;
    assist_player_id: string | null;
    minute: number | null;
  }) {
    setErr("");

    const { error } = await supabase.from("match_goals").insert(payload);
    if (error) return setErr(error.message);

    await maybeRpc("recalc_match_stats", { match_id: payload.match_id });
    await maybeRpc("grade_predictions_for_match", { match_id: payload.match_id });
    await loadAll();
  }

  async function deleteGoal(goalId: string, matchId: string) {
    setErr("");
    const { error } = await supabase.from("match_goals").delete().eq("id", goalId);
    if (error) return setErr(error.message);

    await maybeRpc("recalc_match_stats", { match_id: matchId });
    await maybeRpc("grade_predictions_for_match", { match_id: matchId });
    await loadAll();
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
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Matches</h1>
            <p className="text-white/70">
              Create matches, set score, add goals/assists, set MOTM. This page is the “engine” that powers standings,
              leaderboards, and predictions.
            </p>
            <div className="text-white/50 text-xs mt-2">
              Loaded: {teams.length} teams • {groups.length} groups • {players.length} players • {matches.length} matches
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadAll}
              className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
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
            <div className="mt-2 text-xs text-red-200/80">
              If this says something like <b>“column does not exist”</b> or <b>“relation does not exist”</b>, send me that
              exact message and I’ll match your DB schema perfectly.
            </div>
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
                disabled={stage !== "group"}
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
                  >
                    <option value="Round of 16">Round of 16</option>
                    <option value="Quarterfinal">Quarterfinal</option>
                    <option value="Semifinal">Semifinal</option>
                    <option value="Final">Final</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-white/70 text-sm">Knockout Order (1,2,3…)</div>
                  <input
                    value={kOrder}
                    onChange={(e) => setKOrder(e.target.value)}
                    className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                    placeholder="1"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="text-white/70 text-sm">Label (optional)</div>
                  <input
                    value={kLabel}
                    onChange={(e) => setKLabel(e.target.value)}
                    className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                    placeholder='e.g. "QF1"'
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
              />
            </div>
          </div>

          <button
            onClick={createMatch}
            className="bg-green-600 hover:bg-green-500 transition px-5 py-3 rounded-xl font-bold"
          >
            Create Match
          </button>

          <div className="text-white/50 text-xs">
            Tip: After you mark a match <b>finished</b>, standings + leaderboards will update (either directly from matches
            table, or via your DB triggers/RPC).
          </div>
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
                  onUpdateScore={updateScore}
                  onSetStatus={setStatus}
                  onDeleteMatch={deleteMatch}
                  onSetMotm={setMotm}
                  onAddGoal={addGoal}
                  onDeleteGoal={deleteGoal}
                />
              ))}
            </div>
          )}
        </div>

        <div className="text-white/50 text-xs">
          If your DB has triggers/functions, this page will automatically “power”:
          <br />• Player stats (goals/assists/MOTM)
          <br />• Standings (computed from finished group matches)
          <br />• Prediction scoring (fan points)
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
  onUpdateScore,
  onSetStatus,
  onDeleteMatch,
  onSetMotm,
  onAddGoal,
  onDeleteGoal,
}: {
  match: MatchRow;
  teamNameById: Map<string, string>;
  groupNameById: Map<string, string>;
  playersByTeam: Map<string, Player[]>;
  playerById: Map<string, Player>;
  goals: GoalRow[];
  onUpdateScore: (matchId: string, home: number, away: number) => Promise<void>;
  onSetStatus: (matchId: string, status: "scheduled" | "finished") => Promise<void>;
  onDeleteMatch: (matchId: string) => Promise<void>;
  onSetMotm: (matchId: string, motmId: string | null) => Promise<void>;
  onAddGoal: (payload: {
    match_id: string;
    scoring_team_id: string;
    scorer_player_id: string;
    assist_player_id: string | null;
    minute: number | null;
  }) => Promise<void>;
  onDeleteGoal: (goalId: string, matchId: string) => Promise<void>;
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
    await onUpdateScore(match.id, h, a);
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
              onClick={() => onSetStatus(match.id, "finished")}
              className="bg-green-600 hover:bg-green-500 transition px-4 py-2 rounded-xl font-bold"
            >
              Mark finished
            </button>
          ) : (
            <button
              onClick={() => onSetStatus(match.id, "scheduled")}
              className="bg-yellow-600 hover:bg-yellow-500 transition px-4 py-2 rounded-xl font-bold"
            >
              Re-open
            </button>
          )}

          <button
            onClick={() => onDeleteMatch(match.id)}
            className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
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
            value={homeScoreInput}
            onChange={(e) => setHomeScoreInput(e.target.value)}
            className="w-20 text-center rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
          />
          <div className="text-white/70 font-bold">-</div>
          <input
            value={awayScoreInput}
            onChange={(e) => setAwayScoreInput(e.target.value)}
            className="w-20 text-center rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
          />

          <button
            onClick={saveScore}
            className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
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
            No roster players linked to these teams yet. (Admin: assign roster players to teams in <b>/admin/team-players</b>)
          </div>
        ) : (
          <select
            className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
            value={match.motm_player_id || ""}
            onChange={(e) => onSetMotm(match.id, e.target.value || null)}
          >
            <option value="">(No MOTM)</option>
            {selectablePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} {p.university ? `• ${p.university}` : ""}
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
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
              value={scorerId}
              onChange={(e) => setScorerId(e.target.value)}
              disabled={playersForGoalTeam.length === 0}
            >
              <option value="">Select scorer</option>
              {playersForGoalTeam.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-white/70 text-xs">Assist (optional)</div>
            <select
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
              value={assistId}
              onChange={(e) => setAssistId(e.target.value)}
              disabled={playersForGoalTeam.length === 0}
            >
              <option value="">(No assist)</option>
              {playersForGoalTeam
                .filter((p) => p.id !== scorerId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-white/70 text-xs">Minute (optional)</div>
            <input
              value={minuteStr}
              onChange={(e) => setMinuteStr(e.target.value)}
              placeholder="e.g. 27"
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
            />
          </div>
        </div>

        <button
          onClick={() => {
            if (!scorerId) return;

            const minute = minuteStr.trim() === "" ? null : Number(minuteStr.trim());
            const safeMinute = minute == null || Number.isNaN(minute) ? null : minute;

            onAddGoal({
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
          className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
        >
          Add Goal
        </button>

        {goals.length === 0 ? (
          <div className="text-white/70 text-sm">No goals recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const scorer = playerById.get(g.scorer_player_id)?.display_name || "Unknown";
              const assist = g.assist_player_id ? playerById.get(g.assist_player_id)?.display_name || "Unknown" : null;

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
                    onClick={() => onDeleteGoal(g.id, match.id)}
                    className="bg-red-600 hover:bg-red-500 transition px-3 py-2 rounded-xl font-bold"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-white/50 text-xs">
          If you have DB triggers/functions, stats + predictions are recalculated automatically. If not, tell me and I’ll
          give you the exact SQL to make it 100% automatic.
        </div>
      </div>
    </div>
  );
}
