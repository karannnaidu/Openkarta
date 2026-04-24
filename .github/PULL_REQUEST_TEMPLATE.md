## Summary

<!-- One paragraph describing what this PR does and why. -->

## Test plan

<!-- Bulleted list of how reviewers can verify the change. -->

- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass locally
- [ ] `bash scripts/conformance-smoke.sh` passes locally (if touching SDK / reference agents / conformance)

## Conformance impact

- [ ] This PR changes the protocol contract (request/response shape, error code, header, manifest field).
- [ ] Conformance tests have been updated to cover the change (or this PR has no protocol impact).
