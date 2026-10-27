import { expect, test, type Page } from '@playwright/test';
import {
  addBankCard,
  beginBankDrag,
  boxCenter,
  boxOf,
  card,
  dragCardBy,
  gotoApp,
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
  // Let the board finish sliding in before anything measures its cards.
  await page
    .locator('.board-layer')
    .evaluate((layer) => Promise.all(layer.getAnimations().map((animation) => animation.finished)));
}

function boardNav(page: Page) {
  return page.getByRole('navigation', { name: 'Boards' });
}

function boardButton(page: Page, name: string) {
  return boardNav(page).getByRole('button', { name, exact: true });
}

async function boardNames(page: Page): Promise<string[]> {
  return boardNav(page).locator('.board-tab').allTextContents().then((names) => names.map((name) => name.trim()));
}

async function openBoardMenu(page: Page): Promise<void> {
  await boardNav(page).getByRole('button', { name: 'Board options' }).click();
  await expect(page.getByRole('menu', { name: 'Board options' })).toBeVisible();
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

test('the board buttons show each board by name and open it', async ({ page }) => {
  await gotoLesson(page, lesson);
  expect(await boardNames(page)).toEqual(['Warm-up', 'Carrying', 'Empty']);
  await expect(boardButton(page, 'Warm-up')).toHaveAttribute('aria-current', 'true');

  await boardButton(page, 'Carrying').click();
  await expectBoard(page, 'carrying', 2);
  await expect(boardButton(page, 'Carrying')).toHaveAttribute('aria-current', 'true');
  await expect(boardButton(page, 'Warm-up')).not.toHaveAttribute('aria-current', 'true');
});

test('the arrow buttons step between boards and stop at either end', async ({ page }) => {
  await gotoLesson(page, lesson);
  const previous = boardNav(page).getByRole('button', { name: 'Previous board' });
  const next = boardNav(page).getByRole('button', { name: 'Next board' });
  await expect(previous).toBeDisabled();

  await next.click();
  await expectBoard(page, 'carrying', 2);
  await next.click();
  await expectBoard(page, 'empty', 0);
  await expect(next).toBeDisabled();

  await previous.click();
  await expectBoard(page, 'carrying', 2);
});

test('adding a board opens a new empty board after the current one', async ({ page }) => {
  await gotoLesson(page, lesson);
  await boardNav(page).getByRole('button', { name: 'Add board' }).click();

  expect(await boardNames(page)).toEqual(['Warm-up', 'Board 4', 'Carrying', 'Empty']);
  await expect(boardButton(page, 'Board 4')).toHaveAttribute('aria-current', 'true');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '0');

  await page.waitForTimeout(600);
  await page.reload();
  expect(await boardNames(page)).toEqual(['Warm-up', 'Board 4', 'Carrying', 'Empty']);
  await expect(boardButton(page, 'Board 4')).toHaveAttribute('aria-current', 'true');
});

test('a board can be renamed from its menu or by double-clicking it', async ({ page }) => {
  await gotoLesson(page, lesson);

  await openBoardMenu(page);
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const field = boardNav(page).getByRole('textbox', { name: 'Board name' });
  await expect(field).toBeFocused();
  await field.fill('Starter: 300');
  await field.press('Enter');
  expect(await boardNames(page)).toEqual(['Starter: 300', 'Carrying', 'Empty']);

  // Escape leaves the name as it was.
  await boardButton(page, 'Carrying').dblclick();
  await field.fill('Something else');
  await field.press('Escape');
  expect(await boardNames(page)).toEqual(['Starter: 300', 'Carrying', 'Empty']);

  // Clicking away keeps the new name.
  await boardButton(page, 'Empty').dblclick();
  await field.fill('Your turn');
  await workbench(page).click({ position: { x: 600, y: 400 } });
  expect(await boardNames(page)).toEqual(['Starter: 300', 'Carrying', 'Your turn']);
});

