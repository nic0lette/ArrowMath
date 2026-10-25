import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  addBankCard,
  addStacked,
  bankCard,
  beginBankDrag,
  boxOf,
  cancelBankDrag,
  card,
  cardsLayer,
  chrome,
  dragCardBy,
  dragCardFromPoint,
  dragCardToCenter,
  dragCardToEdge,
  expectInsideCardsLayer,
  gotoApp,
  gotoSeeded,
  pieceIdFor,
  workbench,
} from './helpers';

async function probeBankOverlap(
  page: Page,
  place: number,
  digit: number,
  ghostLeft: number,
  ghostTop: number,
): Promise<string | null> {
  const draggedWidth = place === 100 ? 202 : place === 10 ? 144 : place === 1 ? 86 : 260;
  await beginBankDrag(page, place, digit);
  await page.mouse.move(ghostLeft + draggedWidth / 2, ghostTop + 34, { steps: 10 });
  await page.waitForTimeout(180);

  const haloCount = await page.locator('.halo').count();
  const label = haloCount > 0 ? await page.locator('.halo-label').innerText() : null;

  await cancelBankDrag(page);
  return label;
}

test('clicking a bank card adds exactly one card and selects it', async ({ page }) => {
  await gotoApp(page);

  await bankCard(page, 1, 9).click();

  await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  await expect(page.locator('.piece-chrome')).toHaveCount(1);
  await expect(page.locator('.piece-chrome')).toContainText('9');
});

test('requires 10px of 2D overlap, chains at an edge and stacks centrally', async ({ page }) => {
  await gotoApp(page);
  await addBankCard(page, 1000, 3);

  const target = card(page, 1000, 3);
  const targetBox = await boxOf(target);
  const targetRight = targetBox.x + targetBox.width;
  const targetBottom = targetBox.y + targetBox.height;

  expect(await probeBankOverlap(page, 100, 4, targetRight - 8, targetBox.y)).toBeNull();
  expect(await probeBankOverlap(page, 100, 4, targetRight - 12, targetBox.y)).toContain(
    'Chain Together',
  );
  expect(await probeBankOverlap(page, 100, 4, targetRight - 40, targetBox.y)).toContain(
    'Snap Together',
  );
  expect(
    await probeBankOverlap(page, 100, 4, targetBox.x + 40, targetBottom - 5),
  ).toBeNull();

  await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
});

test('a second drag settles from the new drop, not from the previous resting position', async ({
  page,
}) => {
  await gotoApp(page);
  await addBankCard(page, 1, 5);

  const source = card(page, 1, 5);

  await dragCardBy(page, source, -250, -80);
  await page.waitForTimeout(500);
  const firstRest = await boxOf(source);

  await dragCardBy(page, source, 360, 220, false);
  const drop = await boxOf(source);
  await page.mouse.up();
  await page.waitForTimeout(20);
  const justAfter = await boxOf(source);

  // If Motion reuses its cached transform from the first drag, the card jumps
  // back to firstRest here and then springs all the way to the drop.
  expect(Math.abs(justAfter.x - drop.x)).toBeLessThan(35);
  expect(Math.abs(justAfter.y - drop.y)).toBeLessThan(35);
  expect(Math.abs(justAfter.x - firstRest.x)).toBeGreaterThan(150);

  await page.waitForTimeout(500);
  const secondRest = await boxOf(source);
  expect(Math.abs(secondRest.x - firstRest.x)).toBeGreaterThan(150);
  await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
});

