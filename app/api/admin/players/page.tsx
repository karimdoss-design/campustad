"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PlayerRow = {
  id: string;
  full_name: string;
  university: string | null;
  position: string | null;
  linked_profile_id: string | null;
  created_at: string;
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [statsByPlayer, setStatsByPlayer] = useState<Record<string, StatsRow>>(
    {}
  );

  // Create form
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [position, setPosition] = useState("");

  async function requireAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/register");
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
      router.push("/app");
      return false;
    }

    return true;
  }

  async function loadAll() {
    setError("");

    const { data: pData, error: pErr } = await supabase
      .from("players")
      .select("id,full_name,university,position,linked_profile_id,created_at")
      .order("created_at", { ascending: true });

    if (pErr) {
      setError(pErr.message);
      setPlayers([]);
      return;
    }

    setPlayers((pData as PlayerRow[]) || []);

    const { data: sData, error: sErr } = await supabase
      .from("player_stats")
      .select("player_id,matches_played,goals,assists,motm");

    if (sErr) {
      setError(sErr.message);
      setStatsByPlayer({});
      return;
    }

    const map: Record<string, StatsRow> = {};
    (sData as StatsRow[]).forEach((s) => (map[s.player_id] = s));
    setStatsByPlayer(map);
  }

  async function createPlayer(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleanName = fullName.trim();
    if (!cleanName) {
      setError("Player name is required.");
      return;
    }

    // 1) Insert player
    const { data: created, error: cErr } = await supabase
      .from("players")
      .insert({
        full_name: cleanName,
        university: university.trim() || null,
        position: position.trim() || null,
      })
      .select("id")
      .single();

    if (cErr) {
      setError(cErr.message);
      return;
    }

    // 2) Create stats row (starts at 0)
    const { error: sErr } = await supabase.from("player_stats").insert({
      player_id: created.id,
      matches_played: 0,
      goals: 0,
      assists: 0,
      motm: 0,
    });

    if (sErr) {
      setError(sErr.message);
      return;
    }

    setFullName("");
    setUniversity("");
    setPosition("");
    await loadAll();
  }

  async function deletePlayer(playerId: string) {
    setError("");
    const { error } = await supabase.from("players").delete().eq("id", playerId);
    if (error) setError(error.message);
    else await loadAll();
  }

  async function updateStats(playerId: string, patch: Partial<StatsRow>) {
    setError("");

    const current = statsByPlayer[playerId] || {
      player_id: playerId,
      matches_played: 0,
      goals: 0,
      assists: 0,
      motm: 0,
    };

    const next = { ...current, ...patch };

    const { error } = await supabase
      .from("player_stats")
      .update({
        matches_played: next.matches_played,
        goals: next.goals,
        assists: next.assists,
        motm: next.motm,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("player_id", playerId);

    if (error) setError(error.message);
    else await loadAll();
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await loadAll();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1530] text-white p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin • Players</h1>
            <p className="text-white/70">
              Create roster players and edit their stats (even if they never log
              in).
            </p>
          </div>
          <button
            onClick={loadAll}
            className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
          >
            Refresh
          </button>
        </div>

        {error && <div className="text-red-400">{error}</div>}

        {/* CREATE PLAYER */}
        <form
          onSubmit={createPlayer}
          className="bg-[#111c44] border border-white/10 rounded-2xl p-5 grid md:grid-cols-4 gap-3"
        >
          <input
            className="rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
            placeholder="Full name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            className="rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
            placeholder="University (AUC/GUC/...)"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
          />
          <input
            className="rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
            placeholder="Position (GK/DEF/MID/FWD)"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
          <button className="bg-green-600 hover:bg-green-500 transition rounded-xl font-bold">
            Add Player
          </button>
        </form>

        {/* PLAYERS LIST */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <h2 className="text-xl font-bold mb-3">Roster Players</h2>

          {players.length === 0 ? (
            <div className="text-white/70">No players yet.</div>
          ) : (
            <div className="space-y-3">
              {players.map((p) => {
                const s = statsByPlayer[p.id] || {
                  player_id: p.id,
                  matches_played: 0,
                  goals: 0,
                  assists: 0,
                  motm: 0,
                };

                return (
                  <div
                    key={p.id}
                    className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold">{p.full_name}</div>
                        <div className="text-white/70 text-sm">
                          {(p.university || "—")} • {(p.position || "—")} •{" "}
                          {p.linked_profile_id ? "Linked ✅" : "Not linked"}
                        </div>
                      </div>

                      <button
                        onClick={() => deletePlayer(p.id)}
                        className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <StatInput
                        label="Matches"
                        value={s.matches_played}
                        onChange={(v) =>
                          updateStats(p.id, { matches_played: v })
                        }
                      />
                      <StatInput
                        label="Goals"
                        value={s.goals}
                        onChange={(v) => updateStats(p.id, { goals: v })}
                      />
                      <StatInput
                        label="Assists"
                        value={s.assists}
                        onChange={(v) => updateStats(p.id, { assists: v })}
                      />
                      <StatInput
                        label="MOTM"
                        value={s.motm}
                        onChange={(v) => updateStats(p.id, { motm: v })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-white/60 text-sm">
          Next page: assign these roster players to teams at{" "}
          <b>/admin/team-players</b>.
        </div>
      </div>
    </div>
  );
}

function StatInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="bg-[#111c44] border border-white/10 rounded-2xl p-3">
      <div className="text-sm text-white/70 mb-1">{label}</div>
      <input
        type="number"
        min={0}
        className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-2 outline-none"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      />
    </div>
  );
}
