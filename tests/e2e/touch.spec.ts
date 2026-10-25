import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { addStacked, bankCard, gotoApp, workbench } from './helpers';

// Run these on a touch-capable viewport so `(pointer: coarse)` and the touch
// pointer path are exercised, like a classroom tablet.
test.use({ hasTouch: true, viewport: { width: 1194, height: 834 } });

const clients = new WeakMap<Page, CDPSession>();

async function touchStart(page: Page, x: number, y: number): Promise<void> {
  let client = clients.get(page);
  if (!client) {
    client = await page.context().newCDPSession(page);
    clients.set(page, client);
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
}

async function touchMove(page: Page, x: number, y: number): Promise<void> {
  const client = clients.get(page);
  if (!client) throw new Error('Touch gesture has not started');
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y, id: 1 }],
  });
}

async function touchEnd(page: Page): Promise<void> {
  const client = clients.get(page);
  if (!client) throw new Error('Touch gesture has not started');
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

async function touchDrag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  options: { steps?: number; verticalFirst?: boolean } = {},
): Promise<void> {
  const steps = options.steps ?? 14;
  await touchStart(page, from.x, from.y);
  await page.waitForTimeout(40);

  let startX = from.x;
  let startY = from.y;
  if (options.verticalFirst) {
    startY -= 18;
    await touchMove(page, startX, startY);
    await page.waitForTimeout(20);
  }

  for (let step = 1; step <= steps; step++) {
    await touchMove(
      page,
      startX + ((to.x - startX) * step) / steps,
      startY + ((to.y - startY) * step) / steps,
    );
    await page.waitForTimeout(14);
  }

  await page.waitForTimeout(60);
  await touchEnd(page);
  await page.waitForTimeout(300);
}

async function touchTap(page: Page, x: number, y: number): Promise<void> {
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(200);
}

test('a horizontal swipe scrolls the card tray without adding a card', async ({ page }) => {
  await gotoApp(page);

  const strip = page.locator('.bank-strip').first();
  const before = await strip.evaluate((element) => element.scrollLeft);

  const card = bankCard(page, 1000, 3);
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error('Bank card has no box');

  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // A real swipe drifts a little vertically; it should still pan the row.
  await touchDrag(page, start, { x: start.x - 260, y: start.y + 10 });

  await expect.poll(() => strip.evaluate((element) => element.scrollLeft)).toBeGreaterThan(before + 60);
  await expect(workbench(page)).toHaveAttribute('data-card-count', '0');
  await expect(page.locator('.drag-ghost')).toHaveCount(0);
});

test('a diagonal pull from every tray row still reaches the workbench', async ({ page }) => {
  await gotoApp(page);

  const bench = await workbench(page).boundingBox();
  if (!bench) throw new Error('Workbench has no box');

  const drops = [
    { place: 1000, x: 0.2, y: 150 },
    { place: 100, x: 0.55, y: 150 },
    { place: 10, x: 0.3, y: 330 },
    { place: 1, x: 0.7, y: 330 },
  ] as const;

  for (const [index, drop] of drops.entries()) {
    // Digit 3 is the fourth card in each row (after 0), so it starts in view
    // without the strip having to scroll first.
    const card = bankCard(page, drop.place, 3);
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    if (!box) throw new Error(`Bank card ${drop.place} has no box`);

    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // Pull towards the far side of the bench: a large sideways component must
    // not be mistaken for a tray scroll.
    await touchDrag(page, start, {
      x: bench.x + bench.width * drop.x,
      y: bench.y + drop.y,
    });

    await expect(workbench(page)).toHaveAttribute('data-card-count', String(index + 1));
  }

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '4');
});

test('the front of a stack can be grabbed just beyond the arrow tip', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);
  await page.waitForTimeout(300);

  const top = page.locator('.card-node[data-place="1"][data-digit="5"]');
  const box = await top.boundingBox();
  if (!box) throw new Error('Card has no box');

  // Start past the SVG's shadow filter (which is not reliably hit-testable on
  // every browser), but inside the added front grab area.
  const start = { x: box.x + box.width + 18, y: box.y + box.height / 2 };
  await touchDrag(page, start, { x: start.x - 120, y: start.y + 70 });

  const after = await top.boundingBox();
  if (!after) throw new Error('Card vanished');
  expect(Math.hypot(after.x - box.x, after.y - box.y)).toBeGreaterThan(40);
  await expect(workbench(page)).toHaveAttribute('data-card-count', '4');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
});

test('lifting a finger leaves no hover aim state behind', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);
  await page.waitForTimeout(300);

  const ones = page.locator('.card-node[data-place="1"][data-digit="5"]');
  const box = await ones.boundingBox();
  if (!box) throw new Error('Card has no box');

  // A tap commits the selection, then the lifted touch used to re-check the
  // element under the finger and leave a peel/group lift stuck on.
  await touchTap(page, box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('.peel-lift')).toHaveCount(0);
  await expect(page.locator('.move-intent')).toHaveCount(0);
  await expect(workbench(page)).toHaveAttribute('data-card-count', '4');
});

test('tapping the workbench blurs the number field and closes its keyboard', async ({ page }) => {
  await gotoApp(page);

  const input = page.locator('#make-number');
  await input.tap();
  await expect(input).toBeFocused();

  const bench = await workbench(page).boundingBox();
  if (!bench) throw new Error('Workbench has no box');
  await page.touchscreen.tap(bench.x + bench.width / 2, bench.y + bench.height / 2);

  await expect(input).not.toBeFocused();
});

test('tapping empty canvas dismisses a touch-selected card toolbar', async ({ page }) => {
  await gotoApp(page);

  const card = bankCard(page, 1, 9);
  await card.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error('Bank card has no box');

  await touchTap(page, cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
  await expect(page.locator('.piece-chrome')).toHaveCount(1);

  const bench = await workbench(page).boundingBox();
  if (!bench) throw new Error('Workbench has no box');
  await touchTap(page, bench.x + bench.width / 2, bench.y + bench.height - 40);

  await expect(page.locator('.piece-chrome')).toHaveCount(0);
});
