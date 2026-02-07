import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";
import { enqueueEvent } from "@/lib/inngest/enqueue";
import { writeAuditEvent } from "@/lib/db/audit";

const createItemSchema = z.object({
  type: z.enum(["gpt", "file", "instruction", "agent"]),
  title: z.string().min(1).max(160),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const url = new URL(request.url);
    const topicId = url.searchParams.get("topicId");
    const type = url.searchParams.get("type");

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("items")
      .select("id, type, title, content, metadata, last_activity_at, created_at")
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .order("last_activity_at", { ascending: false })
      .limit(200);

    if (type && ["chat", "gpt", "file", "instruction", "agent"].includes(type)) {
      query = query.eq("type", type);
    }

    if (topicId) {
      const { data: links } = await supabase
        .from("item_topic_links")
        .select("item_id")
        .eq("workspace_id", workspace.id)
        .eq("topic_id", topicId);

      const ids = (links ?? []).map((entry) => entry.item_id);
      if (ids.length === 0) {
        return ok({ items: [] });
      }
      query = query.in("id", ids);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ok({ items: data ?? [] });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Failed to fetch items", 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const payload = createItemSchema.parse(await request.json());

    const supabase = createSupabaseAdminClient();
    const { data: item, error } = await supabase
      .from("items")
      .insert({
        workspace_id: workspace.id,
        user_id: auth.userId,
        type: payload.type,
        title: payload.title,
        content: payload.content,
        metadata: payload.metadata ?? {},
        last_activity_at: new Date().toISOString()
      })
      .select("id, workspace_id, type, title, content")
      .single();

    if (error) throw error;

    await Promise.all([
      enqueueEvent("item/classify.requested", {
        workspaceId: workspace.id,
        itemId: item.id,
        content: payload.content
      }),
      enqueueEvent("item/index.requested", {
        workspaceId: workspace.id,
        itemId: item.id,
        content: payload.content
      })
    ]);

    await writeAuditEvent({
      userId: auth.userId,
      workspaceId: workspace.id,
      eventType: "item.created",
      metadata: { itemId: item.id, type: payload.type }
    });

    return ok({ item }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.errors[0]?.message ?? "Invalid request", 400);
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Failed to create item", 500);
  }
}
