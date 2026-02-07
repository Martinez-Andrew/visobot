import { requireAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { stripe } from "@/lib/billing/stripe";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { getOrCreateProfile } from "@/lib/db/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);
    const profile = await getOrCreateProfile(auth.userId, auth.email);
    const settings = env();

    if (!settings.STRIPE_PRO_PRICE_ID) {
      return fail("Missing STRIPE_PRO_PRICE_ID", 500);
    }

    const stripeClient = stripe();

    const customerId = profile.stripe_customer_id
      ? profile.stripe_customer_id
      : (
          await stripeClient.customers.create({
            email: profile.email ?? undefined,
            metadata: {
              userId: profile.user_id
            }
          })
        ).id;

    if (!profile.stripe_customer_id) {
      const supabase = createSupabaseAdminClient();
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", profile.user_id);
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      success_url: `${settings.NEXT_PUBLIC_APP_URL}/settings?billing=success`,
      cancel_url: `${settings.NEXT_PUBLIC_APP_URL}/settings?billing=cancelled`,
      allow_promotion_codes: true,
      line_items: [{ price: settings.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      metadata: {
        userId: auth.userId,
        workspaceId: workspace.id
      }
    });

    return ok({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Checkout failed", 500);
  }
}
