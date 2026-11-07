import type { Decision } from "@octotrack/core/schemas";
import { deliveryOf } from "../../lib/format.ts";
import { Badge } from "../ui/Badge.tsx";

/** What became of an answer after it was given. */
export function DeliveryBadge({ decision }: { decision: Decision }) {
  const delivery = deliveryOf(decision);
  return delivery === null ? null : <Badge tone={delivery.tone}>{delivery.label}</Badge>;
}