test('stacking a card anchors the stationary target', async ({ page }) => {
  await gotoApp(page);
  await addBankCard(page, 1000, 4);
  await addBankCard(page, 100, 3);

  const target = card(page, 1000, 4);
  const source = card(page, 100, 3);
  const targetBefore = await boxOf(target);

  await dragCardToCenter(page, source, target);

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  await expect(workbench(page)).toHaveAttribute('data-card-count', '2');
  const targetAfter = await boxOf(target);
  expect(Math.abs(targetAfter.x - targetBefore.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(targetAfter.y - targetBefore.y)).toBeLessThanOrEqual(1);

  const groupChrome = page.locator('.piece-chrome');
  await expect(groupChrome).toContainText('4,300');
  await expect(groupChrome).toHaveAttribute('data-mode', 'stack');
});

test('edge overlap chains the cards and anchors the target', async ({ page }) => {
  await gotoApp(page);
  await addBankCard(page, 1000, 4);
  await addBankCard(page, 1, 5);

  const target = card(page, 1000, 4);
  const source = card(page, 1, 5);
  const targetBefore = await boxOf(target);

  await dragCardToEdge(page, source, target, 15);

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  await expect(page.locator('.equation-result')).toContainText('4,005');
  await expect(page.locator('.equation-operator')).toHaveCount(1);

  const chromeLocator = page.locator('.piece-chrome');
  await expect(chromeLocator).toHaveAttribute('data-mode', 'expand');
  await expect(chromeLocator).toContainText('4,005');

  const targetAfter = await boxOf(target);
  expect(Math.abs(targetAfter.x - targetBefore.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(targetAfter.y - targetBefore.y)).toBeLessThanOrEqual(1);
});

async function setupBounce(page: Page): Promise<{ target: Locator; source: Locator }> {
  await gotoApp(page);
  await addStacked(page, 125, 3);
  await addBankCard(page, 10, 5);

  return {
    target: card(page, 100, 1),
    source: card(page, 10, 5),
  };
}

async function dropSourceOnTarget(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<{ dropBox: Awaited<ReturnType<typeof boxOf>>; targetBox: Awaited<ReturnType<typeof boxOf>> }> {
  const sourceBox = await boxOf(source);
  const targetBox = await boxOf(target);
  const dx = targetBox.x + targetBox.width / 2 - (sourceBox.x + sourceBox.width / 2);
  const dy = targetBox.y + targetBox.height / 2 - (sourceBox.y + sourceBox.height / 2);

  await dragCardBy(page, source, dx, dy, false);
  const dropBox = await boxOf(source);
  await page.mouse.up();
  return { dropBox, targetBox };
}

test('duplicate place bounces from the release point, anchors the target and settles once', async ({
  page,
}) => {
  const { target, source } = await setupBounce(page);
  const targetBefore = await boxOf(target);

  const { dropBox } = await dropSourceOnTarget(page, source, target);
  const startBox = await boxOf(source);

  // The spring must begin at the drop position, not at the card's old grid slot
  // or at the bounce destination.
  expect(Math.abs(startBox.x - dropBox.x)).toBeLessThan(100);
  expect(Math.abs(startBox.y - dropBox.y)).toBeLessThan(20);

  await expect(page.locator('.toast-message')).toContainText('tens column');
  await expect(page.locator('.toast-message')).toContainText('bounce apart');

  await page.waitForTimeout(1300);
  const settledBox = await boxOf(source);
  const animationCount = await source.evaluate((element) => element.getAnimations().length);
  expect(animationCount).toBe(0);

  const targetAfter = await boxOf(target);
  expect(Math.abs(targetAfter.x - targetBefore.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(targetAfter.y - targetBefore.y)).toBeLessThanOrEqual(1);

  // It cleared the whole stacked target with the required margin.
  expect(settledBox.x).toBeGreaterThanOrEqual(targetBefore.x + targetBefore.width + 27);
  expect(settledBox.y + settledBox.height).toBeLessThanOrEqual(900);

  await expect(workbench(page)).toHaveAttribute('data-card-count', '4');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');

  await page.waitForTimeout(180);
  const stillBox = await boxOf(source);
  expect(Math.abs(stillBox.x - settledBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(stillBox.y - settledBox.y)).toBeLessThanOrEqual(1);
});

test('grabbing a card mid-bounce uses its visual position instead of jumping', async ({ page }) => {
  const { target, source } = await setupBounce(page);
  await dropSourceOnTarget(page, source, target);

  // Let the spring get properly under way, then grab the card without any
  // Playwright latency between reading the visual position and pointerdown.
  await page.waitForTimeout(50);
  const result = await page.evaluate(async () => {
    const element = document.querySelector<HTMLElement>(
      '.card-node[data-place="10"][data-digit="5"]',
    );
    if (!element) throw new Error('Bouncing card not found');

    const initial = element.getBoundingClientRect();
    const startX = initial.x;
    const startY = initial.y;
    const pointerX = initial.x + initial.width / 2;
    const pointerY = initial.y + initial.height / 2;

    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 41,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: pointerX,
        clientY: pointerY,
      }),
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 41,
        pointerType: 'mouse',
        isPrimary: true,
        buttons: 1,
        clientX: pointerX + 2,
        clientY: pointerY,
      }),
    );

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const after = element.getBoundingClientRect();
    return {
      startX,
      startY,
      afterX: after.x,
      afterY: after.y,
      dragging: element.getAttribute('data-dragging'),
    };
  });

  expect(result.dragging).toBe('true');
  // The card must pick up from the visible bounce position rather than hopping
  // back toward the spring's eventual destination.
  expect(Math.abs(result.afterX - result.startX)).toBeLessThan(45);
  expect(Math.abs(result.afterY - result.startY)).toBeLessThan(12);

  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');
});

