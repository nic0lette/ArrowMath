import { expect, test, type Locator, type Page } from '@playwright/test';
import { bankCard, boxOf, cardsLayer, gotoSeeded, workbench, type SeedPiece } from './helpers';

function one(id: string, place: number, digit: number, x: number, y: number): SeedPiece {
  return { id, cards: [{ id: `${id}-c`, place, digit }], x, y };
}

function scroller(page: Page): Locator {
  return page.locator('[data-workbench-scroll]');
}

function scrollLeft(page: Page): Promise<number> {
  return scroller(page).evaluate((node) => node.scrollLeft);
}

async function setScrollLeft(page: Page, value: number): Promise<void> {
  await scroller(page).evaluate((node, value) => {
    node.scrollLeft = value;
  }, value);
  await page.waitForTimeout(50);
}

/** A piece's x in workbench coordinates, however far the bench is scrolled. */
async function canvasX(page: Page, pieceId: string): Promise<number> {
  const node = await boxOf(page.locator(`.card-node[data-piece="${pieceId}"]`).first());
  const layer = await boxOf(cardsLayer(page));
  return node.x - layer.x;
}

test.describe('scrolling the workbench', () => {
  test('an ordinary bench can be scrolled right into free space', async ({ page }) => {
    await gotoSeeded(page, [one('a', 10, 4, 300, 200)]);
    const sizes = await scroller(page).evaluate((node) => [node.scrollWidth, node.clientWidth]);
    expect(sizes[0]).toBeGreaterThanOrEqual(sizes[1] * 2 - 1);
    await setScrollLeft(page, 500);
    expect(await scrollLeft(page)).toBe(500);
  });

  test('a mouse wheel scrolls the bench sideways', async ({ page }) => {
    await gotoSeeded(page, [one('a', 10, 4, 300, 200)]);
    const view = await boxOf(scroller(page));
    await page.mouse.move(view.x + view.width / 2, view.y + view.height - 80);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(100);
    const right = await scrollLeft(page);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => scrollLeft(page)).toBeLessThan(right);
  });

  test('a number beyond the right edge stays put and can be scrolled to', async ({ page }) => {
    await gotoSeeded(page, [one('far', 10, 3, 2200, 200)]);
    await page.waitForTimeout(300);
    expect(await canvasX(page, 'far')).toBeCloseTo(2200, 0);

    const view = await boxOf(scroller(page));
    const card = page.locator('.card-node[data-piece="far"]');
    expect((await boxOf(card)).x).toBeGreaterThan(view.x + view.width);

    await setScrollLeft(page, 1800);
    expect(await scrollLeft(page)).toBe(1800);
    const box = await boxOf(card);
    expect(box.x).toBeGreaterThan(view.x);
    expect(box.x + box.width).toBeLessThan(view.x + view.width);
  });

  test('dragging a card against the right edge scrolls the bench along', async ({ page }) => {
    await gotoSeeded(page, [one('a', 1, 4, 400, 200)]);
    const view = await boxOf(scroller(page));
    const card = await boxOf(page.locator('.card-node[data-piece="a"]'));
    const start = { x: card.x + card.width / 2, y: card.y + card.height / 2 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 10, start.y, { steps: 3 });
    await page.mouse.move(view.x + view.width - 8, start.y, { steps: 20 });
    await expect.poll(() => scrollLeft(page), { timeout: 4000 }).toBeGreaterThan(300);
    await page.mouse.up();

    // The card went along with the pointer, past the first screenful, and
    // the bench reaches past it so all of it can be scrolled into view.
    const x = await canvasX(page, 'a');
    expect(x).toBeGreaterThan(view.width);
    const width = await scroller(page).evaluate((node) => node.scrollWidth);
    expect(width).toBeGreaterThan(x + 86);
  });

  test('a drag while scrolled lands exactly where it was dropped', async ({ page }) => {
    // On the 24px grid, so grid snapping leaves the drop alone.
    await gotoSeeded(page, [one('a', 1, 4, 1488, 192), one('far', 10, 3, 2600, 400)]);
    await setScrollLeft(page, 1200);
    const node = page.locator('.card-node[data-piece="a"]');
    const before = await boxOf(node);
    const start = { x: before.x + before.width / 2, y: before.y + before.height / 2 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 10, start.y + 10, { steps: 3 });
    await page.mouse.move(start.x - 96, start.y + 72, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const after = await boxOf(node);
    expect(after.x - before.x).toBeCloseTo(-96, -1);
    expect(after.y - before.y).toBeCloseTo(72, -1);
    expect(await scrollLeft(page)).toBe(1200);
  });

  test('a card tapped in from the tray appears in the part of the bench in view', async ({ page }) => {
    await gotoSeeded(page, [one('far', 10, 3, 2600, 200)]);
    await setScrollLeft(page, 2000);
    await page.keyboard.press('Escape');

    const bank = bankCard(page, 1, 7);
    await bank.scrollIntoViewIfNeeded();
    await bank.click();
    await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');

    const view = await boxOf(scroller(page));
    const added = await boxOf(page.locator('.card-node[data-place="1"][data-digit="7"]'));
    expect(added.x).toBeGreaterThan(view.x);
    expect(added.x + added.width).toBeLessThan(view.x + view.width);
  });

  test('a tray card dropped on a scrolled bench lands under the pointer', async ({ page }) => {
    await gotoSeeded(page, [one('far', 10, 3, 2600, 200)]);
    await setScrollLeft(page, 2000);

    const view = await boxOf(scroller(page));
    const target = { x: view.x + 300, y: view.y + 200 };
    const bank = bankCard(page, 1, 7);
    await bank.scrollIntoViewIfNeeded();
    const from = await boxOf(bank);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y - 20, { steps: 4 });
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const added = await boxOf(page.locator('.card-node[data-place="1"][data-digit="7"]'));
    expect(Math.abs(added.x + added.width / 2 - target.x)).toBeLessThan(30);
    expect(Math.abs(added.y + added.height / 2 - target.y)).toBeLessThan(30);
  });

  test('dragging the empty bench pans it sideways', async ({ page }) => {
    await gotoSeeded(page, [one('far', 10, 3, 2600, 200)]);
    const view = await boxOf(scroller(page));
    const start = { x: view.x + view.width - 200, y: view.y + view.height - 60 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 400, start.y, { steps: 12 });
    await page.mouse.up();
    expect(await scrollLeft(page)).toBeCloseTo(400, -1);

    // A plain click on the bench still just clears the selection.
    await page.mouse.click(start.x, start.y);
    expect(await scrollLeft(page)).toBeCloseTo(400, -1);
  });
});
