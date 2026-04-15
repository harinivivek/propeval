# LLM Wiki Knowledge Base — Design Spec

**Date:** 2026-04-15
**Pattern source:** [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

## Overview

A persistent, LLM-maintained wiki for the PropEval/GetItRight project. Instead of re-deriving knowledge from raw docs every session, the LLM incrementally builds and maintains a structured, interlinked collection of markdown pages. Knowledge compounds over time — cross-references are pre-built, contradictions flagged, synthesis already reflects everything ingested.

**Scope:** Industry knowledge (market, regulations, competitors), technical knowledge (stack decisions, patterns, debugging), business knowledge (strategy, positioning, user insights), and project knowledge (architecture, phase history, key decisions).

**Audience:** Solo founder + LLM agents. Pages optimized for both human browsing and LLM retrieval via YAML frontmatter.

**Location:** `.wiki/` at project root (gitignored via project `.gitignore` — personal knowledge base, not checked into repo).

## Architecture: Three Layers

### Layer 1: Raw Sources

Immutable source documents the LLM reads but never modifies.

```
.wiki/raw/
├── docs/           # Symlinks to existing docs/ files
└── external/       # New sources added over time (articles, PDFs, notes)
```

- `raw/docs/` contains symlinks to `docs/GTR-PRODUCT-SPECIFICATION.md`, `docs/market-research-india-property-valuation-2025.md`, design specs, and `CLAUDE.md`
- `raw/external/` is where new sources land — articles, regulatory PDFs, competitor analyses, podcast notes
- Sources are never modified by the LLM

### Layer 2: The Wiki

LLM-generated markdown pages organized by category.

```
.wiki/pages/
├── industry/       # Market landscape, regulations, RBI/NHB, competitors
├── technical/      # Stack decisions, architecture patterns, debugging learnings
├── business/       # Strategy, positioning, pricing models, user insights
└── project/        # Phase summaries, key decisions, architecture evolution
```

- The LLM owns this layer entirely — creates, updates, cross-references, maintains
- The user reads and browses; the LLM writes

### Layer 3: The Schema

Configuration that tells the LLM how to maintain the wiki.

- `.wiki/WIKI.md` — structure, conventions, workflows
- Slash command skills — formalized operations (`/wiki-ingest`, `/wiki-query`, `/wiki-lint`)
- CLAUDE.md addition — pointer so conversational requests know to check the wiki

## Directory Structure

```
.wiki/
├── WIKI.md              # Schema — LLM instructions for wiki maintenance
├── index.md             # Content catalog: every page with link + one-line summary
├── log.md               # Append-only chronological operations log
├── raw/
│   ├── docs/            # Symlinks to existing docs/ files
│   └── external/        # New sources (articles, PDFs, notes)
├── pages/
│   ├── industry/        # Market, regulations, competitors
│   ├── technical/       # Stack, patterns, debugging
│   ├── business/        # Strategy, positioning, insights
│   └── project/         # Phases, decisions, architecture
└── _templates/          # Page templates (entity, concept, source-summary, etc.)
```

## Page Format

Every wiki page uses this structure:

```markdown
---
title: "Page Title"
type: entity | concept | source-summary | comparison | synthesis | decision
category: industry | technical | business | project
tags: [tag1, tag2, tag3]
sources: [source-filename.md]
created: YYYY-MM-DD
updated: YYYY-MM-DD
confidence: high | medium | low
---

# Page Title

Content — concise, cross-linked with [[wikilinks]].

## Key Facts
- Bullet points of core information

## Open Questions
- Gaps or unresolved items for future research

## See Also
- [[Related Page 1]]
- [[Related Page 2]]
```

### Page Types

| Type | Purpose | Example |
|------|---------|---------|
| `entity` | A specific thing (company, regulation, tool) | "RBI", "WeasyPrint", "ABCL Bank" |
| `concept` | An idea or domain topic | "OCR Extraction Accuracy", "B2B Marketplace Dynamics" |
| `source-summary` | Digest of a single raw source | "Summary: GTR Product Spec" |
| `comparison` | Side-by-side analysis | "Claude vs Tesseract OCR" |
| `synthesis` | Cross-source insight | "Property Valuation Tech Landscape 2025" |
| `decision` | A choice made and why | "Why FastAPI over Django" |

### Conventions

- File naming: `kebab-case.md`
- Cross-references: `[[wikilinks]]` (Obsidian-compatible)
- `confidence` field: how well-supported claims are (`high` = multiple sources, `medium` = single source, `low` = inference/speculation)
- `sources` field: traces claims back to raw documents
- `Open Questions` section: captures gaps for future research/ingestion

## Index & Log

### index.md

Content-oriented catalog of every wiki page. Updated on every ingest.

```markdown
# Wiki Index

## Industry
- [Indian Property Valuation Market](pages/industry/india-valuation-market-2025.md) — market size, growth projections, key trends
- [Regulatory Landscape](pages/industry/regulatory-landscape.md) — RBI/NHB guidelines, SARFAESI Act

## Technical
- [Stack Decisions](pages/technical/stack-decisions.md) — why FastAPI, Next.js 15, SQLAlchemy async
...
```

The LLM reads `index.md` first when answering queries to find relevant pages, then drills into them.

### log.md

Chronological, append-only record of operations.

```markdown
# Wiki Log

## [2026-04-15] ingest | GTR Product Specification
- Created: project/gtr-product-overview.md, project/three-workflows.md, business/b2b-marketplace-model.md
- Updated: (none — first ingest)
- Pages touched: 3

## [2026-04-15] ingest | Market Research India 2025
- Created: industry/india-valuation-market-2025.md, industry/regulatory-landscape.md, industry/competitor-landscape.md
- Updated: project/gtr-product-overview.md (added market validation cross-refs)
- Pages touched: 4
```

Prefix format is parseable: `grep "^## \[" .wiki/log.md | tail -5` gives last 5 operations.

## Operations

### Ingest

Triggered by `/wiki-ingest <path>` or conversationally ("ingest this article").

1. Read the raw source fully
2. Discuss key takeaways with user (unless batch mode)
3. Create or update a `source-summary` page
4. Create or update entity/concept pages touched by this source
5. Add/update `[[wikilinks]]` cross-references across all affected pages
6. Update `index.md` with any new pages
7. Append entry to `log.md` with date, source, pages created/updated

**Batch mode:** `/wiki-ingest --batch path/to/dir` processes multiple sources with less supervision — skips step 2, generates a single summary at the end.

### Query

Triggered by `/wiki-query <question>` or conversationally ("what do we know about RBI guidelines?").

1. Read `index.md` to find relevant pages
2. Read those pages
3. Synthesize answer with `[[wikilink]]` citations back to wiki pages
4. If the answer is substantial/reusable, offer to file it as a new wiki page (synthesis or comparison type)

### Lint

Triggered by `/wiki-lint` or `/wiki-lint <category>`.

1. Scan all pages (or pages in specified category) for:
   - Orphan pages (no inbound `[[wikilinks]]`)
   - Stale claims (sources updated since page was last updated)
   - Contradictions between pages
   - Broken `[[wikilinks]]` (referenced pages that don't exist)
   - Thin pages (fewer than 3 bullet points in Key Facts)
2. Report findings as a checklist
3. Offer to fix each issue

## Slash Command Skills

Three skills installed as superpowers skills, available in every session.

### `/wiki-ingest`
- **Trigger:** User wants to add a new source or process existing docs
- **Input:** File path, URL, or "process existing docs"
- **Reads:** `.wiki/WIKI.md` for conventions, source document, existing wiki pages that may need updating
- **Writes:** Pages in `.wiki/pages/`, updates `index.md` and `log.md`
- **Modes:** Interactive (default) or batch (`--batch`)

### `/wiki-query`
- **Trigger:** User asks a question against the knowledge base
- **Input:** Natural language question
- **Reads:** `.wiki/index.md` then relevant `.wiki/pages/` files
- **Output:** Synthesized answer with wiki citations; optional filing as new page

### `/wiki-lint`
- **Trigger:** Periodic health check
- **Input:** None, or category filter
- **Reads:** All `.wiki/pages/` files, `index.md`
- **Output:** Health report with actionable fixes

## CLAUDE.md Integration

Add to CLAUDE.md:

```markdown
## Knowledge Wiki

Project wiki at `.wiki/` — LLM-maintained knowledge base (industry, technical, business, project).
- Schema: `.wiki/WIKI.md`
- Commands: `/wiki-ingest`, `/wiki-query`, `/wiki-lint`
- When answering domain questions, check `.wiki/index.md` first for existing knowledge
- Conversational requests like "what do we know about X" should query the wiki
```

## Initial Seeding

Four sources ingested on setup to bootstrap the wiki:

### Source 1: `docs/GTR-PRODUCT-SPECIFICATION.md`
Expected pages:
- `project/gtr-product-overview.md` — high-level product summary
- `project/three-workflows.md` — new request, listing purchase, update/nearby
- `business/b2b-marketplace-model.md` — lender-vendor marketplace dynamics
- `industry/property-valuation-india.md` — domain context from the spec
- `project/lender-portal.md`, `project/vendor-portal.md`, `project/admin-portal.md` — entity pages

### Source 2: `docs/market-research-india-property-valuation-2025.md`
Expected pages:
- `industry/india-valuation-market-2025.md` — market size, growth, trends
- `industry/regulatory-landscape.md` — RBI/NHB guidelines, SARFAESI
- `industry/competitor-landscape.md` — existing players, gaps
- Cross-references into product overview (market validation)

### Source 3: Design specs (17 files in `docs/superpowers/specs/`)
- One synthesis page: `project/phase-history.md` — all 16 phases, key decisions, architecture evolution
- Individual specs remain as raw sources for deeper queries

### Source 4: `CLAUDE.md`
Expected pages:
- `technical/stack-decisions.md` — why FastAPI, Next.js 15, SQLAlchemy async, etc.
- `technical/known-gotchas.md` — bcrypt pinning, port offsets, volume mounting, enum reuse
- `technical/celery-patterns.md` — async session context, lazy imports, task discovery
- Cross-references into project and architecture pages

**Expected result:** ~15-20 wiki pages on day one with real cross-links across all four categories.

## Principles

1. **Concise over verbose** — write for someone who knows the context
2. **Update don't duplicate** — if a page exists, update it; don't create a parallel one
3. **Flag contradictions** — when new sources conflict with existing pages, note it explicitly
4. **Trace to sources** — every claim should be traceable via the `sources` frontmatter field
5. **Compound on queries** — good answers get filed back as wiki pages
6. **Cross-link aggressively** — `[[wikilinks]]` are the primary discovery mechanism
