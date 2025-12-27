"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { adminAction } from "@/lib/adminApi";

type Team = { id: string; name: string };
type Player = { id: string; full_name: string; display_name: string | null };

export default function AdminTeamPlayersPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [error, setError] = useState("");

  async function requireAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return router.push("/register");

    const { data: me } = await supabase.from("profiles").select("role,status").eq("id", data.user.id).single();
    if (me?.role !== "admin" || me?.status !== "active") {
      router.push("/app");
      return false;
    }
    return true;
  }

  async function load() {
    const { data: t } = await supabase.from("teams").select("id,name");
    const { data: p } = await supabase.from("players").select("id,full_name,display_name");
    setTeams((t as Team[]) || []);
    setPlayers((p as Player[]) || []);
  }

  async function loadTeamPlayers(teamId: string) {
    const { data } = await supabase
      .from("team_players")
      .select("players(id,full_name,display_name)")
      .eq("team_id", teamId);

    setTeamPlayers(data?.map((r: any) => r.players) || []);
  }

  async function add(playerId: string) {
    try {
      await adminAction("addTeamPlayer", { team_id: selectedTeam, player_id: playerId });
      await loadTeamPlayers(selectedTeam);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function remove(playerId: string) {
    try {
      await adminAction("removeTeamPlayer", { team_id: selectedTeam, player_id: playerId });
      await loadTeamPlayers(selectedTeam);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const available = useMemo(() => {
    const used = new Set(teamPlayers.map((p) => p.id));
    return players.filter((p) => !used.has(p.id));
  }, [players, teamPlayers]);

  useEffect(() => {
    (async () => {
      await requireAdmin();
      await load();
    })();
  }, []);

  useEffect(() => {
    if (selectedTeam) loadTeamPlayers(selectedTeam);
  }, [selectedTeam]);

  return (
    <div className="p-6 text-white bg-[#0b1530] min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Admin • Team Players</h1>
      {error && <div className="text-red-400">{error}</div>}

      <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}>
        <option value="">Select team</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {selectedTeam && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <h2>Team</h2>
            {teamPlayers.map((p) => (
              <div key={p.id}>
                {p.display_name || p.full_name}
                <button onClick={() => remove(p.id)}>Remove</button>
              </div>
            ))}
          </div>

          <div>
            <h2>Available</h2>
            {available.map((p) => (
              <div key={p.id}>
                {p.display_name || p.full_name}
                <button onClick={() => add(p.id)}>Add</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
