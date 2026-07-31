# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- README rewritten for public OSS / portfolio presentation (overview, architecture,
  AI-assisted development workflow, accurate feature list).
- LICENSE copyright line set to legal name `Cyrielle Wu`.
- `package.json` metadata: description, repository links, `engines.node`, version `0.1.0`.
- Screenshot asset path moved to `docs/screenshots/demo-preview.png`.

### Added
- `docs/screenshots/` with demo preview and capture guidelines.
- Draft `docs/oss/release-notes-v1.0.0.draft.md` (gated — not a tagged release).
- Open-source foundation: MIT `LICENSE`, `CONTRIBUTING`, `CODE_OF_CONDUCT`,
  `SECURITY`, `PRIVACY`, issue/PR templates, and contributor-facing docs.
- Self-hosting guide (`docs/oss/self-hosting.md`) and expanded `.env.example`.
- Shared edge-function auth helpers; JWT checks on `link-preview` / `life-replay`.
- HMAC-signed Google Calendar OAuth `state` + redirect origin allowlist.
- Private `moment-photos` bucket + signed URL display helper (`StorageImage`).

### Security
- Dropped client write policies on `google_calendar_tokens` (service-role only).
- `image-proxy` requires anon `apikey` and Origin/Referer allowlist.
- Removed tracked maintainer/agent scratch from the product tree.

> Note: Prior history exists in git commits but was not tracked in a changelog.
> The first tagged release should summarize the current feature set rather than
> reconstruct every past commit. See `docs/oss/release-notes-v1.0.0.draft.md`.
