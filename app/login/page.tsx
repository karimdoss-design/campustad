"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      setMsg("Logged in ✅");
      router.replace("/app");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07102a] text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-[#111c44] border border-white/10 rounded-2xl p-6">
        <h1 className="text-2xl font-extrabold">Login</h1>
        <p className="text-white/60 text-sm mt-1">Sign in to Campustad.</p>

        {err && <div className="mt-4 text-red-300 text-sm">{err}</div>}
        {msg && <div className="mt-4 text-green-300 text-sm">{msg}</div>}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <input
            className="input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />

          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition px-4 py-3 rounded-xl font-bold"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-4 text-white/70 text-sm">
          No account?{" "}
          <Link href="/register" className="text-blue-300 hover:text-blue-200 font-bold">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
