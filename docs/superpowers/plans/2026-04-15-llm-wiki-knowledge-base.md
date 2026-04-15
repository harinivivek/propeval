# LLM Wiki Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up a persistent, LLM-maintained wiki at `.wiki/` with structured pages, three slash command skills, and initial seed content from existing project docs.

**Architecture:** Three-layer wiki (raw sources → LLM-generated pages → schema/skills). Directory at `.wiki/` project root, gitignored. Slash commands (`/wiki-ingest`, `/wiki-query`, `/wiki-lint`) installed as personal skills in `~/.claude/skills/`. CLAUDE.md updated to point sessions to the wiki.

**Tech Stack:** Markdown, YAML frontmatter, Claude Code skills (SKILL.md format), symlinks for raw source references.

**Spec:** `docs/superpowers/specs/2026-04-15-llm-wiki-knowledge-base-design.md`

---

## File Structure

**Create:**
- `.wiki/WIKI.md` — schema (LLM instructions for wiki maintenance)
- `.wiki/index.md` — content catalog
- `.wiki/log.md` — operations log
- `.wiki/raw/docs/` — symlinks to existing docs
- `.wiki/raw/external/` — empty dir for future sources
- `.wiki/pages/industry/` — industry knowledge pages
- `.wiki/pages/technical/` — technical knowledge pages
- `.wiki/pages/business/` — business knowledge pages
- `.wiki/pages/project/` — project knowledge pages
- `.wiki/_templates/entity.md` — entity page template
- `.wiki/_templates/concept.md` — concept page template
- `.wiki/_templates/source-summary.md` — source summary template
- `.wiki/_templates/comparison.md` — comparison page template
- `.wiki/_templates/synthesis.md` — synthesis page template
- `.wiki/_templates/decision.md` — decision page template
- `~/.claude/skills/wiki-ingest/SKILL.md` — ingest skill
- `~/.claude/skills/wiki-query/SKILL.md` — query skill
- `~/.claude/skills/wiki-lint/SKILL.md` — lint skill

**Modify:**
- `.gitignore` — add `.wiki/` entry
- `CLAUDE.md` — add Knowledge Wiki section

---

### Task 1: Directory Structure & Gitignore

**Files:**
- Create: `.wiki/` directory tree
- Modify: `.gitignore`

- [ ] **Step 1: Create the full directory structure**

```bash
mkdir -p .wiki/raw/docs .wiki/raw/external .wiki/pages/industry .wiki/pages/technical .wiki/pages/business .wiki/pages/project .wiki/_templates
```

- [ ] **Step 2: Add .wiki/ to .gitignore**

Read `.gitignore`, then append:

```
# LLM Wiki (personal knowledge base)
.wiki/
```

- [ ] **Step 3: Create .gitkeep files for empty directories**

```bash
touch .wiki/raw/external/.gitkeep
```

Note: `.gitkeep` won't matter since `.wiki/` is gitignored, but it ensures the directory exists if someone clones and manually creates the wiki.

- [ ] **Step 4: Verify structure**

```bash
find .wiki -type d | sort
```

Expected output:
```
.wiki
.wiki/_templates
.wiki/pages
.wiki/pages/business
.wiki/pages/industry
.wiki/pages/project
.wiki/pages/technical
.wiki/raw
.wiki/raw/docs
.wiki/raw/external
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: add .wiki/ to gitignore for LLM knowledge base"
```

---

### Task 2: Page Templates

**Files:**
- Create: `.wiki/_templates/entity.md`
- Create: `.wiki/_templates/concept.md`
- Create: `.wiki/_templates/source-summary.md`
- Create: `.wiki/_templates/comparison.md`
- Create: `.wiki/_templates/synthesis.md`
- Create: `.wiki/_templates/decision.md`

- [ ] **Step 1: Create entity template**

Write to `.wiki/_templates/entity.md`:

