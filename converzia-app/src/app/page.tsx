import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { queryWithTimeout } from "@/lib/supabase/query-with-timeout";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is Converzia admin
  const { data: profile } = await queryWithTimeout(
    supabase
      .from("user_profiles")
      .select("is_converzia_admin")
      .eq("id", user.id)
      .single(),
    10000,
    "get user profile in home"
  );

  if ((profile as any)?.is_converzia_admin) {
    redirect("/admin");
  }

  redirect("/portal");
}












