import os
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ModuleNotFoundError as exc:
    raise SystemExit(
        "Playwright is required. Install requirements-test.txt and run "
        "`python -m playwright install chromium` before this test."
    ) from exc


BASE_URL = os.environ.get(
    "MICROSITE_BASE_URL",
    "http://127.0.0.1:8765/stat5003-stock-project.html",
)
CHROMIUM_EXECUTABLE = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")


def is_visible(page, selector: str) -> bool:
    return page.locator(selector).evaluate("element => getComputedStyle(element).display !== 'none'")


def run_desktop(browser) -> None:
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    console_errors: list[str] = []
    page_errors: list[str] = []
    page.on(
        "console",
        lambda message: console_errors.append(
            f"{message.text} @ {message.location.get('url', 'unknown')}"
        )
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    page.goto(f"{BASE_URL}#unknown", wait_until="networkidle")
    assert page.url.endswith("#dataset")
    assert page.locator("html").get_attribute("lang") == "en"
    assert page.locator("body").get_attribute("data-language") == "en"
    assert is_visible(page, '[data-section-panel="dataset"]')
    assert not is_visible(page, '[data-section-panel="research"]')
    assert page.get_by_text("Version 1023", exact=True).first.is_visible()
    dataset_english = page.locator('[data-section-panel="dataset"] .language-copy[data-copy="en"]')
    dataset_link = dataset_english.locator(".hero-source a")
    assert dataset_link.is_visible()
    assert dataset_link.get_attribute("href") == "https://www.kaggle.com/datasets/andrewmvd/sp-500-stocks/data"
    assert "S&P 500 Stocks" in dataset_link.inner_text()
    course_fit = dataset_english.locator(".course-fit")
    archive_detail = dataset_english.locator(".archive-detail")
    assert course_fit.bounding_box()["y"] < archive_detail.bounding_box()["y"]
    assert dataset_english.locator(".fact-grid .fact-card").count() == 6
    assert course_fit.locator(".criterion-card.pass").count() == 3
    assert course_fit.locator(".criterion-card.available").count() == 1
    assert course_fit.locator(".criterion-card.available").get_by_text("Multi-class", exact=True).is_visible()
    assert dataset_english.locator(".why-fit, .feature-map, .quality-layout, .caveat-strip").count() == 0
    page.screenshot(path="/tmp/stat5003-microsite-en-dataset.png", full_page=True)

    page.get_by_role("button", name="中文").click()
    assert page.locator("html").get_attribute("lang") == "zh-CN"
    chinese_heading = page.locator('[data-section-panel="dataset"] .language-copy[data-copy="zh"] .hero h2')
    assert chinese_heading.is_visible()
    assert chinese_heading.inner_text() == "S&P 500 Stocks"
    assert page.get_by_role("button", name="中文").get_attribute("aria-pressed") == "true"

    page.reload(wait_until="networkidle")
    assert page.locator("body").get_attribute("data-language") == "zh"
    assert page.url.endswith("#dataset")

    page.locator('[data-section-link="research"]').click()
    page.wait_for_url("**#research")
    assert is_visible(page, '[data-section-panel="research"]')
    assert not is_visible(page, '[data-section-panel="dataset"]')
    assert page.get_by_text("计划进行的可行性检查", exact=True).is_visible()
    page.screenshot(path="/tmp/stat5003-microsite-zh-research.png", full_page=True)

    page.get_by_role("button", name="한국어").click()
    assert page.locator("html").get_attribute("lang") == "ko"
    assert page.get_by_text("계획된 실행 가능성 점검", exact=True).is_visible()
    assert page.locator('[data-section-panel="research"] .language-copy[data-copy="ko"] .metric-value').first.is_visible()
    assert page.locator('[data-section-panel="research"] .language-copy[data-copy="ko"] .metric-value').first.inner_text() == "검토 대기"

    page.reload(wait_until="networkidle")
    assert page.locator("body").get_attribute("data-language") == "ko"
    assert page.url.endswith("#research")
    assert page.locator('[data-section-link="research"]').get_attribute("aria-current") == "page"

    page.screenshot(path="/tmp/stat5003-microsite-desktop.png", full_page=True)
    assert console_errors == [], console_errors
    assert page_errors == [], page_errors
    context.close()


def run_mobile(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
    page = context.new_page()
    console_errors: list[str] = []
    page_errors: list[str] = []
    page.on(
        "console",
        lambda message: console_errors.append(
            f"{message.text} @ {message.location.get('url', 'unknown')}"
        )
        if message.type == "error"
        else None,
    )
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    page.goto(f"{BASE_URL}#dataset", wait_until="networkidle")
    assert page.get_by_role("button", name="EN").is_visible()
    assert page.locator('[data-section-link="dataset"]').is_visible()
    assert page.locator('[data-section-link="research"]').is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    page.locator('[data-section-link="research"]').click()
    page.wait_for_url("**#research")
    assert page.locator('[data-section-panel="research"] .language-copy[data-copy="en"] .hero h2').is_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    page.screenshot(path="/tmp/stat5003-microsite-mobile.png", full_page=True)

    assert console_errors == [], console_errors
    assert page_errors == [], page_errors
    context.close()


if __name__ == "__main__":
    launch_options = {"headless": True}
    if CHROMIUM_EXECUTABLE:
        chromium_path = Path(CHROMIUM_EXECUTABLE)
        assert chromium_path.exists(), f"Chromium executable not found: {chromium_path}"
        launch_options["executable_path"] = str(chromium_path)
    with sync_playwright() as playwright:
        chromium = playwright.chromium.launch(**launch_options)
        run_desktop(chromium)
        run_mobile(chromium)
        chromium.close()
    print("STAT5003 microsite interaction tests passed")
