"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { adminAction } from "@/lib/adminApi";

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  university: string | null;
  role: "fan" | "player" | "admin";
  status: "active" | "pending" | "disabled";
  created_at: string;
};

export default function AdminApprovePlayersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  async function requireAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/register");
      return false;
    }

    const { data: me, error } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .single();

    if (error) {
      setErr(error.message);
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
    setErr("");

    // NOTE: If this SELECT is blocked by RLS, you'll see an error message here.
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,phone,university,role,status,created_at")
      .eq("role", "player")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      setRows((data as Profile[]) || []);
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const name = (r.name || "").toLowerCase();
      const uni = (r.university || "").toLowerCase();
      const phone = (r.phone || "").toLowerCase();
      return name.includes(s) || uni.includes(s) || phone.includes(s);
    });
  }, [rows, q]);

  async function approve(id: string) {
    setErr("");
    try {
      // route.ts supports type === "setProfileStatus"
      await adminAction("setProfileStatus", { id, status: "active" });
      await load();
    } catch (e: any) {
      setErr(e.message || "Approve failed");
    }
  }

  async function reject(id: string) {
    setErr("");
    try {
      await adminAction("setProfileStatus", { id, status: "disabled" });
      await load();
    } catch (e: any) {
      setErr(e.message || "Reject failed");
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Approve Players</h1>
            <p className="text-white/70">Approve / reject pending player signups.</p>
          </div>
          <button
            onClick={load}
            className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
          >
            Refresh
          </button>
        </div>

        {err && <div className="text-red-400">{err}</div>}

        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name / university / phone…"
            className="flex-1 min-w-[260px] rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
          />
          <div className="text-white/60 text-sm">
            Pending players: <b className="text-white">{filtered.length}</b>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-white/70">No pending players.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="bg-[#111c44] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-lg">{p.name || "Unnamed player"}</div>
                  <div className="text-white/60 text-sm">
                    {p.university || "—"} • {p.phone || "—"}
                  </div>
                  <div className="text-white/50 text-xs">
                    Status: {p.status} • {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => approve(p.id)}
                    className="bg-green-600 hover:bg-green-500 transition px-4 py-2 rounded-xl font-bold"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => reject(p.id)}
                    className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-white/50 text-xs">
          If you see an RLS error here, you must add a SELECT policy for admins on profiles (we can do that if it happens).
        </div>
      </div>
    </div>
  );
}
