# STAT5003 Stock Project Microsite Design

## Purpose

Create a public, shareable project brief for the STAT5003 group. The page must let group members quickly understand both the selected Kaggle dataset and the proposed high-volatility classification question.

## Audience and language

The audience includes English-, Chinese-, and Korean-speaking group members. English is the default. A top-right language control switches the complete interface and content between English, Simplified Chinese, and Korean. Translations are curated in the page source; the site does not depend on an online translation service.

## Information architecture

Add one standalone page, `stat5003-stock-project.html`, with two hash-addressable sections:

- `#dataset` - dataset overview, structure, fields, scale, course-fit evidence, strengths, and limitations.
- `#research` - proposed research question, target definition, observation unit, candidate features, modelling plan, evaluation, preliminary evidence, and open decisions.

A persistent left navigation switches between the two sections. On narrow screens it becomes a top tab bar. Browser history and direct links remain useful through hash routing.

Update the root `index.html` with a card linking to the new page.

## Content boundaries

The dataset section will use verified Version 1023 facts:

- Three CSV files and 97.17 MB uncompressed size.
- 1,891,536 stock-date rows, 502 symbols, 11 sectors.
- Stock data from 2010-01-04 through 2024-12-20.
- Large, Messy, and Integrated are supported course criteria; Complex is not claimed.
- Missing-history, current-constituent survivorship bias, stale update date, and current-snapshot leakage risks are explicit.

The research section will present the future 20-trading-day high-volatility task. The 30% annualised realised-volatility threshold is a provisional working definition pending a distribution and class-balance study. The page must not present it as final. Binary and possible three-class extensions remain visible as next analysis decisions.

## Visual direction

Use an editorial research-dossier aesthetic: dark navy navigation, warm off-white reading surface, teal data accents, restrained amber warnings, and compact tabular-number typography. The design should feel like a polished research briefing rather than a generic dashboard.

Key devices:

- Large issue-number style section markers (`01`, `02`).
- A compact evidence strip for headline dataset facts.
- Clear tables and labelled diagrams built with HTML/CSS rather than decorative stock imagery.
- Light, purposeful transitions for section and language changes.
- Strong focus states, semantic headings, reduced-motion support, and sufficient contrast.

## Interaction and state

- Default language is English.
- The chosen language is saved in `localStorage`.
- Section state is encoded in the URL hash.
- Changing languages preserves the active section.
- The active navigation item and language button expose accessible state.
- With JavaScript unavailable, English dataset content remains visible and links remain usable.

## Verification

- Validate HTML structure and links.
- Test both hash routes, all three languages, persistence after reload, and browser back/forward.
- Test desktop and mobile widths.
- Check keyboard navigation, focus visibility, reduced motion, and no horizontal overflow.
- Serve locally and capture visual evidence before publishing.

## 29 August information-density revision

The dataset page now leads with the course-fit decision immediately after the verified facts. The status encoding is deliberate: green means currently met, blue means available if the target is chosen as multi-class, and an unaccented card means not claimed. The field description is condensed from four broad cards to two higher-signal blocks: model-safe feature sources and context-only or excluded fields. The archive table remains as the detailed reference.

The hero is intentionally compact: a direct one-line explanation of the dataset plus a six-item, one-row summary at desktop widths. “Why this dataset works” follows the course-fit section immediately, before archive-level details, so a group member sees the decision rationale before the schema.

Detailed limitations are condensed into one three-item caveat strip: missingness, survivorship bias, and snapshot leakage. The strip preserves the methodological guardrails without competing visually with the dataset overview.

The hero also exposes the official dataset name and direct Kaggle link in all three languages, so source identification does not depend on the footer links.
