"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  name: string;
  university: string | null;
};

type Player = {
  id: string;
  full_name: string;
  university: string | null;
  linked_profile_id: string | null;
};

export default function AdminLinkPlayerPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Linking UI state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState<string>("");

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

  async function loadData() {
    setError("");

    const { data: pData, error: pErr } = await supabase
      .from("profiles")
      .select("id,name,university")
      .eq("role", "player")
      .eq("status", "active")
      .order("name");

    if (pErr) {
      setError(pErr.message);
      return;
    }

    const { data: rData, error: rErr } = await supabase
      .from("players")
      .select("id,full_name,university,linked_profile_id")
      .order("full_name");

    if (rErr) {
      setError(rErr.message);
      return;
    }

    setProfiles((pData as Profile[]) || []);
    setPlayers((rData as Player[]) || []);
  }

  const unlinkedRosterPlayers = useMemo(() => {
    return players.filter((p) => !p.linked_profile_id);
  }, [players]);

  const linkedByProfile = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((pl) => {
      if (pl.linked_profile_id) map.set(pl.linked_profile_id, pl);
    });
    return map;
  }, [players]);

  async function confirmLink() {
    if (!selectedProfileId) return;
    if (!selectedRosterId) {
      setError("Choose a roster player first.");
      return;
    }

    setError("");

    // Link roster player -> profile
    const { error } = await supabase
      .from("players")
      .update({ linked_profile_id: selectedProfileId })
      .eq("id", selectedRosterId);

    if (error) {
      setError(error.message);
      return;
    }

    // Reset modal state
    setSelectedProfileId(null);
    setSelectedRosterId("");

    await loadData();
  }

  async function unlinkRoster(rosterId: string) {
    setError("");

    const { error } = await supabase
      .from("players")
      .update({ linked_profile_id: null })
      .eq("id", rosterId);

    if (error) setError(error.message);
    else await loadData();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/register");
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await loadData();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading...</div>
    );
  }

  const activeProfile = selectedProfileId
    ? profiles.find((p) => p.id === selectedProfileId) || null
    : null;

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Link Player</h1>
            <p className="text-white/70">
              Click “Link” next to a logged-in player, then choose the roster player.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
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

        <div className="grid md:grid-cols-2 gap-6">
          {/* LEFT: LOGGED-IN PLAYERS */}
          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
            <h2 className="text-xl font-bold mb-3">Logged-in Players</h2>

            {profiles.length === 0 ? (
              <div className="text-white/70">No active player logins yet.</div>
            ) : (
              <div className="space-y-2">
                {profiles.map((p) => {
                  const linked = linkedByProfile.get(p.id);
                  return (
                    <div
                      key={p.id}
                      className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold">{p.name}</div>
                        <div className="text-sm text-white/60">
                          {(p.university || "—")}
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                          {linked
                            ? `Linked ✅ → ${linked.full_name}`
                            : "Not linked"}
                        </div>
                      </div>

                      {!linked ? (
                        <button
                          onClick={() => {
                            setSelectedProfileId(p.id);
                            setSelectedRosterId("");
                          }}
                          className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-xl font-bold"
                        >
                          Link
                        </button>
                      ) : (
                        <button
                          onClick={() => unlinkRoster(linked.id)}
                          className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-xl font-bold"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: ROSTER OVERVIEW */}
          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
            <h2 className="text-xl font-bold mb-3">Roster Players</h2>
            <div className="text-white/70 text-sm mb-3">
              Unlinked roster players available to link:{" "}
              <b>{unlinkedRosterPlayers.length}</b>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
              {players.map((pl) => (
                <div
                  key={pl.id}
                  className="bg-[#0b1530] border border-[#1f2a60] rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-bold">{pl.full_name}</div>
                    <div className="text-sm text-white/60">
                      {(pl.university || "—")}
                    </div>
                  </div>
                  <div className="text-xs text-white/60">
                    {pl.linked_profile_id ? "Linked ✅" : "Not linked"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SIMPLE MODAL */}
        {selectedProfileId && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-bold">Link Player</div>
                  <div className="text-white/70 text-sm">
                    Linking login: <b>{activeProfile?.name || "—"}</b>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedProfileId(null);
                    setSelectedRosterId("");
                  }}
                  className="bg-[#0b1530] border border-[#1f2a60] px-3 py-2 rounded-xl font-bold"
                >
                  Close
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-white/70 text-sm">
                  Choose a roster player (only unlinked shown):
                </div>
                <select
                  className="w-full bg-[#0b1530] border border-[#1f2a60] p-3 rounded-xl"
                  value={selectedRosterId}
                  onChange={(e) => setSelectedRosterId(e.target.value)}
                >
                  <option value="">Select roster player</option>
                  {unlinkedRosterPlayers.map((rp) => (
                    <option key={rp.id} value={rp.id}>
                      {rp.full_name} {rp.university ? `• ${rp.university}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={confirmLink}
                  className="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-xl font-bold"
                >
                  Confirm Link
                </button>
                <button
                  onClick={() => {
                    setSelectedProfileId(null);
                    setSelectedRosterId("");
                  }}
                  className="flex-1 bg-[#0b1530] border border-[#1f2a60] py-3 rounded-xl font-bold"
                >
                  Cancel
                </button>
              </div>

              <div className="text-white/50 text-xs">
                Tip: if a roster player is missing, add them at <b>/admin/players</b>.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
