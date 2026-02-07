import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmbedding, cosineSimilarity, toVectorLiteral } from "@/lib/llm/embeddings";
import { truncate } from "@/lib/utils";
import { classifySimilarity } from "@/lib/organize/scoring";

function buildTopicName(content: string) {
  const normalized = content
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 5)
    .join(" ");

  if (!normalized) return "Inbox";
  return normalized
    .replace(/[.!?].*$/, "")
    .replace(/[^\w\s-]/g, "")
    .trim();
}

type TopicRow = {
  id: string;
  name: string;
  embedding: string | number[] | null;
};

function parseVector(value: string | number[] | null): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value;
  }
  const cleaned = value.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!cleaned) return null;
  return cleaned.split(",").map((entry) => Number(entry.trim())).filter((entry) => Number.isFinite(entry));
}

export async function autoAssignItemToTopic(params: {
  workspaceId: string;
  itemId: string;
  content: string;
}) {
  const { workspaceId, itemId, content } = params;
  const supabase = createSupabaseAdminClient();

  const summary = truncate(content.replace(/\s+/g, " "), 240);
  const embedding = await getEmbedding(summary);

  const { data: topics, error: topicsError } = await supabase
    .from("topics")
    .select("id, name, embedding")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (topicsError) throw topicsError;

  let bestTopic: TopicRow | null = null;
  let bestScore = 0;

  if (embedding && topics?.length) {
    for (const topic of topics as TopicRow[]) {
      const existingEmbedding = parseVector(topic.embedding);
      if (!existingEmbedding) continue;

      const score = cosineSimilarity(embedding, existingEmbedding);
      if (score > bestScore) {
        bestScore = score;
        bestTopic = topic;
      }
    }
  }

  let topicId = bestTopic?.id;
  if (!topicId || classifySimilarity(bestScore) === "create-topic") {
    const fallbackName = buildTopicName(summary) || "Inbox";

    const { data: created, error: createError } = await supabase
      .from("topics")
      .insert({
        workspace_id: workspaceId,
        name: fallbackName,
        summary,
        embedding: embedding ? toVectorLiteral(embedding) : null,
        source: "auto"
      })
      .select("id")
      .single();

    if (createError) throw createError;

    topicId = created.id;
    bestScore = 0.5;
  }

  const { error: linkError } = await supabase.from("item_topic_links").upsert(
    {
      workspace_id: workspaceId,
      item_id: itemId,
      topic_id: topicId,
      confidence: bestScore,
      source: "auto"
    },
    { onConflict: "item_id,topic_id" }
  );

  if (linkError) throw linkError;

  return {
    topicId,
    confidence: bestScore,
    summary
  };
}
