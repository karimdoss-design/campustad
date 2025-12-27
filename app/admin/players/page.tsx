"use client";

import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [position, setPosition] = useState("");

  async function requireAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return router.push("/register");

    const { data: me } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .single();

    if (me?.role !== "admin" || me?.status !== "active") {
      router.push("/app");
      return false;
    }
    return true;
  }

  async function load() {
    setError("");

    const { data: p } = await supabase
      .from("players")
      .select("id,full_name,display_name,university,position,linked_profile_id")
      .order("created_at");

    setPlayers((p as PlayerRow[]) || []);

    const { data: s } = await supabase
      .from("player_stats")
      .select("player_id,matches_played,goals,assists,motm");

    const map: Record<string, StatsRow> = {};
    (s as StatsRow[] | null)?.forEach((r) => (map[r.player_id] = r));
    setStats(map);
  }

  async function createPlayer(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      await adminAction("createPlayerWithStats", {
        full_name: fullName.trim(),
        university: university || null,
        position: position || null,
      });

      setFullName("");
      setUniversity("");
      setPosition("");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function deletePlayer(id: string) {
    try {
      await adminAction("deletePlayer", { id });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function updateStat(playerId: string, patch: Partial<StatsRow>) {
    try {
      await adminAction("updatePlayerStats", {
        player_id: playerId,
        patch,
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await load();
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-8 text-white">Loading…</div>;

  return (
    <div className="p-6 text-white bg-[#0b1530] min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Admin • Players</h1>

      {error && <div className="text-red-400 mb-3">{error}</div>}

      <form onSubmit={createPlayer} className="grid grid-cols-4 gap-2 mb-6">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
        <input value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="University" />
        <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Position" />
        <button className="bg-green-600 rounded">Add</button>
      </form>

      {players.map((p) => {
        const s = stats[p.id] || { matches_played: 0, goals: 0, assists: 0, motm: 0 };
        const name = p.display_name || p.full_name || "Unnamed";

        return (
          <div key={p.id} className="bg-[#111c44] p-4 rounded mb-3">
            <div className="flex justify-between">
              <div>
                <b>{name}</b> • {p.university || "—"}
              </div>
              <button onClick={() => deletePlayer(p.id)} className="bg-red-600 px-3 rounded">
                Delete
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-3">
              {(["matches_played", "goals", "assists", "motm"] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  value={s[k]}
                  onChange={(e) => updateStat(p.id, { [k]: Number(e.target.value) })}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
