# CLAUDE.md — LLM Wiki Schema

This file is the configuration and instruction set for the LLM maintaining this wiki.
Read it at the start of every session before taking any action.

---

## Project Structure

```
root/
├── CLAUDE.md              ← this file (schema and instructions)
├── .gitignore
├── raw/                   ← immutable source documents (never modify)
│   └── assets/            ← locally downloaded images
└── wiki/                  ← LLM-owned knowledge base
    ├── index.md           ← catalog of all wiki pages (update on every ingest)
    ├── log.md             ← append-only activity log
    ├── concepts/          ← one .md file per concept or topic
    ├── entities/          ← one .md file per notable person, org, or project
    ├── sources/           ← one .md file per ingested source
    └── output/            ← saved query results and analyses
```

---

## Core Rules

- **Never modify files in `raw/`.** It is the immutable source of truth.
- **You own `wiki/` entirely.** Create, update, and reorganize files there freely.
- **Always update `wiki/index.md`** after any ingest that creates or modifies wiki pages.
- **Always append to `wiki/log.md`** after every significant operation.
- **All wiki files are markdown (`.md`).** No other formats in `wiki/`.
- **Use relative links** for all cross-references between wiki pages (e.g., `../concepts/machine-learning.md`).
- **File names** should be lowercase, hyphen-separated (e.g., `neural-networks.md`, `yann-lecun.md`).

---

## Page Conventions

### Source pages (`wiki/sources/`)

Each ingested source gets a summary page. Use this structure:

```markdown
# [Source Title]

**Date added:** YYYY-MM-DD
**Original file:** `../../raw/filename.md` (or URL if not local)
**Type:** article | paper | note | transcript | dataset | other

## Summary
[2–4 paragraph summary of the source's key content]

## Key Points
- ...
- ...

## Related Pages
- [Concept X](../concepts/concept-x.md)
- [Entity Y](../entities/entity-y.md)
```

### Concept pages (`wiki/concepts/`)

One page per significant idea, topic, or theme. Synthesizes information from multiple sources.

```markdown
# [Concept Name]

## Overview
[What this concept is and why it matters]

## Key Details
[Substantive content, organized as prose or subsections]

## Sources
- [Source A](../sources/source-a.md) — brief note on what it contributed
- [Source B](../sources/source-b.md)

## Related Concepts
- [Related Concept](../concepts/related.md)
```

### Entity pages (`wiki/entities/`)

One page per notable person, organization, project, or tool.

```markdown
# [Entity Name]

**Type:** person | organization | project | tool

## Overview
[Brief description]

## Relevance
[Why this entity matters in the context of this wiki]

## Appearances
- [Source A](../sources/source-a.md)

## Related
- [Entity B](../entities/entity-b.md)
- [Concept C](../concepts/concept-c.md)
```

### Output pages (`wiki/output/`)

Saved results of queries and analyses. Use free-form structure appropriate to the content.
Always include a header noting when it was generated and what question prompted it.

```markdown
# [Query or Analysis Title]

**Generated:** YYYY-MM-DD
**Prompted by:** [the question or task that generated this]

---

[Content]
```

---

## Ingest Workflow

When the user asks you to ingest a new source:

1. **Read** the source file in `raw/` (or fetch URL if not local).
2. **Write a source page** in `wiki/sources/` summarizing key content.
3. **Update or create concept pages** for significant ideas in the source.
4. **Update or create entity pages** for notable people, orgs, or projects mentioned.
5. **Add cross-references** (backlinks) on all touched pages.
6. **Update `wiki/index.md`** to include any new pages.
7. **Append to `wiki/log.md`**: `## [YYYY-MM-DD] ingest | [Source Title]`
8. **Briefly report to the user**: what pages were created or updated.

A single source may touch 5–15 wiki pages. That is expected and correct.

The user prefers a **balanced** ingestion style: provide brief summaries of what was done, but do not ask clarifying questions for every decision. Use your judgment. If something is genuinely ambiguous, ask once.

---

## Query Workflow

When the user asks a question against the wiki:

1. **Read `wiki/index.md`** to identify relevant pages.
2. **Read the relevant pages** in full.
3. **Synthesize an answer** with citations linking to wiki pages.
4. **If the answer is substantive and reusable**, offer to save it as a page in `wiki/output/`.
5. If saved, **update `wiki/index.md`** and **append to `wiki/log.md`**: `## [YYYY-MM-DD] query | [Question summary]`

---

## Index File Format

`wiki/index.md` is organized into sections by page type. Each entry follows this format:

```
- [Page Title](path/to/page.md) — one-line summary
```

Keep entries sorted alphabetically within each section.

---

## Log File Format

Every entry in `wiki/log.md` must start with:

```
## [YYYY-MM-DD] <operation> | <short description>
```

Valid operations: `ingest`, `query`, `maintenance`, `setup`

Append only. Never edit or delete past entries.

---

## Notes

- This wiki is general-purpose. It may grow to cover many unrelated topics. Use the category structure (concepts/entities/sources) to keep things navigable.
- When in doubt about where to file something, prefer creating a new page over cramming it into an existing one. Pages are cheap.
- The index file is the LLM's primary navigation tool. Keep it accurate and up to date.
