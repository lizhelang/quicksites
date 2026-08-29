# Microsite interaction test

The test covers the single dataset route, stale-hash fallback, English/Chinese/Korean switching, language persistence, mobile overflow, browser-console errors, and representative screenshots.

## Setup

```bash
python3 -m venv .venv-test
.venv-test/bin/pip install -r requirements-test.txt
.venv-test/bin/python -m playwright install chromium
```

## Run

Start the static site from the repository root:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Then run the test in another terminal:

```bash
.venv-test/bin/python tests/stat5003_microsite_test.py
```

`MICROSITE_BASE_URL` can point the test at another server. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can select an existing Chromium binary; otherwise Playwright uses its installed browser.
