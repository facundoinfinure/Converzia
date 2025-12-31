import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ============================================
// Google OAuth - Disconnect Account
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return NextResponse.json(
        { error: "tenant_id es requerido" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Clear OAuth tokens from integration
    const { error } = await supabase
      .from("tenant_integrations")
      .update({
        oauth_tokens: null,
        status: "PENDING_SETUP",
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id)
      .eq("integration_type", "GOOGLE_SHEETS");

    if (error) {
      console.error("Error disconnecting Google:", error);
      return NextResponse.json(
        { error: "Error al desconectar cuenta" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disconnecting Google account:", error);
    return NextResponse.json(
      { error: "Error al desconectar cuenta" },
      { status: 500 }
    );
  }
}

