"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { adminAction } from "@/lib/adminApi";

type Team = { id: string; name: string };

type MatchRow = {
  id: string;
  stage: "group" | "knockout";
  home_team_id: string;
  away_team_id: string;
  start_time: string | null;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "finished";
  knockout_round: string | null;
  knockout_order: number | null;
  knockout_label: string | null;
};

const ROUND_OPTIONS = [
  { code: "R16", name: "Round of 16" },
  { code: "QF", name: "Quarterfinal" },
  { code: "SF", name: "Semifinal" },
  { code: "F", name: "Final" },
  { code: "3P", name: "3rd Place" },
];

function roundName(code: string | null) {
  const r = ROUND_OPTIONS.find((x) => x.code === code);
  return r ? r.name : "—";
}

export default function AdminKnockoutPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  // Create knockout match form
  const [round, setRound] = useState("QF");
  const [label, setLabel] = useState("");
  const [order, setOrder] = useState("1");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [startLocal, setStartLocal] = useState("");

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [teams]);

  async function requireAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/register");
      return false;
    }
    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .single();

    if (meErr) {
      setError(meErr.message);
      return false;
    }

    if (me?.role !== "admin" || me?.status !== "active") {
      router.replace("/app");
      return false;
    }
    return true;
  }

  async function load() {
    setLoading(true);
    setError("");

    const { data: t, error: tErr } = await supabase.from("teams").select("id,name").order("name");
    if (tErr) return fail(tErr.message);
    setTeams((t as Team[]) || []);

    const { data: m, error: mErr } = await supabase
      .from("matches")
      .select("id,stage,home_team_id,away_team_id,start_time,home_score,away_score,status,knockout_round,knockout_order,knockout_label")
      .eq("stage", "knockout")
      .order("knockout_round", { ascending: true })
      .order("knockout_order", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false });

    if (mErr) return fail(mErr.message);
    setMatches((m as MatchRow[]) || []);

    setLoading(false);
  }

  function fail(msg: string) {
    setError(msg);
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

  async function createKnockoutMatch() {
    setError("");

    if (!homeId || !awayId) return setError("Choose home and away teams.");
    if (homeId === awayId) return setError("Home and away must be different.");

    const start_time = startLocal ? new Date(startLocal).toISOString() : null;
    const knockout_order = Number(order);
    const safeOrder = Number.isNaN(knockout_order) ? 1 : Math.max(1, knockout_order);

    setBusy(true);
    try {
      await adminAction("createMatch", {
        match: {
          stage: "knockout",
          group_id: null,
          home_team_id: homeId,
          away_team_id: awayId,
          start_time,
          status: "scheduled",
          home_score: 0,
          away_score: 0,
          knockout_round: round,
          knockout_order: safeOrder,
          knockout_label: label.trim() ? label.trim() : null,
          motm_player_id: null,
        },
      });

      setLabel("");
      setOrder("1");
      setHomeId("");
      setAwayId("");
      setStartLocal("");

      await load();
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateMeta(matchId: string, patch: Partial<MatchRow>) {
    setError("");
    setBusy(true);
    try {
      await adminAction("updateMatch", { id: matchId, patch });
      await load();
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMatch(matchId: string) {
    setError("");
    setBusy(true);
    try {
      await adminAction("deleteMatch", { id: matchId });
      await load();
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setBusy(false);
    }
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
          <button
            disabled={busy}
            onClick={load}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition px-4 py-2 rounded-xl font-bold"
          >
            Refresh
          </button>
        </div>

        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-2xl font-bold">Admin • Knockout Bracket</div>
          <div className="text-white/70">Create knockout matches and label them as R16 / QF / SF / Final.</div>
        </div>

        {error && <div className="text-red-400 whitespace-pre-wrap">{error}</div>}

        {/* Create knockout match */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="text-xl font-bold">Create Knockout Match</div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-white/70 text-sm">Round</div>
              <select
                disabled={busy}
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                value={round}
                onChange={(e) => setRound(e.target.value)}
              >
                {ROUND_OPTIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-white/70 text-sm">Order (1,2,3…)</div>
              <input
                disabled={busy}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                placeholder="1"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <div className="text-white/70 text-sm">Label (optional)</div>
              <input
                disabled={busy}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                placeholder='e.g. "Quarterfinal 1"'
              />
            </div>

            <div className="space-y-1">
              <div className="text-white/70 text-sm">Home team</div>
              <select
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              />
            </div>
          </div>

          <button
            disabled={busy}
            onClick={createKnockoutMatch}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-60 transition px-5 py-3 rounded-xl font-bold"
          >
            Create Knockout Match
          </button>
        </div>

        {/* Knockout matches list */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">Knockout Matches</div>

          {matches.length === 0 ? (
            <div className="text-white/70">No knockout matches yet.</div>
          ) : (
            <div className="space-y-3">
              {matches.map((m) => (
                <div key={m.id} className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="text-white/60 text-xs">
                        {roundName(m.knockout_round)} {m.knockout_label ? `• ${m.knockout_label}` : ""}
                      </div>
                      <div className="text-lg font-bold">
                        {teamNameById.get(m.home_team_id) || "Home"} vs {teamNameById.get(m.away_team_id) || "Away"}
                      </div>
                      <div className="text-white/60 text-sm">
                        Start: {m.start_time ? new Date(m.start_time).toLocaleString() : "TBD"} • Status:{" "}
                        <b>{m.status}</b> • Score:{" "}
                        <b>{m.home_score == null || m.away_score == null ? "—" : `${m.home_score}-${m.away_score}`}</b>
                      </div>
                      <div className="text-white/50 text-xs mt-1">
                        Edit score/goals/MOTM from:{" "}
                        <Link className="underline" href="/admin/matches">
                          /admin/matches
                        </Link>
                      </div>
                    </div>

                    <button
                      disabled={busy}
                      onClick={() => deleteMatch(m.id)}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-60 transition px-4 py-2 rounded-xl font-bold"
                    >
                      Delete
                    </button>
                  </div>

                  {/* edit round / label / order */}
                  <div className="grid md:grid-cols-3 gap-2">
                    <select
                      disabled={busy}
                      className="w-full rounded-xl bg-[#111c44] border border-white/10 p-3 outline-none"
                      value={m.knockout_round || ""}
                      onChange={(e) => updateMeta(m.id, { knockout_round: e.target.value || null })}
                    >
                      <option value="">(No round)</option>
                      {ROUND_OPTIONS.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </select>

                    <input
                      disabled={busy}
                      defaultValue={m.knockout_label || ""}
                      onBlur={(e) => updateMeta(m.id, { knockout_label: e.target.value.trim() || null })}
                      className="w-full rounded-xl bg-[#111c44] border border-white/10 p-3 outline-none"
                      placeholder="Label (optional)"
                    />

                    <input
                      disabled={busy}
                      defaultValue={m.knockout_order?.toString() ?? "1"}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        updateMeta(m.id, { knockout_order: Number.isNaN(v) ? 1 : Math.max(1, v) });
                      }}
                      className="w-full rounded-xl bg-[#111c44] border border-white/10 p-3 outline-none"
                      placeholder="Order"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-white/50 text-xs">
          The round/label will be shown to users in the knockout section so they understand: R16, QF, SF, Final, etc.
        </div>
      </div>
    </div>
  );
}