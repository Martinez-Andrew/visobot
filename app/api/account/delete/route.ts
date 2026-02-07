import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";
import { writeAuditEvent } from "@/lib/db/audit";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const supabase = createSupabaseAdminClient();

    await writeAuditEvent({
      userId: auth.userId,
      workspaceId: workspace.id,
      eventType: "account.delete.requested"
    });

    const { error } = await supabase.rpc("hard_delete_workspace_data", {
      p_workspace_id: workspace.id,
      p_user_id: auth.userId
    });

    if (error) {
      throw error;
    }

    return ok({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Delete failed", 500);
  }
}
