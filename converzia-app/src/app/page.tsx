import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is Converzia admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_converzia_admin")
    .eq("id", user.id)
    .single();

  if ((profile as any)?.is_converzia_admin) {
    redirect("/admin");
  }

  redirect("/portal");
}


