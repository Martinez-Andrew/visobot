import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";
import type { TopicNode } from "@/types/domain";

function buildTopicTree(
  topics: Array<{ id: string; name: string; parent_topic_id: string | null }>,
  counts: Record<string, number>
): TopicNode[] {
  const nodeMap = new Map<string, TopicNode>();
  const roots: TopicNode[] = [];

  for (const topic of topics) {
    nodeMap.set(topic.id, {
      id: topic.id,
      name: topic.name,
      parentTopicId: topic.parent_topic_id,
      itemCount: counts[topic.id] ?? 0,
      children: []
    });
  }

  for (const topic of topics) {
    const node = nodeMap.get(topic.id);
    if (!node) continue;

    if (!topic.parent_topic_id) {
      roots.push(node);
      continue;
    }

    const parent = nodeMap.get(topic.parent_topic_id);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const supabase = createSupabaseAdminClient();

    const [{ data: topics, error: topicsError }, { data: links, error: linksError }] = await Promise.all([
      supabase
        .from("topics")
        .select("id, name, parent_topic_id")
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase.from("item_topic_links").select("topic_id").eq("workspace_id", workspace.id)
    ]);

    if (topicsError) throw topicsError;
    if (linksError) throw linksError;

    const counts = (links ?? []).reduce<Record<string, number>>((acc, link) => {
      acc[link.topic_id] = (acc[link.topic_id] ?? 0) + 1;
      return acc;
    }, {});

    const tree = buildTopicTree(topics ?? [], counts);

    return ok({
      workspace,
      topics: tree
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }
    return fail(error instanceof Error ? error.message : "Failed to load topics", 500);
  }
}
