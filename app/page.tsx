"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.replace("/register");
      } else {
        router.replace("/app");
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen page-shell text-white p-6">

      <div className="text-white/80">Loading…</div>
    </div>
  );
}