test('duplicating a board opens a copy with the same cards right after it', async ({ page }) => {
  await gotoLesson(page, lesson, undefined, 'carrying');
  await openBoardMenu(page);
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();

  expect(await boardNames(page)).toEqual(['Warm-up', 'Carrying', 'Carrying copy', 'Empty']);
  await expect(boardButton(page, 'Carrying copy')).toHaveAttribute('aria-current', 'true');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');
  await expect(card(page, 10, 7)).toBeVisible();
});

test('deleting a board opens its neighbour and can be undone', async ({ page }) => {
  await gotoLesson(page, lesson);
  await openBoardMenu(page);
  await page.getByRole('menuitem', { name: 'Delete' }).click();

  expect(await boardNames(page)).toEqual(['Carrying', 'Empty']);
  await expectBoard(page, 'carrying', 2);
  await expect(page.locator('.toast-message')).toContainText('Deleted Warm-up');

  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await boardNames(page)).toEqual(['Warm-up', 'Carrying', 'Empty']);
  await expectBoard(page, 'warm-up', 1);
});

test('the only board cannot be deleted', async ({ page }) => {
  await gotoLesson(page, [lesson[0]]);
  await openBoardMenu(page);
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Board options' })).toHaveCount(0);
});

test('a new board slides in from the side it comes from', async ({ page }) => {
  await gotoLesson(page, lesson);
  const layer = page.locator('.board-layer');
  // Nothing slides when the page first opens.
  expect(await layer.evaluate((element) => element.getAnimations().length)).toBe(0);

  await page.keyboard.press('PageDown');
  await expect(layer).toHaveAttribute('data-slide', 'next');
  await page.keyboard.press('PageUp');
  await expect(layer).toHaveAttribute('data-slide', 'previous');
});

async function chooseFromBoardMenu(page: Page, item: string): Promise<void> {
  await openBoardMenu(page);
  await page.getByRole('menuitem', { name: item }).click();
}

test('Reset brings back the start the teacher saved, and can be undone', async ({ page }) => {
  await gotoLesson(page, lesson, undefined, 'carrying');
  const home = await boxOf(card(page, 10, 7));
  await chooseFromBoardMenu(page, 'Save as start');
  await expect(page.locator('.toast-message')).toContainText('Saved as the start');
  await expect(boardButton(page, 'Carrying')).not.toHaveAttribute('data-changed', 'true');

  // The class works on the problem.
  await dragCardBy(page, card(page, 10, 7), 0, 144);
  await selectPieceOf(page, card(page, 1, 8));
  await page.keyboard.press('Delete');
  await expectBoard(page, 'carrying', 1);
  await expect(boardButton(page, 'Carrying')).toHaveAttribute('data-changed', 'true');

  await page.getByRole('button', { name: 'Reset to start' }).click();
  await expect(page.locator('.toast-message')).toContainText('Back to the saved start');
  await expectBoard(page, 'carrying', 2);
  await expect(boardButton(page, 'Carrying')).not.toHaveAttribute('data-changed', 'true');
  await expect
    .poll(async () => Math.abs((await boxOf(card(page, 10, 7))).y - home.y))
    .toBeLessThanOrEqual(2);

  await page.getByRole('button', { name: 'Undo' }).click();
  await expectBoard(page, 'carrying', 1);
  await expect(boardButton(page, 'Carrying')).toHaveAttribute('data-changed', 'true');
});

test('Reset on a board that is already at its start says so', async ({ page }) => {
  await gotoLesson(page, lesson);
  await chooseFromBoardMenu(page, 'Save as start');
  await page.getByRole('button', { name: 'Reset to start' }).click();
  await expect(page.locator('.toast-message')).toContainText('already at its saved start');
  await expectBoard(page, 'warm-up', 1);
});

