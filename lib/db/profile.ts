import type { BillingTier } from "@/types/domain";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type Profile = {
  user_id: string;
  email: string | null;
  plan_tier: BillingTier;
  stripe_customer_id: string | null;
};

export async function getOrCreateProfile(userId: string, email: string | null): Promise<Profile> {
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("user_id, email, plan_tier, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    return existing as Profile;
  }

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      user_id: userId,
      email,
      plan_tier: "free"
    })
    .select("user_id, email, plan_tier, stripe_customer_id")
    .single();

  if (createError) throw createError;

  return created as Profile;
}

export async function updateProfilePlanByCustomer(customerId: string, tier: BillingTier, status: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      plan_tier: tier,
      stripe_subscription_status: status,
      updated_at: new Date().toISOString()
    })
    .eq("stripe_customer_id", customerId);

  if (error) throw error;
}
