"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import DawraLikBackground from "@/components/DawraLikBackground";

export default function WaitingPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Checking approval status...");

  useEffect(() => {
    let timer: any;

    async function check() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        router.push("/register");
        return;
      }

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("status,role")
        .eq("id", user.id)
        .single();

      if (error) {
        setMsg("Error reading your status: " + error.message);
        return;
      }

      if (!prof) {
        setMsg("No profile found yet...");
        return;
      }

      if (prof.status === "active") {
        router.replace("/app");
        return;
      }

      if (prof.status === "rejected") {
        setMsg("Your registration was rejected. Contact the admin.");
        return;
      }

      setMsg("Still pending approval… Admin will approve you soon.");
    }

    check();
    timer = setInterval(check, 2000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <DawraLikBackground>
      <div className="min-h-screen text-white p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-[#111c44]/80 border border-white/10 rounded-2xl p-6 text-center space-y-3 backdrop-blur">
          <div className="text-2xl font-bold">Waiting for approval</div>
          <div className="text-white/70">{msg}</div>
          <div className="text-white/50 text-sm">(This page auto-refreshes every 2 seconds)</div>
        </div>
      </div>
    </DawraLikBackground>
  );
}
