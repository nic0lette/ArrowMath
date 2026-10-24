/**
 * Follow-up touch probe: fresh state per probe, zooms into the failures.
 */
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';

async function makeSession(viewport) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ hasTouch: true, viewport });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-workbench]').waitFor();
  await page.waitForTimeout(300);

  const touchStart = (points) =>
    client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points.map((p) => ({ ...p, id: 1 })) });
  const touchMove = (points) =>
    client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points.map((p) => ({ ...p, id: 1 })) });
  const touchEnd = () => client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  const tap = async (x, y, settle = 120) => {
    await touchStart([{ x, y }]);
    await touchEnd();
    await page.waitForTimeout(settle);
  };
  const drag = async (from, to, steps = 12) => {
    await touchStart([{ x: from.x, y: from.y }]);
    await page.waitForTimeout(40);
    for (let i = 1; i <= steps; i++) {
      await touchMove([{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]);
      await page.waitForTimeout(12);
    }
    await page.waitForTimeout(60);
    await touchEnd();
    await page.waitForTimeout(200);
  };
  const centerOf = async (locator) => {
    const box = await locator.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  };
  const stats = () =>
    page.evaluate(() => {
      const bench = document.querySelector('[data-workbench]');
      return {
        cards: bench.dataset.cardCount,
        pieces: bench.dataset.pieceCount,
        chromes: [...document.querySelectorAll('.piece-chrome')].map((c) => ({
          pieceId: c.dataset.pieceId,
          mode: c.dataset.mode,
          value: c.textContent.replace(/\s+/g, ' ').trim(),
          rect: c.getBoundingClientRect().toJSON(),
        })),
        bankOpen: !document.querySelector('.bank')?.classList.contains('collapsed'),
      };
    });
  return { browser, page, client, touchStart, touchMove, touchEnd, tap, drag, centerOf, stats };
}

const log = (...a) => console.log(...a);

// ---- A. double-tap to expand (fresh board) ---------------------------------
{
  const s = await makeSession({ width: 1194, height: 834 });
  const { browser, page, tap, drag, centerOf, stats } = s;
  log('\n=== A: double-tap modes a 2-card stack ===');
  await page.locator('#make-number').fill('300');
  await page.getByRole('button', { name: 'Add Stacked' }).tap();
  await page.waitForTimeout(150);
  await page.locator('#make-number').fill('40');
  await page.getByRole('button', { name: 'Add Stacked' }).tap();
  await page.waitForTimeout(250);
  let st = await stats();
  log(`setup: pieces=${st.pieces} cards=${st.cards}`);
  const card300 = page.locator('.card-node[data-place="100"][data-digit="3"]');
  const card40 = page.locator('.card-node[data-place="10"][data-digit="4"]');
  const a = await centerOf(card40);
  const b = await centerOf(card300);
  await drag({ x: a.x, y: a.y }, { x: b.x - 60, y: b.y });
  st = await stats();
  log(`after merge: pieces=${st.pieces}`);
  if (st.pieces === '1') {
    const group = page.locator('.card-node').first();
    const g = await centerOf(group);
    log(`tapping card twice at (${g.x.toFixed(0)}, ${g.y.toFixed(0)})`);
    await tap(g.x, g.y, 100);
    await tap(g.x, g.y, 400);
    st = await stats();
    log(`after double-tap: pieces=${st.pieces} chromes=${JSON.stringify(st.chromes.map((c) => c.value + '/' + c.mode))}`);
    await page.waitForTimeout(800);
    st = await stats();
    log(` chromes after settle: ${JSON.stringify(st.chromes.map((c) => c.value + '/' + c.mode))}`);
    log(st.chromes[0]?.mode === 'expand' ? 'PASS double-tap expands' : 'FAIL double-tap did not expand');
  }
  await browser.close();
}

// ---- B. chrome lingering after tap-select + empty-canvas tap ---------------
{
  const s = await makeSession({ width: 1194, height: 834 });
  const { browser, page, tap, centerOf, stats } = s;
  log('\n=== B: single card select / deselect behaviour on touch ===');
  const bankCard = page.locator('[data-bank-place="1"][data-bank-digit="9"]');
  await bankCard.scrollIntoViewIfNeeded();
  const bc = await centerOf(bankCard);
  await tap(bc.x, bc.y);
  let st = await stats();
  log(`after tap-add: pieces=${st.pieces} chromes=${st.chromes.length}`);
  await page.waitForTimeout(1000);
  st = await stats();
  log(` 1s later: chromes=${st.chromes.length} (selected card keeps its chrome)`);
  const bench = await page.locator('[data-workbench]').boundingBox();
  await tap(bench.x + bench.width / 2, bench.y + bench.height - 30, 900);
  st = await stats();
  log(`after tapping empty canvas + 900ms: chromes=${st.chromes.length} (expect 0)`);
  log(st.chromes.length === 0 ? 'PASS deselect clears chrome' : `FAIL deselect left ${st.chromes.length} chrome(s): ${JSON.stringify(st.chromes.map((c) => c.value))}`);
  await browser.close();
}

