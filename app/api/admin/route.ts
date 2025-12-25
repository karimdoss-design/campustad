import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, payload } = body;

    // DELETE ROSTER PLAYER
    if (type === "deleteRosterPlayer") {
      const { team_player_id } = payload;

      await supabase.from("team_players").delete().eq("id", team_player_id);
      return NextResponse.json({ ok: true });
    }

    // DELETE TEAM
    if (type === "deleteTeam") {
      const { team_id } = payload;

      await supabase.from("teams").delete().eq("id", team_id);
      return NextResponse.json({ ok: true });
    }

    // DELETE GROUP
    if (type === "deleteGroup") {
      const { group_id } = payload;

      await supabase.from("groups").delete().eq("id", group_id);
      return NextResponse.json({ ok: true });
    }

    // UPDATE MATCH (score + motm + finish)
    if (type === "updateMatch") {
      const { match_id, home_score, away_score, motm_player_id, status } =
        payload;

      await supabase
        .from("matches")
        .update({
          home_score,
          away_score,
          motm_player_id,
          status,
        })
        .eq("id", match_id);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
