import { expect, test, type Locator, type Page } from '@playwright/test';
import { bankCard, boxOf, gotoSeeded, workbench, type Box, type SeedPiece } from './helpers';

function stack(id: string, value: number, x: number, y: number): SeedPiece {
  const cards = [1000, 100, 10, 1]
    .map((place) => ({ id: `${id}-${place}`, place, digit: Math.floor(value / place) % 10 }))
    .filter((entry) => entry.digit > 0);
  return { id, cards, x, y };
}

function plus(page: Page): Locator {
  return page.locator('[data-sum-handle]');
}

function sum(page: Page): Locator {
  return page.locator('.sum-overlay');
}

async function pieceBox(page: Page, pieceId: string): Promise<Box> {
  const boxes = await Promise.all(
    (await page.locator(`.card-node[data-piece="${pieceId}"]`).all()).map((node) => boxOf(node)),
  );
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  return { x: left, y: top, width: right - left, height: 68 };
}

/** Drags a whole piece by the arrow tip of its front card. */
async function dragPieceBy(page: Page, pieceId: string, dx: number, dy: number): Promise<void> {
  const front = page.locator(`.card-node[data-piece="${pieceId}"]`).last();
  const box = await boxOf(front);
  const start = { x: box.x + box.width - 14, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 7, start.y + 7, { steps: 3 });
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 14 });
  await page.waitForTimeout(120);
  await page.mouse.up();
}

async function dropIntoSlot(page: Page, pieceId: string, side: 'left' | 'right'): Promise<void> {
  const slot = await boxOf(page.locator(`.sum-slot[data-slot="${side}"]`));
  const piece = await pieceBox(page, pieceId);
  const dx = side === 'left' ? slot.x + slot.width - (piece.x + piece.width) : slot.x - piece.x;
  await dragPieceBy(page, pieceId, dx, slot.y - piece.y);
  await expect(sum(page)).toHaveAttribute(`data-${side}`, pieceId);
}

async function addPlus(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add Plus' }).click();
  await expect(workbench(page)).toHaveAttribute('data-sum-count', '1');
}

