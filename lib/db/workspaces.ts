import { slugify } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getOrCreateDefaultWorkspace(userId: string) {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: readError } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("owner_user_id", userId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (existing) {
    return existing;
  }

  const suffix = userId.slice(0, 8);
  const name = "My Workspace";
  const slug = slugify(`${name}-${suffix}`);

  const { data: created, error: writeError } = await supabase
    .from("workspaces")
    .insert({ owner_user_id: userId, name, slug })
    .select("id, name, slug")
    .single();

  if (writeError) {
    throw writeError;
  }

  return created;
}
