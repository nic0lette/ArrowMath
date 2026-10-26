import { expect, test, type Page } from '@playwright/test';
import {
  beginBankDrag,
  boxCenter,
  boxOf,
  card,
  dragCardBy,
  gotoLesson,
  selectPieceOf,
  workbench,
  type SeedBoard,
} from './helpers';

const lesson: SeedBoard[] = [
  {
    id: 'warm-up',
    name: 'Warm-up',
    pieces: [{ id: 'w', cards: [{ id: 'w1', place: 100, digit: 3 }], x: 120, y: 120 }],
  },
  {
    id: 'carrying',
    name: 'Carrying',
    pieces: [
      { id: 'c', cards: [{ id: 'c1', place: 10, digit: 7 }], x: 120, y: 120 },
      { id: 'd', cards: [{ id: 'd1', place: 1, digit: 8 }], x: 360, y: 120 },
    ],
  },
  { id: 'empty', name: 'Empty', pieces: [] },
];

async function expectBoard(page: Page, id: string, pieceCount: number): Promise<void> {
  await expect(workbench(page)).toHaveAttribute('data-board-id', id);
  await expect(workbench(page)).toHaveAttribute('data-piece-count', String(pieceCount));
}

test('Page Down and Page Up step through the boards and stop at either end', async ({ page }) => {
  await gotoLesson(page, lesson);
  await expectBoard(page, 'warm-up', 1);
  await expect(card(page, 100, 3)).toBeVisible();

  await page.keyboard.press('PageDown');
  await expectBoard(page, 'carrying', 2);
  await expect(card(page, 10, 7)).toBeVisible();
  await expect(card(page, 100, 3)).toHaveCount(0);

  await page.keyboard.press('PageDown');
  await expectBoard(page, 'empty', 0);
  await page.keyboard.press('PageDown');
  await expectBoard(page, 'empty', 0);

  await page.keyboard.press('PageUp');
  await page.keyboard.press('PageUp');
  await expectBoard(page, 'warm-up', 1);
  await page.keyboard.press('PageUp');
  await expectBoard(page, 'warm-up', 1);
});

test('each board keeps its own changes, and the open board survives a reload', async ({ page }) => {
  await gotoLesson(page, lesson);
  const before = await boxOf(card(page, 100, 3));
  await dragCardBy(page, card(page, 100, 3), 96, 48);
  const moved = await boxOf(card(page, 100, 3));
  expect(moved.x - before.x).toBeGreaterThan(48);

  await page.keyboard.press('PageDown');
  await expectBoard(page, 'carrying', 2);
  await selectPieceOf(page, card(page, 1, 8));
  await page.keyboard.press('Delete');
  await expectBoard(page, 'carrying', 1);

  await page.keyboard.press('PageUp');
  await expectBoard(page, 'warm-up', 1);
  const back = await boxOf(card(page, 100, 3));
  expect(Math.abs(back.x - moved.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(back.y - moved.y)).toBeLessThanOrEqual(2);

  await page.keyboard.press('PageDown');
  await page.waitForTimeout(600);
  await page.reload();
  await expectBoard(page, 'carrying', 1);
  await expect(card(page, 1, 8)).toHaveCount(0);
});

test('switching boards drops the selection and an Undo meant for the old board', async ({ page }) => {
  await gotoLesson(page, lesson);
  await selectPieceOf(page, card(page, 100, 3));
  await expect(page.locator('.piece-chrome')).toHaveCount(1);

  await page.keyboard.press('PageDown');
  await expectBoard(page, 'carrying', 2);
  await expect(page.locator('.piece-chrome')).toHaveCount(0);

  // A teacher clears a board, then moves on: the Undo must not pour that
  // board's cards onto the next one.
  await page.getByRole('button', { name: 'Reset canvas' }).click();
  await expectBoard(page, 'carrying', 0);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

  // Focus is still on the toolbar button, as it would be in class.
  await page.keyboard.press('PageDown');
  await expectBoard(page, 'empty', 0);
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  await page.keyboard.press('PageUp');
  await expectBoard(page, 'carrying', 0);
});

test('switching boards mid-drag drops the dragged card instead of carrying it over', async ({ page }) => {
  await gotoLesson(page, lesson);

  // A card on the board being dragged...
  const center = boxCenter(await boxOf(card(page, 100, 3)));
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 80, center.y + 40, { steps: 6 });
  await page.keyboard.press('PageDown');
  await page.mouse.up();
  await expectBoard(page, 'carrying', 2);
  await expect(card(page, 100, 3)).toHaveCount(0);

  // ...and a card on its way in from the tray.
  await beginBankDrag(page, 1000, 5);
  await page.keyboard.press('PageUp');
  await page.mouse.move(center.x, center.y + 160, { steps: 4 });
  await page.mouse.up();
  await expectBoard(page, 'warm-up', 1);
  await expect(card(page, 1000, 5)).toHaveCount(0);
});

test('Page Down while typing in a text field does not change board', async ({ page }) => {
  await gotoLesson(page, lesson);
  const input = page.getByPlaceholder('4325');
  await input.click();
  await input.press('PageDown');
  await expectBoard(page, 'warm-up', 1);
});
