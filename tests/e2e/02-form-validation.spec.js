// TC-06 to TC-13: Form validation, space selection, pricing and UX guards
const { test, expect } = require('@playwright/test');

/** Load the booking page with a mocked (empty) calendar API */
async function loadBookingPage(page) {
  await page.route('**/api/booking/calendar', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ bookings: [] }),
    })
  );
  await page.goto('/booking.html');
  await page.waitForSelector('#booking-form', { state: 'visible' });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-06 · Required field validation on empty submit', () => {
  test('shows Norwegian error and applies is-error class', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('#submit-btn').click();

    await expect(page.locator('#booking-status')).toHaveClass(/is-visible/);
    await expect(page.locator('#booking-status')).toHaveClass(/is-error/);
    // Message must be in Norwegian
    await expect(page.locator('#booking-status')).toContainText('Vennligst fyll ut');
  });

  test('confirmation receipt is NOT shown on validation failure', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('#submit-btn').click();

    await expect(page.locator('#booking-confirmation')).toBeHidden();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-07 · Space selector mutual exclusion', () => {
  test('checking Salen then Peisestue unchecks Salen', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Salen"]').check();
    await page.locator('input[name="spaces"][value="Peisestue"]').check();

    await expect(page.locator('input[name="spaces"][value="Salen"]')).not.toBeChecked();
    await expect(page.locator('input[name="spaces"][value="Peisestue"]')).toBeChecked();
  });

  test('selecting Hele lokalet unchecks individual spaces', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Peisestue"]').check();
    await page.locator('input[name="spaces"][value="Hele lokalet"]').check();

    await expect(page.locator('input[name="spaces"][value="Peisestue"]')).not.toBeChecked();
    await expect(page.locator('input[name="spaces"][value="Hele lokalet"]')).toBeChecked();
  });

  test('selecting Bryllupspakke unchecks Hele lokalet', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Hele lokalet"]').check();
    await page.locator('input[name="spaces"][value="Bryllupspakke"]').check();

    await expect(page.locator('input[name="spaces"][value="Hele lokalet"]')).not.toBeChecked();
    await expect(page.locator('input[name="spaces"][value="Bryllupspakke"]')).toBeChecked();
  });

  test('selecting individual space unchecks whole-premises spaces', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Bryllupspakke"]').check();
    await page.locator('input[name="spaces"][value="Salen"]').check();

    await expect(page.locator('input[name="spaces"][value="Bryllupspakke"]')).not.toBeChecked();
    await expect(page.locator('input[name="spaces"][value="Salen"]')).toBeChecked();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-08 · Bryllupspakke special flow', () => {
  test('selecting Bryllupspakke hides duration and reveals end-date/end-time fields', async ({
    page,
  }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Bryllupspakke"]').check();

    await expect(page.locator('#duration-field')).toBeHidden();
    await expect(page.locator('#end-date-field')).toBeVisible();
    await expect(page.locator('#end-time-field')).toBeVisible();
  });

  test('selecting Bryllupspakke auto-sets event type to Bryllup', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Bryllupspakke"]').check();

    await expect(page.locator('#event-type')).toHaveValue('Bryllup');
  });

  test('selecting Bryllupspakke shows info status message', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Bryllupspakke"]').check();

    await expect(page.locator('#booking-status')).toContainText('Bryllupspakke');
    await expect(page.locator('#booking-status')).toHaveClass(/is-info/);
  });

  test('deselecting Bryllupspakke restores duration field and hides end-date fields', async ({
    page,
  }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Bryllupspakke"]').check();
    await page.locator('input[name="spaces"][value="Bryllupspakke"]').uncheck();

    await expect(page.locator('#duration-field')).toBeVisible();
    await expect(page.locator('#end-date-field')).toBeHidden();
    await expect(page.locator('#end-time-field')).toBeHidden();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-09 · Member discount section visibility', () => {
  test('member discount section is hidden by default', async ({ page }) => {
    await loadBookingPage(page);

    await expect(page.locator('#member-discount-section')).toBeHidden();
  });

  test('member discount section appears when Hele lokalet is selected', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Hele lokalet"]').check();

    await expect(page.locator('#member-discount-section')).toBeVisible();
  });

  test('member discount section appears when Bryllupspakke is selected', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Bryllupspakke"]').check();

    await expect(page.locator('#member-discount-section')).toBeVisible();
  });

  test('switching to individual space hides member discount section', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Hele lokalet"]').check();
    await expect(page.locator('#member-discount-section')).toBeVisible();

    await page.locator('input[name="spaces"][value="Peisestue"]').check();

    await expect(page.locator('#member-discount-section')).toBeHidden();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-10 · Price calculation per space', () => {
  const cases = [
    { space: 'Peisestue', expected: '1\u00a0500 kr' },
    { space: 'Salen', expected: '3\u00a0000 kr' },
    { space: 'Hele lokalet', expected: '4\u00a0000 kr' },
    { space: 'Bryllupspakke', expected: '6\u00a0000 kr' },
  ];

  for (const { space, expected } of cases) {
    test(`${space} shows estimated price of ${expected}`, async ({ page }) => {
      await loadBookingPage(page);

      await page.locator(`input[name="spaces"][value="${space}"]`).check();

      await expect(page.locator('#calculated-price')).toContainText(expected);
    });
  }

  test('Hele lokalet with member discount shows 3\u00a0500 kr', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Hele lokalet"]').check();
    await page.locator('#is-member').check();

    await expect(page.locator('#calculated-price')).toContainText('3\u00a0500 kr');
  });

  test('Små møter with 10 attendees shows 300 kr', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('input[name="spaces"][value="Små møter"]').check();
    await page.locator('#attendees').fill('10');
    // Trigger input event to recalculate
    await page.locator('#attendees').dispatchEvent('input');

    await expect(page.locator('#calculated-price')).toContainText('300 kr');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-11 · Contact info field validation', () => {
  test('submitting with only a name (missing email/phone/date/space) shows error', async ({
    page,
  }) => {
    await loadBookingPage(page);

    await page.locator('#name').fill('Ola Nordmann');
    await page.locator('#submit-btn').click();

    await expect(page.locator('#booking-status')).toHaveClass(/is-error/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-12 · Double-submission prevention', () => {
  test('rapid double-click sends at most one API request', async ({ page }) => {
    await loadBookingPage(page);

    let apiCallCount = 0;
    // Register the submission intercept BEFORE filling the form
    await page.route('**/api/booking', (route) => {
      apiCallCount++;
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'dup-test', status: 'pending', paymentMethod: 'bank' }),
      });
    });

    // Fill minimum required fields
    await page.locator('#name').fill('Test Bruker');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#phone').fill('99999999');
    await page.locator('#date').fill('2026-08-15');
    await page.locator('#time').fill('14:00');
    await page.locator('#event-type').selectOption('Familiefeiring');
    await page.locator('input[name="spaces"][value="Peisestue"]').check();

    // Double-click submit (dblclick to ensure both events fire before form hides)
    await page.locator('#submit-btn').dblclick();

    await page.waitForTimeout(600);

    expect(apiCallCount).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-13 · No space selected error', () => {
  test('shows "Velg minst ett" error when no space is checked', async ({ page }) => {
    await loadBookingPage(page);

    await page.locator('#name').fill('Test Bruker');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#phone').fill('99999999');
    await page.locator('#date').fill('2026-08-15');
    await page.locator('#time').fill('14:00');
    await page.locator('#event-type').selectOption('Familiefeiring');
    // Intentionally skip space selection

    await page.locator('#submit-btn').click();

    await expect(page.locator('#booking-status')).toContainText('Velg minst ett');
    await expect(page.locator('#booking-status')).toHaveClass(/is-error/);
  });
});
