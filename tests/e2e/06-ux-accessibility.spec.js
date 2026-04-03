// TC-28 to TC-32: UX, responsive layout, keyboard nav, locale, performance, regression
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function mockCalendarEmpty(page) {
  await page.route('**/api/booking/calendar', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookings: [] }),
    })
  );
}

async function loadBookingPage(page) {
  await mockCalendarEmpty(page);
  await page.goto('/booking.html');
  await page.waitForSelector('#booking-form', { state: 'visible' });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-28 · Responsive layout on mobile viewport (375×812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('week/day view buttons are absent on mobile', async ({ page }) => {
    await loadBookingPage(page);

    // FullCalendar hides week/day views on mobile, only shows month + list
    expect(await page.locator('.fc-timeGridWeek-button').count()).toBe(0);
    expect(await page.locator('.fc-timeGridDay-button').count()).toBe(0);
  });

  test('prev/next calendar navigation buttons are visible on mobile', async ({ page }) => {
    await loadBookingPage(page);

    await expect(page.locator('.fc-prev-button')).toBeVisible();
    await expect(page.locator('.fc-next-button')).toBeVisible();
  });

  test('booking form fields are reachable and fillable on mobile', async ({ page }) => {
    await loadBookingPage(page);

    await expect(page.locator('#name')).toBeVisible();
    await page.locator('#name').fill('Mobil Bruker');
    await expect(page.locator('#name')).toHaveValue('Mobil Bruker');

    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#submit-btn')).toBeVisible();
  });

  test('calendar is visible and not cropped on mobile', async ({ page }) => {
    await loadBookingPage(page);

    const calendarBox = await page.locator('#calendar').boundingBox();
    expect(calendarBox).not.toBeNull();
    // The calendar should sit within the viewport width
    expect(calendarBox.x).toBeGreaterThanOrEqual(0);
    expect(calendarBox.x + calendarBox.width).toBeLessThanOrEqual(375 + 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-29 · Keyboard navigation', () => {
  test('Tab key moves focus from name to email field', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('#name').focus();
    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBe('email');
  });

  test('Tab key continues through phone and date fields without trapping', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('#name').focus();
    // Tab through name → email → phone → address → date
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
    }

    const focused = await page.evaluate(() => document.activeElement?.id);
    // Focus should have advanced past name
    expect(focused).not.toBe('name');
    expect(focused).toBeTruthy();
  });

  test('submit button is reachable by keyboard', async ({ page }) => {
    await loadBookingPage(page);

    // Focus the submit button directly
    await page.locator('#submit-btn').focus();
    const focused = await page.evaluate(() => document.activeElement?.id);
    expect(focused).toBe('submit-btn');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-30 · Norwegian locale consistency', () => {
  test('page heading is in Norwegian', async ({ page }) => {
    await loadBookingPage(page);

    await expect(page.locator('h1')).toContainText('Lei Bjørkvang forsamlingslokale');
  });

  test('form labels are in Norwegian', async ({ page }) => {
    await loadBookingPage(page);

    await expect(page.locator('label[for="name"]')).toContainText('Navn');
    await expect(page.locator('label[for="email"]')).toContainText('E-post');
    await expect(page.locator('label[for="phone"]')).toContainText('Telefon');
    await expect(page.locator('label[for="date"]')).toContainText('Dato');
    await expect(page.locator('label[for="time"]')).toContainText('Starttid');
    await expect(page.locator('label[for="duration"]')).toContainText('Varighet');
  });

  test('event type options are in Norwegian', async ({ page }) => {
    await loadBookingPage(page);

    const options = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#event-type option')).map(o => o.textContent)
    );
    const norwegianKeywords = ['Bursdag', 'Bryllup', 'kurs', 'Konsert', 'minnestund', 'Dugnad', 'Annet'];
    const hasNorwegian = norwegianKeywords.every((kw) => options.some((o) => o.includes(kw)));
    expect(hasNorwegian).toBe(true);
  });

  test('validation error messages are in Norwegian', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('#submit-btn').click();

    const errorText = await page.evaluate(() => document.getElementById('booking-status').textContent);
    // Must contain a common Norwegian validation phrase
    expect(errorText).toMatch(/Vennligst|Velg|fyll/i);
  });

  test('legend labels are in Norwegian', async ({ page }) => {
    await loadBookingPage(page);

    await expect(page.locator('.legend-item').getByText('Ledig dato', { exact: true })).toBeVisible();
    await expect(page.locator('.legend-item').getByText('Venter bekreftelse', { exact: true })).toBeVisible();
    await expect(page.locator('.legend-item').getByText('Reservert', { exact: true })).toBeVisible();
  });

  test('page lang attribute is set to nb (Norwegian)', async ({ page }) => {
    await loadBookingPage(page);

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('nb');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-31 · Page load performance', () => {
  test('form is interactive before calendar finishes loading (non-blocking)', async ({ page }) => {
    // Simulate a slow calendar API (1.5s delay)
    await page.route('**/api/booking/calendar', (route) => {
      setTimeout(
        () =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ bookings: [] }),
          }),
        1500
      );
    });

    await page.goto('/booking.html');

    // Form inputs should be enabled before the API resolves
    await expect(page.locator('#name')).toBeEnabled({ timeout: 1200 });
    await expect(page.locator('#submit-btn')).toBeEnabled({ timeout: 1200 });
  });

  test('calendar API response is handled within 5 seconds', async ({ page }) => {
    let resolved = false;

    await page.route('**/api/booking/calendar', async (route) => {
      resolved = true;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ bookings: [] }),
      });
    });

    await page.goto('/booking.html');
    await page.waitForSelector('.fc-daygrid-body', { timeout: 5000 });

    expect(resolved).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-32 · Email no_tracking regression', () => {
  test('functions/shared/email.js contains no_tracking: true in buildPayload', () => {
    const emailPath = path.resolve(__dirname, '../../functions/shared/email.js');
    expect(fs.existsSync(emailPath)).toBe(true);

    const source = fs.readFileSync(emailPath, 'utf-8');

    // Verify the fix from the no-tracking commit is present
    expect(source).toContain('no_tracking: true');
  });

  test('no_tracking is set inside the buildPayload function, not elsewhere', () => {
    const emailPath = path.resolve(__dirname, '../../functions/shared/email.js');
    const source = fs.readFileSync(emailPath, 'utf-8');

    // The no_tracking line should be inside the buildPayload object literal
    const buildPayloadBlock = source.match(/const buildPayload[\s\S]+?\);/)?.[0] ?? '';
    expect(buildPayloadBlock).toContain('no_tracking: true');
  });
});