```markdown
---
title: "{{TITLE}}"
type: entity
category: {{industry|technical|business|project}}
tags: []
sources: []
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
confidence: medium
---

# {{TITLE}}

Brief description of what this entity is and why it matters.

## Key Facts
- 

## Relationships
- 

## Open Questions
- 

## See Also
- 
```

- [ ] **Step 2: Create concept template**

Write to `.wiki/_templates/concept.md`:

```markdown
---
title: "{{TITLE}}"
type: concept
category: {{industry|technical|business|project}}
tags: []
sources: []
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
confidence: medium
---

# {{TITLE}}

Brief explanation of the concept and its relevance to the project.

## Key Points
- 

## How It Applies
- 

## Open Questions
- 

## See Also
- 
```

- [ ] **Step 3: Create source-summary template**

Write to `.wiki/_templates/source-summary.md`:

```markdown
---
title: "Summary: {{SOURCE_NAME}}"
type: source-summary
category: {{industry|technical|business|project}}
tags: []
sources: [{{source-filename.md}}]
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
confidence: high
---

# Summary: {{SOURCE_NAME}}

**Source:** `raw/{{path-to-source}}`
**Date read:** {{YYYY-MM-DD}}

## Key Takeaways
- 

## Notable Details
- 

## Contradictions or Tensions
- 

## Pages Created/Updated
- 

## See Also
- 
```

- [ ] **Step 4: Create comparison template**

Write to `.wiki/_templates/comparison.md`:

```markdown
---
title: "{{TITLE}}"
type: comparison
category: {{industry|technical|business|project}}
tags: []
sources: []
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
confidence: medium
---

# {{TITLE}}

Brief context for why this comparison matters.

## Comparison

| Dimension | {{Option A}} | {{Option B}} |
|-----------|-------------|-------------|
|           |             |             |

## Analysis
- 

## Recommendation
- 

## See Also
- 
```

- [ ] **Step 5: Create synthesis template**

Write to `.wiki/_templates/synthesis.md`:

```markdown
---
title: "{{TITLE}}"
type: synthesis
category: {{industry|technical|business|project}}
tags: []
sources: []
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
confidence: medium
---

# {{TITLE}}

Cross-source insight synthesizing multiple pages/sources.

## Thesis
- 

## Supporting Evidence
- 

## Counterpoints
- 

## Open Questions
- 

## See Also
- 
```

- [ ] **Step 6: Create decision template**

Write to `.wiki/_templates/decision.md`:

```markdown
---
title: "{{TITLE}}"
type: decision
category: {{industry|technical|business|project}}
tags: []
sources: []
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
confidence: high
---

# {{TITLE}}

## Decision
One-sentence statement of the choice made.

## Context
Why this decision was needed.

## Options Considered
1. **{{Option A}}** — pros / cons
2. **{{Option B}}** — pros / cons

## Rationale
Why this option was chosen.

## Consequences
What this decision means going forward.

## See Also
- 
```

- [ ] **Step 7: Verify all templates exist**

```bash
ls .wiki/_templates/
```

Expected: `comparison.md  concept.md  decision.md  entity.md  source-summary.md  synthesis.md`

---

### Task 3: WIKI.md Schema

**Files:**
- Create: `.wiki/WIKI.md`

- [ ] **Step 1: Write the wiki schema**

Write to `.wiki/WIKI.md`:

