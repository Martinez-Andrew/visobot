import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";
import { enqueueEvent } from "@/lib/inngest/enqueue";
import { writeAuditEvent } from "@/lib/db/audit";

const createChatSchema = z.object({
  title: z.string().min(2).max(160),
  llmConnectionId: z.string().uuid().optional(),
  model: z.string().min(2).optional(),
  starterMessage: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const payload = createChatSchema.parse(await request.json());

    const supabase = createSupabaseAdminClient();

    const { data: item, error: itemError } = await supabase
      .from("items")
      .insert({
        workspace_id: workspace.id,
        user_id: auth.userId,
        type: "chat",
        title: payload.title,
        content: payload.starterMessage ?? "",
        metadata: {
          model: payload.model ?? null,
          connection_id: payload.llmConnectionId ?? null
        },
        last_activity_at: new Date().toISOString()
      })
      .select("id, workspace_id, type, title, metadata")
      .single();

    if (itemError) throw itemError;

    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .insert({
        workspace_id: workspace.id,
        item_id: item.id,
        llm_connection_id: payload.llmConnectionId ?? null,
        active_model: payload.model ?? null
      })
      .select("id, item_id, llm_connection_id, active_model")
      .single();

    if (threadError) throw threadError;

    await supabase
      .from("items")
      .update({
        metadata: {
          ...((item.metadata as Record<string, unknown>) ?? {}),
          thread_id: thread.id
        }
      })
      .eq("id", item.id)
      .eq("workspace_id", workspace.id);

    if (payload.starterMessage) {
      await supabase.from("chat_messages").insert({
        workspace_id: workspace.id,
        thread_id: thread.id,
        role: "user",
        content: payload.starterMessage
      });

      await Promise.all([
        enqueueEvent("item/classify.requested", {
          workspaceId: workspace.id,
          itemId: item.id,
          content: payload.starterMessage
        }),
        enqueueEvent("item/index.requested", {
          workspaceId: workspace.id,
          itemId: item.id,
          content: payload.starterMessage
        })
      ]);
    }

    await writeAuditEvent({
      userId: auth.userId,
      workspaceId: workspace.id,
      eventType: "chat.created",
      metadata: { itemId: item.id, threadId: thread.id }
    });

    return ok({ item, thread }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.errors[0]?.message ?? "Invalid request", 400);
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Failed to create chat", 500);
  }
}
