import { requireAuth } from "@/lib/auth";
import { getOrCreateDefaultWorkspace } from "@/lib/db/workspaces";
import { hybridSearch } from "@/lib/search/hybrid";
import { enforceRateLimit } from "@/lib/rate-limit";
import { fail, ok } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const workspace = await getOrCreateDefaultWorkspace(auth.userId);

    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return fail("Search query must be at least 2 characters.", 400);
    }

    const rate = await enforceRateLimit(auth.userId, "search");
    if (!rate.success) {
      return fail("Search limit exceeded. Try again shortly.", 429);
    }

    const results = await hybridSearch(workspace.id, query);

    return ok({
      query,
      count: results.length,
      results
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return fail("Unauthorized", 401);
    }

    return fail(error instanceof Error ? error.message : "Failed to search", 500);
  }
}
