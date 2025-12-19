"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Team = { id: string; name: string };
type Group = { id: string; name: string };

type TeamGroupRow = { team_id: string; group_id: string };

export default function AdminGroupsPage() {
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamGroupRow[]>([]);

  const [newGroupName, setNewGroupName] = useState("");
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

  async function load() {
    setError("");
    setLoading(true);

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id,name")
      .order("name");
    if (gErr) {
      setError(gErr.message);
      setLoading(false);
      return;
    }
    setGroups((g as Group[]) || []);

    const { data: t, error: tErr } = await supabase
      .from("teams")
      .select("id,name")
      .order("name");
    if (tErr) {
      setError(tErr.message);
      setLoading(false);
      return;
    }
    setTeams((t as Team[]) || []);

    const { data: tg, error: tgErr } = await supabase
      .from("team_groups")
      .select("team_id,group_id");
    if (tgErr) {
      setError(tgErr.message);
      setLoading(false);
      return;
    }
    setTeamGroups((tg as TeamGroupRow[]) || []);

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

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  const teamToGroupId = useMemo(() => {
    const m = new Map<string, string>();
    teamGroups.forEach((row) => m.set(row.team_id, row.group_id));
    return m;
  }, [teamGroups]);

  async function createGroup() {
    setError("");
    const name = newGroupName.trim();
    if (!name) {
      setError("Group name is required (e.g. Group A).");
      return;
    }

    const { error } = await supabase.from("groups").insert({ name });
    if (error) {
      setError(error.message);
      return;
    }

    setNewGroupName("");
    await load();
  }

  async function deleteGroup(groupId: string) {
    setError("");
    const { error } = await supabase.from("groups").delete().eq("id", groupId);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  async function assignTeam(teamId: string, groupId: string | null) {
    setError("");

    // remove assignment
    if (!groupId) {
      const { error } = await supabase.from("team_groups").delete().eq("team_id", teamId);
      if (error) setError(error.message);
      else await load();
      return;
    }

    // upsert assignment (team_id is PK)
    const { error } = await supabase
      .from("team_groups")
      .upsert({ team_id: teamId, group_id: groupId });

    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/register");
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Groups</h1>
            <p className="text-white/70">
              Create groups (Group A/B/…) and assign teams to groups.
            </p>
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

        {error && <div className="text-red-400">{error}</div>}

        {/* Create group */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="text-xl font-bold">Create Group</div>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group A"
              className="flex-1 rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
            />
            <button
              onClick={createGroup}
              className="bg-green-600 hover:bg-green-500 transition px-5 py-3 rounded-xl font-bold"
            >
              Create
            </button>
          </div>
        </div>

        {/* Groups list */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">Groups</div>
          {groups.length === 0 ? (
            <div className="text-white/70">No groups yet.</div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="font-bold">{g.name}</div>
                  <button
                    onClick={() => deleteGroup(g.id)}
                    className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assign teams */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">Assign Teams to Groups</div>

          {teams.length === 0 ? (
            <div className="text-white/70">No teams yet.</div>
          ) : (
            <div className="space-y-2">
              {teams.map((t) => {
                const currentGroupId = teamToGroupId.get(t.id) || "";
                return (
                  <div
                    key={t.id}
                    className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold">{t.name}</div>
                      <div className="text-white/60 text-sm">
                        Current group:{" "}
                        <b>{currentGroupId ? groupNameById.get(currentGroupId) : "—"}</b>
                      </div>
                    </div>

                    <select
                      className="rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
                      value={currentGroupId}
                      onChange={(e) => assignTeam(t.id, e.target.value || null)}
                    >
                      <option value="">(No group)</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-white/50 text-xs mt-4">
            Tip: standings will be calculated per group using matches where stage = <b>group</b> and group_id matches.
          </div>
        </div>
      </div>
    </div>
  );
}
