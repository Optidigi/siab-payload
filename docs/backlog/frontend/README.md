# Frontend Backlog

Canonical source of truth for frontend / UI / UX items to review or address in future cycles.

## How this file is used

- **Each entry has a stable ID** (`FE-N`).
- **Entries categorize by status:** Active (real, deferred), Latent (not exploitable today; trigger documented), Closed (kept for lineage).
- **When something gets discovered** (during an audit, a PR review, a user report, etc.) that's frontend-shaped and not actionable in the discovering work, append it here as `FE-N`.
- **When an item is addressed**, move it to the Closed section with a reference to the resolving branch/PR/commit. Do NOT delete — lineage matters.

## Pairing

Backend items are tracked at `../backend/README.md`. Cross-references between FE-N and BE-N (or `OBS-N` for items inherited from the 2026-05 audit cycle) are encouraged where the same root issue spans both domains.

---

## Active

*(none currently)*

---

## Latent

*(none currently)*

---

## Closed

*(none currently)*

---

## Item shape (when adding new entries)

```markdown
### FE-N — <short title>

**Status:** Active | Latent | Closed
**Discovered in:** <where: PR / audit cycle / user report / etc.>
**File:** `path:line` (if applicable)

#### Description
<what the issue is>

#### Why deferred (or not actioned in the discovering work)
<one-line reason>

#### Trigger condition (if Latent)
<what would warrant action>

#### Suggested fix shape
<the shape of the fix when it's eventually addressed>
```
