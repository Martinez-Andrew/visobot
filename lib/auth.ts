import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type AuthContext = {
  userId: string;
  email: string | null;
};

export async function requireAuth(request: Request): Promise<AuthContext> {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.replace("Bearer ", "").trim();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new Error("Unauthorized");
    }

    return {
      userId: data.user.id,
      email: data.user.email ?? null
    };
  }

  const settings = env();
  if (settings.DEV_BYPASS_AUTH) {
    return {
      userId: settings.DEV_USER_ID,
      email: "dev@visobot.local"
    };
  }

  throw new Error("Unauthorized");
}