test('expands into a number sentence, stacks again, and toggles x-ray', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);

  const source = card(page, 1000, 4);
  const pieceId = await pieceIdFor(source);
  const groupChrome = chrome(page, pieceId);

  await expect(groupChrome).toHaveAttribute('data-mode', 'stack');
  await groupChrome.getByRole('button', { name: 'Expand' }).click();

  await expect(groupChrome).toHaveAttribute('data-mode', 'expand');
  await expect(page.locator('.equation-operator')).toHaveCount(3);
  await expect(page.locator('.equation-result')).toContainText('4,325');

  await groupChrome.getByRole('button', { name: 'Stack' }).click();
  await expect(groupChrome).toHaveAttribute('data-mode', 'stack');
  await expect(page.locator('.equation-operator')).toHaveCount(0);
  await expect(page.locator('.equation-result')).toHaveCount(0);

  await page.getByRole('button', { name: 'X-ray peek' }).click();
  await expect(page.locator('.card-node.show-through')).toHaveCount(3);
  await page.waitForTimeout(300);
  const topCard = page.locator('.card-node.show-through').first();
  const opacity = await topCard
    .locator('.card-inner')
    .evaluate((element) => getComputedStyle(element).opacity);
  expect(Number(opacity)).toBeCloseTo(0.88, 1);
  const fillOpacity = await topCard
    .locator('svg > path')
    .first()
    .evaluate((element) => getComputedStyle(element).fillOpacity);
  expect(Number(fillOpacity)).toBeCloseTo(0.3, 1);
  const zeroOpacities = await topCard
    .locator('svg text[font-size="32"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('opacity')));
  expect(zeroOpacities).toContain('0.35');

  // X-ray is specifically a stacked-view tool: expanded groups already show all
  // cards separately, so there is nothing hidden to reveal.
  await groupChrome.getByRole('button', { name: 'Expand' }).click();
  await expect(page.locator('.card-node.show-through')).toHaveCount(0);
  await groupChrome.getByRole('button', { name: 'Stack' }).click();
  await expect(page.locator('.card-node.show-through')).toHaveCount(3);
});

