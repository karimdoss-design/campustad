"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-white">
      Logging out...
    </div>
  );
}
