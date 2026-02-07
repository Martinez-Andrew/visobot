import { describe, expect, it } from "vitest";

import { getEntitlements } from "@/lib/billing/entitlements";

describe("billing entitlements", () => {
  it("returns free plan limits", () => {
    const free = getEntitlements("free");

    expect(free.maxConnections).toBe(2);
    expect(free.maxIndexedItemsPerMonth).toBe(1000);
    expect(free.hasPrioritySupport).toBe(false);
  });

  it("returns pro plan limits", () => {
    const pro = getEntitlements("pro");

    expect(pro.maxConnections).toBeGreaterThan(2);
    expect(pro.maxSearchesPerMonth).toBeGreaterThan(1000);
    expect(pro.hasPrioritySupport).toBe(true);
  });
});
