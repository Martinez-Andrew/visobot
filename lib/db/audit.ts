import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function writeAuditEvent(params: {
  userId: string;
  workspaceId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("audit_logs").insert({
    user_id: params.userId,
    workspace_id: params.workspaceId,
    event_type: params.eventType,
    metadata: params.metadata ?? {}
  });
}
