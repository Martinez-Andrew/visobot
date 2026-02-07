import type { BillingTier } from "@/types/domain";

export type Entitlements = {
  maxConnections: number;
  maxIndexedItemsPerMonth: number;
  maxSearchesPerMonth: number;
  hasPrioritySupport: boolean;
};

export function getEntitlements(tier: BillingTier): Entitlements {
  if (tier === "pro") {
    return {
      maxConnections: 20,
      maxIndexedItemsPerMonth: 10000,
      maxSearchesPerMonth: 5000,
      hasPrioritySupport: true
    };
  }

  return {
    maxConnections: 2,
    maxIndexedItemsPerMonth: 1000,
    maxSearchesPerMonth: 400,
    hasPrioritySupport: false
  };
}
