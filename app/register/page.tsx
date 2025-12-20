"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Mode = "signup" | "signin";

type ProfileRow = {
  role: string;
  status: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signup");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  // Shared auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Sign-up extra fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [university, setUniversity] = useState("");
  const [role, setRole] = useState<"player" | "fan">("fan");

  // ✅ Debug info (TEMP)
  const [debugOpen, setDebugOpen] = useState(true);
  const [debugUserId, setDebugUserId] = useState<string>("");
  const [debugProfile, setDebugProfile] = useState<any>(null);
  const [debugProfileErr, setDebugProfileErr] = useState<any>(null);

  useEffect(() => {
    setErr("");
    setMsg("");
  }, [mode]);

  async function afterLoginRedirect(userId: string) {
    // Always refetch from DB (source of truth)
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", userId)
      .maybeSingle();

    // ✅ DEBUG
    setDebugUserId(userId);
    setDebugProfile(prof ?? null);
    setDebugProfileErr(error ?? null);

    // If profile can't be read → show error (this is what’s happening to you)
    if (error) {
      setErr(
        `Profile read blocked. This is almost always RLS or wrong Supabase project on Vercel.\n\nError: ${error.message}`
      );
      return;
    }

    if (!prof) {
      setErr("No profile row found for this user id (profiles table).");
      return;
    }

    // Admin → admin area
    if (prof.role === "admin" && prof.status === "active") {
      router.replace("/admin");
      return;
    }

    // Player pending → waiting page
    if (prof.role === "player" && prof.status === "pending") {
      router.replace("/waiting");
      return;
    }

    // Everyone else → app
    router.replace("/app");
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
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

    setMsg("Signed in ✅");
    await afterLoginRedirect(data.user.id);
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);

    const cleanEmail = email.trim();
    const cleanName = name.trim();
    if (!cleanName) {
      setLoading(false);
      setErr("Name is required.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        // ✅ Don’t hardcode localhost in production. This is safe for now:
        emailRedirectTo: `${window.location.origin}/app`,
      },
    });

    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    if (!data.user) {
      setLoading(false);
      setErr("No user returned from sign up.");
      return;
    }

    const status = role === "player" ? "pending" : "active";

    const { error: profErr } = await supabase.from("profiles").insert({
      id: data.user.id,
      name: cleanName,
      phone: phone.trim() || null,
      university: university.trim() || null,
      role,
      status,
    });

    setLoading(false);

    if (profErr) {
      setErr(profErr.message);
      return;
    }

    setMsg("Signed up ✅");
    if (role === "player") router.replace("/waiting");
    else router.replace("/app");
  }

  return (
    <div className="min-h-screen bg-transparent text-white p-6">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-[#111c44]/80 border border-white/10 rounded-2xl p-5 backdrop-blur">
          <h1 className="text-2xl font-bold">Campustad</h1>
          <p className="text-white/70">
            {mode === "signup" ? "Create account" : "Sign in to your account"}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl px-3 py-2 font-bold border ${
                mode === "signup"
                  ? "bg-blue-600 border-blue-400/30"
                  : "bg-[#0b1530] border-[#1f2a60]"
              }`}
            >
              Sign Up
            </button>
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-xl px-3 py-2 font-bold border ${
                mode === "signin"
                  ? "bg-blue-600 border-blue-400/30"
                  : "bg-[#0b1530] border-[#1f2a60]"
              }`}
            >
              Sign In
            </button>
          </div>

          {/* ✅ DEBUG PANEL */}
          <button
            type="button"
            onClick={() => setDebugOpen((v) => !v)}
            className="mt-4 text-xs text-white/70 hover:text-white underline"
          >
            {debugOpen ? "Hide debug" : "Show debug"}
          </button>

          {debugOpen ? (
            <div className="mt-3 text-xs bg-[#0b1530]/70 border border-white/10 rounded-xl p-3 space-y-2">
              <div className="text-white/60">
                NEXT_PUBLIC_SUPABASE_URL:{" "}
                <span className="text-white break-all">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL || "(missing)"}
                </span>
              </div>
              <div className="text-white/60">
                Logged user id: <span className="text-white break-all">{debugUserId || "—"}</span>
              </div>
              <div className="text-white/60">
                profiles row:{" "}
                <pre className="text-white whitespace-pre-wrap break-words">
                  {debugProfile ? JSON.stringify(debugProfile, null, 2) : "—"}
                </pre>
              </div>
              <div className="text-white/60">
                profiles error:{" "}
                <pre className="text-red-200 whitespace-pre-wrap break-words">
                  {debugProfileErr ? JSON.stringify(debugProfileErr, null, 2) : "—"}
                </pre>
              </div>
            </div>
          ) : null}
        </div>

        {err ? (
          <div className="bg-red-600/20 border border-red-500/40 text-red-200 rounded-2xl p-4 whitespace-pre-wrap">
            {err}
          </div>
        ) : null}

        {msg ? (
          <div className="bg-green-600/20 border border-green-500/40 text-green-200 rounded-2xl p-4">
            {msg}
          </div>
        ) : null}

        {mode === "signin" ? (
          <form
            onSubmit={onSignIn}
            className="bg-[#111c44]/80 border border-white/10 rounded-2xl p-5 space-y-3 backdrop-blur"
          >
            <input
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 transition font-bold py-3 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={onSignUp}
            className="bg-[#111c44]/80 border border-white/10 rounded-2xl p-5 space-y-3 backdrop-blur"
          >
            <input
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              placeholder="University (AUC / GUC / GIU / Coventry / BUE)"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
            />
            <input
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("fan")}
                className={`rounded-xl px-3 py-2 font-bold border ${
                  role === "fan"
                    ? "bg-blue-600 border-blue-400/30"
                    : "bg-[#0b1530] border-[#1f2a60]"
                }`}
              >
                Fan
              </button>
              <button
                type="button"
                onClick={() => setRole("player")}
                className={`rounded-xl px-3 py-2 font-bold border ${
                  role === "player"
                    ? "bg-blue-600 border-blue-400/30"
                    : "bg-[#0b1530] border-[#1f2a60]"
                }`}
              >
                Player
              </button>
            </div>

            <input
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <button
              disabled={loading}
              className="w-full rounded-xl bg-green-600 hover:bg-green-500 transition font-bold py-3 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Sign Up"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