test('the digit end lifts one card and the arrow side lifts the whole stack', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);
  await page.waitForTimeout(350);

  const hundreds = card(page, 100, 3);
  const hundredsBox = await boxOf(hundreds);
  await page.mouse.move(hundredsBox.x + 18, hundredsBox.y + 34);

  await expect(page.locator('.card-node[data-place="100"].peel-lift')).toHaveCount(1);
  await expect(page.locator('.card-node.move-intent')).toHaveCount(0);

  // The digit end bends up like paper. While it bends, the paper layer draws
  // the card and the SVG is hidden, so the two never show at once.
  const hundredsPaper = page.locator('.card-node[data-place="100"] .paper-layer');
  await expect(hundredsPaper).toHaveAttribute('data-bent', 'true');
  await expect(page.locator('.card-node[data-place="100"] .paper-canvas')).toBeVisible();
  await expect(page.locator('.card-node[data-place="100"] .arrow-card')).toBeHidden();
  await expect(page.locator('.paper-layer[data-bent="true"]')).toHaveCount(1);

  // Pressing keeps the stack calm and the card lifted until the movement
  // threshold is crossed.
  await page.mouse.down();
  await expect(page.locator('.card-node[data-place="100"]')).toHaveAttribute(
    'data-dragging',
    'false',
  );
  await expect(page.locator('.card-node[data-place="100"].peel-lift')).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator('.card-node[data-place="100"].peel-lift')).toHaveCount(1);

  const ones = card(page, 1, 5);
  const onesBox = await boxOf(ones);
  await page.mouse.move(onesBox.x + onesBox.width - 10, onesBox.y + 34);

  await expect(page.locator('.card-node.peel-lift')).toHaveCount(0);
  await expect(page.locator('.card-node.move-intent')).toHaveCount(4);
  // Moving off the digit end flattens the card and brings its SVG back.
  await expect(hundredsPaper).toHaveAttribute('data-bent', 'false');
  await expect(page.locator('.card-node[data-place="100"] .arrow-card')).toBeVisible();

  await page.mouse.move(24, 300);
  await expect(page.locator('.card-node.move-intent')).toHaveCount(0);
});

test('pulling a card out of the digit end closes the group and updates its value', async ({
  page,
}) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);
  await page.waitForTimeout(350);

  const groupId = await pieceIdFor(card(page, 1000, 4));
  const groupChrome = chrome(page, groupId);
  const hundreds = card(page, 100, 3);
  const before = await boxOf(hundreds);

  await dragCardFromPoint(page, hundreds, 18, 34, 240, 140);

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');
  await expect(workbench(page)).toHaveAttribute('data-card-count', '4');
  await expect(groupChrome).toHaveAttribute('data-mode', 'stack');
  await expect(groupChrome).toContainText('4,025');

  const detached = card(page, 100, 3);
  await expect(detached).toHaveAttribute('data-dragging', 'false');
  expect(await pieceIdFor(detached)).not.toBe(groupId);

  const after = await boxOf(detached);
  expect(after.x).toBeGreaterThan(before.x + 150);

  // The peeled card now lives on its own, so a 700 can join the group.
  await addBankCard(page, 100, 7);
  await dragCardToCenter(page, card(page, 100, 7), card(page, 1000, 4));

  await expect(groupChrome).toContainText('4,725');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');
  await expect(workbench(page)).toHaveAttribute('data-card-count', '5');
});

test('dragging the arrow spine moves the whole group', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);
  await page.waitForTimeout(350);

  const groupId = await pieceIdFor(card(page, 1000, 4));
  const ones = card(page, 1, 5);
  const before = await boxOf(ones);

  await dragCardFromPoint(page, ones, 76, 34, 90, 50);

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  await expect(workbench(page)).toHaveAttribute('data-card-count', '4');
  await expect(chrome(page, groupId)).toContainText('4,325');
  await expect(page.locator('.card-node.move-intent')).toHaveCount(4);
  expect(await pieceIdFor(ones)).toBe(groupId);

  const after = await boxOf(ones);
  expect(after.x - before.x).toBeGreaterThan(40);
  expect(after.y - before.y).toBeGreaterThan(10);
});

test('dragging the number chip moves the group and keeps the chrome visible', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);
  await page.waitForTimeout(350);

  const groupId = await pieceIdFor(card(page, 1000, 4));
  const groupChrome = chrome(page, groupId);
  const chip = groupChrome.locator('.chrome-value');
  const before = await boxOf(card(page, 1, 5));
  const chipBox = await boxOf(chip);
  const startX = chipBox.x + chipBox.width / 2;
  const startY = chipBox.y + chipBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 70, startY + 40, { steps: 10 });
  await page.waitForTimeout(120);

  await expect(groupChrome).toBeVisible();
  await page.mouse.up();

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  await expect(page.locator('.card-node.move-intent')).toHaveCount(4);
  const after = await boxOf(card(page, 1, 5));
  expect(after.x - before.x).toBeGreaterThan(30);
  expect(after.y - before.y).toBeGreaterThan(10);
});

