"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("APP ERROR:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#07102a] text-white p-6">
      <div className="max-w-xl mx-auto bg-[#111c44]/90 border border-white/10 rounded-2xl p-5">
        <h1 className="text-2xl font-extrabold">Something broke on /app</h1>
        <p className="text-white/70 mt-2">
          This is not your fault — it means one component crashed after login.
        </p>

        <div className="mt-4 bg-black/30 border border-white/10 rounded-xl p-3 text-sm whitespace-pre-wrap">
          {error?.message || "Unknown error"}
        </div>

        <button
          onClick={() => reset()}
          className="mt-5 w-full rounded-xl bg-blue-600 hover:bg-blue-500 transition font-bold py-3"
        >
          Try again
        </button>

        <p className="text-white/50 text-xs mt-3">
          Tip: Open DevTools Console (F12) to see the full error.
        </p>
      </div>
    </div>
  );
}
