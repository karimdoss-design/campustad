"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { adminAction } from "@/lib/adminApi";

type Team = {
  id: string;
  name: string;
  created_at: string;
};

export default function AdminTeamsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeam, setNewTeam] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requireAdmin() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/register");
      return false;
    }

    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", userData.user.id)
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

  async function loadTeams() {
    setError("");
    const { data, error } = await supabase
      .from("teams")
      .select("id,name,created_at")
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setTeams([]);
      return;
    }

    setTeams((data as Team[]) || []);
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const name = newTeam.trim();
    if (!name) return;

    setBusy(true);
    try {
      await adminAction("createTeam", { name });
      setNewTeam("");
      await loadTeams();
    } catch (e: any) {
      setError(e.message || "Failed to create team");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeam(id: string) {
    setError("");
    setBusy(true);
    try {
      await adminAction("deleteTeam", { id });
      await loadTeams();
    } catch (e: any) {
      setError(e.message || "Failed to delete team");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await loadTeams();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1530] text-white p-8">
        Loading admin teams...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <h1 className="text-2xl font-bold">Admin • Teams</h1>
          <p className="text-white/70">Create and manage tournament teams.</p>
        </div>

        <form
          onSubmit={createTeam}
          className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex gap-2"
        >
          <input
            className="flex-1 rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
            placeholder="Team name (e.g. AUC Titans)"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
          />
          <button
            disabled={busy}
            className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 font-bold"
          >
            Add
          </button>
        </form>

        {error && <div className="text-red-400 whitespace-pre-wrap">{error}</div>}

        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <h2 className="text-xl font-bold mb-3">Teams</h2>

          {teams.length === 0 ? (
            <div className="text-white/70">No teams created yet.</div>
          ) : (
            <div className="space-y-2">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4"
                >
                  <div className="font-bold">{team.name}</div>
                  <button
                    disabled={busy}
                    onClick={() => deleteTeam(team.id)}
                    className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 font-bold"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="text-white/60 text-sm mt-4">
            Next step: assign players to teams at <b>/admin/team-players</b>
          </div>
        </div>
      </div>
    </div>
  );
}
