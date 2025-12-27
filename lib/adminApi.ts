"use client";

import { supabase } from "@/lib/supabaseClient";

export async function adminAction(type: string, payload: any) {
  // Get session token so API can verify you are admin
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw new Error(sessErr.message);

  const token = sess.session?.access_token;

  const res = await fetch("/api/admin/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ type, payload }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // show server error message if present
    throw new Error(json?.error || `Admin action failed (${res.status})`);
  }

  return json;
}
