import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function requireAdminFromToken(token: string | null) {
  if (!token) return { ok: false, error: "Missing auth token" };

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, error: "Invalid session" };

  const userId = userData.user.id;

  const { data: me, error: meErr } = await supabaseAdmin
    .from("profiles")
    .select("role,status")
    .eq("id", userId)
    .single();

  if (meErr) return { ok: false, error: meErr.message };
  if (!me || me.role !== "admin" || me.status !== "active") return { ok: false, error: "Not admin" };

  return { ok: true, userId };
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "") || null;
    const auth = await requireAdminFromToken(token);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

    const body = await req.json();
    const { type, payload } = body;

    // ---------------- PROFILES (FANS) ----------------
    if (type === "setProfileStatus") {
      const { id, status } = payload;
      const { error } = await supabaseAdmin.from("profiles").update({ status }).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ---------------- TEAMS ----------------
    if (type === "createTeam") {
      const { name } = payload;
      const { error } = await supabaseAdmin.from("teams").insert({ name });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (type === "deleteTeam") {
      const { id } = payload;
      const { error } = await supabaseAdmin.from("teams").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ---------------- GROUPS ----------------
    if (type === "createGroup") {
      const { name } = payload;
      const { error } = await supabaseAdmin.from("groups").insert({ name });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (type === "deleteGroup") {
      const { id } = payload;
      const { error } = await supabaseAdmin.from("groups").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (type === "assignTeamGroup") {
      // groupId can be null to remove assignment
      const { teamId, groupId } = payload;

      if (!groupId) {
        const { error } = await supabaseAdmin.from("team_groups").delete().eq("team_id", teamId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }

      const { error } = await supabaseAdmin
        .from("team_groups")
        .upsert({ team_id: teamId, group_id: groupId });

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ---------------- TEAM PLAYERS (ROSTER LINKS) ----------------
    if (type === "addTeamPlayer") {
      const { team_id, player_id } = payload;
      const { error } = await supabaseAdmin.from("team_players").insert({ team_id, player_id });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (type === "removeTeamPlayer") {
      const { team_id, player_id } = payload;
      const { error } = await supabaseAdmin
        .from("team_players")
        .delete()
        .eq("team_id", team_id)
        .eq("player_id", player_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ---------------- PLAYERS + PLAYER_STATS ----------------
    if (type === "createPlayerWithStats") {
      const { full_name, university, position } = payload;

      const { data: created, error: cErr } = await supabaseAdmin
        .from("players")
        .insert({
          full_name,
          university: university || null,
          position: position || null,
        })
        .select("id")
        .single();

      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });

      // Create initial stats row (THIS used to fail under RLS)
      const { error: sErr } = await supabaseAdmin.from("player_stats").insert({
        player_id: created.id,
        matches_played: 0,
        goals: 0,
        assists: 0,
        motm: 0,
      });

      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

      return NextResponse.json({ ok: true, player_id: created.id });
    }

    if (type === "deletePlayer") {
      const { id } = payload;
      const { error } = await supabaseAdmin.from("players").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (type === "updatePlayerStats") {
      const { player_id, patch } = payload;

      const { error } = await supabaseAdmin
        .from("player_stats")
        .update(patch)
        .eq("player_id", player_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    // ---------------- MATCHES + GOALS ----------------
    if (type === "createMatch") {
      const { match } = payload;
      const { error } = await supabaseAdmin.from("matches").insert(match);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (type === "updateMatch") {
      const { id, patch } = payload;
      const { error } = await supabaseAdmin.from("matches").update(patch).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (type === "deleteMatch") {
      const { id } = payload;

      // delete goals first (avoid FK issues)
      const { error: gErr } = await supabaseAdmin.from("match_goals").delete().eq("match_id", id);
      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 400 });

      const { error } = await supabaseAdmin.from("matches").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      return NextResponse.json({ ok: true });
    }

    if (type === "addGoal") {
      const { goal } = payload;

      // Your DB has scorer_player_id NOT NULL; this prevents the null error.
      if (!goal?.scorer_player_id) {
        return NextResponse.json({ error: "Scorer is required" }, { status: 400 });
      }

      const { error } = await supabaseAdmin.from("match_goals").insert(goal);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      return NextResponse.json({ ok: true });
    }

    if (type === "deleteGoal") {
      const { id } = payload;
      const { error } = await supabaseAdmin.from("match_goals").delete().eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