```markdown
# PropEval Wiki Schema

This file tells the LLM how to maintain the wiki. Read this before any wiki operation.

## Purpose

Persistent knowledge base for the PropEval/GetItRight project. Covers industry (property valuation market, regulations, competitors), technical (stack decisions, patterns, gotchas), business (strategy, positioning, user insights), and project (architecture, phase history, decisions).

**Audience:** Solo founder + LLM agents. Write concisely for someone who knows the full context. Use YAML frontmatter for machine parsing.

## Directory Layout

```
.wiki/
├── WIKI.md              # This file — schema and conventions
├── index.md             # Content catalog (read this first for queries)
├── log.md               # Chronological operations log
├── raw/
│   ├── docs/            # Symlinks to project docs/ files
│   └── external/        # New external sources
├── pages/
│   ├── industry/        # Market, regulations, competitors
│   ├── technical/       # Stack, patterns, debugging
│   ├── business/        # Strategy, positioning, insights
│   └── project/         # Phases, decisions, architecture
└── _templates/          # Page templates by type
```

## Page Conventions

- **File naming:** `kebab-case.md`
- **Frontmatter:** Every page has YAML frontmatter with: title, type, category, tags, sources, created, updated, confidence
- **Page types:** entity, concept, source-summary, comparison, synthesis, decision (see `_templates/` for formats)
- **Categories:** industry, technical, business, project
- **Cross-references:** Use `[[Page Title]]` wikilinks (Obsidian-compatible)
- **Confidence levels:** high (multiple corroborating sources), medium (single source), low (inference/speculation)
- **Templates:** Always start from the matching template in `_templates/`

## Category Definitions

- **industry/** — Property valuation market, regulatory environment (RBI/NHB/SARFAESI), competitor landscape, market sizing, industry trends, valuation methodologies
- **technical/** — Stack decisions, architecture patterns, library choices, known gotchas, Celery/Redis patterns, deployment, performance, security
- **business/** — B2B marketplace model, pricing strategy, go-to-market, user personas, competitive positioning, partnership strategy
- **project/** — Phase history, architecture evolution, key decisions, portal designs, workflow summaries, feature inventory

## Operations

### Ingest (triggered by /wiki-ingest or "ingest this")

1. Read the raw source document fully
2. Discuss 3-5 key takeaways with the user (skip in batch mode)
3. Create a `source-summary` page in the appropriate category
4. For each significant entity, concept, or decision in the source:
   - If a wiki page exists: update it with new information, add source to `sources` list, bump `updated` date
   - If no wiki page exists: create one from the appropriate template
5. Add `[[wikilinks]]` cross-references in all affected pages
6. Update `index.md` with any new pages (maintain alphabetical order within categories)
7. Append entry to `log.md` with format: `## [YYYY-MM-DD] ingest | Source Title`

**Batch mode (--batch):** Skip step 2. Process all sources in a directory. Generate a single summary at the end listing all pages created/updated.

### Query (triggered by /wiki-query or domain questions)

1. Read `index.md` to identify relevant pages
2. Read those pages (follow `[[wikilinks]]` if needed for deeper context)
3. Synthesize an answer citing wiki pages with `[[wikilinks]]`
4. If the answer is substantial and reusable, offer to file it as a new page (synthesis or comparison type)

### Lint (triggered by /wiki-lint)

1. Scan all pages in `.wiki/pages/` (or a specific category if specified)
2. Check for:
   - **Orphans:** Pages with zero inbound `[[wikilinks]]` from other pages
   - **Broken links:** `[[wikilinks]]` pointing to pages that don't exist
   - **Stale content:** Pages where source documents have been updated since `updated` date
   - **Thin pages:** Fewer than 3 items in Key Facts/Key Points section
   - **Contradictions:** Claims in one page that conflict with another
   - **Missing pages:** Important concepts mentioned in text but lacking their own page
3. Report findings as a checklist with severity (critical/warning/suggestion)
4. Offer to fix each issue

## Principles

1. **Concise over verbose** — one good sentence beats three mediocre ones
2. **Update don't duplicate** — if a page exists for a topic, update it; never create a parallel page
3. **Flag contradictions** — when new sources conflict with existing pages, note the conflict explicitly in both pages
4. **Trace to sources** — every factual claim should be traceable via the `sources` frontmatter field
5. **Compound on queries** — good answers get filed back as wiki pages (synthesis or comparison type)
6. **Cross-link aggressively** — `[[wikilinks]]` are the primary discovery mechanism; if two pages relate, link them
7. **Maintain the index** — `index.md` must always reflect the current state of all pages
8. **Log everything** — every ingest, significant query, and lint pass gets a `log.md` entry
```

- [ ] **Step 2: Verify the schema is well-formed**

Read `.wiki/WIKI.md` and confirm: no placeholders, all sections complete, directory paths match Task 1 structure.

---

### Task 4: Index and Log Files

**Files:**
- Create: `.wiki/index.md`
- Create: `.wiki/log.md`

- [ ] **Step 1: Create empty index**

Write to `.wiki/index.md`:

```markdown
# Wiki Index

