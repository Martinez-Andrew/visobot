import { inngest } from "@/lib/inngest/client";

export async function enqueueEvent(name: string, data: Record<string, unknown>) {
  try {
    await inngest.send({
      name,
      data
    });
  } catch {
    // In local development this can be intentionally skipped.
  }
}