test('a board changed since its start stays marked after switching away and reloading', async ({ page }) => {
  await gotoLesson(page, lesson);
  await chooseFromBoardMenu(page, 'Save as start');
  await dragCardBy(page, card(page, 100, 3), 96, 48);
  await page.keyboard.press('PageDown');

  await expect(boardButton(page, 'Warm-up')).toHaveAttribute('data-changed', 'true');
  // A board without a saved start is never marked.
  await expect(boardButton(page, 'Carrying')).not.toHaveAttribute('data-changed', 'true');

  await page.waitForTimeout(600);
  await page.reload();
  await expect(boardButton(page, 'Warm-up')).toHaveAttribute('data-changed', 'true');
  await page.keyboard.press('PageUp');
  await page.getByRole('button', { name: 'Reset to start' }).click();
  await expect(boardButton(page, 'Warm-up')).not.toHaveAttribute('data-changed', 'true');
});

test('saving a new start replaces the old one, and Undo puts the old one back', async ({ page }) => {
  await gotoLesson(page, lesson);
  await chooseFromBoardMenu(page, 'Save as start');
  await dragCardBy(page, card(page, 100, 3), 96, 48);

  await chooseFromBoardMenu(page, 'Replace start');
  await expect(page.locator('.toast-message')).toContainText('Replaced the saved start');
  await expect(boardButton(page, 'Warm-up')).not.toHaveAttribute('data-changed', 'true');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(boardButton(page, 'Warm-up')).toHaveAttribute('data-changed', 'true');
});

test('forgetting the start makes Reset clear the board again', async ({ page }) => {
  await gotoLesson(page, lesson);
  await chooseFromBoardMenu(page, 'Save as start');
  await chooseFromBoardMenu(page, 'Forget start');
  await expect(page.getByRole('button', { name: 'Reset to start' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Reset canvas' }).click();
  await expectBoard(page, 'warm-up', 0);
});

test('Clear board empties the board but keeps its saved start', async ({ page }) => {
  await gotoLesson(page, lesson);
  await chooseFromBoardMenu(page, 'Save as start');
  await chooseFromBoardMenu(page, 'Clear board');
  await expectBoard(page, 'warm-up', 0);
  await expect(boardButton(page, 'Warm-up')).toHaveAttribute('data-changed', 'true');

  await page.getByRole('button', { name: 'Reset to start' }).click();
  await expectBoard(page, 'warm-up', 1);
});

function intro(page: Page) {
  return page.getByRole('heading', { name: /Build a number/ });
}

test('the welcome only greets a brand-new lesson; Reset leaves a truly empty board', async ({ page }) => {
  await gotoApp(page);
  await expect(intro(page)).toBeVisible();

  await addBankCard(page, 1, 7);
  await page.getByRole('button', { name: 'Reset canvas' }).click();
  await expect(workbench(page)).toHaveAttribute('data-card-count', '0');
  await expect(intro(page)).toHaveCount(0);
});

test('a new board, a cleared board and an empty board are all blank', async ({ page }) => {
  await gotoLesson(page, lesson);
  await expect(intro(page)).toHaveCount(0);

  await chooseFromBoardMenu(page, 'Clear board');
  await expectBoard(page, 'warm-up', 0);
  await expect(intro(page)).toHaveCount(0);

  await boardNav(page).getByRole('button', { name: 'Add board' }).click();
  await expect(boardButton(page, 'Board 4')).toHaveAttribute('aria-current', 'true');
  await expect(intro(page)).toHaveCount(0);

  await boardButton(page, 'Empty').click();
  await expectBoard(page, 'empty', 0);
  await expect(intro(page)).toHaveCount(0);
});

test('Reset on a brand-new lesson clears away the welcome', async ({ page }) => {
  await gotoApp(page);
  await expect(intro(page)).toBeVisible();

  await page.getByRole('button', { name: 'Reset canvas' }).click();
  await expect(intro(page)).toHaveCount(0);
  await expect(page.getByText('already clear')).toHaveCount(0);
});
