import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";

let limiter: Ratelimit | null = null;

function getLimiter() {
  if (limiter) return limiter;

  const settings = env();
  if (!settings.UPSTASH_REDIS_REST_URL || !settings.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const redis = new Redis({
    url: settings.UPSTASH_REDIS_REST_URL,
    token: settings.UPSTASH_REDIS_REST_TOKEN
  });

  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: true,
    prefix: "visobot:ratelimit"
  });

  return limiter;
}

export async function enforceRateLimit(identifier: string, segment: string) {
  const activeLimiter = getLimiter();
  if (!activeLimiter) {
    return { success: true, remaining: 9999 };
  }

  const result = await activeLimiter.limit(`${segment}:${identifier}`);
  return result;
}
