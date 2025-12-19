"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* HERO */}
        <div className="card p-8 flex flex-col gap-4">
          <h1 className="h1">🏆 Campustad Tournament</h1>
          <p className="subtle max-w-2xl">
            Follow teams, players, matches, predictions and live results of the
            inter-university football tournament.
          </p>

          <div className="flex flex-wrap gap-3 mt-2">
            <Link href="/app/matches" className="btn btn-primary">
              View Matches
            </Link>
            <Link href="/app/standings" className="btn btn-ghost">
              Standings
            </Link>
            <Link href="/app/news" className="btn btn-ghost">
              Latest News
            </Link>
          </div>
        </div>

        {/* QUICK STATS */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card-soft p-5">
            <div className="muted text-sm">Tournament Stage</div>
            <div className="text-xl font-bold mt-1">Group Stage</div>
          </div>

          <div className="card-soft p-5">
            <div className="muted text-sm">Matches Played</div>
            <div className="text-xl font-bold mt-1">—</div>
          </div>

          <div className="card-soft p-5">
            <div className="muted text-sm">Total Goals</div>
            <div className="text-xl font-bold mt-1">—</div>
          </div>
        </div>

        {/* LEADERBOARDS */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="h2 mb-4">⚽ Top Scorers</h2>
            <div className="text-white/50 text-sm">
              Scores will appear here once matches are played.
            </div>
          </div>

          <div className="card p-6">
            <h2 className="h2 mb-4">🎯 Top Assisters</h2>
            <div className="text-white/50 text-sm">
              Assists leaderboard will update automatically.
            </div>
          </div>
        </div>

        {/* TEAMS */}
        <div className="card p-6">
          <h2 className="h2 mb-4">🏟 Teams</h2>
          <div className="text-white/50 text-sm">
            Teams will be listed here. Click a team to view players and stats.
          </div>
        </div>

      </div>
    </div>
  );
}