> Content catalog for the PropEval knowledge wiki. Read this first when answering queries.

## Industry

_(no pages yet)_

## Technical

_(no pages yet)_

## Business

_(no pages yet)_

## Project

_(no pages yet)_
```

- [ ] **Step 2: Create empty log**

Write to `.wiki/log.md`:

```markdown
# Wiki Log

> Chronological record of wiki operations. Each entry starts with `## [YYYY-MM-DD] operation | description`.

```

---

### Task 5: Raw Source Symlinks

**Files:**
- Create: symlinks in `.wiki/raw/docs/`

- [ ] **Step 1: Create symlinks to existing project docs**

```bash
cd /home/yogidigital/projects/propeval
ln -s ../../docs/GTR-PRODUCT-SPECIFICATION.md .wiki/raw/docs/GTR-PRODUCT-SPECIFICATION.md
ln -s ../../docs/market-research-india-property-valuation-2025.md .wiki/raw/docs/market-research-india-property-valuation-2025.md
ln -s ../../CLAUDE.md .wiki/raw/docs/CLAUDE.md
```

- [ ] **Step 2: Create a symlink for the specs directory**

```bash
ln -s ../../docs/superpowers/specs .wiki/raw/docs/design-specs
```

- [ ] **Step 3: Verify symlinks resolve**

```bash
ls -la .wiki/raw/docs/
head -3 .wiki/raw/docs/GTR-PRODUCT-SPECIFICATION.md
head -3 .wiki/raw/docs/CLAUDE.md
```

Expected: symlinks resolve, first 3 lines of each file are readable.

---

### Task 6: Slash Command Skills

**Files:**
- Create: `~/.claude/skills/wiki-ingest/SKILL.md`
- Create: `~/.claude/skills/wiki-query/SKILL.md`
- Create: `~/.claude/skills/wiki-lint/SKILL.md`

- [ ] **Step 1: Create skills directory**

```bash
mkdir -p ~/.claude/skills/wiki-ingest ~/.claude/skills/wiki-query ~/.claude/skills/wiki-lint
```

- [ ] **Step 2: Write wiki-ingest skill**

Write to `~/.claude/skills/wiki-ingest/SKILL.md`:

```markdown
---
name: wiki-ingest
description: "Ingest a source document into the project wiki. Reads the source, creates/updates wiki pages, maintains cross-references and index. Use when adding new knowledge sources or processing existing docs."
---

# Wiki Ingest

Ingest a source document into the LLM wiki at `.wiki/`.

## Prerequisites

Read `.wiki/WIKI.md` for full conventions before proceeding.

## Input

The user provides one of:
- A file path to a document (relative to project root or absolute)
- A URL to fetch and process
- Pasted text content
- `--batch <directory>` flag to process all files in a directory

## Workflow

### Interactive Mode (default)

1. **Read the source fully.** If it's a file, use the Read tool. If a URL, fetch it. If pasted text, use it directly.

2. **Place the source in raw/.** If it's a new external source, copy or save it to `.wiki/raw/external/`. If it's already in `docs/`, confirm the symlink exists in `.wiki/raw/docs/`.

3. **Discuss key takeaways.** Present 3-5 key takeaways to the user. Ask if there's anything specific to emphasize or skip.

4. **Create a source-summary page.** Use the `_templates/source-summary.md` template. Save to `.wiki/pages/<category>/summary-<kebab-source-name>.md`.

5. **Create or update entity/concept/decision pages.** For each significant item in the source:
   - Check `index.md` — does a page already exist for this topic?
   - If yes: read the existing page, update it with new info, add this source to `sources`, bump `updated`
   - If no: create a new page from the appropriate template

