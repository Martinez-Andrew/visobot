import { inngest } from "@/lib/inngest/client";
import { autoAssignItemToTopic } from "@/lib/organize/classifier";
import { chunkText, truncate } from "@/lib/utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmbedding, toVectorLiteral } from "@/lib/llm/embeddings";

export const classifyItemEvent = inngest.createFunction(
  { id: "classify-item" },
  { event: "item/classify.requested" },
  async ({ event }) => {
    const payload = event.data as { workspaceId: string; itemId: string; content: string };
    await autoAssignItemToTopic(payload);
    return { ok: true };
  }
);

export const indexItemEvent = inngest.createFunction(
  { id: "index-item" },
  { event: "item/index.requested" },
  async ({ event }) => {
    const payload = event.data as { workspaceId: string; itemId: string; content: string };
    const supabase = createSupabaseAdminClient();
    const chunks = chunkText(payload.content, 1200).slice(0, 50);

    const rows = [] as Array<{ workspace_id: string; item_id: string; content: string; embedding: string | null }>;
    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk);
      rows.push({
        workspace_id: payload.workspaceId,
        item_id: payload.itemId,
        content: truncate(chunk, 3000),
        embedding: embedding ? toVectorLiteral(embedding) : null
      });
    }

    if (rows.length) {
      await supabase.from("search_chunks").insert(rows);
    }

    return { chunkCount: rows.length };
  }
);

export const nightlyTopicMaintenance = inngest.createFunction(
  {
    id: "nightly-topic-maintenance",
    name: "Nightly Topic Maintenance"
  },
  { cron: "0 2 * * *" },
  async () => {
    const supabase = createSupabaseAdminClient();

    const { data: workspaces } = await supabase.from("workspaces").select("id").is("deleted_at", null);
    if (!workspaces?.length) return { maintained: 0 };

    let maintained = 0;
    for (const workspace of workspaces) {
      const { data: topics } = await supabase
        .from("topics")
        .select("id, name")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null);

      if (!topics) continue;

      const normalized = new Map<string, string>();
      for (const topic of topics) {
        const key = topic.name.trim().toLowerCase();
        if (normalized.has(key)) {
          const targetTopicId = normalized.get(key)!;
          await supabase
            .from("item_topic_links")
            .update({ topic_id: targetTopicId, source: "auto" })
            .eq("topic_id", topic.id)
            .eq("workspace_id", workspace.id);

          await supabase.from("topics").update({ deleted_at: new Date().toISOString() }).eq("id", topic.id);
          maintained += 1;
        } else {
          normalized.set(key, topic.id);
        }
      }
    }

    return { maintained };
  }
);

export const inngestFunctions = [classifyItemEvent, indexItemEvent, nightlyTopicMaintenance];
