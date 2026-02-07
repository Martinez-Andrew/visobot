import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";
import { chunkText } from "@/lib/utils";
import { enqueueEvent } from "@/lib/inngest/enqueue";
import { writeAuditEvent } from "@/lib/db/audit";

function inferMimeType(fileName: string) {
  if (fileName.endsWith(".md")) return "text/markdown";
  if (fileName.endsWith(".txt")) return "text/plain";
  if (fileName.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return fail("A file is required.", 400);
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".md") && !name.endsWith(".txt") && !name.endsWith(".json")) {
      return fail("Only md/txt/json files are supported.", 400);
    }

    const raw = await file.text();
    if (!raw.trim()) {
      return fail("File is empty.", 400);
    }

    const supabase = createSupabaseAdminClient();

    const { data: item, error: itemError } = await supabase
      .from("items")
      .insert({
        workspace_id: workspace.id,
        user_id: auth.userId,
        type: "file",
        title: file.name,
        content: raw.slice(0, 12000),
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          mimeType: inferMimeType(file.name)
        },
        last_activity_at: new Date().toISOString()
      })
      .select("id, title")
      .single();

    if (itemError) throw itemError;

    const chunks = chunkText(raw, 1200).slice(0, 50);

    await supabase.from("imports").insert({
      workspace_id: workspace.id,
      user_id: auth.userId,
      item_id: item.id,
      source: "upload",
      file_name: file.name,
      status: "completed",
      chunk_count: chunks.length
    });

    await Promise.all([
      enqueueEvent("item/classify.requested", {
        workspaceId: workspace.id,
        itemId: item.id,
        content: raw.slice(0, 8000)
      }),
      enqueueEvent("item/index.requested", {
        workspaceId: workspace.id,
        itemId: item.id,
        content: raw
      }),
      writeAuditEvent({
        userId: auth.userId,
        workspaceId: workspace.id,
        eventType: "import.completed",
        metadata: { fileName: file.name, itemId: item.id, chunkCount: chunks.length }
      })
    ]);

    return ok({
      item,
      chunksIndexed: chunks.length
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Failed to import file", 500);
  }
}
