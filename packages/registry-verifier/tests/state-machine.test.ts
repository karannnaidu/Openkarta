import { describe, expect, it } from "vitest";
import { type AgentHealthState, transition } from "../src/state-machine.js";

const s = (status: AgentHealthState["status"], fc: number): AgentHealthState => ({
  status,
  consecutiveFailures: fc,
});

describe("state-machine: transition()", () => {
  it("first ever pass (prev=null) → healthy + verification_passed email", () => {
    const t = transition(null, true);
    expect(t.next).toEqual({ status: "healthy", consecutiveFailures: 0 });
    expect(t.emails).toEqual([{ kind: "verification_passed" }]);
  });

  it("healthy + pass → healthy, no email", () => {
    const t = transition(s("healthy", 0), true);
    expect(t.next).toEqual({ status: "healthy", consecutiveFailures: 0 });
    expect(t.emails).toEqual([]);
  });

  it("healthy + first fail → still healthy (fc=1), no email", () => {
    const t = transition(s("healthy", 0), false);
    expect(t.next).toEqual({ status: "healthy", consecutiveFailures: 1 });
    expect(t.emails).toEqual([]);
  });

  it("healthy + 2nd fail → still healthy (fc=2), no email", () => {
    const t = transition(s("healthy", 1), false);
    expect(t.next).toEqual({ status: "healthy", consecutiveFailures: 2 });
    expect(t.emails).toEqual([]);
  });

  it("healthy + 3rd consecutive fail → stale + stale email", () => {
    const t = transition(s("healthy", 2), false);
    expect(t.next).toEqual({ status: "stale", consecutiveFailures: 3 });
    expect(t.emails).toEqual([{ kind: "stale" }]);
  });

  it("stale + 4th fail → stale (fc=4), no email (no transition)", () => {
    const t = transition(s("stale", 3), false);
    expect(t.next).toEqual({ status: "stale", consecutiveFailures: 4 });
    expect(t.emails).toEqual([]);
  });

  it("stale + 6th fail → stale (fc=6), no email", () => {
    const t = transition(s("stale", 5), false);
    expect(t.next).toEqual({ status: "stale", consecutiveFailures: 6 });
    expect(t.emails).toEqual([]);
  });

  it("stale + 7th fail → delisted + delisted email", () => {
    const t = transition(s("stale", 6), false);
    expect(t.next).toEqual({ status: "delisted", consecutiveFailures: 7 });
    expect(t.emails).toEqual([{ kind: "delisted" }]);
  });

  it("delisted + further fail → delisted (no re-emit)", () => {
    const t = transition(s("delisted", 7), false);
    expect(t.next).toEqual({ status: "delisted", consecutiveFailures: 8 });
    expect(t.emails).toEqual([]);
  });

  it("stale + pass → healthy + back_to_healthy email, fc reset", () => {
    const t = transition(s("stale", 5), true);
    expect(t.next).toEqual({ status: "healthy", consecutiveFailures: 0 });
    expect(t.emails).toEqual([{ kind: "back_to_healthy" }]);
  });

  it("delisted + pass → healthy + back_to_healthy email", () => {
    const t = transition(s("delisted", 9), true);
    expect(t.next).toEqual({ status: "healthy", consecutiveFailures: 0 });
    expect(t.emails).toEqual([{ kind: "back_to_healthy" }]);
  });

  it("unknown + pass (with prev row, fc=0) → healthy + back_to_healthy", () => {
    const t = transition(s("unknown", 0), true);
    expect(t.next).toEqual({ status: "healthy", consecutiveFailures: 0 });
    expect(t.emails).toEqual([{ kind: "back_to_healthy" }]);
  });
});
