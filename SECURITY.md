# Security Policy

## Supported versions

| Version | Status                          |
| ------- | ------------------------------- |
| 0.1.x   | Supported (current)             |
| < 0.1   | Not supported                   |

Security fixes are published as patch releases against the most recent minor.

## Reporting a vulnerability

Please report security issues privately to **security@openkarta.ai**.

Include, where possible:

- A description of the issue and its impact.
- Affected package(s) and version(s).
- A minimal reproduction (a script, a request/response pair, or a test).
- Your name and a contact for credit (optional).

Do **not** open public GitHub issues for security reports.

## Disclosure policy

OpenKarta follows a **90-day coordinated disclosure** window:

1. We acknowledge your report within five working days.
2. We confirm the issue and agree on a remediation timeline (typically within 30 days for critical issues).
3. A fix is released; an advisory is published; you are credited unless you prefer otherwise.
4. If the issue cannot be resolved within 90 days, we will coordinate with you on a public disclosure date.

Security advisories are published as signed [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories) on this repository, and announced on the project mailing list.

## Scope

This policy covers:

- The protocol surface (`@openkarta/spec`).
- The reference SDK (`@openkarta/sdk-node`).
- The reference agents and conformance harness in this repository.

It does **not** cover third-party deployments of OpenKarta agents — please report those to the operator directly.
