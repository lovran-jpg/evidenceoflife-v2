# Security Policy

## Supported Versions

Evidence of Life is a single-maintainer project under active development. Only
the latest `main` is supported. There is no long-term-support branch.

## Reporting a Vulnerability

**Please do not open a public issue for security problems.**

Report privately via GitHub's **"Report a vulnerability"** button under the
repository's **Security** tab (Private Vulnerability Reporting). Include:

- A description of the issue and its impact.
- Steps to reproduce or a proof of concept.
- Affected component (frontend, a specific Supabase edge function, RLS policy,
  storage bucket, or OAuth flow).

Please do **not** include real user data, private keys, or tokens in the report.
Describe the exposure; do not copy the sensitive values.

## Response expectations

This is a spare-time project, so response is best-effort. Reasonable disclosure
timelines will be honored, and credit will be given to reporters who wish it.

## Scope

In scope:

- Authentication / authorization and Row Level Security (RLS) on user tables.
- Leakage of secrets (service-role keys, OAuth tokens) to the browser.
- Publicly readable private storage buckets.
- Google Calendar token handling and refresh behavior.
- Account data export/deletion correctness.

Out of scope:

- Vulnerabilities in third-party services (report to those vendors).
- Issues requiring a compromised maintainer machine or physical access.
- Missing best-practice headers on the static host without a concrete exploit.

## Handling of secrets in this repository

- Only `.env.example` is tracked; `.env*` are gitignored.
- Service-role keys are used **only** in Supabase edge functions via
  `Deno.env.get(...)`, never in browser code.
- If you believe a secret was committed, report it privately and do not share
  the value publicly.
