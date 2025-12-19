"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NewsPost = {
  id: string;
  created_at: string;
  title: string | null;
  body: string | null;
  media_url: string | null;
  media_type: "image" | "video" | "none" | null;
};

const NEWS_TABLE_CANDIDATES = ["news_posts", "news", "posts"];

export default function NewsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [posts, setPosts] = useState<NewsPost[]>([]);

  async function getNewsTableName(): Promise<string> {
    for (const t of NEWS_TABLE_CANDIDATES) {
      const { error } = await supabase.from(t).select("id").limit(1);
      if (!error) return t;
    }
    return "news_posts";
  }

  async function markReadNow() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return;

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("news_reads")
      .upsert({ user_id: user.id, last_seen_at: nowIso }, { onConflict: "user_id" });

    if (error) setErr("Mark read failed: " + error.message);
  }

  async function load() {
    setLoading(true);
    setErr("");

    const table = await getNewsTableName();
    const { data, error } = await supabase
      .from(table)
      .select("id,created_at,title,body,media_url,media_type")
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setPosts((data as NewsPost[]) || []);
    setLoading(false);

    // ✅ After load, mark as read
    await markReadNow();
  }

  useEffect(() => {
    let channel: any = null;

    (async () => {
      await load();

      const table = await getNewsTableName();
      channel = supabase
        .channel("news-feed")
        .on("postgres_changes", { event: "INSERT", schema: "public", table }, () => load())
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <h1 className="text-2xl font-bold">News</h1>
          <p className="text-white/60 text-sm">Updates from Campustad admin.</p>
        </div>

        {err && <div className="text-red-400">{err}</div>}

        {posts.length === 0 ? (
          <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 text-white/70">
            No posts yet.
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <div key={p.id} className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
                <div>
                  <div className="text-lg font-bold">{p.title || "Update"}</div>
                  <div className="text-white/50 text-xs">{new Date(p.created_at).toLocaleString()}</div>
                </div>

                {p.body ? <div className="text-white/80 whitespace-pre-wrap">{p.body}</div> : null}

                {p.media_url && p.media_type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.media_url}
                    alt={p.title || "News image"}
                    className="w-full rounded-xl border border-white/10"
                  />
                ) : null}

                {p.media_url && p.media_type === "video" ? (
                  <video controls className="w-full rounded-xl border border-white/10">
                    <source src={p.media_url} />
                  </video>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
