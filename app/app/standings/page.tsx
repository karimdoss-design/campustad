"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Team = { id: string; name: string };
type Group = { id: string; name: string };

type MatchRow = {
  id: string;
  stage: "group" | "knockout";
  group_id: string | null;
  home_team_id: string;
  away_team_id: string;
  start_time: string | null;
  status: "scheduled" | "finished";
  home_score: number | null;
  away_score: number | null;
  knockout_round: string | null;
};

/** Supabase join sometimes returns object OR array depending on FK settings */
type JoinOne<T> = T | T[] | null;

type TeamGroupRow = {
  team_id: string;
  group_id: string;
  teams: JoinOne<{ id: string; name: string }>;
  groups: JoinOne<{ id: string; name: string }>;
};

function pickOne<T>(x: JoinOne<T>): T | null {
  if (!x) return null;
  return Array.isArray(x) ? x[0] ?? null : x;
}

function normRoundLabel(x: string | null) {
  const s = (x || "").trim();
  return s.length ? s : "Knockout";
}

// Flexible ordering (works with QF/SF/F, and also full words)
function roundOrder(label: string) {
  const x = label.toLowerCase();
  if (x.includes("round of 16") || x.includes("r16") || x.includes("ro16")) return 1;
  if (x.includes("quarter") || x === "qf") return 2;
  if (x.includes("semi") || x === "sf") return 3;
  if (x.includes("third") || x.includes("3rd") || x.includes("bronze")) return 4;
  if (x.includes("final") || x === "f") return 5;
  if (x === "knockout") return 99;
  return 50; // unknown custom rounds go in the middle
}

