import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";
import { writeAuditEvent } from "@/lib/db/audit";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const supabase = createSupabaseAdminClient();

    const [items, chats, topics, links, imports] = await Promise.all([
      supabase.from("items").select("*").eq("workspace_id", workspace.id),
      supabase.from("chat_messages").select("*").eq("workspace_id", workspace.id),
      supabase.from("topics").select("*").eq("workspace_id", workspace.id),
      supabase.from("item_topic_links").select("*").eq("workspace_id", workspace.id),
      supabase.from("imports").select("*").eq("workspace_id", workspace.id)
    ]);

    await writeAuditEvent({
      userId: auth.userId,
      workspaceId: workspace.id,
      eventType: "account.export",
      metadata: { itemCount: items.data?.length ?? 0 }
    });

    return ok({
      exportedAt: new Date().toISOString(),
      workspace,
      data: {
        items: items.data ?? [],
        chatMessages: chats.data ?? [],
        topics: topics.data ?? [],
        itemTopicLinks: links.data ?? [],
        imports: imports.data ?? []
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Export failed", 500);
  }
}