test.describe('addition', () => {
  test('two numbers on a plus show one row per place, ones at the bottom', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 1234, 40, 40), stack('b', 5678, 900, 40)]);
    await addPlus(page);

    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');

    const rows = page.locator('.sum-row');
    await expect(rows).toHaveCount(4);
    const order = await rows.evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          place: Number(node.getAttribute('data-row-place')),
          top: node.querySelector('.mini-card')!.getBoundingClientRect().top,
          digits: [...node.querySelectorAll('.mini-card')].map((card) => card.getAttribute('data-digit')),
        }))
        .sort((a, b) => b.top - a.top),
    );
    expect(order.map((row) => [row.place, ...row.digits])).toEqual([
      [1, '4', '8'],
      [10, '3', '7'],
      [100, '2', '6'],
      [1000, '1', '5'],
    ]);

    // The numbers sit snug either side of the plus.
    const plusBox = await boxOf(plus(page));
    const left = await pieceBox(page, 'a');
    const right = await pieceBox(page, 'b');
    expect(plusBox.x - (left.x + left.width)).toBeGreaterThan(4);
    expect(plusBox.x - (left.x + left.width)).toBeLessThan(24);
    expect(right.x - (plusBox.x + plusBox.width)).toBeGreaterThan(4);
    expect(right.x - (plusBox.x + plusBox.width)).toBeLessThan(24);
  });

  test('row cards end at their number\'s arrow tip and every = shares a column', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 127, 40, 40), stack('b', 5, 900, 40)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');
    await page.waitForTimeout(500);

    const tip = (box: Box) => box.x + box.width;
    const left = await pieceBox(page, 'a');
    const right = await pieceBox(page, 'b');
    for (const node of await page.locator('.mini-card[data-part="left"]').all()) {
      expect(tip(await boxOf(node))).toBeCloseTo(tip(left), 0);
    }
    for (const node of await page.locator('.mini-card[data-part="right"]').all()) {
      expect(tip(await boxOf(node))).toBeCloseTo(tip(right), 0);
    }

    const centers = await page
      .locator('.row-equals, .total-equals')
      .evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return box.left + box.width / 2;
      }));
    expect(centers).toHaveLength(4);
    for (const center of centers) expect(center).toBeCloseTo(centers[0], 0);
  });

  test('= shows the column answer, with a carry as a stacked ten', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 4, 40, 40), stack('b', 8, 900, 40)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');

    const row = page.locator('.sum-row[data-row-place="1"]');
    await expect(row.locator('[data-result]')).toHaveCount(0);
    await row.getByRole('button', { name: 'Show 4 + 8' }).click();

    const results = row.locator('[data-result]');
    await expect(results).toHaveCount(2);
    expect(
      await results.evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute('data-place'), node.getAttribute('data-digit')]),
      ),
    ).toEqual([
      ['10', '1'],
      ['1', '2'],
    ]);

    // Stacked: the 2 sits on the right-hand end of the 10.
    const ten = await boxOf(results.nth(0));
    const two = await boxOf(results.nth(1));
    expect(Math.abs(ten.x + ten.width - (two.x + two.width))).toBeLessThan(1);

    await row.getByRole('button', { name: 'Hide 4 + 8' }).click();
    await expect(results).toHaveCount(0);
  });

  test('the = beside the numbers shows the total as full-size cards', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 127, 40, 40), stack('b', 2385, 900, 40)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');

    const total = page.locator('.sum-total');
    await expect(total).toHaveCount(0);
    await page.getByRole('button', { name: 'Show 127 + 2,385' }).click();

    const cards = total.locator('[data-total-card]');
    expect(
      await cards.evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute('data-place'), node.getAttribute('data-digit')]),
      ),
    ).toEqual([
      ['1000', '2'],
      ['100', '5'],
      ['10', '1'],
      ['1', '2'],
    ]);
    // Full size, and the ones answer above ends at the same tip.
    const thousands = await boxOf(cards.first());
    expect(thousands.height).toBeCloseTo(68, 0);
    await page.locator('.sum-row[data-row-place="1"]').getByRole('button', { name: 'Show 7 + 5' }).click();
    const onesAnswer = await boxOf(page.locator('.sum-row[data-row-place="1"] [data-result]').last());
    expect(onesAnswer.x + onesAnswer.width).toBeCloseTo(thousands.x + thousands.width, 0);

    await page.getByRole('button', { name: 'Hide 127 + 2,385' }).click();
    await expect(total).toHaveCount(0);
  });

  test('the place rows collapse and expand, keeping their answers', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 12, 40, 40), stack('b', 34, 900, 40)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');
    await page.locator('.sum-row[data-row-place="1"]').getByRole('button', { name: 'Show 2 + 4' }).click();

    await page.getByRole('button', { name: 'Hide the place rows' }).click();
    await expect(page.locator('.sum-row')).toHaveCount(0);
    await expect(page.locator('.total-equals')).toBeVisible();

    await page.getByRole('button', { name: 'Show the place rows' }).click();
    await expect(page.locator('.sum-row')).toHaveCount(2);
    await expect(page.locator('.sum-row[data-row-place="1"] [data-result]')).toHaveCount(1);

    // Double-clicking the plus toggles the same way.
    await plus(page).dblclick();
    await expect(page.locator('.sum-row')).toHaveCount(0);
    await plus(page).dblclick();
    await expect(page.locator('.sum-row')).toHaveCount(2);
  });

  /** Drags from the middle of `from` to an empty spot well above the sum. */
  async function dragOut(page: Page, from: Locator, dx: number, dy: number): Promise<void> {
    const box = await boxOf(from);
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 8, start.y - 8, { steps: 3 });
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 14 });
    await page.mouse.up();
  }

  async function digitsOf(page: Page, pieceId: string): Promise<string[][]> {
    return page
      .locator(`.card-node[data-piece="${pieceId}"]`)
      .evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute('data-place')!, node.getAttribute('data-digit')!]),
      );
  }

  test('dragging a column answer pulls out a full-size copy', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 4, 400, 520), stack('b', 8, 900, 520)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');
    const row = page.locator('.sum-row[data-row-place="1"]');
    await row.getByRole('button', { name: 'Show 4 + 8' }).click();

    await dragOut(page, row.locator('[data-result]').last(), 0, -260);

    await expect(workbench(page)).toHaveAttribute('data-piece-count', '3');
    const copyId = (await page.locator('.card-node').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-piece')).find((id) => id !== 'a' && id !== 'b'),
    ))!;
    expect(await digitsOf(page, copyId)).toEqual([
      ['10', '1'],
      ['1', '2'],
    ]);
    expect((await boxOf(page.locator(`.card-node[data-piece="${copyId}"]`).first())).height).toBeCloseTo(68, 0);
    // The answer stays where it was.
    await expect(row.locator('[data-result]')).toHaveCount(2);
  });

  test('dragging the total pulls out a copy of the whole number', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 127, 300, 560), stack('b', 2385, 900, 560)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');
    await page.getByRole('button', { name: 'Hide the place rows' }).click();
    await page.getByRole('button', { name: 'Show 127 + 2,385' }).click();

    await dragOut(page, page.locator('[data-total-card]').first(), -40, -320);

    await expect(workbench(page)).toHaveAttribute('data-piece-count', '3');
    await expect(workbench(page)).toHaveAttribute('data-card-count', '11');
  });

  test('tapping an answer does not add a copy', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 4, 400, 520), stack('b', 8, 900, 520)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');
    const row = page.locator('.sum-row[data-row-place="1"]');
    await row.getByRole('button', { name: 'Show 4 + 8' }).click();
    await row.locator('[data-result]').last().click();
    await page.waitForTimeout(200);
    await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');
  });

  test('a place one number leaves out shows as a zero card', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 123, 40, 40), stack('b', 205, 900, 40)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');

    const tens = page.locator('.sum-row[data-row-place="10"] .mini-card');
    expect(await tens.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-digit')))).toEqual([
      '2',
      '0',
    ]);
  });

  test('dragging the plus carries both numbers; pulling a number away unhooks it', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 12, 40, 40), stack('b', 34, 900, 40)]);
    await addPlus(page);
    await dropIntoSlot(page, 'a', 'left');
    await dropIntoSlot(page, 'b', 'right');

    const beforePlus = await boxOf(plus(page));
    const beforeLeft = await pieceBox(page, 'a');
    const start = { x: beforePlus.x + beforePlus.width / 2, y: beforePlus.y + beforePlus.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 60, start.y + 40, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const afterPlus = await boxOf(plus(page));
    const afterLeft = await pieceBox(page, 'a');
    const plusMove = { x: afterPlus.x - beforePlus.x, y: afterPlus.y - beforePlus.y };
    expect(Math.abs(plusMove.x) + Math.abs(plusMove.y)).toBeGreaterThan(30);
    expect(afterLeft.x - beforeLeft.x).toBeCloseTo(plusMove.x, 0);
    expect(afterLeft.y - beforeLeft.y).toBeCloseTo(plusMove.y, 0);

    await dragPieceBy(page, 'b', 300, -220);
    await expect(sum(page)).toHaveAttribute('data-right', '');
    await expect(page.locator('.sum-row')).toHaveCount(0);
    await expect(page.locator('.sum-slot[data-slot="right"]')).toBeVisible();
  });

  /** Drags the plus so the given empty side's slot lands on the piece. */
  async function dragPlusOnto(page: Page, side: 'left' | 'right', pieceId: string): Promise<void> {
    const slot = await boxOf(page.locator(`.sum-slot[data-slot="${side}"]`));
    const target = await pieceBox(page, pieceId);
    const dx = side === 'left' ? target.x + target.width - (slot.x + slot.width) : target.x - slot.x;
    const dy = target.y - slot.y;
    const handle = await boxOf(plus(page));
    const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 16 });
    await expect(page.locator(`.sum-slot[data-slot="${side}"]`)).toHaveClass(/aimed/);
    await page.mouse.up();
  }

  test('dragging the plus onto numbers puts them on either side', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 31, 160, 420), stack('b', 205, 760, 220)]);
    await addPlus(page);

    await dragPlusOnto(page, 'right', 'b');
    await expect(sum(page)).toHaveAttribute('data-right', 'b');

    await dragPlusOnto(page, 'left', 'a');
    await expect(sum(page)).toHaveAttribute('data-left', 'a');
    await expect(page.locator('.sum-row')).toHaveCount(3);
  });

  test('a card dropped from the tray attaches to an empty side', async ({ page }) => {
    await gotoSeeded(page, [stack('a', 3, 40, 40)]);
    await addPlus(page);

    const slot = await boxOf(page.locator('.sum-slot[data-slot="right"]'));
    const bank = bankCard(page, 1, 0);
    await bank.scrollIntoViewIfNeeded();
    const from = await boxOf(bank);
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y - 20, { steps: 4 });
    await page.mouse.move(slot.x + 43, slot.y + 34, { steps: 12 });
    await page.mouse.up();

    const rightId = await sum(page).getAttribute('data-right');
    expect(rightId).toBeTruthy();
    await expect(page.locator(`.card-node[data-piece="${rightId}"]`)).toHaveAttribute('data-digit', '0');
  });
});
