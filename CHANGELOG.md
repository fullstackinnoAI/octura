# Changelog

## Unreleased

- Replaced the original `octura` subcommand entry point with standalone hyphenated commands such as `octura-doctor`, `octura-demo-seed`, and `octura-record-add`.
- Added read-only Spec Kit artifact discovery and import with isolated `.octura/oct-imports/oct-spec-kit-index.json` state.

## 0.1.0 — Developer Preview

- Added a local-first PostgreSQL evidence store.
- Added project and evidence-record HTTP APIs with the `octura.api.v1` envelope.
- Added the `octura` CLI for project creation, capture, listing, review and demo seeding.
- Added a display-oriented evidence workspace with live refresh and human review.
- Added a one-command Docker Compose environment and five-minute demo script.
