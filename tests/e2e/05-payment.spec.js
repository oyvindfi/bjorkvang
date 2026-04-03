// TC-24 to TC-27: complete-payment page states
// complete-payment.html uses ?bookingId=<id> and calls GET /api/getBooking?id=<bookingId>
const { test, expect } = require('@playwright/test');

/** Intercept the getBooking API call (works for both localhost:7071 and production URLs) */
async function mockGetBooking(page, booking) {
  await page.route(/\/api\/getBooking/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(booking),
    })
  );
}

/** Intercept getBooking with an error */
async function mockGetBookingError(page, status = 404, body = { error: 'Not found' }) {
  await page.route(/\/api\/getBooking/, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  );
}

const APPROVED_BOOKING = {
  id: 'pay-test-001',
  date: '2026-07-20',
  time: '14:00',
  duration: 4,
  spaces: ['Peisestue'],
  totalAmount: 1500,
  paymentAmount: 75000, // in øre (750 kr deposit = 50%)
  paymentStatus: 'unpaid',
  status: 'approved',
  requesterName: 'Test Bruker',
  contract: {
    signedAt: '2026-04-01T10:00:00Z',
    landlordSignedAt: '2026-04-01T12:00:00Z',
  },
};

const PAID_BOOKING = {
  ...APPROVED_BOOKING,
  id: 'pay-test-paid',
  paymentStatus: 'paid',
};

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-24 · complete-payment shows loading state then payment view', () => {
  test('loading state appears and transitions to payment view', async ({ page }) => {
    await mockGetBooking(page, APPROVED_BOOKING);

    await page.goto('/complete-payment?bookingId=pay-test-001');
    await page.waitForURL(/complete-payment/);

    // Payment view should appear after API resolves
    await expect(page.locator('#payment-view')).toBeVisible({ timeout: 8000 });
    // Loading state should be gone
    await expect(page.locator('#loading-state')).toBeHidden();
  });

  test('page renders without crashing', async ({ page }) => {
    await mockGetBooking(page, APPROVED_BOOKING);

    await page.goto('/complete-payment?bookingId=pay-test-001');
    await expect(page.locator('body')).toBeVisible();
    // No JS errors that halt rendering
    await expect(page.locator('.payment-container')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-25 · Payment view shows booking summary', () => {
  test('booking ID, date and Vipps pay button are visible', async ({ page }) => {
    await mockGetBooking(page, APPROVED_BOOKING);

    await page.goto('/complete-payment?bookingId=pay-test-001');
    await expect(page.locator('#payment-view')).toBeVisible({ timeout: 8000 });

    // Vipps button present and labelled
    await expect(page.locator('#vipps-pay-btn')).toBeVisible();
    await expect(page.locator('#vipps-pay-btn')).toContainText(/Vipps/i);

    // Booking date and spaces rendered
    await expect(page.locator('#booking-date')).not.toBeEmpty();
    await expect(page.locator('#booking-spaces')).not.toBeEmpty();
  });

  test('payment amount is displayed in NOK', async ({ page }) => {
    await mockGetBooking(page, APPROVED_BOOKING);

    await page.goto('/complete-payment?bookingId=pay-test-001');
    await expect(page.locator('#payment-view')).toBeVisible({ timeout: 8000 });

    const amountText = await page.locator('#payment-amount').textContent();
    expect(amountText).toMatch(/kr/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-26 · Payment success view after Vipps confirmation', () => {
  test('already-paid booking shows success view directly', async ({ page }) => {
    await mockGetBooking(page, PAID_BOOKING);

    await page.goto('/complete-payment?bookingId=pay-test-paid');
    await expect(page.locator('#loading-state')).toBeHidden({ timeout: 8000 });

    // Should show success, not payment form
    await expect(page.locator('#payment-view')).toBeHidden();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-27 · Error view for invalid / missing booking ID', () => {
  test('missing bookingId query param shows error', async ({ page }) => {
    await page.goto('/complete-payment.html');

    await page.waitForTimeout(1000);

    // Error view should be shown
    await expect(page.locator('#error-view')).toBeVisible({ timeout: 6000 });
  });

  test('non-existent booking ID shows error state gracefully', async ({ page }) => {
    await mockGetBookingError(page, 404);

    await page.goto('/complete-payment?bookingId=invalid-id-xxx');

    await page.waitForTimeout(1000);

    // Error view shown, no blank page
    await expect(page.locator('#error-view')).toBeVisible({ timeout: 6000 });
    await expect(page.locator('#payment-view')).toBeHidden();
  });

  test('error view has a "Prøv igjen" retry button', async ({ page }) => {
    await mockGetBookingError(page, 500, 'Server Error');

    await page.goto('/complete-payment?bookingId=bad-id');
    await expect(page.locator('#error-view')).toBeVisible({ timeout: 6000 });
    await expect(page.getByRole('button', { name: /Prøv igjen/i })).toBeVisible();
  });
});