6. **Add cross-references.** In every page you created or updated, add `[[wikilinks]]` to related pages. Also update existing pages that should link to new pages.

7. **Update index.md.** Add new pages under the correct category heading. Maintain alphabetical order. Format: `- [Page Title](pages/category/filename.md) — one-line summary`

8. **Update log.md.** Append:
   ```
   ## [YYYY-MM-DD] ingest | Source Name
   - Source: raw/path/to/source.md
   - Created: list of new pages
   - Updated: list of modified pages
   - Pages touched: N
   ```

### Batch Mode (--batch flag)

Same as interactive but skip step 3 (no discussion per source). Process each source sequentially. At the end, present a single summary of all pages created/updated.

## Quality Checks

Before finishing, verify:
- [ ] Every new page has complete frontmatter (no template placeholders)
- [ ] Every new page has at least 3 items in Key Facts/Key Points
- [ ] Cross-references are bidirectional (if A links to B, B should link to A where relevant)
- [ ] index.md reflects all new pages
- [ ] log.md has the ingest entry
```

- [ ] **Step 3: Write wiki-query skill**

Write to `~/.claude/skills/wiki-query/SKILL.md`:

```markdown
---
name: wiki-query
description: "Query the project wiki for knowledge. Searches the wiki index, reads relevant pages, and synthesizes an answer with citations. Use when asking domain questions about the project, industry, or technology."
---

# Wiki Query

Answer questions using the LLM wiki at `.wiki/`.

## Prerequisites

Read `.wiki/WIKI.md` for conventions.

## Input

A natural language question from the user. Examples:
- "What do we know about RBI property valuation guidelines?"
- "Why did we choose FastAPI over Django?"
- "What's the competitive landscape?"

## Workflow

1. **Read the index.** Read `.wiki/index.md` to get the full catalog of available pages.

2. **Identify relevant pages.** Based on the question, select pages that are likely to contain answers. Follow category hints:
   - Regulatory/market questions → `industry/`
   - Stack/architecture questions → `technical/`
   - Strategy/positioning questions → `business/`
   - Feature/phase questions → `project/`

3. **Read relevant pages.** Read the selected pages. If they contain `[[wikilinks]]` to other relevant pages, follow those too (max 2 levels deep).

4. **Synthesize an answer.** Combine information from multiple pages into a coherent answer. Cite wiki pages using `[[wikilinks]]` so the user can drill deeper.

5. **Offer to file the answer.** If the synthesized answer:
   - Combines insights from 3+ pages, OR
   - Produces a comparison or analysis that doesn't exist as a page yet
   Then offer: "This answer could be valuable as a wiki page. Want me to file it as a [[synthesis/comparison]] page?"

6. **If filing:** Create the page from the appropriate template, update index.md, update log.md with a query entry:
   ```
   ## [YYYY-MM-DD] query | Question summary
   - Pages consulted: list
   - Filed as: new-page-name.md (or "not filed")
   ```

## When the Wiki Doesn't Have the Answer

If the wiki doesn't contain enough information to answer:
1. Say what the wiki does know (partial answer)
2. Identify the gap explicitly
3. Suggest: "Want me to research this and ingest the findings?" or "This might be in [specific raw source] — want me to ingest it?"
```

- [ ] **Step 4: Write wiki-lint skill**

Write to `~/.claude/skills/wiki-lint/SKILL.md`:

```markdown
---
name: wiki-lint
description: "Health-check the project wiki. Scans for orphan pages, broken links, stale content, contradictions, and thin pages. Use periodically to keep the wiki healthy as it grows."
---

# Wiki Lint

Health-check the LLM wiki at `.wiki/`.

## Prerequisites

Read `.wiki/WIKI.md` for conventions.

## Input

Optional: a category filter (e.g., `/wiki-lint industry`). Without a filter, lint all categories.

## Workflow

1. **Inventory all pages.** Read `index.md` and also glob `.wiki/pages/**/*.md` to catch any pages not in the index.

2. **Build a link map.** For each page, extract:
   - All `[[wikilinks]]` it contains (outbound links)
   - Its title (for matching inbound links)

