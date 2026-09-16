# quicksites

Static GitHub Pages collection for small publishable pages.

Current pages:

- `aea/` - AEA engineering progress and integration commit publication snapshot. Reads the adjacent `aea/status.json` on load, every 60 seconds, and on manual refresh; the page never queries a private Git repository. Source Git verification, snapshot generation, and browser retrieval timestamps are distinct. Each development checkout must run `git fetch` to verify its actual remote tip. Snapshots older than 24 hours are flagged; failed refreshes retain the last successfully loaded data with an error notice. Missing data is shown as unpublished, without demo progress. Task links support anchors such as `aea/#P2-T`.
- `usyd-rental-shortlist.html` - USYD 2B2B air-conditioned rental shortlist with listing cards and a transport map.
- `stat5003-stock-project.html` - Multilingual STAT5003 S&P 500 dataset overview and high-volatility classification project brief.

The root `index.html` is only a directory page so more standalone pages can be added later.

AEA entry: `aea/index.html` is the complete requirement/progress table generated from the verified SheetMetalUnroll integration commit. `aea/status.html` is the lightweight version view and `aea/status.json` its manifest. Do not manually edit generated index/JSON; the source repository publisher owns those two files. The source repository remains private.
