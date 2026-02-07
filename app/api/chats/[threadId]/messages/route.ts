import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";
import { decryptSecret } from "@/lib/security/encryption";
import { sendProviderChat } from "@/lib/llm/providers";
import { enqueueEvent } from "@/lib/inngest/enqueue";
import { writeAuditEvent } from "@/lib/db/audit";

const bodySchema = z.object({
  content: z.string().min(1),
  systemPrompt: z.string().max(2000).optional()
});

export async function GET(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const { threadId } = await context.params;

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, token_usage, created_at")
      .eq("workspace_id", workspace.id)
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    return ok({ messages: data ?? [] });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Failed to fetch messages", 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const payload = bodySchema.parse(await request.json());
    const { threadId } = await context.params;

    const supabase = createSupabaseAdminClient();

    const { data: thread, error: threadError } = await supabase
      .from("chat_threads")
      .select("id, item_id, llm_connection_id, active_model")
      .eq("id", threadId)
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null)
      .single();

    if (threadError || !thread) {
      return fail("Thread not found", 404);
    }

    const { error: userMessageError } = await supabase.from("chat_messages").insert({
      workspace_id: workspace.id,
      thread_id: threadId,
      role: "user",
      content: payload.content
    });

    if (userMessageError) throw userMessageError;

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(20);

    let assistantContent = "I saved your message. Connect an LLM key to generate AI responses.";
    let tokenUsage = 0;

    let llmConnection: { provider: "openai" | "anthropic"; encrypted_api_key: string } | null = null;
    if (thread.llm_connection_id) {
      const { data: connection } = await supabase
        .from("llm_connections")
        .select("provider, encrypted_api_key")
        .eq("id", thread.llm_connection_id)
        .eq("workspace_id", workspace.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (connection) {
        llmConnection = connection;
      }
    }

    if (llmConnection?.encrypted_api_key && thread.active_model) {
      const apiKey = await decryptSecret(llmConnection.encrypted_api_key);
      const messages = [
        ...(payload.systemPrompt ? [{ role: "system" as const, content: payload.systemPrompt }] : []),
        ...((history ?? []).map((entry) => ({ role: entry.role, content: entry.content })) as Array<{
          role: "system" | "user" | "assistant";
          content: string;
        }>)
      ];

      const response = await sendProviderChat({
        provider: llmConnection.provider,
        apiKey,
        model: thread.active_model,
        messages
      });

      assistantContent = response.content;
      tokenUsage = response.tokens;
    }

    const { data: assistantMessage, error: assistantError } = await supabase
      .from("chat_messages")
      .insert({
        workspace_id: workspace.id,
        thread_id: threadId,
        role: "assistant",
        content: assistantContent,
        token_usage: tokenUsage
      })
      .select("id, role, content, token_usage, created_at")
      .single();

    if (assistantError) throw assistantError;

    await supabase
      .from("items")
      .update({
        content: payload.content,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", thread.item_id)
      .eq("workspace_id", workspace.id);

    const combinedForMemory = `${payload.content}\n${assistantContent}`;

    await Promise.all([
      enqueueEvent("item/classify.requested", {
        workspaceId: workspace.id,
        itemId: thread.item_id,
        content: combinedForMemory
      }),
      enqueueEvent("item/index.requested", {
        workspaceId: workspace.id,
        itemId: thread.item_id,
        content: combinedForMemory
      }),
      writeAuditEvent({
        userId: auth.userId,
        workspaceId: workspace.id,
        eventType: "chat.message.created",
        metadata: { threadId, tokenUsage }
      })
    ]);

    return ok({ message: assistantMessage });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.errors[0]?.message ?? "Invalid request", 400);
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Failed to send message", 500);
  }
}
