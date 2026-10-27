import { expect, test, type CDPSession, type Page } from '@playwright/test';
import {
  bankCard,
  boxCenter,
  boxOf,
  card,
  dragCardBy,
  dragCardFromPoint,
  gotoApp,
  gotoSeeded,
  pieceIdFor,
  workbench,
  type SeedPiece,
} from './helpers';

const noSnap = { snapToGrid: false };

const hundreds: SeedPiece[] = [
  { id: 'h', cards: [{ id: 'h1', place: 100, digit: 3 }], x: 120, y: 140 },
];

const stack: SeedPiece[] = [
  {
    id: 's',
    cards: [
      { id: 's1', place: 100, digit: 3 },
      { id: 's2', place: 10, digit: 2 },
      { id: 's3', place: 1, digit: 5 },
    ],
    x: 120,
    y: 140,
  },
];

function zoomLabel(page: Page) {
  return page.getByRole('button', { name: 'Reset zoom' });
}

async function zoomTo(page: Page, percent: number): Promise<void> {
  const current = Number((await zoomLabel(page).textContent())?.replace('%', ''));
  const button = page.getByRole('button', { name: percent < current ? 'Zoom out' : 'Zoom in' });
  for (let step = 0; step < Math.round(Math.abs(current - percent) / 10); step++) await button.click();
  await expect(zoomLabel(page)).toHaveText(`${percent}%`);
  await page.waitForTimeout(100);
}

async function cardHeight(page: Page): Promise<number> {
  return (await boxOf(card(page, 100, 3))).height;
}

test('the − and + buttons shrink and grow everything on the bench together', async ({ page }) => {
  await gotoSeeded(page, hundreds, noSnap);
  await expect(zoomLabel(page)).toHaveText('100%');
  const full = await cardHeight(page);

  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(zoomLabel(page)).toHaveText('90%');
  await expect.poll(() => cardHeight(page)).toBeCloseTo(full * 0.9, 0);

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(zoomLabel(page)).toHaveText('110%');
  await expect.poll(() => cardHeight(page)).toBeCloseTo(full * 1.1, 0);

  await zoomLabel(page).click();
  await expect(zoomLabel(page)).toHaveText('100%');
  await expect.poll(() => cardHeight(page)).toBeCloseTo(full, 0);
});

test('zoom stops at 60% so cards stay big enough to grab', async ({ page }) => {
  await gotoSeeded(page, hundreds, noSnap);
  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  for (let step = 0; step < 4; step++) await zoomOut.click();
  await expect(zoomLabel(page)).toHaveText('60%');
  await expect(zoomOut).toBeDisabled();
  await zoomOut.click({ force: true });
  await expect(zoomLabel(page)).toHaveText('60%');
});

test('a zoomed-out card still follows the pointer exactly', async ({ page }) => {
  await gotoSeeded(page, hundreds, noSnap);
  await zoomTo(page, 70);
  const before = await boxOf(card(page, 100, 3));

  await dragCardBy(page, card(page, 100, 3), 150, 90);
  await page.waitForTimeout(400);

  const after = await boxOf(card(page, 100, 3));
  expect(after.x - before.x).toBeCloseTo(150, -1);
  expect(after.y - before.y).toBeCloseTo(90, -1);
});

test('a tray card dropped on a zoomed-out bench lands under the pointer', async ({ page }) => {
  await gotoApp(page);
  await zoomTo(page, 70);

  const tray = boxCenter(await boxOf(bankCard(page, 10, 4)));
  const bench = await boxOf(workbench(page));
  const target = { x: bench.x + bench.width / 2, y: bench.y + bench.height / 2 };
  await page.mouse.move(tray.x, tray.y);
  await page.mouse.down();
  await page.mouse.move(tray.x + 20, tray.y - 20, { steps: 4 });
  await page.mouse.move(target.x, target.y, { steps: 14 });
  await expect(page.locator('.drag-ghost')).toBeVisible();
  await page.mouse.up();
  await page.waitForTimeout(400);

  const dropped = boxCenter(await boxOf(card(page, 10, 4)));
  expect(Math.abs(dropped.x - target.x)).toBeLessThan(30);
  expect(Math.abs(dropped.y - target.y)).toBeLessThan(30);
});

test('the digit end still pulls one card out of a stack when zoomed out', async ({ page }) => {
  await gotoSeeded(page, stack, noSnap);
  await zoomTo(page, 60);
  const groupId = await pieceIdFor(card(page, 1, 5));

  // 12px into the hundreds card is inside its digit end at any zoom.
  await dragCardFromPoint(page, card(page, 100, 3), 12, 20, 160, 110);

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');
  expect(await pieceIdFor(card(page, 100, 3))).not.toBe(groupId);
});

test('the zoom is remembered on this device', async ({ page }) => {
  await gotoSeeded(page, hundreds, noSnap);
  await zoomTo(page, 80);
  await page.reload();
  await expect(zoomLabel(page)).toHaveText('80%');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the bench starts at 75%', async ({ page }) => {
    await gotoApp(page);
    // Phones keep the zoom buttons in the menu.
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(zoomLabel(page)).toHaveText('75%');
  });
});

test.describe('pinching', () => {
  test.use({ hasTouch: true, viewport: { width: 1194, height: 834 } });

  async function pinch(page: Page, from: number, to: number): Promise<void> {
    const client: CDPSession = await page.context().newCDPSession(page);
    const bench = await boxOf(workbench(page));
    const center = { x: bench.x + bench.width / 2, y: bench.y + bench.height / 2 };
    const points = (gap: number) => [
      { x: center.x - gap / 2, y: center.y, id: 1 },
      { x: center.x + gap / 2, y: center.y, id: 2 },
    ];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
    const steps = 12;
    for (let step = 1; step <= steps; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points(from + ((to - from) * step) / steps),
      });
      await page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
  }

  async function zoomPercent(page: Page): Promise<number> {
    return Number((await zoomLabel(page).textContent())?.replace('%', ''));
  }

  test('pinching the bench in and out zooms it', async ({ page }) => {
    await gotoSeeded(page, hundreds, noSnap);

    await pinch(page, 300, 200);
    const smaller = await zoomPercent(page);
    expect(smaller).toBeLessThan(75);
    expect(smaller).toBeGreaterThan(60);
    await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');

    await pinch(page, 200, 300);
    expect(await zoomPercent(page)).toBeGreaterThan(smaller + 20);
  });

  test('a trackpad pinch (Ctrl + wheel) zooms the bench, not the page', async ({ page }) => {
    await gotoSeeded(page, hundreds, noSnap);
    const bench = boxCenter(await boxOf(workbench(page)));
    await page.mouse.move(bench.x, bench.y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 40);
    await page.keyboard.up('Control');
    await expect.poll(() => zoomPercent(page)).toBeLessThan(100);
  });
});
