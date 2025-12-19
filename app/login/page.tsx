"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    // If already logged in, go to app
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace("/app");
    })();
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setOk("Logged in! Redirecting…");
    router.replace("/app");
  }

  return (
    <div className="min-h-screen bg-[#07102a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#111c44]/90 border border-white/10 rounded-2xl p-6 backdrop-blur">
        <h1 className="text-2xl font-extrabold">Login</h1>
        <p className="text-white/60 text-sm mt-1">Welcome back to Campustad.</p>

        {err ? <div className="mt-4 text-red-300 text-sm">{err}</div> : null}
        {ok ? <div className="mt-4 text-green-300 text-sm">{ok}</div> : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <input
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition px-4 py-3 rounded-xl font-extrabold"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-white/60 text-sm">
          Don’t have an account?{" "}
          <Link href="/register" className="text-blue-300 hover:text-blue-200 font-bold">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
