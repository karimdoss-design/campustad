"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { adminAction } from "@/lib/adminApi";

type Team = { id: string; name: string };

type Player = {
  id: string;
  full_name: string;
  display_name: string | null;
};

type TeamPlayerRow = { team_id: string; player_id: string };

export default function AdminTeamPlayersPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<TeamPlayerRow[]>([]);

  const [selectedTeam, setSelectedTeam] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  async function loadAll() {
    setError("");
    setLoading(true);

    try {
      const { data: t, error: tErr } = await supabase
        .from("teams")
        .select("id,name")
        .order("name", { ascending: true });

      if (tErr) throw new Error(tErr.message);
      setTeams((t as Team[]) || []);

      const { data: p, error: pErr } = await supabase
        .from("players")
        .select("id,full_name,display_name")
        .order("full_name", { ascending: true });

      if (pErr) throw new Error(pErr.message);
      setPlayers((p as Player[]) || []);

      // IMPORTANT: load the mapping so we can show "current team" for each player
      const { data: tp, error: tpErr } = await supabase
        .from("team_players")
        .select("team_id,player_id");

      if (tpErr) throw new Error(tpErr.message);
      setTeamPlayers((tp as TeamPlayerRow[]) || []);
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/register");
  }

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));
    return m;
  }, [teams]);

  // Because we enforced "one team per player", we treat it as 0 or 1
  const teamIdByPlayerId = useMemo(() => {
    const m = new Map<string, string>();
    teamPlayers.forEach((row) => m.set(row.player_id, row.team_id));
    return m;
  }, [teamPlayers]);

  const playersInSelectedTeam = useMemo(() => {
    if (!selectedTeam) return [];
    const ids = new Set(
      teamPlayers.filter((r) => r.team_id === selectedTeam).map((r) => r.player_id)
    );
    const arr = players.filter((p) => ids.has(p.id));
    arr.sort((a, b) => displayName(a).localeCompare(displayName(b)));
    return arr;
  }, [players, teamPlayers, selectedTeam]);

  const filteredPlayers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return players;

    return players.filter((p) => {
      const name = displayName(p).toLowerCase();
      const teamName = (teamNameById.get(teamIdByPlayerId.get(p.id) || "") || "").toLowerCase();
      return name.includes(s) || teamName.includes(s);
    });
  }, [players, q, teamIdByPlayerId, teamNameById]);

  // A safe add that respects "one team per player":
  // - if player already in another team => we offer MOVE (remove old then add new)
  async function addToSelectedTeam(playerId: string) {
    if (!selectedTeam) return;
    setError("");
    setBusy(true);

    try {
      const currentTeam = teamIdByPlayerId.get(playerId);

      if (!currentTeam) {
        // simple add
        await adminAction("addTeamPlayer", { team_id: selectedTeam, player_id: playerId });
      } else if (currentTeam === selectedTeam) {
        // already in this team, nothing
      } else {
        // move: remove from old team first, then add to new team
        await adminAction("removeTeamPlayer", { team_id: currentTeam, player_id: playerId });
        await adminAction("addTeamPlayer", { team_id: selectedTeam, player_id: playerId });
      }

      await loadAll();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeFromSelectedTeam(playerId: string) {
    if (!selectedTeam) return;
    setError("");
    setBusy(true);

    try {
      await adminAction("removeTeamPlayer", { team_id: selectedTeam, player_id: playerId });
      await loadAll();
    } catch (e: any) {
      setError(e?.message ? String(e.message) : String(e));
    } finally {
      setBusy(false);
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

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Team Players</h1>
            <p className="text-white/70">
              Assign roster players to teams. Each player can belong to <b>one</b> team only.
            </p>
            <div className="text-white/50 text-xs mt-2">
              Teams: <b className="text-white">{teams.length}</b> • Players:{" "}
              <b className="text-white">{players.length}</b>
              {busy ? <span className="ml-2 text-white/60">• Working…</span> : null}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadAll}
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

        {error && (
          <div className="bg-red-600/20 border border-red-500/40 text-red-200 rounded-2xl p-4 whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Select team */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="text-xl font-bold">Select team</div>
          <select
            className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">— Choose team —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {selectedTeam ? (
            <div className="text-white/60 text-sm">
              Current team roster size:{" "}
              <b className="text-white">{playersInSelectedTeam.length}</b>
            </div>
          ) : (
            <div className="text-white/60 text-sm">
              Choose a team to manage its roster.
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search players by name or current team…"
            className="flex-1 min-w-[260px] rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
          />
          <div className="text-white/60 text-sm">
            Showing: <b className="text-white">{filteredPlayers.length}</b>
          </div>
        </div>

        {/* Two columns */}
        {selectedTeam ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Team roster */}
            <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="text-xl font-bold">
                Team roster: <span className="text-white/70">{teamNameById.get(selectedTeam)}</span>
              </div>

              {playersInSelectedTeam.length === 0 ? (
                <div className="text-white/70">No players assigned to this team yet.</div>
              ) : (
                <div className="space-y-2">
                  {playersInSelectedTeam.map((p) => (
                    <div
                      key={p.id}
                      className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-3 flex items-center justify-between gap-3"
                    >
                      <div className="font-bold">{displayName(p)}</div>
                      <button
                        onClick={() => removeFromSelectedTeam(p.id)}
                        className="bg-red-600 hover:bg-red-500 transition px-3 py-2 rounded-xl font-bold"
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-white/50 text-xs">
                Removing a player from a team only affects team-based views (like leaderboards by team).
                It does NOT delete the player or goals.
              </div>
            </div>

            {/* Right: All players (with their current team) */}
            <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="text-xl font-bold">All roster players</div>

              <div className="space-y-2">
                {filteredPlayers.map((p) => {
                  const currentTeamId = teamIdByPlayerId.get(p.id) || "";
                  const currentTeamName = currentTeamId ? teamNameById.get(currentTeamId) || "—" : "—";
                  const inThisTeam = currentTeamId === selectedTeam;

                  return (
                    <div
                      key={p.id}
                      className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold">{displayName(p)}</div>
                        <div className="text-white/60 text-sm">
                          Current team: <b className="text-white">{currentTeamName}</b>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {inThisTeam ? (
                          <button
                            onClick={() => removeFromSelectedTeam(p.id)}
                            className="bg-red-600 hover:bg-red-500 transition px-3 py-2 rounded-xl font-bold"
                            disabled={busy}
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => addToSelectedTeam(p.id)}
                            className="bg-green-600 hover:bg-green-500 transition px-3 py-2 rounded-xl font-bold"
                            disabled={busy}
                          >
                            {currentTeamId ? "Move here" : "Add"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-white/50 text-xs">
                If a player already belongs to another team, click <b>Move here</b> (it automatically removes from the
                old team then adds to this team).
              </div>
            </div>
          </div>
        ) : (
          <div className="text-white/70">
            Select a team above to manage roster assignments.
          </div>
        )}
      </div>
    </div>
  );
}

function displayName(p: { display_name: string | null; full_name: string }) {
  return (p.display_name || p.full_name || "Unnamed").trim();
}
