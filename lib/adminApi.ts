"use client";

import { supabase } from "@/lib/supabaseClient";

export async function adminAction(type: string, payload: any) {
  // Get session token so API can verify you are admin
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;

  const res = await fetch("/api/admin/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ type, payload }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Admin action failed");
  return data;
}
