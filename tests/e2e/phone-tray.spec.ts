import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { boxCenter, boxOf, gotoApp, workbench, type Box } from './helpers';

// Phones get a compact tray that opens over the bench, one place at a time.

function trayButton(page: Page) {
  return page.getByRole('button', { name: 'Open card tray' });
}

function tray(page: Page) {
  return page.getByRole('region', { name: 'Arrow card tray' });
}

function placeTab(page: Page, name: string) {
  return tray(page).getByRole('tab', { name });
}

function trayCard(page: Page, place: number, digit: number) {
  return tray(page).locator(`[data-bank-place="${place}"][data-bank-digit="${digit}"]`);
}

async function openTray(page: Page): Promise<void> {
  await trayButton(page).click();
  await expect(tray(page)).toHaveAttribute('data-state', 'open');
  await page.waitForTimeout(300);
}

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const client: CDPSession = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  await page.waitForTimeout(40);
  const steps = 16;
  for (let step = 1; step <= steps; step++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps, id: 1 },
      ],
    });
    await page.waitForTimeout(16);
  }
  return {
    release: async () => {
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(350);
    },
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test.describe('phone, upright', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the tray starts closed so the bench gets the screen', async ({ page }) => {
    await gotoApp(page);
    await expect(trayButton(page)).toBeVisible();
    await expect(tray(page)).toHaveAttribute('data-state', 'closed');
    const bench = await boxOf(workbench(page));
    expect(bench.y + bench.height).toBeGreaterThan(844 - 40);
  });

  test('the tray shows one place at a time, ones first', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);

    await expect(placeTab(page, 'Ones')).toHaveAttribute('aria-selected', 'true');
    await expect(trayCard(page, 1, 7)).toBeVisible();
    await expect(tray(page).locator('[data-bank-place="100"]')).toHaveCount(0);

    await placeTab(page, 'Hundreds').click();
    await expect(trayCard(page, 100, 3)).toBeVisible();
    await expect(tray(page).locator('[data-bank-place="1"]')).toHaveCount(0);
  });

  test('all ten ones fit without scrolling', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    for (const digit of [0, 4, 5, 9]) await expect(trayCard(page, 1, digit)).toBeInViewport();
  });

  test('a tapped card lands on the bench where the open tray does not hide it', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    await trayCard(page, 1, 7).tap();

    await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
    const placed = await boxOf(page.locator('.card-node[data-place="1"]'));
    expect(overlaps(placed, await boxOf(tray(page)))).toBe(false);
    await expect(tray(page)).toHaveAttribute('data-state', 'open');
  });

  test('the tray gets out of the way during a drag and comes back after', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    await placeTab(page, 'Tens').click();

    const start = boxCenter(await boxOf(trayCard(page, 10, 2)));
    const drag = await touchDrag(page, start, { x: 195, y: 420 });
    await expect(tray(page)).toHaveAttribute('data-state', 'hidden');
    await expect(page.locator('.drag-ghost')).toBeVisible();
    await drag.release();

    await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
    await expect(tray(page)).toHaveAttribute('data-state', 'open');
    await expect(placeTab(page, 'Tens')).toHaveAttribute('aria-selected', 'true');
  });

  test('a sideways swipe scrolls the wide cards instead of picking one up', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    await placeTab(page, 'Thousands').click();
    const strip = tray(page).locator('.phone-strip');
    const before = await strip.evaluate((element) => element.scrollLeft);

    const start = boxCenter(await boxOf(trayCard(page, 1000, 0)));
    const swipe = await touchDrag(page, start, { x: start.x - 200, y: start.y + 6 });
    await swipe.release();

    await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before + 60);
    await expect(workbench(page)).toHaveAttribute('data-card-count', '0');
  });

  test('a number can still be made and a plus added from the tray', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    await tray(page).getByRole('textbox', { name: /Number to make/ }).fill('4325');
    await tray(page).getByRole('button', { name: 'Add Stacked' }).click();
    await expect(workbench(page)).toHaveAttribute('data-card-count', '4');

    await tray(page).getByRole('button', { name: 'Add Plus' }).click();
    await expect(workbench(page)).toHaveAttribute('data-sum-count', '1');
  });

  test('the tray closes again', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    await tray(page).getByRole('button', { name: 'Close card tray' }).click();
    await expect(tray(page)).toHaveAttribute('data-state', 'closed');
    await expect(trayButton(page)).toBeVisible();
  });
});

test.describe('phone, on its side', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('the tray opens down the right-hand side, leaving the bench its full height', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    const panel = await boxOf(tray(page));
    expect(panel.x).toBeGreaterThan(844 / 2);
    expect(panel.height).toBeGreaterThan(390 / 2);
    const bench = await boxOf(workbench(page));
    expect(bench.y + bench.height).toBeGreaterThan(390 - 40);
  });

  test('a card pulled left out of the side tray lands on the bench', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    await placeTab(page, 'Hundreds').click();

    const start = boxCenter(await boxOf(trayCard(page, 100, 1)));
    const drag = await touchDrag(page, start, { x: 260, y: start.y });
    await expect(tray(page)).toHaveAttribute('data-state', 'hidden');
    await drag.release();

    await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
    await expect(tray(page)).toHaveAttribute('data-state', 'open');
  });
});

test.describe('phone, dropping where the tray comes back', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('a card dropped under the tray slides clear of it as the tray returns', async ({ page }) => {
    await gotoApp(page);
    await openTray(page);
    await placeTab(page, 'Tens').click();
    const panel = await boxOf(tray(page));

    const start = boxCenter(await boxOf(trayCard(page, 10, 1)));
    // Pull the card out to the left, then back over to where the tray sits.
    const out = { x: 300, y: 250 };
    const under = { x: panel.x + panel.width / 2, y: 250 };
    const client: CDPSession = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', point?: { x: number; y: number }) =>
      client.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
    await touch('touchStart', start);
    for (const [from, to] of [
      [start, out],
      [out, under],
    ]) {
      for (let step = 1; step <= 12; step++) {
        await touch('touchMove', { x: from.x + ((to.x - from.x) * step) / 12, y: from.y + ((to.y - from.y) * step) / 12 });
        await page.waitForTimeout(16);
      }
    }
    await expect(tray(page)).toHaveAttribute('data-state', 'hidden');
    await touch('touchEnd');
    await expect(tray(page)).toHaveAttribute('data-state', 'open');

    const placed = page.locator('.card-node[data-place="10"]');
    await expect(placed).toHaveCount(1);
    await page.waitForTimeout(600);
    expect(overlaps(await boxOf(placed), panel)).toBe(false);
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 1194, height: 834 }, hasTouch: true });

  test('keeps the full tray with every place showing', async ({ page }) => {
    await gotoApp(page);
    await expect(trayButton(page)).toHaveCount(0);
    for (const place of [1000, 100, 10, 1]) {
      await expect(page.locator(`[data-bank-place="${place}"][data-bank-digit="1"]`)).toBeVisible();
    }
  });
});
