# DevOps Sub-Role: Release Packaging & Changelogs

Consolidated from `release-notes-worker`.

## Responsibilities & Standards
- Produce structured release notes, semantic version bumps, and `CHANGELOG.md` following Keep a Changelog.

## Release Notes Checklist
- [ ] Semantic Versioning: Bump version strictly according to SemVer (MAJOR for breaking changes, MINOR for features, PATCH for fixes).
- [ ] Conventional Commit Parsing: Group changes into `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`.
- [ ] Migration Notices: Explicitly highlight breaking database migrations, required environment variables, or config changes.
- [ ] Clean Markdown: Release notes free of internal commit hashes or agent communication metadata.