3. **Run checks:**

   **Critical:**
   - **Broken links:** `[[wikilinks]]` pointing to pages that don't exist
   - **Unindexed pages:** Pages in `pages/` not listed in `index.md`

   **Warning:**
   - **Orphan pages:** Pages with zero inbound links from other pages
   - **Stale content:** Pages where `updated` date is older than the modification date of any file in their `sources` list
   - **Thin pages:** Pages with fewer than 3 items in their Key Facts/Key Points section

   **Suggestion:**
   - **Missing pages:** Concepts or entities mentioned frequently in text (3+ pages) but lacking their own page
   - **One-way links:** Page A links to Page B, but B doesn't link back to A (and should)
   - **Category mismatches:** Pages that might fit better in a different category based on their content

4. **Report findings.** Present as a checklist grouped by severity:

   ```
   ## Wiki Health Report — YYYY-MM-DD

   ### Critical (N)
   - [ ] Broken link: [[Missing Page]] in pages/industry/market.md
   - [ ] Unindexed: pages/technical/redis-patterns.md not in index.md

   ### Warning (N)
   - [ ] Orphan: pages/business/pricing-model.md (0 inbound links)
   - [ ] Stale: pages/industry/competitor-landscape.md (updated 2026-04-01, source modified 2026-04-10)

   ### Suggestion (N)
   - [ ] Missing page: "SARFAESI Act" mentioned in 4 pages but has no dedicated page
   - [ ] One-way link: market.md → regulatory.md but not reverse
   ```

5. **Offer to fix.** Ask: "Want me to fix all critical issues, or go through them one by one?"

6. **Log the lint pass.** Append to log.md:
   ```
   ## [YYYY-MM-DD] lint | Full scan (or category name)
   - Critical: N issues (N fixed)
   - Warning: N issues
   - Suggestion: N issues
   ```
```

- [ ] **Step 5: Verify all skills exist**

```bash
ls -R ~/.claude/skills/wiki-*/
```

Expected:
```
~/.claude/skills/wiki-ingest/:
SKILL.md

~/.claude/skills/wiki-query/:
SKILL.md

~/.claude/skills/wiki-lint/:
SKILL.md
```

---

### Task 7: CLAUDE.md Integration

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Knowledge Wiki section to CLAUDE.md**

Add the following section after the "Key Files" section in `CLAUDE.md`:

```markdown
## Knowledge Wiki

Project wiki at `.wiki/` — LLM-maintained knowledge base (industry, technical, business, project).
- Schema: `.wiki/WIKI.md` — read this before any wiki operation
- Commands: `/wiki-ingest`, `/wiki-query`, `/wiki-lint`
- Index: `.wiki/index.md` — read this first when answering domain questions
- When answering domain questions about the project, industry, regulations, or technical decisions, check `.wiki/index.md` first
- Conversational requests like "what do we know about X" should query the wiki
```

- [ ] **Step 2: Verify the addition reads well in context**

Read the CLAUDE.md section around the insertion point and confirm it flows naturally.

- [ ] **Step 3: Commit structural setup**

```bash
git add CLAUDE.md
git commit -m "feat: add LLM wiki knowledge base structure and skills

