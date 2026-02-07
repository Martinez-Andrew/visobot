import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEmbedding, toVectorLiteral } from "@/lib/llm/embeddings";
import type { SearchResult } from "@/types/domain";

export async function hybridSearch(workspaceId: string, query: string): Promise<SearchResult[]> {
  const supabase = createSupabaseAdminClient();

  const keywordPromise = supabase
    .from("items")
    .select("id, type, title")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .ilike("title", `%${query}%`)
    .limit(15);

  const chunkPromise = supabase
    .from("search_chunks")
    .select("id, item_id, content")
    .eq("workspace_id", workspaceId)
    .ilike("content", `%${query}%`)
    .limit(20);

  const [keywordResult, chunkResult] = await Promise.all([keywordPromise, chunkPromise]);

  const results: SearchResult[] = [];

  if (keywordResult.data) {
    for (const row of keywordResult.data) {
      results.push({
        id: row.id,
        itemId: row.id,
        type: row.type,
        title: row.title,
        snippet: row.title,
        source: "title",
        score: 0.92
      });
    }
  }

  if (chunkResult.data) {
    for (const row of chunkResult.data) {
      results.push({
        id: row.id,
        itemId: row.item_id,
        type: "file",
        title: "Content match",
        snippet: row.content.slice(0, 220),
        source: "content",
        score: 0.75
      });
    }
  }

  const embedding = await getEmbedding(query);
  if (embedding) {
    const { data } = await supabase.rpc("match_search_chunks", {
      p_workspace: workspaceId,
      query_embedding: toVectorLiteral(embedding),
      match_threshold: 0.72,
      match_count: 10
    });

    if (data) {
      for (const row of data as Array<{ id: string; item_id: string; content: string; similarity: number }>) {
        results.push({
          id: row.id,
          itemId: row.item_id,
          type: "file",
          title: "Semantic match",
          snippet: row.content.slice(0, 220),
          source: "content",
          score: row.similarity
        });
      }
    }
  }

  const deduped = new Map<string, SearchResult>();
  for (const result of results) {
    const current = deduped.get(result.itemId);
    if (!current || result.score > current.score) {
      deduped.set(result.itemId, result);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => b.score - a.score).slice(0, 25);
}
