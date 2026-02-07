import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { getOrCreateProfile } from "@/lib/db/profile";
import { getEntitlements } from "@/lib/billing/entitlements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateProviderKey } from "@/lib/llm/providers";
import { encryptSecret } from "@/lib/security/encryption";
import { enforceRateLimit } from "@/lib/rate-limit";
import { writeAuditEvent } from "@/lib/db/audit";
import { fail, ok } from "@/lib/http";

const bodySchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  apiKey: z.string().min(10),
  label: z.string().min(2).max(60)
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const body = bodySchema.parse(await request.json());

    const rate = await enforceRateLimit(auth.userId, "llm-connect");
    if (!rate.success) {
      return fail("Rate limit exceeded. Try again in a minute.", 429);
    }

    const profile = await getOrCreateProfile(auth.userId, auth.email);
    const entitlements = getEntitlements(profile.plan_tier);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);

    const supabase = createSupabaseAdminClient();
    const { count } = await supabase
      .from("llm_connections")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .is("deleted_at", null);

    if ((count ?? 0) >= entitlements.maxConnections) {
      return fail("Connection limit reached for your plan.", 403);
    }

    const validation = await validateProviderKey(body.provider, body.apiKey);
    const encryptedKey = await encryptSecret(body.apiKey);

    const { data: record, error } = await supabase
      .from("llm_connections")
      .insert({
        workspace_id: workspace.id,
        user_id: auth.userId,
        provider: body.provider,
        label: body.label,
        encrypted_api_key: encryptedKey,
        model_catalog: validation.models,
        validation_status: "validated",
        validated_at: new Date().toISOString(),
        is_active: true
      })
      .select("id, provider, label, validated_at, is_active")
      .single();

    if (error) {
      throw error;
    }

    await writeAuditEvent({
      userId: auth.userId,
      workspaceId: workspace.id,
      eventType: "llm.connection.created",
      metadata: { provider: body.provider, label: body.label }
    });

    return ok({
      connection: record,
      modelCatalog: validation.models,
      status: validation.status
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail(error.errors[0]?.message ?? "Invalid request body", 400);
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Failed to create LLM connection", 500);
  }
}
