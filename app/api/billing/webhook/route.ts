import Stripe from "stripe";

import { env } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { stripe } from "@/lib/billing/stripe";
import { updateProfilePlanByCustomer } from "@/lib/db/profile";

export async function POST(request: Request) {
  try {
    const config = env();

    if (!config.STRIPE_WEBHOOK_SECRET) {
      return fail("Missing STRIPE_WEBHOOK_SECRET", 500);
    }

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return fail("Missing stripe signature", 400);
    }

    const payload = await request.text();
    const stripeClient = stripe();

    const event = stripeClient.webhooks.constructEvent(payload, signature, config.STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.customer) {
        await updateProfilePlanByCustomer(String(session.customer), "pro", "active");
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.customer) {
        await updateProfilePlanByCustomer(String(subscription.customer), "free", "canceled");
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.customer) {
        const tier = subscription.status === "active" ? "pro" : "free";
        await updateProfilePlanByCustomer(String(subscription.customer), tier, subscription.status);
      }
    }

    return ok({ received: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid webhook", 400);
  }
}
