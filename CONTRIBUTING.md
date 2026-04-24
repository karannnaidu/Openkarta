# Contributing to OpenKarta

Thanks for considering a contribution. OpenKarta is an MIT-licensed protocol; we welcome bug fixes, new conformance tests, additional reference agents, and protocol-extension proposals.

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Development setup

```bash
# Prerequisites: Node 22+, pnpm 9+
git clone https://github.com/openkarta/openkarta.git
cd openkarta
pnpm install
pnpm build
pnpm test
```

The repo is a pnpm workspace driven by [Turborepo](https://turbo.build/). Per-package commands:

```bash
pnpm --filter @openkarta/sdk-node test
pnpm --filter @openkarta/conformance-tests build
```

End-to-end smoke against all three reference agents:

```bash
bash scripts/conformance-smoke.sh
```

---

## Branch naming

| Prefix     | Use for                                       |
| ---------- | --------------------------------------------- |
| `feat/`    | New features (new endpoints, new test packs)  |
| `fix/`     | Bug fixes                                     |
| `docs/`    | Documentation only                            |
| `chore/`   | CI, tooling, build-only changes               |
| `refactor/`| Internal refactor with no behaviour change    |
| `spec/`    | Protocol/spec changes (require RFC discussion) |

Example: `feat/conformance-flight-pack-v0.2`.

---

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

<optional body>

<optional footer>
```

`type` is one of `feat / fix / docs / chore / refactor / test / perf`. `scope` is the package or area (`sdk-node`, `spec`, `conformance`, `reference-agents`, `ci`, etc.).

Examples from this repo:

```
feat(demo-cli): three end-to-end flows (product, stay, flight)
fix(reference-agents): copy fixtures to dist for bin.js runtime
docs: root README, protocol v0.1 reference, quickstarts, community files
```

Sign-off (`Signed-off-by`) is encouraged but not required.

---

## Pull-request process

1. **Open early.** A draft PR is fine; we'd rather give feedback before you've spent days.
2. **One concern per PR.** Easier to review, easier to revert.
3. **Run `pnpm lint && pnpm typecheck && pnpm test` locally.** CI will run them again, but please don't push obviously red commits.
4. **Update tests.** New behaviour needs a test; bug fixes need a regression test.
5. **Update conformance.** If the PR changes a protocol contract (request/response shape, error code, header), the conformance pack(s) must be updated in the same PR. Tick the corresponding box in the PR template.
6. **Update docs.** Anything user-visible should land with documentation in `docs/protocol/v0.1.md`, the relevant quickstart, or the package README.
7. **Two approving reviews** for protocol changes; one for everything else.

We aim to give first-pass feedback within five working days. After approval, a maintainer will merge.

---

## Spec changes (RFC process)

Backwards-incompatible protocol changes follow a lightweight RFC process:

1. Open an issue titled `RFC: <change>` with a written proposal: motivation, design, alternatives considered, migration story.
2. Discuss publicly for at least two weeks.
3. If accepted, open a PR against `docs/protocol/v0.1.md` (or a new `docs/protocol/v0.x.md`) plus the affected packages.

Backwards-compatible additions (a new optional field, a new error code) don't require an RFC, but please flag them as a spec change in the PR description.

---

## Releases

Releases are cut by the maintainers using the `chore: changelog` PR pattern:

1. PR updates `CHANGELOG.md` and bumps version fields if needed.
2. After merge, a maintainer tags `vX.Y.Z` on `main`.
3. The `publish.yml` workflow publishes to npm with provenance.

---

## Contact

- Spec discussion: GitHub issues with the `spec` label.
- Security: see [`SECURITY.md`](SECURITY.md).
- Anything else: GitHub Discussions, or `hello@openkarta.ai`.