export default function StandingsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamGroupRow[]>([]);
  const [groupMatches, setGroupMatches] = useState<MatchRow[]>([]);
  const [knockoutMatches, setKnockoutMatches] = useState<MatchRow[]>([]);

  function fail(message: string) {
    setErr(message);
    setLoading(false);
  }

  async function load() {
    setLoading(true);
    setErr("");

    // Teams
    const { data: t, error: tErr } = await supabase.from("teams").select("id,name").order("name");
    if (tErr) return fail(tErr.message);
    setTeams((t as Team[]) || []);

    // Groups
    const { data: g, error: gErr } = await supabase.from("groups").select("id,name").order("name");
    if (gErr) return fail(gErr.message);
    setGroups((g as Group[]) || []);

    // Team -> Group mapping (THIS is what makes user see changes instantly)
    // Using your table: team_groups
    const { data: tg, error: tgErr } = await supabase
      .from("team_groups")
      .select(
        `
        team_id,
        group_id,
        teams:team_id ( id, name ),
        groups:group_id ( id, name )
      `
      );

    if (tgErr) return fail(tgErr.message);
    setTeamGroups((((tg as any[]) || []) as TeamGroupRow[]) || []);

    // Group matches
    const { data: gm, error: gmErr } = await supabase
      .from("matches")
      .select("id,stage,group_id,home_team_id,away_team_id,start_time,status,home_score,away_score,knockout_round")
      .eq("stage", "group")
      .order("start_time", { ascending: true, nullsFirst: false });

    if (gmErr) return fail(gmErr.message);
    setGroupMatches((gm as MatchRow[]) || []);

    // Knockout matches
    const { data: km, error: kmErr } = await supabase
      .from("matches")
      .select("id,stage,group_id,home_team_id,away_team_id,start_time,status,home_score,away_score,knockout_round")
      .eq("stage", "knockout")
      .order("start_time", { ascending: true, nullsFirst: false });

    if (kmErr) return fail(kmErr.message);
    setKnockoutMatches((km as MatchRow[]) || []);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const teamName = useMemo(() => {
    const m = new Map<string, string>();
    teams.forEach((t) => m.set(t.id, t.name));

    // fallback: if a team didn't load for any reason but join has it
    teamGroups.forEach((tg) => {
      const t = pickOne(tg.teams);
      if (t?.id && t?.name) m.set(t.id, t.name);
    });

    return m;
  }, [teams, teamGroups]);

  const groupName = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));

    // fallback join
    teamGroups.forEach((tg) => {
      const g = pickOne(tg.groups);
      if (g?.id && g?.name) m.set(g.id, g.name);
    });

    return m;
  }, [groups, teamGroups]);

  /** ✅ teams per group comes from team_groups table (not matches) */
  const teamsInGroup = useMemo(() => {
    const map = new Map<string, Set<string>>();
    teamGroups.forEach((tg) => {
      if (!tg.group_id || !tg.team_id) return;
      if (!map.has(tg.group_id)) map.set(tg.group_id, new Set());
      map.get(tg.group_id)!.add(tg.team_id);
    });
    return map;
  }, [teamGroups]);

  /** Compute standings based on finished GROUP matches */
  const standingsByGroup = useMemo(() => {
    const out: { group_id: string; rows: any[] }[] = [];

    for (const g of groups) {
      const set = teamsInGroup.get(g.id) || new Set<string>();
      const table = new Map<string, any>();

      // ensure each mapped team has a row even before matches
      for (const teamId of Array.from(set)) {
        table.set(teamId, {
          team_id: teamId,
          played: 0,
          won: 0,
          draw: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          pts: 0,
        });
      }

      // apply finished matches
      groupMatches.forEach((m) => {
        if (m.group_id !== g.id) return;
        if (m.status !== "finished") return;
        if (m.home_score == null || m.away_score == null) return;

        if (!table.has(m.home_team_id)) {
          table.set(m.home_team_id, {
            team_id: m.home_team_id,
            played: 0,
            won: 0,
            draw: 0,
            lost: 0,
            gf: 0,
            ga: 0,
            gd: 0,
            pts: 0,
          });
        }
        if (!table.has(m.away_team_id)) {
          table.set(m.away_team_id, {
            team_id: m.away_team_id,
            played: 0,
            won: 0,
            draw: 0,
            lost: 0,
            gf: 0,
            ga: 0,
            gd: 0,
            pts: 0,
          });
        }

        const home = table.get(m.home_team_id);
        const away = table.get(m.away_team_id);

        home.played++;
        away.played++;

        home.gf += m.home_score;
        home.ga += m.away_score;
        away.gf += m.away_score;
        away.ga += m.home_score;

        if (m.home_score > m.away_score) {
          home.won++;
          away.lost++;
          home.pts += 3;
        } else if (m.home_score < m.away_score) {
          away.won++;
          home.lost++;
          away.pts += 3;
        } else {
          home.draw++;
          away.draw++;
          home.pts += 1;
          away.pts += 1;
        }

        home.gd = home.gf - home.ga;
        away.gd = away.gf - away.ga;
      });

      const rows = Array.from(table.values());
      rows.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return (teamName.get(a.team_id) || "").localeCompare(teamName.get(b.team_id) || "");
      });

      out.push({ group_id: g.id, rows });
    }

    return out;
  }, [groups, teamsInGroup, groupMatches, teamName]);

  /** Knockout grouped by knockout_round */
  const knockoutGroups = useMemo(() => {
    const map = new Map<string, MatchRow[]>();
    knockoutMatches.forEach((m) => {
      const label = normRoundLabel(m.knockout_round);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(m);
    });

    const entries = Array.from(map.entries());
    entries.sort((a, b) => roundOrder(a[0]) - roundOrder(b[0]) || a[0].localeCompare(b[0]));

    // sort matches inside each round by start_time
    entries.forEach(([k, arr]) => {
      arr.sort((x, y) => {
        const tx = x.start_time ? new Date(x.start_time).getTime() : 0;
        const ty = y.start_time ? new Date(y.start_time).getTime() : 0;
        return tx - ty;
      });
    });

    return entries;
  }, [knockoutMatches]);

  if (loading) return <div className="min-h-screen bg-[#0b1530] text-white p-8">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0b1530] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {err && <div className="text-red-400">{err}</div>}

        {/* GROUPS */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h1 className="text-2xl font-bold">Groups</h1>
            <button
              onClick={load}
              className="bg-blue-600 hover:bg-blue-500 transition px-4 py-2 rounded-xl font-bold"
            >
              Refresh
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {standingsByGroup.map((g) => {
              const gName = groupName.get(g.group_id) || "Group";

              return (
                <div key={g.group_id} className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4">
                  <div className="font-bold text-lg mb-3">{gName}</div>

                  {g.rows.length === 0 ? (
                    <div className="text-white/70">
                      No teams in this group yet. (Admin: assign teams to this group)
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-white/60">
                          <tr>
                            <th className="text-left py-2">Team</th>
                            <th className="text-right py-2">P</th>
                            <th className="text-right py-2">W</th>
                            <th className="text-right py-2">D</th>
                            <th className="text-right py-2">L</th>
                            <th className="text-right py-2">GD</th>
                            <th className="text-right py-2">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.rows.map((r: any) => (
                            <tr key={r.team_id} className="border-t border-white/10">
                              <td className="py-2 font-bold">{teamName.get(r.team_id) || "—"}</td>
                              <td className="py-2 text-right">{r.played}</td>
                              <td className="py-2 text-right">{r.won}</td>
                              <td className="py-2 text-right">{r.draw}</td>
                              <td className="py-2 text-right">{r.lost}</td>
                              <td className="py-2 text-right">{r.gd}</td>
                              <td className="py-2 text-right font-bold">{r.pts}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="text-white/50 text-xs mt-2">
                        Note: points & GD appear after group matches are marked as finished.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* KNOCKOUT */}
        <div className="bg-[#111c44] border border-white/10 rounded-2xl p-5">
          <h2 className="text-2xl font-bold">Knockout</h2>
          <p className="text-white/60 text-sm">
            Admin can set any knockout round label (ex: QF, SF, Final, Round of 16). Empty labels go under “Knockout”.
          </p>

          {knockoutMatches.length === 0 ? (
            <div className="text-white/70 mt-4">No knockout matches yet.</div>
          ) : (
            <div className="mt-4 space-y-4">
              {knockoutGroups.map(([label, arr]) => (
                <div key={label} className="bg-[#0b1530] border border-[#1f2a60] rounded-2xl p-4">
                  <div className="font-bold text-lg mb-3">{label}</div>

                  <div className="space-y-2">
                    {arr.map((m) => {
                      const home = teamName.get(m.home_team_id) || "TBD";
                      const away = teamName.get(m.away_team_id) || "TBD";
                      const kickoff = m.start_time ? new Date(m.start_time).toLocaleString() : "—";
                      const score =
                        m.home_score == null || m.away_score == null ? "—" : `${m.home_score} - ${m.away_score}`;

                      return (
                        <div
                          key={m.id}
                          className="bg-[#111c44] border border-white/10 rounded-xl p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                        >
                          <div>
                            <div className="font-bold">
                              {home} <span className="text-white/60 font-normal">vs</span> {away}
                            </div>
                            <div className="text-white/60 text-xs">
                              {kickoff} • status: {m.status}
                            </div>
                          </div>

                          <div className="font-bold text-lg">{score}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
