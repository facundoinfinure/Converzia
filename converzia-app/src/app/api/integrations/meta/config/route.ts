import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/integrations/meta/config - Get Meta integration config
export async function GET(request: NextRequest) {
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

    // Get global Meta integration
    const { data: integration, error } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("integration_type", "META_ADS")
      .is("tenant_id", null)
      .maybeSingle();

    if (error) {
      console.error("Error fetching Meta integration:", error);
      return NextResponse.json(
        { error: "Failed to fetch integration" },
        { status: 500 }
      );
    }

    if (!integration) {
      return NextResponse.json(
        { connected: false },
        { status: 200 }
      );
    }

    const config = integration.config as any;

    return NextResponse.json({
      connected: true,
      user_name: config?.user_name,
      ad_accounts: config?.ad_accounts || [],
      pages: (config?.pages || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        // Don't expose access_token to client
      })),
      whatsapp_business_accounts: (config?.whatsapp_business_accounts || []).map((waba: any) => ({
        id: waba.id,
        name: waba.name,
        business_name: waba.business_name,
        phone_numbers: waba.phone_numbers || [],
      })),
      selected_page_id: config?.selected_page_id,
      selected_waba_id: config?.selected_waba_id,
      selected_phone_number_id: config?.selected_phone_number_id,
    });
  } catch (error) {
    console.error("Error getting Meta config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/integrations/meta/config - Update selected items
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { selected_page_id, selected_waba_id, selected_phone_number_id } = body;

    // Get existing integration
    const { data: integration, error: fetchError } = await supabase
      .from("tenant_integrations")
      .select("*")
      .eq("integration_type", "META_ADS")
      .is("tenant_id", null)
      .maybeSingle();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: "Meta integration not found" },
        { status: 404 }
      );
    }

    // Update config with selected items
    const currentConfig = integration.config as any;
    const updatedConfig = {
      ...currentConfig,
      ...(selected_page_id !== undefined && { selected_page_id }),
      ...(selected_waba_id !== undefined && { selected_waba_id }),
      ...(selected_phone_number_id !== undefined && { selected_phone_number_id }),
    };

    const { error: updateError } = await supabase
      .from("tenant_integrations")
      .update({
        config: updatedConfig,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    if (updateError) {
      console.error("Error updating Meta config:", updateError);
      return NextResponse.json(
        { error: "Failed to update configuration" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating Meta config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

