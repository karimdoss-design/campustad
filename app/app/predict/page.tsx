"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type MatchRow = {
  id: string;
  stage: "group" | "knockout";
  start_time: string | null;
  status: "scheduled" | "finished";
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  knockout_round: string | null;
  knockout_label: string | null;
};

type Team = { id: string; name: string };

type MyPred = {
  match_id: string;
  user_id: string;
  home_pred: number;
  away_pred: number;
};

type LeaderRow = {
  user_id: string;
  name: string;
  university: string | null;
  total_points: number;
  predictions_count: number;
};

const ROUND_LABEL: Record<string, string> = {
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  F: "Final",
  "3P": "3rd Place",
};

function prettyRound(code: string | null) {
  if (!code) return "Knockout";
  return ROUND_LABEL[code] || `Knockout • ${code}`;
}

export default function PredictPage() {
  const router = useRouter();
  const [meId, setMeId] = useState<string | null>(null);
  const [meRole, setMeRole] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [myPreds, setMyPreds] = useState<MyPred[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [teams]);

  const myPredByMatch = useMemo(() => {
    const m = new Map<string, MyPred>();
    myPreds.forEach((p) => m.set(p.match_id, p));
    return m;
  }, [myPreds]);

  async function load() {
    setLoading(true);
    setErr("");
    setMsg("");

    const { data: u } = await supabase.auth.getUser();
    const user = u.user;
    if (!user) {
      router.replace("/register");
      return;
    }
    setMeId(user.id);

    const { data: prof } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", user.id)
      .single();

    setMeRole(prof?.role ?? null);

    const { data: t } = await supabase.from("teams").select("id,name").order("name");
    setTeams((t as Team[]) || []);

    const { data: m } = await supabase
      .from("matches")
      .select(
        "id,stage,start_time,status,home_team_id,away_team_id,home_score,away_score,knockout_round,knockout_label"
      )
      .order("start_time", { ascending: true, nullsFirst: false });

    setMatches((m as MatchRow[]) || []);

    const { data: mp } = await supabase
      .from("predictions")
      .select("match_id,user_id,home_pred,away_pred")
      .eq("user_id", user.id);

    setMyPreds((mp as MyPred[]) || []);

    const { data: lb } = await supabase
      .from("prediction_leaderboard")
      .select("user_id,name,university,total_points,predictions_count")
      .limit(50);

    setLeaderboard((lb as LeaderRow[]) || []);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPrediction(matchId: string, home: number, away: number) {
    setErr("");
    setMsg("");

    if (!meId) return;
    if (meRole !== "fan") {
      setErr("Only fans can submit predictions.");
      return;
    }

    const { error } = await supabase.from("predictions").insert({
      match_id: matchId,
      user_id: meId,
      home_pred: home,
      away_pred: away,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Prediction submitted ✅");
    await load();
  }

  const upcoming = matches.filter((m) => m.status === "scheduled");
  const finished = matches.filter((m) => m.status === "finished");

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Prediction Game</h1>
            <p className="text-white/70">
              +3 exact score • +1 correct outcome • 0 otherwise
            </p>
            <p className="text-white/50 text-xs mt-1">
              Your role: <b>{meRole ?? "—"}</b> {meRole !== "fan" ? " (view only)" : ""}
            </p>
          </div>
          <button
            onClick={load}
            className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
          >
            Refresh
          </button>
        </div>

        {msg && <div className="text-green-300">{msg}</div>}
        {err && <div className="text-red-400">{err}</div>}

        {/* Leaderboard */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">Leaderboard</div>
          {leaderboard.length === 0 ? (
            <div className="text-white/70">No leaderboard yet.</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.slice(0, 10).map((r, idx) => (
                <div
                  key={r.user_id}
                  className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold">{r.name}</div>
                      <div className="text-white/60 text-xs">{r.university || "—"}</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold">{r.total_points}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming matches to predict */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">Upcoming Matches</div>

          {upcoming.length === 0 ? (
            <div className="text-white/70">No upcoming matches.</div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((m) => {
                const home = teamNameById.get(m.home_team_id) || "Home";
                const away = teamNameById.get(m.away_team_id) || "Away";
                const time = m.start_time ? new Date(m.start_time).toLocaleString() : "TBD";

                const meta =
                  m.stage === "knockout"
                    ? m.knockout_label
                      ? `${prettyRound(m.knockout_round)} • ${m.knockout_label}`
                      : `${prettyRound(m.knockout_round)}`
                    : "Group Stage";

                const existing = myPredByMatch.get(m.id);

                return (
                  <UpcomingCard
                    key={m.id}
                    matchId={m.id}
                    title={`${home} vs ${away}`}
                    meta={`${meta} • ${time}`}
                    canPredict={meRole === "fan"}
                    existing={existing ? `${existing.home_pred}-${existing.away_pred}` : null}
                    onSubmit={submitPrediction}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Finished matches (for trust) */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">Finished Matches</div>
          {finished.length === 0 ? (
            <div className="text-white/70">No finished matches yet.</div>
          ) : (
            <div className="space-y-2">
              {finished.slice(0, 10).map((m) => {
                const home = teamNameById.get(m.home_team_id) || "Home";
                const away = teamNameById.get(m.away_team_id) || "Away";
                const score =
                  m.home_score == null || m.away_score == null ? "—" : `${m.home_score}-${m.away_score}`;
                const meta =
                  m.stage === "knockout"
                    ? m.knockout_label
                      ? `${prettyRound(m.knockout_round)} • ${m.knockout_label}`
                      : `${prettyRound(m.knockout_round)}`
                    : "Group Stage";
                return (
                  <div
                    key={m.id}
                    className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold">
                        {home} <span className="text-white/60 font-normal">vs</span> {away}
                      </div>
                      <div className="text-white/60 text-xs">{meta}</div>
                    </div>
                    <div className="text-lg font-bold">{score}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-white/50 text-xs">
          Notes: predictions are locked (no edit/delete) to keep it fair.
        </div>
      </div>
    </div>
  );
}

function UpcomingCard({
  matchId,
  title,
  meta,
  canPredict,
  existing,
  onSubmit,
}: {
  matchId: string;
  title: string;
  meta: string;
  canPredict: boolean;
  existing: string | null;
  onSubmit: (matchId: string, home: number, away: number) => Promise<void>;
}) {
  const [home, setHome] = useState("0");
  const [away, setAway] = useState("0");

  return (
    <div className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4 space-y-2">
      <div className="font-bold text-lg">{title}</div>
      <div className="text-white/60 text-xs">{meta}</div>

      {existing ? (
        <div className="text-green-300 font-bold">
          Your prediction: {existing} ✅
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="w-20 text-center rounded-xl bg-[#111c44] border border-white/10 p-2 outline-none"
            value={home}
            onChange={(e) => setHome(e.target.value)}
          />
          <div className="font-bold text-white/70">-</div>
          <input
            className="w-20 text-center rounded-xl bg-[#111c44] border border-white/10 p-2 outline-none"
            value={away}
            onChange={(e) => setAway(e.target.value)}
          />

          <button
            disabled={!canPredict}
            onClick={() => {
              const h = Number(home);
              const a = Number(away);
              if (Number.isNaN(h) || Number.isNaN(a) || h < 0 || a < 0) return;
              onSubmit(matchId, h, a);
            }}
            className={`px-4 py-2 rounded-xl font-bold transition ${
              canPredict ? "bg-blue-600 hover:bg-blue-500" : "bg-white/10 text-white/50 cursor-not-allowed"
            }`}
          >
            Submit
          </button>

          {!canPredict ? (
            <div className="text-white/50 text-xs">Fans only</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
