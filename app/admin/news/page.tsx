"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type NewsPost = {
  id: string;
  created_at: string;
  title: string | null;
  body: string;
  media_type: "none" | "image" | "video";
  media_url: string | null;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminNewsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [posts, setPosts] = useState<NewsPost[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none");
  const [file, setFile] = useState<File | null>(null);

  async function requireAdmin() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/register");
      return false;
    }

    const { data: me } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", data.user.id)
      .single();

    if (me?.role !== "admin" || me?.status !== "active") {
      router.replace("/app");
      return false;
    }
    return true;
  }

  async function load() {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("news_posts")
      .select("id,created_at,title,body,media_type,media_url")
      .order("created_at", { ascending: false });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    setPosts((data as NewsPost[]) || []);
    setLoading(false);
  }

  async function uploadToBucket(f: File) {
    const ext = f.name.split(".").pop() || "bin";
    const path = `news/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

    const { error: upErr } = await supabase.storage.from("news").upload(path, f, {
      upsert: false,
      contentType: f.type || undefined,
    });
    if (upErr) throw new Error(upErr.message);

    const { data } = supabase.storage.from("news").getPublicUrl(path);
    return data.publicUrl;
  }

  async function createPost() {
    setErr("");

    if (!body.trim()) return setErr("Write something in the post body.");

    let media_url: string | null = null;

    if (mediaType !== "none") {
      if (!file) return setErr("Choose a file (image/video) to upload.");
      try {
        media_url = await uploadToBucket(file);
      } catch (e: any) {
        return setErr(e?.message || "Upload failed.");
      }
    }

    const { data: u } = await supabase.auth.getUser();

    const { error } = await supabase.from("news_posts").insert({
      title: title.trim() ? title.trim() : null,
      body: body.trim(),
      media_type: mediaType,
      media_url,
      created_by: u.user?.id ?? null,
    });

    if (error) return setErr(error.message);

    setTitle("");
    setBody("");
    setMediaType("none");
    setFile(null);

    await load();
  }

  async function deletePost(id: string) {
    setErr("");
    const { error } = await supabase.from("news_posts").delete().eq("id", id);
    if (error) return setErr(error.message);
    await load();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/register");
  }

  useEffect(() => {
    (async () => {
      const ok = await requireAdmin();
      if (!ok) return;
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin • News</h1>
            <p className="text-white/60 text-sm">Post updates that instantly appear to everyone.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
            >
              Refresh
            </button>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-500 transition px-4 py-2 rounded-xl font-bold"
            >
              Log out
            </button>
          </div>
        </div>

        {err && <div className="text-red-400">{err}</div>}

        {/* Create */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="text-xl font-bold">Create Post</div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write the news post..."
            className="w-full min-h-[120px] rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
          />

          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <div className="text-white/70 text-sm">Media type</div>
              <select
                value={mediaType}
                onChange={(e) => {
                  const v = e.target.value as any;
                  setMediaType(v);
                  setFile(null);
                }}
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              >
                <option value="none">No media</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <div className="text-white/70 text-sm">Upload file (if media)</div>
              <input
                type="file"
                accept={mediaType === "image" ? "image/*" : mediaType === "video" ? "video/*" : undefined}
                disabled={mediaType === "none"}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl bg-[#0b1530] border border-[#1f2a60] p-3 outline-none"
              />
              <div className="text-white/50 text-xs">
                Tip: keep videos short (storage is limited on free tier).
              </div>
            </div>
          </div>

          <button
            onClick={createPost}
            className="bg-green-600 hover:bg-green-500 transition px-5 py-3 rounded-xl font-bold"
          >
            Publish
          </button>
        </div>

        {/* List */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="text-xl font-bold mb-3">All Posts</div>

          {posts.length === 0 ? (
            <div className="text-white/70">No posts yet.</div>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => (
                <div key={p.id} className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-white/50 text-xs">{fmtDate(p.created_at)}</div>
                    <button
                      onClick={() => deletePost(p.id)}
                      className="bg-red-600 hover:bg-red-500 transition px-3 py-2 rounded-xl font-bold"
                    >
                      Delete
                    </button>
                  </div>

                  {p.title ? <div className="text-lg font-bold">{p.title}</div> : null}
                  <div className="text-white/80 whitespace-pre-wrap">{p.body}</div>

                  {p.media_type === "image" && p.media_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.media_url} alt="news media" className="w-full rounded-2xl border border-white/10" />
                  ) : null}

                  {p.media_type === "video" && p.media_url ? (
                    <video src={p.media_url} controls className="w-full rounded-2xl border border-white/10" />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
