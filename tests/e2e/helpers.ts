import { expect, type Locator, type Page } from '@playwright/test';

export function workbench(page: Page): Locator {
  return page.locator('[data-workbench]');
}

export function card(page: Page, place: number, digit: number): Locator {
  return page.locator(`.card-node[data-place="${place}"][data-digit="${digit}"]`);
}

export function bankCard(page: Page, place: number, digit: number): Locator {
  return page.locator(`[data-bank-place="${place}"][data-bank-digit="${digit}"]`);
}

export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(workbench(page)).toBeVisible();
  await expect(workbench(page)).toHaveAttribute('data-card-count', '0');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '0');
}

export async function addBankCard(page: Page, place: number, digit: number): Promise<void> {
  const beforePieces = Number(await workbench(page).getAttribute('data-piece-count'));
  const beforeCards = Number(await workbench(page).getAttribute('data-card-count'));

  const bank = bankCard(page, place, digit);
  await bank.scrollIntoViewIfNeeded();
  await bank.click();

  await expect(workbench(page)).toHaveAttribute('data-piece-count', String(beforePieces + 1));
  await expect(workbench(page)).toHaveAttribute('data-card-count', String(beforeCards + 1));
}

export async function addStacked(page: Page, value: number, cardCount: number): Promise<void> {
  const beforePieces = Number(await workbench(page).getAttribute('data-piece-count'));
  const beforeCards = Number(await workbench(page).getAttribute('data-card-count'));

  await page.locator('#make-number').fill(String(value));
  await page.getByRole('button', { name: 'Add Stacked' }).click();

  await expect(workbench(page)).toHaveAttribute('data-piece-count', String(beforePieces + 1));
  await expect(workbench(page)).toHaveAttribute('data-card-count', String(beforeCards + cardCount));
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No bounding box for ${locator}`);
  return box;
}

export function boxCenter(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Moves a canvas card by the given piece-space delta. The initial small move
 * crosses the drag threshold before the real destination is applied.
 */
export async function dragCardBy(
  page: Page,
  source: Locator,
  dx: number,
  dy: number,
  release = true,
): Promise<void> {
  const sourceBox = await boxOf(source);
  const start = boxCenter(sourceBox);

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + Math.sign(dx || 1) * 7, start.y + Math.sign(dy || 1) * 7, {
    steps: 3,
  });
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 14 });
  await page.waitForTimeout(120);

  if (release) {
    await page.mouse.up();
  }
}

/**
 * Drags from a specific point inside a card, rather than its centre. Used to
 * grab the exposed digit slot in a stack or the arrow-side spine.
 */
export async function dragCardFromPoint(
  page: Page,
  source: Locator,
  offsetX: number,
  offsetY: number,
  dx: number,
  dy: number,
  release = true,
): Promise<void> {
  const sourceBox = await boxOf(source);
  const startX = sourceBox.x + offsetX;
  const startY = sourceBox.y + offsetY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + Math.sign(dx || 1) * 7, startY + Math.sign(dy || 1) * 7, {
    steps: 3,
  });
  await page.mouse.move(startX + dx, startY + dy, { steps: 14 });
  await page.waitForTimeout(120);

  if (release) {
    await page.mouse.up();
  }
}

export async function dragCardToCenter(page: Page, source: Locator, target: Locator): Promise<void> {
  const sourceBox = await boxOf(source);
  const targetBox = await boxOf(target);
  const dx = targetBox.x + targetBox.width / 2 - (sourceBox.x + sourceBox.width / 2);
  const dy = targetBox.y + targetBox.height / 2 - (sourceBox.y + sourceBox.height / 2);
  await dragCardBy(page, source, dx, dy);
}

/** Drags a card so it overlaps the target's right edge by exactly edgeOverlap px. */
export async function dragCardToEdge(
  page: Page,
  source: Locator,
  target: Locator,
  edgeOverlap: number,
): Promise<void> {
  const sourceBox = await boxOf(source);
  const targetBox = await boxOf(target);
  const desiredLeft = targetBox.x + targetBox.width - edgeOverlap;
  const dx = desiredLeft - sourceBox.x;
  const dy = targetBox.y - sourceBox.y;
  await dragCardBy(page, source, dx, dy);
}

export async function beginBankDrag(page: Page, place: number, digit: number): Promise<void> {
  const bank = bankCard(page, place, digit);
  await bank.scrollIntoViewIfNeeded();
  const bankBox = await boxOf(bank);
  const center = boxCenter(bankBox);

  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 20, center.y - 20, { steps: 4 });
}

export async function cancelBankDrag(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.halo')).toHaveCount(0);
}

export async function pieceIdFor(locator: Locator): Promise<string> {
  const id = await locator.getAttribute('data-piece');
  if (!id) throw new Error('Card has no data-piece');
  return id;
}

export function chrome(page: Page, pieceId: string): Locator {
  return page.locator(`.piece-chrome[data-piece-id="${pieceId}"]`);
}

export interface SeedCard {
  id: string;
  place: number;
  digit: number;
}

export interface SeedPiece {
  id: string;
  cards: SeedCard[];
  x: number;
  y: number;
  mode?: 'stack' | 'expand';
}

/**
 * Opens the app with a saved board (and optional preferences) already in
 * storage, so a test can start with cards at exact positions such as the
 * workbench edges. Each call seeds exactly once, before the app loads, so a
 * test can load once to measure the canvas and then seed again.
 */
let seedCount = 0;

export async function gotoSeeded(
  page: Page,
  pieces: SeedPiece[],
  preferences?: Record<string, unknown>,
): Promise<void> {
  seedCount += 1;
  const flag = `arrow-math:test-seeded-${seedCount}`;
  await page.addInitScript(
    ([pieces, preferences, flag]) => {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, '1');
      localStorage.setItem(
        'arrow-math:workbench',
        JSON.stringify({
          version: 1,
          pieces: pieces.map((piece, index) => ({ mode: 'stack', z: index + 1, ...piece })),
        }),
      );
      if (preferences) localStorage.setItem('arrow-math:preferences', JSON.stringify(preferences));
    },
    [pieces, preferences, flag] as const,
  );
  await page.goto('/');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', String(pieces.length));
}

/** The card layer is the coordinate system pieces are clamped to. */
export function cardsLayer(page: Page): Locator {
  return page.locator('.cards-layer');
}

/**
 * Waits until the boxes have stopped moving and then checks that every one is
 * fully inside the card layer. Checking before a spring settles can pass on
 * the drop position and miss where the card actually comes to rest.
 */
export async function expectInsideCardsLayer(page: Page, targets: Locator[]): Promise<void> {
  const measure = () => Promise.all(targets.map((target) => boxOf(target)));
  await expect
    .poll(async () => {
      const before = await measure();
      await page.waitForTimeout(150);
      const boxes = await measure();
      const settled = boxes.every(
        (box, index) =>
          Math.abs(box.x - before[index].x) < 0.5 && Math.abs(box.y - before[index].y) < 0.5,
      );
      if (!settled) return 'moving';

      const layer = await boxOf(cardsLayer(page));
      const inside = boxes.every(
        (box) =>
          box.x >= layer.x - 0.5 &&
          box.y >= layer.y - 0.5 &&
          box.x + box.width <= layer.x + layer.width + 0.5 &&
          box.y + box.height <= layer.y + layer.height + 0.5,
      );
      return inside ? 'inside' : 'outside';
    })
    .toBe('inside');
}

/** Selects a card's piece from the keyboard, which shows that piece's toolbar. */
export async function selectPieceOf(page: Page, source: Locator): Promise<void> {
  await source.focus();
  await page.keyboard.press('Enter');
}
