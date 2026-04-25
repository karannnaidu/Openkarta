# Governance

**Status:** draft for v0.1 launch
**Purpose:** define who runs what, and why brands and AI labs can trust the protocol is not a single-company play.

## The three layers

| Layer            | What it is                                            | Who runs it                              |
| ---------------- | ----------------------------------------------------- | ---------------------------------------- |
| **Protocol spec**| `docs/protocol/`, schemas in `@openkarta/spec`        | OpenKarta Foundation (CC-BY)             |
| **Reference SDK / orchestrator / CLI** | `@openkarta/sdk-node`, `@openkarta/orchestrator`, `@openkarta/cli`, conformance harness | OpenKarta Foundation (Apache 2.0) |
| **Registry**     | Directory of brand agents + attester keys             | Independent registry operator(s)         |

The critical separation: whoever writes the spec must not also be the sole registry operator. Otherwise "open protocol" is cosmetic.

## The foundation

OpenKarta Foundation is the neutral steward of the spec and reference implementations.

> **Milestone note:** foundation **incorporation** (or transfer to a neutral host) is a **v2.0** target, not v0.1. For v0.1, OpenKarta's core maintainers run the project under the written neutrality covenant below; the foundation entity is described here so the succession path is committed in writing from day one.

- **Form:** starts as a lightweight entity (Linux Foundation sub-project, or a dedicated 501(c)(6)-equivalent). Does not need to be large to be credible — it needs to be *separate* from any single commercial operator.
- **Membership:** open. Three tiers — Contributor (individuals), Member (orgs shipping on the protocol), Steering (funding + governance vote).
- **Decisions:** spec changes via RFC + rough-consensus on a public tracker. Breaking changes require a supermajority of Steering.
- **IP:** contributions under a Developer Certificate of Origin. Spec under CC-BY; code under Apache 2.0 (patent grant matters for commerce).

## The registry

A registry operator runs infrastructure that answers:

1. **Discovery.** "Who sells in category X / region Y?" → list of signed brand-agent records.
2. **Identity.** "What is `nike.karta`'s current endpoint and pubkey?" → signed record.
3. **Attester directory.** "Who are the review attesters, and what are their pubkeys?" → signed list.

A registry does **not**:

- Rank offers. (Ranking lives in the consumer agent — see `packages/orchestrator/src/rank.ts`.)
- Store reviews.
- Touch payment flows.
- Gate brand participation beyond identity verification + spec compliance.

### Operator model

v0.1 launches with **one** registry operator (to ship), but the spec is written so additional operators can federate later.

- **Initial operator:** the foundation itself, or a commercial operator under a foundation-governed charter. Operator is bound by a published SLA and a neutrality covenant.
- **Neutrality covenant — the operator MUST NOT:**
  - Give any brand priority placement.
  - Refuse listing to a spec-compliant brand without published cause.
  - Charge differential listing fees by brand.
  - Use registry data to compete with listed brands.
- **Transparency:** operator publishes a quarterly transparency report — brands added/removed, attesters onboarded, incidents, appeals.

### Federation (v0.2+)

Multiple registry operators cross-sign each other's records, so consumer agents can query any operator and get a consistent view. Model is DNS-like: roots federate, resolvers cache.

Federation is explicitly deferred from v0.1 to avoid shipping consensus problems before the core protocol is validated.

## Attesters

Review attesters are independent of both the foundation and the registry operator. Anyone can stand up an attester; consumer agents choose which to trust.

- The registry lists attester identities and pubkeys but does not endorse any.
- Existing review platforms (Trustpilot, Google, industry bodies) can become attesters by publishing signed bundles in the spec's format.
- This keeps review quality a competitive market, not a protocol monopoly.

## Why this shape

- **Brands won't adopt a protocol owned by a competitor.** Foundation stewardship makes the spec safe to build on.
- **AI labs won't route users through a gatekeeper.** A neutral registry (or many, post-federation) means OpenAI, Anthropic, Google, and any local/open-weight model can each wire up consumer agents without depending on a rival's goodwill.
- **Consumers need review plurality.** Centralised review scores replicate the current walled-garden problem in a new venue. Attestations make review trust a choice.

## What this means for OpenKarta (the company)

OpenKarta the company can:

- Employ staff that contribute to the foundation (like Linux Foundation + major contributors).
- Run the first registry operator under the neutrality covenant.
- Ship its own consumer app (the orchestrator + CLI shipped today are reference implementations) and its own brand-agent hosting product, competing on execution — *not* on protocol access.

OpenKarta the company should not:

- Hold unilateral control of the spec.
- Charge brands for registry listing.
- Withhold protocol features from competing implementations.

## Milestones

The work splits cleanly into what's publishable now (v0.1) and what requires standing up the foundation entity itself (v2.0). Don't conflate them — v0.1 must ship without waiting on v2.0.

### v0.1 launch checklist (publish now, no foundation entity required)

- [ ] Publish the neutrality covenant — either inline in this file or as a standalone `docs/registry-covenant.md`. The covenant binds OpenKarta-the-company while it operates the registry.
- [ ] Publish IP policy (DCO + license summary) as `docs/ip-policy.md`.
- [ ] State publicly that OpenKarta-the-company runs the registry under the covenant, **with the v2.0 succession path committed in writing**.
- [ ] Reserve `foundation@openkarta.org` and route it to the maintainers; reserve the `openkartafoundation.*` namespaces.
- [ ] Publish the first transparency report template (empty is fine — establishes the cadence).
- [ ] Add the v2.0 milestone block below to `ROADMAP.md` so the public timeline is unambiguous.

### v2.0 — actual foundation handover

- [ ] Incorporate foundation entity (or file for LF sub-project / transfer to ONDC / OpenJS).
- [ ] Transfer `@openkarta/*` npm scope + GitHub org to foundation control.
- [ ] Name an initial Steering group (≥3 orgs, no single-org majority).
- [ ] Move registry operation from OpenKarta-the-company to a foundation-governed operator (the company can still operate it, but under a foundation charter rather than self-binding).
- [ ] First Steering-approved spec RFC (proves the governance process works end-to-end).
