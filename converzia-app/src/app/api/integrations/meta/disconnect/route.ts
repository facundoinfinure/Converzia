import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/integrations/meta/disconnect - Disconnect Meta Ads integration
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find and delete the global Meta Ads integration
    const { error: deleteError } = await supabase
      .from("tenant_integrations")
      .delete()
      .eq("integration_type", "META_ADS")
      .is("tenant_id", null);

    if (deleteError) {
      console.error("Error deleting Meta integration:", deleteError);
      return NextResponse.json(
        { error: "Failed to disconnect Meta Ads" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Meta Ads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

