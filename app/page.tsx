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
    <div className="min-h-screen bg-[#07102a] text-white flex items-center justify-center">
      <div className="text-white/80">Loading…</div>
    </div>
  );
}