test('double-clicking a group toggles stack and expand', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);
  await page.waitForTimeout(350);

  const groupId = await pieceIdFor(card(page, 1000, 4));
  const groupChrome = chrome(page, groupId);
  const onesBox = await boxOf(card(page, 1, 5));
  await page.mouse.dblclick(onesBox.x + 20, onesBox.y + 34);

  await expect(groupChrome).toHaveAttribute('data-mode', 'expand');
  await expect(page.locator('.equation-operator')).toHaveCount(3);
  await expect(page.locator('.equation-result')).toContainText('4,325');

  await page.waitForTimeout(500);
  const expandedBox = await boxOf(card(page, 1, 5));
  await page.mouse.dblclick(expandedBox.x + 20, expandedBox.y + 34);

  await expect(groupChrome).toHaveAttribute('data-mode', 'stack');
  await expect(page.locator('.equation-operator')).toHaveCount(0);
});

test('an expanded card can be pulled out from anywhere on the card', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);
  await page.waitForTimeout(350);

  const groupId = await pieceIdFor(card(page, 1000, 4));
  const groupChrome = chrome(page, groupId);
  await groupChrome.getByRole('button', { name: 'Expand' }).click();
  await expect(groupChrome).toHaveAttribute('data-mode', 'expand');
  await page.waitForTimeout(500);

  const hundreds = card(page, 100, 3);
  const box = await boxOf(hundreds);
  await dragCardFromPoint(page, hundreds, box.width - 20, 34, 140, 150);

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '2');
  await expect(groupChrome).toHaveAttribute('data-mode', 'expand');
  await expect(groupChrome).toContainText('4,025');
});

test('clicking a single card does not nudge it', async ({ page }) => {
  await gotoApp(page);
  await addBankCard(page, 1, 9);
  await page.waitForTimeout(350);

  const nine = card(page, 1, 9);
  const before = await boxOf(nine);

  for (let click = 0; click < 3; click++) {
    const box = await boxOf(nine);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(380);
  }

  const after = await boxOf(nine);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
});

test('a single card has no pull-out lift and still drags normally', async ({ page }) => {
  await gotoApp(page);
  await addBankCard(page, 1, 9);
  await page.waitForTimeout(300);

  const nine = card(page, 1, 9);
  const box = await boxOf(nine);
  await page.mouse.move(box.x + 18, box.y + 34);

  await expect(page.locator('.peel-lift')).toHaveCount(0);
  await expect(page.locator('.move-intent')).toHaveCount(0);

  await dragCardBy(page, nine, 80, 40);
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  await expect(workbench(page)).toHaveAttribute('data-card-count', '1');
});

test('x-ray explains when there is no stacked group to reveal', async ({ page }) => {
  await gotoApp(page);
  await addBankCard(page, 1, 7);

  await page.getByRole('button', { name: 'X-ray peek' }).click();

  await expect(page.locator('.card-node.show-through')).toHaveCount(0);
  await expect(page.locator('.toast-message')).toContainText('stacked group');
});

test('reset is undoable and the teacher guide opens and closes', async ({ page }) => {
  await gotoApp(page);
  await addBankCard(page, 1, 7);

  await page.getByRole('button', { name: 'Reset canvas' }).click();
  await expect(workbench(page)).toHaveAttribute('data-card-count', '0');
  await expect(page.locator('.toast-message')).toContainText('Workbench cleared');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(workbench(page)).toHaveAttribute('data-card-count', '1');

  await page.getByRole('button', { name: 'How arrow cards work' }).click();
  const dialog = page.locator('dialog.guide-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'How arrow cards work' })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
});

test('the workbench survives a page reload', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);

  // Let the debounced workbench save run before leaving the page.
  await page.waitForTimeout(600);
  const before = await boxOf(card(page, 1000, 4));

  await page.reload();

  await expect(workbench(page)).toHaveAttribute('data-card-count', '4');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  await expect(card(page, 1000, 4)).toBeVisible();

  // The restored group is still the same stacked 4,325 group, sitting where it
  // was left thanks to the persisted coordinates.
  const groupId = await pieceIdFor(card(page, 1000, 4));
  await expect(chrome(page, groupId)).toContainText('4,325');
  await expect(chrome(page, groupId)).toHaveAttribute('data-mode', 'stack');

  const after = await boxOf(card(page, 1000, 4));
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
});

