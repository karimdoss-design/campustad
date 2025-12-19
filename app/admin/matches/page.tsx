"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Team = { id: string; name: string };
type Group = { id: string; name: string };

type Player = {
  id: string;
  display_name: string;
  university: string | null;
  position: string | null;
};

type TeamPlayer = { team_id: string; player_id: string };

type MatchRow = {
  id: string;
  created_at: string;
  stage: "group" | "knockout";
  group_id: string | null;

  home_team_id: string;
  away_team_id: string;

  start_time: string | null;
  status: "scheduled" | "finished";
  home_score: number;
  away_score: number;

  knockout_round: string | null;
  knockout_order: number;
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
  sort_order: number | null;
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
    const map = new Map<string, Player[]>();
    const idsByTeam = new Map<string, string[]>();

    teamPlayers.forEach((tp) => {
      if (!idsByTeam.has(tp.team_id)) idsByTeam.set(tp.team_id, []);
      idsByTeam.get(tp.team_id)!.push(tp.player_id);
    });

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
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      map.set(k, arr);
    }

    return map;
  }, [goals]);

  async function load() {
    setLoading(true);
    setErr("");

    const { data: t, error: tErr } = await supabase.from("teams").select("id,name").order("name");
    if (tErr) return fail(tErr.message);
    setTeams((t as Team[]) || []);

    const { data: g, error: gErr } = await supabase.from("groups").select("id,name").order("name");
    if (gErr) return fail(gErr.message);
    setGroups((g as Group[]) || []);

    const { data: p, error: pErr } = await supabase
      .from("players")
      .select("id,display_name,university,position")
      .order("display_name");
    if (pErr) return fail(pErr.message);
    setPlayers((p as Player[]) || []);

    const { data: tp, error: tpErr } = await supabase.from("team_players").select("team_id,player_id");
    if (tpErr) return fail(tpErr.message);
    setTeamPlayers((tp as TeamPlayer[]) || []);

    const { data: m, error: mErr } = await supabase
      .from("matches")
      .select(
        "id,created_at,stage,group_id,home_team_id,away_team_id,start_time,status,home_score,away_score,knockout_round,knockout_order,knockout_label,motm_player_id"
      )
      .order("start_time", { ascending: true, nullsFirst: false });
    if (mErr) return fail(mErr.message);
    setMatches((m as MatchRow[]) || []);

    const { data: gl, error: glErr } = await supabase
      .from("match_goals")
      .select("id,match_id,scoring_team_id,scorer_player_id,assist_player_id,minute,sort_order,created_at")
      .order("created_at", { ascending: true });
    if (glErr) return fail(glErr.message);
    setGoals((gl as GoalRow[]) || []);

    setLoading(false);
  }

  function fail(message: string) {
    setErr(message);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createMatch() {
    setErr("");

    if (!homeId || !awayId) return setErr("Choose Home and Away teams.");
    if (homeId === awayId) return setErr("Home and Away must be different.");
    if (stage === "group" && !groupId) return setErr("For Group matches, choose a Group.");

    const start_time = startLocal ? new Date(startLocal).toISOString() : null;

    // ✅ NEVER allow null knockout_order (your DB requires NOT NULL)
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

      // keep 0-0 initially (works with NOT NULL constraints)
      home_score: 0,
      away_score: 0,

      knockout_round: stage === "knockout" ? kRound : null,
      knockout_order: safeOrder,
      knockout_label: stage === "knockout" ? (kLabel.trim() || null) : null,

      motm_player_id: null,
    };

    const { error } = await supabase.from("matches").insert(payload);
    if (error) return setErr(error.message);

    setHomeId("");
    setAwayId("");
    setStartLocal("");
    setKLabel("");
    await load();
  }

  async function updateScore(matchId: string, home: number, away: number) {
    setErr("");
    const { error } = await supabase.from("matches").update({ home_score: home, away_score: away }).eq("id", matchId);
    if (error) setErr(error.message);
    else await load();
  }

  async function setStatus(matchId: string, status: "scheduled" | "finished") {
    setErr("");
    const { error } = await supabase.from("matches").update({ status }).eq("id", matchId);
    if (error) setErr(error.message);
    else await load();
  }

  async function deleteMatch(matchId: string) {
    setErr("");
    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) setErr(error.message);
    else await load();
  }

  async function setMotm(matchId: string, motmId: string | null) {
    setErr("");
    const { error } = await supabase.from("matches").update({ motm_player_id: motmId }).eq("id", matchId);
    if (error) setErr(error.message);
    else await load();
  }

  async function addGoal(payload: {
    match_id: string;
    scoring_team_id: string;
    scorer_player_id: string;
    assist_player_id: string | null;
    minute: number | null;
  }) {
    setErr("");
    const { error } = await supabase.from("match_goals").insert({
      ...payload,
      sort_order: 0,
    });
    if (error) setErr(error.message);
    else await load();
  }

  async function deleteGoal(goalId: string) {
    setErr("");
    const { error } = await supabase.from("match_goals").delete().eq("id", goalId);
    if (error) setErr(error.message);
    else await load();
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
            <p className="text-white/70">Create matches, save scores, add goals/assists, set MOTM.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
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

        {err && <div className="text-red-400">{err}</div>}

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
                  <div className="text-white/70 text-sm">Knockout Order (1,2,3...)</div>
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
            Note: Match starts at 0-0. You can edit score, goals, assists, minute, and MOTM anytime.
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
  onDeleteGoal: (goalId: string) => Promise<void>;
}) {
  const homeTeam = teamNameById.get(match.home_team_id) || "Home";
  const awayTeam = teamNameById.get(match.away_team_id) || "Away";

  const meta =
    match.stage === "group"
      ? `Group • ${match.group_id ? groupNameById.get(match.group_id) || "—" : "—"}`
      : `Knockout${match.knockout_round ? ` • ${match.knockout_round}` : ""}${
          match.knockout_order != null ? ` • #${match.knockout_order}` : ""
        }`;

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

  // Add goal form state
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

  const scoreText = `${match.home_score} - ${match.away_score}`;

  return (
    <div className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4 space-y-4">
      {/* header */}
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
            Current: <b className="text-white">{scoreText}</b>
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
              const assist = g.assist_player_id
                ? playerById.get(g.assist_player_id)?.display_name || "Unknown"
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
                    onClick={() => onDeleteGoal(g.id)}
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
          (Stats updates are handled by your database functions/triggers you already set up.)
        </div>
      </div>
    </div>
  );
}
