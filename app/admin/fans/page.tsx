"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  name: string | null;
  phone: string | null;
  university: string | null;
  role: "fan" | "player" | "admin";
  status: "active" | "pending" | "disabled";
  created_at: string;
};

export default function AdminFansPage() {
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

    const { data: me } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .single();

    if (me?.role !== "admin" || me?.status !== "active") {
      router.replace("/app");
      return false;
    }
    return true;
  }

  async function load() {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,phone,university,role,status,created_at")
      .eq("role", "fan")
      .order("created_at", { ascending: false });

    if (error) setErr(error.message);
    setRows((data as Profile[]) || []);
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

  async function setStatus(id: string, status: Profile["status"]) {
    setErr("");
    const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin • Fans</h1>
            <p className="text-white/70">
              Deactivate a fan to kick them out immediately and block access.
            </p>
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
            Fans: <b className="text-white">{filtered.length}</b>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-white/70">No fans found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((f) => (
              <div
                key={f.id}
                className="bg-[#111c44] border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-lg">{f.name || "Unnamed fan"}</div>
                  <div className="text-white/60 text-sm">
                    {f.university || "—"} • {f.phone || "—"}
                  </div>
                  <div className="text-white/50 text-xs">status: {f.status}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {f.status !== "disabled" ? (
                    <button
                      onClick={() => setStatus(f.id, "disabled")}
                      className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
                    >
                      Kick (Disable)
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(f.id, "active")}
                      className="bg-green-600 hover:bg-green-500 transition px-4 py-2 rounded-xl font-bold"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-white/50 text-xs">
          Note: “Disable” blocks access everywhere. The fan stays in the database for audit/history.
        </div>
      </div>
    </div>
  );
}
