import { expect, test, type Page } from '@playwright/test';
import { addBankCard, boxOf, gotoApp, workbench } from './helpers';

// Phones fold the toolbar into a menu so the top bar is one short row.

function topbar(page: Page) {
  return page.locator('header.topbar');
}

function menuButton(page: Page) {
  return page.getByRole('button', { name: 'Menu' });
}

function menu(page: Page) {
  return page.getByRole('region', { name: 'Settings and tools' });
}

async function openMenu(page: Page): Promise<void> {
  await menuButton(page).click();
  await expect(menu(page)).toBeVisible();
}

test.describe('phone, upright', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the top bar is one short row with the name, Reset and the menu', async ({ page }) => {
    await gotoApp(page);
    const bar = await boxOf(topbar(page));
    expect(bar.height).toBeLessThan(64);

    await expect(page.getByRole('heading', { name: 'Arrow Math' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset canvas' })).toBeVisible();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('combobox', { name: 'Color theme' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Number words' })).toBeHidden();

    // Same row: the buttons sit level with the name.
    const reset = await boxOf(page.getByRole('button', { name: 'Reset canvas' }));
    const menuBox = await boxOf(menuButton(page));
    expect(reset.y + reset.height).toBeLessThanOrEqual(bar.y + bar.height);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(390);
  });

  test('the menu holds every other setting, with words beside the toggles', async ({ page }) => {
    await gotoApp(page);
    await openMenu(page);
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'true');

    const panel = menu(page);
    await expect(panel.getByRole('combobox', { name: 'Color theme' })).toBeVisible();
    for (const name of ['Grid snapping', 'Number words', 'Sound', 'Zoom out', 'Reset zoom', 'Zoom in', 'Snap all cards', 'How arrow cards work']) {
      await expect(panel.getByRole('button', { name })).toBeVisible();
    }
    await expect(panel.getByText('Grid snap', { exact: true })).toBeVisible();
    await expect(panel.getByText('Words', { exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Reset zoom' })).toHaveText('75%');

    const box = await boxOf(panel);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('toggles work from the menu and leave it open for the next one', async ({ page }) => {
    await gotoApp(page);
    await openMenu(page);
    const words = menu(page).getByRole('button', { name: 'Number words' });
    await words.click();
    await expect(words).toHaveAttribute('aria-pressed', 'true');
    await expect(menu(page)).toBeVisible();

    await menu(page).getByRole('button', { name: 'Zoom in' }).click();
    await expect(menu(page).getByRole('button', { name: 'Reset zoom' })).toHaveText('80%');
    await expect(menu(page)).toBeVisible();
  });

  test('the menu closes on a tap outside it, on Escape, and on the menu button', async ({ page }) => {
    await gotoApp(page);
    await openMenu(page);
    await workbench(page).click({ position: { x: 150, y: 500 } });
    await expect(menu(page)).toBeHidden();
    await expect(menuButton(page)).toHaveAttribute('aria-expanded', 'false');

    await openMenu(page);
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();

    await openMenu(page);
    await menuButton(page).click();
    await expect(menu(page)).toBeHidden();
  });

  test('actions in the menu close it once they run', async ({ page }) => {
    await gotoApp(page);
    await openMenu(page);
    await menu(page).getByRole('button', { name: 'How arrow cards work' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(menu(page)).toBeHidden();
  });

  test('Reset on the top row clears the bench without opening the menu', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'Open card tray' }).click();
    await addBankCard(page, 1, 7);
    await page.getByRole('button', { name: 'Close card tray' }).click();
    await page.getByRole('button', { name: 'Reset canvas' }).click();
    await expect(workbench(page)).toHaveAttribute('data-card-count', '0');
  });
});

test.describe('phone, on its side', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('the top bar uses the menu too, and the open menu fits on screen', async ({ page }) => {
    await gotoApp(page);
    expect((await boxOf(topbar(page))).height).toBeLessThan(64);
    await expect(page.getByRole('button', { name: 'Number words' })).toBeHidden();

    await openMenu(page);
    const box = await boxOf(menu(page));
    expect(box.y + box.height).toBeLessThanOrEqual(390);
    const help = menu(page).getByRole('button', { name: 'How arrow cards work' });
    await help.scrollIntoViewIfNeeded();
    await expect(help).toBeInViewport();
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 1194, height: 834 }, hasTouch: true });

  test('keeps the full toolbar with no menu', async ({ page }) => {
    await gotoApp(page);
    await expect(menuButton(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Number words' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Color theme' })).toBeVisible();
  });
});