- .wiki/ directory with raw sources, pages, templates, index, log
- WIKI.md schema for LLM wiki maintenance conventions
- Three slash command skills: /wiki-ingest, /wiki-query, /wiki-lint
- CLAUDE.md updated with Knowledge Wiki section"
```

---

### Task 8: Seed — Ingest GTR Product Specification

**Files:**
- Create: `.wiki/pages/project/summary-gtr-product-spec.md`
- Create: `.wiki/pages/project/gtr-product-overview.md`
- Create: `.wiki/pages/project/three-workflows.md`
- Create: `.wiki/pages/project/lender-portal.md`
- Create: `.wiki/pages/project/vendor-portal.md`
- Create: `.wiki/pages/project/admin-portal.md`
- Create: `.wiki/pages/business/b2b-marketplace-model.md`
- Create: `.wiki/pages/industry/property-valuation-india.md`
- Update: `.wiki/index.md`
- Update: `.wiki/log.md`

- [ ] **Step 1: Read the source**

Read `docs/GTR-PRODUCT-SPECIFICATION.md` fully.

- [ ] **Step 2: Create source-summary page**

Write `.wiki/pages/project/summary-gtr-product-spec.md` using the source-summary template. Include: key takeaways, scope, the three workflows, user roles, key business rules.

- [ ] **Step 3: Create project overview page**

Write `.wiki/pages/project/gtr-product-overview.md` as an entity page. Cover: what GetItRight is, the three user types, core value proposition, current build status (Phase 16 complete).

- [ ] **Step 4: Create three-workflows page**

Write `.wiki/pages/project/three-workflows.md` as a concept page. Detail: New Request workflow, Listing Purchase workflow, Update/Nearby workflow. Cross-link to portals.

- [ ] **Step 5: Create portal entity pages**

Write `.wiki/pages/project/lender-portal.md`, `.wiki/pages/project/vendor-portal.md`, `.wiki/pages/project/admin-portal.md` as entity pages. Each covers: purpose, key features, URL paths, user types.

- [ ] **Step 6: Create business model page**

Write `.wiki/pages/business/b2b-marketplace-model.md` as a concept page. Cover: lender-vendor marketplace dynamics, GTR's role as platform operator, revenue model (platform fees, listing fees), trust mechanisms.

- [ ] **Step 7: Create industry context page**

Write `.wiki/pages/industry/property-valuation-india.md` as a concept page. Cover: what property valuation is in Indian context, why lenders need it, regulatory drivers, current manual process that GTR digitizes.

- [ ] **Step 8: Add cross-references**

Go through all pages created in steps 2-7 and add `[[wikilinks]]` between them. At minimum:
- Overview links to all three portals and workflows
- Workflows link to portals and business model
- Business model links to overview and industry context
- Industry context links to business model and overview

- [ ] **Step 9: Update index.md**

Add all new pages under the correct category headings in `.wiki/index.md`.

- [ ] **Step 10: Update log.md**

Append ingest entry for GTR Product Specification.

---

### Task 9: Seed — Ingest Market Research

**Files:**
- Create: `.wiki/pages/industry/summary-market-research-2025.md`
- Create: `.wiki/pages/industry/india-valuation-market-2025.md`
- Create: `.wiki/pages/industry/regulatory-landscape.md`
- Create: `.wiki/pages/industry/competitor-landscape.md`
- Update: existing pages with cross-references
- Update: `.wiki/index.md`
- Update: `.wiki/log.md`

- [ ] **Step 1: Read the source**

Read `docs/market-research-india-property-valuation-2025.md` fully.

- [ ] **Step 2: Create source-summary page**

Write `.wiki/pages/industry/summary-market-research-2025.md` using the source-summary template.

- [ ] **Step 3: Create market overview page**

Write `.wiki/pages/industry/india-valuation-market-2025.md` as a synthesis page. Cover: market size, growth projections, key trends, technology adoption, geographic breakdown.

- [ ] **Step 4: Create regulatory landscape page**

Write `.wiki/pages/industry/regulatory-landscape.md` as a concept page. Cover: RBI guidelines, NHB requirements, SARFAESI Act relevance, compliance requirements for valuers.

- [ ] **Step 5: Create competitor landscape page**

Write `.wiki/pages/industry/competitor-landscape.md` as an entity page. Cover: existing players, their approaches, market gaps GTR addresses, differentiation.

- [ ] **Step 6: Cross-reference with existing pages**

Update `.wiki/pages/industry/property-valuation-india.md` with links to market-2025, regulatory, competitor pages. Update `.wiki/pages/business/b2b-marketplace-model.md` with market validation cross-refs.

- [ ] **Step 7: Update index.md and log.md**

Add new pages to index. Append ingest entry to log.

---

### Task 10: Seed — Ingest Design Specs (Synthesis)

**Files:**
- Create: `.wiki/pages/project/phase-history.md`
- Update: `.wiki/index.md`
- Update: `.wiki/log.md`

- [ ] **Step 1: Read all design specs**

Read (or skim key sections of) all 17 files in `docs/superpowers/specs/`. Extract: phase name, what was built, key architectural decisions, notable trade-offs.

- [ ] **Step 2: Create phase history synthesis page**

Write `.wiki/pages/project/phase-history.md` as a synthesis page. Structure as a timeline with each phase:
- Phase number and name
- Date
- What was built (2-3 sentences)
- Key decisions made
- Architecture impact

Cover all phases 0-16 from the spec files.

- [ ] **Step 3: Cross-reference**

Link phase-history to overview, portals, and workflow pages where relevant. Update those pages to link back.

- [ ] **Step 4: Update index.md and log.md**

Add phase-history to index. Append ingest entry to log.

---

### Task 11: Seed — Ingest CLAUDE.md (Technical Decisions)

**Files:**
- Create: `.wiki/pages/technical/summary-claude-md.md`
- Create: `.wiki/pages/technical/stack-decisions.md`
- Create: `.wiki/pages/technical/known-gotchas.md`
- Create: `.wiki/pages/technical/celery-patterns.md`
- Update: `.wiki/index.md`
- Update: `.wiki/log.md`

- [ ] **Step 1: Read CLAUDE.md as a source**

Read `CLAUDE.md` focusing on: Stack section, Architecture section, Backend Conventions, Known Issues & Gotchas, Key Files.

- [ ] **Step 2: Create source-summary page**

Write `.wiki/pages/technical/summary-claude-md.md` using the source-summary template.

- [ ] **Step 3: Create stack decisions page**

Write `.wiki/pages/technical/stack-decisions.md` as a decision page. Cover: why FastAPI (not Django), why Next.js 15 App Router, why SQLAlchemy 2.0 async, why Celery+Redis (not alternatives), why PostgreSQL, port offset rationale.

- [ ] **Step 4: Create known gotchas page**

Write `.wiki/pages/technical/known-gotchas.md` as a concept page. Cover: bcrypt 4.0.1 pinning, port conflicts, PYTHONPATH requirement, Docker volume mounting limits, Poetry lock workflow, Alembic enum reuse, decimal serialization, Report→Vendor FK (no request_id).

- [ ] **Step 5: Create Celery patterns page**

Write `.wiki/pages/technical/celery-patterns.md` as a concept page. Cover: `get_async_session_context()` for DB access, `asyncio.run()` wrapping, lazy imports, autodiscover_tasks, beat schedule conventions.

- [ ] **Step 6: Cross-reference with existing pages**

Link technical pages to project overview, phase history where relevant. Update existing pages that reference technical topics.

- [ ] **Step 7: Update index.md and log.md**

Add new pages to index. Append ingest entry to log.

---

### Task 12: Final Verification

- [ ] **Step 1: Run a manual lint check**

Review all pages in `.wiki/pages/` for:
- Complete frontmatter (no `{{placeholders}}`)
- At least 3 items in Key Facts/Key Points
- Bidirectional cross-references
- All pages listed in index.md

- [ ] **Step 2: Count pages and verify index**

```bash
find .wiki/pages -name "*.md" | wc -l
grep -c "^- \[" .wiki/index.md
```

Expected: both numbers match (should be ~15-20 pages).

- [ ] **Step 3: Test symlinks**

```bash
for f in .wiki/raw/docs/*; do echo "$f -> $(readlink -f "$f")"; done
```

All symlinks should resolve to existing files.

- [ ] **Step 4: Verify skills are discoverable**

Start a new Claude Code session (or use `/help`) and confirm `/wiki-ingest`, `/wiki-query`, `/wiki-lint` appear in the skills list.

- [ ] **Step 5: Test a query**

Run `/wiki-query "What is GetItRight?"` and verify it reads the index, finds relevant pages, and returns a cited answer.