test('a cleared workbench stays clear after a reload', async ({ page }) => {
  await gotoApp(page);
  await addStacked(page, 4325, 4);

  await page.getByRole('button', { name: 'Reset canvas' }).click();
  await expect(workbench(page)).toHaveAttribute('data-card-count', '0');
  await page.waitForTimeout(600);

  await page.reload();

  await expect(workbench(page)).toHaveAttribute('data-card-count', '0');
  await expect(workbench(page)).toHaveAttribute('data-piece-count', '0');
});

test('phone layout stays within the viewport and collapses the tray', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoApp(page);

  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  await expect(page.getByRole('button', { name: 'Expand card tray' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand card tray' }).click();
  await expect(page.getByRole('button', { name: 'Add Stacked' })).toBeVisible();
});

test('stacking onto a card at the left edge keeps the whole group on the workbench', async ({
  page,
}) => {
  // The stack grows leftwards from the stationary target, so a 4,000 card
  // dropped onto a 5 at the left edge used to push its "4" off the canvas.
  await gotoSeeded(page, [
    { id: 'ones', cards: [{ id: 'c-ones', place: 1, digit: 5 }], x: 16, y: 300 },
    { id: 'thousands', cards: [{ id: 'c-thousands', place: 1000, digit: 4 }], x: 480, y: 300 },
  ]);

  await dragCardToCenter(page, card(page, 1000, 4), card(page, 1, 5));

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  const groupId = await pieceIdFor(card(page, 1000, 4));
  await expect(chrome(page, groupId)).toContainText('4,005');
  await expectInsideCardsLayer(page, [card(page, 1000, 4), card(page, 1, 5)]);
});

test('chaining near the right edge keeps the cards and the sum on the workbench', async ({
  page,
}) => {
  await gotoSeeded(page, [
    { id: 'ones', cards: [{ id: 'c-ones', place: 1, digit: 5 }], x: 300, y: 300 },
  ]);
  const layer = await boxOf(cardsLayer(page));
  // Leave just enough room on the right for the 5 to touch the 4,000's edge.
  await gotoSeeded(page, [
    { id: 'ones', cards: [{ id: 'c-ones', place: 1, digit: 5 }], x: 300, y: 300 },
    {
      id: 'thousands',
      cards: [{ id: 'c-thousands', place: 1000, digit: 4 }],
      x: Math.round(layer.width - 16 - 260 - 90),
      y: 300,
    },
  ]);

  await dragCardToEdge(page, card(page, 1, 5), card(page, 1000, 4), 12);

  await expect(workbench(page)).toHaveAttribute('data-piece-count', '1');
  const groupId = await pieceIdFor(card(page, 1000, 4));
  await expect(chrome(page, groupId)).toHaveAttribute('data-mode', 'expand');
  await expect(page.locator('.equation-result')).toContainText('4,005');
  await expectInsideCardsLayer(page, [
    card(page, 1000, 4),
    card(page, 1, 5),
    page.locator('.equation-result'),
  ]);
});

test('opening the card tray pulls cards near the bottom back into view', async ({ page }) => {
  await gotoSeeded(page, [], { bankOpen: false });
  const layer = await boxOf(cardsLayer(page));
  await gotoSeeded(
    page,
    [
      {
        id: 'tens',
        cards: [{ id: 'c-tens', place: 10, digit: 3 }],
        x: 200,
        y: Math.round(layer.height - 16 - 68),
      },
    ],
    { bankOpen: false },
  );

  await page.getByRole('button', { name: 'Expand card tray' }).click();
  await expect(page.getByRole('button', { name: 'Collapse card tray' })).toBeVisible();

  await expectInsideCardsLayer(page, [card(page, 10, 3)]);
});
