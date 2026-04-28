export interface AgentHealthState {
  status: "unknown" | "healthy" | "stale" | "delisted";
  consecutiveFailures: number;
}

export type Email =
  | { kind: "verification_passed" }
  | { kind: "stale" }
  | { kind: "delisted" }
  | { kind: "back_to_healthy" };

export interface Transition {
  next: AgentHealthState;
  emails: Email[];
}

const STALE_THRESHOLD = 3;
const DELIST_THRESHOLD = 7;

export function transition(prev: AgentHealthState | null, passed: boolean): Transition {
  if (passed) {
    const next: AgentHealthState = { status: "healthy", consecutiveFailures: 0 };
    const emails: Email[] = [];
    if (prev === null) emails.push({ kind: "verification_passed" });
    else if (prev.status !== "healthy") emails.push({ kind: "back_to_healthy" });
    return { next, emails };
  }

  const fc = (prev?.consecutiveFailures ?? 0) + 1;
  const prevStatus = prev?.status ?? "unknown";

  if (fc >= DELIST_THRESHOLD) {
    return {
      next: { status: "delisted", consecutiveFailures: fc },
      emails: prevStatus === "delisted" ? [] : [{ kind: "delisted" }],
    };
  }
  if (fc >= STALE_THRESHOLD) {
    return {
      next: { status: "stale", consecutiveFailures: fc },
      emails: prevStatus === "stale" ? [] : [{ kind: "stale" }],
    };
  }
  return { next: { status: prevStatus, consecutiveFailures: fc }, emails: [] };
}
