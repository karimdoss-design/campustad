"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { adminAction } from "@/lib/adminApi";

type PlayerRow = {
  id: string;
  full_name: string;
  display_name: string | null;
  university: string | null;
  position: string | null;
  linked_profile_id: string | null;
  created_at?: string | null;
};

type StatsRow = {
  player_id: string;
  matches_played: number;
  goals: number;
  assists: number;
  motm: number;
};

export default function AdminPlayersPage() {
  const router = useRouter();

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [stats, setStats] = useState<Record<string, StatsRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Create form
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [position, setPosition] = useState("");

  // Optional: quick search
  const [q, setQ] = useState("");

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
    setError("");
    setLoading(true);

    try {
      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("id,full_name,display_name,university,position,linked_profile_id,created_at")
        .order("created_at", { ascending: true });

      if (pErr) throw new Error(pErr.message);
      setPlayers((p as PlayerRow[]) || []);

      const { data: s, error: sErr } = await supabase
        .from("player_stats")
        .select("player_id,matches_played,goals,assists,motm");

      if (sErr) throw new Error(sErr.message);

      const map: Record<string, StatsRow> = {};
      ((s as StatsRow[]) || []).forEach((r) => (map[r.player_id] = r));
      setStats(map);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function createPlayer(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanName = fullName.trim();
    if (!cleanName) {
      setError("Player full name is required.");
      return;
    }

    setBusy(true);
    try {
      await adminAction("createPlayerWithStats", {
        full_name: cleanName,
        university: university.trim() ? university.trim() : null,
        position: position.trim() ? position.trim() : null,
      });

      setFullName("");
      setUniversity("");
      setPosition("");
      await load();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deletePlayer(id: string) {
    setError("");
    const ok = confirm("Delete this roster player? (Goals/MOTM may also be removed/cleared based on your DB rules)");
    if (!ok) return;

    setBusy(true);
    try {
      await adminAction("deletePlayer", { id });
      await load();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function updateStat(playerId: string, patch: Partial<StatsRow>) {
    setError("");
    setBusy(true);
    try {
      await adminAction("updatePlayerStats", { player_id: playerId, patch });
      await load();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/register");
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return players;

    return players.filter((p) => {
      const name = (p.display_name || p.full_name || "").toLowerCase();
      const uni = (p.university || "").toLowerCase();
      const pos = (p.position || "").toLowerCase();
      return name.includes(s) || uni.includes(s) || pos.includes(s);
    });
  }, [players, q]);

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Roster Players</h1>
            <p className="text-white/70">
              Create roster players (even without login). You can still assign them to teams and record goals/MOTM.
            </p>
            <div className="text-white/50 text-xs mt-2">
              Total players: <b className="text-white">{players.length}</b>
              {busy ? <span className="ml-2 text-white/60">• Working…</span> : null}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={load}
              className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
              disabled={busy}
            >
              Refresh
            </button>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
              disabled={busy}
            >
              Log out
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-600/20 border border-red-500/40 text-red-200 rounded-2xl p-4 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Create player */}
        <form onSubmit={createPlayer} className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="text-xl font-bold">Add roster player</div>

          <div className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2 space-y-1">
              <div className="text-white/70 text-sm">Full name *</div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Karim Doss"
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                disabled={busy}
              />
            </div>

            <div className="space-y-1">
              <div className="text-white/70 text-sm">University</div>
              <input
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="AUC / GUC / ..."
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                disabled={busy}
              />
            </div>

            <div className="space-y-1">
              <div className="text-white/70 text-sm">Position</div>
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="GK / DEF / MID / FWD"
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                disabled={busy}
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-white/50 text-xs">
              Tip: display_name can stay null until linked; we use <b>display_name</b> if present, else <b>full_name</b>.
            </div>
            <button
              className="bg-green-600 hover:bg-green-500 transition px-5 py-3 rounded-xl font-bold"
              disabled={busy}
            >
              Add Player
            </button>
          </div>
        </form>

        {/* Search */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name / university / position…"
            className="flex-1 min-w-[260px] rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
          />
          <div className="text-white/60 text-sm">
            Showing: <b className="text-white">{filtered.length}</b>
          </div>
        </div>

        {/* Players list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-white/70">No players found.</div>
          ) : (
            filtered.map((p) => {
              const s = stats[p.id] || {
                player_id: p.id,
                matches_played: 0,
                goals: 0,
                assists: 0,
                motm: 0,
              };

              const name = (p.display_name || p.full_name || "Unnamed").trim();

              return (
                <div key={p.id} className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold">{name}</div>
                      <div className="text-white/60 text-sm">
                        {p.university || "—"} • {p.position || "—"} •{" "}
                        {p.linked_profile_id ? <b className="text-green-400">Linked ✅</b> : <b className="text-yellow-300">Not linked</b>}
                      </div>
                      <div className="text-white/40 text-xs mt-1">Player ID: {p.id}</div>
                    </div>

                    <button
                      onClick={() => deletePlayer(p.id)}
                      className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatInput
                      label="Matches"
                      value={s.matches_played}
                      disabled={busy}
                      onChange={(v) => updateStat(p.id, { matches_played: v })}
                    />
                    <StatInput
                      label="Goals"
                      value={s.goals}
                      disabled={busy}
                      onChange={(v) => updateStat(p.id, { goals: v })}
                    />
                    <StatInput
                      label="Assists"
                      value={s.assists}
                      disabled={busy}
                      onChange={(v) => updateStat(p.id, { assists: v })}
                    />
                    <StatInput
                      label="MOTM"
                      value={s.motm}
                      disabled={busy}
                      onChange={(v) => updateStat(p.id, { motm: v })}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="text-white/60 text-sm">
          Next step: assign roster players to teams at <b>/admin/team-players</b>.
        </div>
      </div>
    </div>
  );
}

function StatInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4">
      <div className="text-sm text-white/70 mb-2">{label}</div>
      <input
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-full rounded-xl bg-[#111c44] border border-white/10 p-3 outline-none"
      />
    </div>
  );
}
