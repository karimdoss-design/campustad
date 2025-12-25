"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Team = {
  id: string;
  name: string;
};

type Player = {
  id: string;
  full_name: string;
  university: string | null;
  position: string | null;
};

export default function AdminTeamPlayersPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedTeam, setSelectedTeam] = useState("");
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function requireAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/register");
      return false;
    }

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

  async function loadTeams() {
    const { data, error } = await supabase
      .from("teams")
      .select("id,name")
      .order("name");
    if (error) setError(error.message);
    setTeams((data as Team[]) || []);
  }

  async function loadPlayers() {
    const { data, error } = await supabase
      .from("players")
      .select("id,full_name,university,position")
      .order("full_name");
    if (error) setError(error.message);
    setPlayers((data as Player[]) || []);
  }

  async function loadTeamPlayers(teamId: string) {
    const { data, error } = await supabase
      .from("team_players")
      .select("players(id,full_name,university,position)")
      .eq("team_id", teamId);

    if (error) {
      setError(error.message);
      setTeamPlayers([]);
      return;
    }

    const mapped =
      data?.map((r: any) => r.players).filter(Boolean) || [];
    setTeamPlayers(mapped);
  }

  async function addPlayer(playerId: string) {
    if (!selectedTeam) return;
    setError("");

    const { error } = await supabase.from("team_players").insert({
      team_id: selectedTeam,
      player_id: playerId,
    });

    if (error) setError(error.message);
    else await loadTeamPlayers(selectedTeam);
  }

  async function removePlayer(playerId: string) {
    if (!selectedTeam) return;
    setError("");

    const { error } = await supabase
      .from("team_players")
      .delete()
      .eq("team_id", selectedTeam)
      .eq("player_id", playerId);

    if (error) setError(error.message);
    else await loadTeamPlayers(selectedTeam);
  }

  const availablePlayers = useMemo(() => {
    const ids = new Set(teamPlayers.map((p) => p.id));
    return players.filter((p) => !ids.has(p.id));
  }, [players, teamPlayers]);

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await Promise.all([loadTeams(), loadPlayers()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTeam) loadTeamPlayers(selectedTeam);
    else setTeamPlayers([]);
  }, [selectedTeam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1530] text-white p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <h1 className="text-2xl font-bold">Admin • Team Players</h1>
          <p className="text-white/70">
            Assign roster players to teams (independent of login).
          </p>
        </div>

        {error && <div className="text-red-400">{error}</div>}

        <select
          className="w-full bg-[#0b1530] border border-[#1f2a60] p-3 rounded-xl"
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
        >
          <option value="">Select a team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {selectedTeam && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
              <h2 className="text-xl font-bold mb-3">
                Team Players ({teamPlayers.length})
              </h2>
              {teamPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center bg-[#0b1530] border border-[#1f2a60] p-3 rounded-xl mb-2"
                >
                  <div>
                    <div className="font-bold">{p.full_name}</div>
                    <div className="text-white/60 text-sm">
                      {(p.university || "—")} • {(p.position || "—")}
                    </div>
                  </div>
                  <button
                    onClick={() => removePlayer(p.id)}
                    className="bg-red-600 hover:bg-red-500 px-3 py-1 rounded-xl font-bold"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
              <h2 className="text-xl font-bold mb-3">Available Players</h2>
              {availablePlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center bg-[#0b1530] border border-[#1f2a60] p-3 rounded-xl mb-2"
                >
                  <div>
                    <div className="font-bold">{p.full_name}</div>
                    <div className="text-white/60 text-sm">
                      {(p.university || "—")} • {(p.position || "—")}
                    </div>
                  </div>
                  <button
                    onClick={() => addPlayer(p.id)}
                    className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-xl font-bold"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
