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

  async function afterLoginRedirect(userId: string) {
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setErr(`Profile read blocked: ${error.message}`);
      return;
    }

    if (!prof) {
      router.replace("/app");
      return;
    }

    if (prof.role === "admin" && prof.status === "active") {
      router.replace("/admin");
      return;
    }

    if (prof.role === "player" && prof.status === "pending") {
      router.replace("/waiting");
      return;
    }

    router.replace("/app");
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await afterLoginRedirect(data.user.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    if (!data.user) {
      setErr("No user returned from login.");
      return;
    }

    setOk("Logged in! Redirecting…");
    await afterLoginRedirect(data.user.id);
  }

  return (
    <div className="min-h-screen bg-transparent text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#111c44]/85 border border-white/10 rounded-2xl p-6 backdrop-blur">
        <h1 className="text-2xl font-extrabold">Login</h1>
        <p className="text-white/60 text-sm mt-1">Welcome back to Campustad.</p>

        {err ? <div className="mt-4 text-red-300 text-sm whitespace-pre-wrap">{err}</div> : null}
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