// ---- C. phone: expand the collapsed tray, then tap-add --------------------
{
  const s = await makeSession({ width: 390, height: 844 });
  const { browser, page, tap, stats, centerOf } = s;
  log('\n=== C: phone — tray starts collapsed? ===');
  let st = await stats();
  log(`bankOpen on load: ${st.bankOpen} (viewport 390x844)`);
  const chevron = page.locator('.collapse-button');
  await chevron.scrollIntoViewIfNeeded();
  const cb = await centerOf(chevron);
  log(`collapse button box: ${JSON.stringify(cb.box)}`);
  await tap(cb.x, cb.y);
  st = await stats();
  log(`after tapping chevron: bankOpen=${st.bankOpen}`);
  if (st.bankOpen) {
    const bankCard = page.locator('[data-bank-place="1"][data-bank-digit="5"]');
    await bankCard.scrollIntoViewIfNeeded();
    const bc = await centerOf(bankCard);
    log(`bank card box: ${JSON.stringify(bc.box)}`);
    await tap(bc.x, bc.y);
    st = await stats();
    log(`after tap-add: pieces=${st.pieces} cards=${st.cards} chromes=${st.chromes.length}`);
    log(st.pieces === '1' ? 'PASS tap-add works with tray expanded' : 'FAIL tap-add on 390px viewport');
  }
  await page.screenshot({ path: '/private/var/folders/jj/dwh8bmw17yx60ttc9np3zlfr0000gn/T/opencode/phone-open.png', fullPage: false });
  await browser.close();
}

// ---- D. tray scroll from the background between cards (hundreds row) ------
{
  const s = await makeSession({ width: 1194, height: 834 });
  const { browser, page, drag, stats } = s;
  log('\n=== D: tray scroll when touch starts in the row background ===');
  const strip = page.locator('.bank-strip').first();
  const box = await strip.boundingBox();
  // find an x within the strip that is NOT on a bank card
  const gapX = await page.evaluate(
    ([left, top, height, width]) => {
      const el = document.elementFromPoint(left + width * 0.5, top + height / 2);
      let x = left + 2;
      for (; x < left + width - 24; x += 4) {
        const at = document.elementFromPoint(x, top + height / 2);
        if (at && !at.closest('[data-bank-place]')) return x;
      }
      return null;
    },
    [box.x, box.y, box.height, box.width],
  );
  log(`non-card x in strip: ${gapX} (strip ${box.width}px wide)`);
  if (gapX) {
    const stripHandle = await strip.elementHandle();
    const before = await page.evaluate((el) => el.scrollLeft, stripHandle);
    await drag({ x: gapX, y: box.y + box.height / 2 }, { x: gapX - 260, y: box.y + box.height / 2 });
    const after = await page.evaluate((el) => el.scrollLeft, stripHandle);
    const st = await stats();
    log(`scrollLeft before=${before} after=${after} pieces=${st.pieces}`);
    log(after > before ? 'PASS scroll works from the background' : 'FAIL scroll from strip background');
  }
  await browser.close();
}

// ---- E. chrome button target sizes across viewports ------------------------
{
  const s = await makeSession({ width: 1194, height: 834 });
  const { browser, page } = s;
  log('\n=== E: touch target sizes (desktop-size canvas) ===');
  const sizes = await page.evaluate(() => {
    const measure = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const cs = getComputedStyle(el);
      return { sel, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height };
    };
    return [
      '.chrome-button.remove',
      '.collapse-button',
      '.scroll-hint.left',
      'button[aria-label="X-ray peek"]',
      'button[aria-label="Sound"]',
      '.guide-close',
      '.chrome-value',
    ].map(measure);
  });
  for (const it of sizes) log(` ${it.sel}: ${it.w ? `${it.w.toFixed(0)}x${it.h.toFixed(0)}` : 'missing'}`);
  await browser.close();
}

log('\nDONE');
