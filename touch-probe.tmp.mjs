/**
 * Touch-emulation probe for Arrow Math.
 * Dispatches raw touch sequences through CDP so both touch and pointer events
 * fire in the renderer, like a real mobile/tablet browser.
 */
import { chromium, devices } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';

async function withPage(label, contextOptions, fn) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    hasTouch: true,
    ...contextOptions,
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-workbench]').waitFor();
  await page.waitForTimeout(300);

  const touchStart = (points) =>
    client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: points.map((p) => ({ ...p, id: p.id ?? 1 })),
    });
  const touchMove = (points) =>
    client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points.map((p) => ({ ...p, id: p.id ?? 1 })),
    });
  const touchEnd = () => client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  const tap = async (x, y) => {
    await touchStart([{ x, y }]);
    await touchEnd();
    await page.waitForTimeout(120);
  };

  const drag = async (from, to, opts = {}) => {
    const steps = opts.steps ?? 12;
    await touchStart([{ x: from.x, y: from.y }]);
    await page.waitForTimeout(40);
    if (opts.firstQi && opts.firstQi > 0) {
      // tiny first move (device jitter)
      await touchMove([{ x: from.x + 2, y: from.y + 1 }]);
      await page.waitForTimeout(16);
    }
    for (let i = 1; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      await touchMove([{ x, y }]);
      await page.waitForTimeout(12);
    }
    await page.waitForTimeout(60);
    await touchEnd();
    await page.waitForTimeout(200);
  };

  const centerOf = async (locator) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error('no box for ' + locator);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
  };

  const stats = () =>
    page.evaluate(() => {
      const bench = document.querySelector('[data-workbench]');
      const cards = [...document.querySelectorAll('.card-node')].map((c) => ({
        piece: c.dataset.piece,
        cardId: c.dataset.cardId,
        place: c.dataset.place,
        digit: c.dataset.digit,
        rect: c.getBoundingClientRect().toJSON(),
      }));
      const chromes = [...document.querySelectorAll('.piece-chrome')].map((c) => ({
        pieceId: c.dataset.pieceId,
        mode: c.dataset.mode,
        rect: c.getBoundingClientRect().toJSON(),
        text: c.textContent.replace(/\s+/g, ' ').trim(),
      }));
      return {
        cards: bench.dataset.cardCount,
        pieces: bench.dataset.pieceCount,
        cardRects: cards,
        chromes,
      };
    });

  try {
    await fn({ page, tap, drag, touchStart, touchMove, touchEnd, stats, centerOf });
  } catch (error) {
    console.log(`\n[${label}] ERROR:`, error.message?.split('\n')[0]);
  } finally {
    await browser.close();
  }
}

const log = (...args) => console.log(...args);

// ---------------------------------------------------------------------------
await withPage('iPad landscape 1194x834', { viewport: { width: 1194, height: 834 } }, async (ctx) => {
  const { page, tap, drag, stats, centerOf } = ctx;

  log('\n=== T1: tap a bank card to add ===');
  const bankCard = page.locator('[data-bank-place="1000"][data-bank-digit="3"]');
  await bankCard.scrollIntoViewIfNeeded();
  const bc = await centerOf(bankCard);
  await tap(bc.x, bc.y);
  let s = await stats();
  log(`after tap: pieces=${s.pieces} cards=${s.cards} chromes=${s.chromes.length} ${JSON.stringify(s.chromes.map((c) => c.text))}`);

  log('\n=== T2: tap chrome remove button ===');
  const rm = page.locator('.piece-chrome .chrome-button.remove');
  if ((await rm.count()) === 0) {
    log('FAIL: no chrome remove button visible after tap-select');
  } else {
    const rc = await centerOf(rm.first());
    await tap(rc.x, rc.y);
    s = await stats();
    log(`after remove tap: pieces=${s.pieces} cards=${s.cards}`);
  }

  log('\n=== T3: touch-drag a canvas card ===');
  await page.locator('#make-number').fill('7');
  await page.getByRole('button', { name: 'Add Stacked' }).tap();
  await page.waitForTimeout(150);
  s = await stats();
  const before = s.cardRects[0]?.rect;
  log(`piece at x=${before?.x?.toFixed(1)} y=${before?.y?.toFixed(1)}`);
  const from = { x: before.x + 30, y: before.y + 30 };
  await drag(from, { x: from.x + 140, y: from.y + 90 }, { firstQi: true });
  s = await stats();
  const after = s.cardRects[0]?.rect;
  log(`after touch-drag: x=${after?.x?.toFixed(1)} y=${after?.y?.toFixed(1)} pieces=${s.pieces} chromes=${s.chromes.length}`);
  const moved = after && before && (Math.abs(after.x - before.x) > 40 || Math.abs(after.y - before.y) > 40);
  log(moved ? 'PASS: card followed the finger' : 'FAIL: card did not follow the finger');

  log('\n=== T4: touch-drag from tray onto canvas ===');
  const trayCard = page.locator('[data-bank-place="100"][data-bank-digit="4"]');
  await trayCard.scrollIntoViewIfNeeded();
  const tc = await centerOf(trayCard);
  const workbenchBox = await page.locator('[data-workbench]').boundingBox();
  const drop = { x: workbenchBox.x + 200, y: workbenchBox.y + 150 };
  await drag({ x: tc.x, y: tc.y }, drop);
  s = await stats();
  log(`after tray drag-drop: pieces=${s.pieces} cards=${s.cards}`);
  log(s.pieces === '2' ? 'PASS: bank drag-drop added the card' : 'FAIL: pieces=' + s.pieces);

  log('\n=== T5: make stacked 4325 then tap chrome Expand ===');
  await page.locator('#make-number').fill('4325');
  await page.getByRole('button', { name: 'Add Stacked' }).tap();
  await page.waitForTimeout(200);
  s = await stats();
  log(`pieces=${s.pieces} cards=${s.cards} chrome modes=${JSON.stringify(s.chromes.map((c) => c.mode))}`);
  const expBtn = page.locator('.piece-chrome .chrome-button', { hasText: 'Expand' });
  if ((await expBtn.count()) === 0) {
    log('FAIL: no Expand button on chrome');
  } else {
    const eb = await centerOf(expBtn.first());
    await tap(eb.x, eb.y);
    await page.waitForTimeout(300);
    s = await stats();
    log(`after Expand tap: modes=${JSON.stringify(s.chromes.map((c) => c.mode))} chromes=${s.chromes.length}`);
  }

  log('\n=== T6: double-tap stacked group toggles mode ===');
  // stack a fresh pair: 40 dragged onto 300, centre to centre
  await page.locator('#make-number').fill('300');
  await page.getByRole('button', { name: 'Add Stacked' }).tap();
  await page.locator('#make-number').fill('40');
  await page.getByRole('button', { name: 'Add Stacked' }).tap();
  await page.waitForTimeout(250);
  s = await stats();
  log(`setup: pieces=${s.pieces} cards=${s.cards}`);
  if (s.pieces === '2') {
    const target = s.cardRects.find((c) => c.digit === '3');
    const dragged = s.cardRects.find((c) => c.digit === '4');
    if (target && dragged) {
      const from = { x: dragged.rect.x + dragged.rect.width / 2, y: dragged.rect.y + dragged.rect.height / 2 };
      const to = { x: target.rect.x + target.rect.width / 2, y: target.rect.y + target.rect.height / 2 };
      await drag(from, to);
      s = await stats();
      log(`after merge drag: pieces=${s.pieces} cards=${s.cards}`);
      if (s.pieces === '1') {
        await page.waitForTimeout(400);
        s = await stats();
        const stackedChrome = s.chromes[0];
        const ccenter = { x: stackedChrome.rect.x + 40, y: stackedChrome.rect.y + stackedChrome.rect.height / 2 };
        log(`before double-tap: mode=${stackedChrome.mode} chromes=${s.chromes.length}`);
        await tap(ccenter.x, ccenter.y);
        await page.waitForTimeout(140);
        await tap(ccenter.x, ccenter.y);
        await page.waitForTimeout(500);
        s = await stats();
        log(`after double-tap: mode=${s.chromes[0]?.mode} chromes=${s.chromes.length} pieces=${s.pieces} cards=${s.cards}`);
        log(s.chromes[0]?.mode === 'expand' ? 'PASS: double-tap expanded the group' : 'FAIL: double-tap did nothing');
      }
    }
  }

  log('\n=== T7: tap empty canvas deselects ===');
  const bench = await page.locator('[data-workbench]').boundingBox();
  await tap(bench.x + bench.width / 2, bench.y + bench.height - 40);
  await page.waitForTimeout(600);
  s = await stats();
  log(`chromes visible after tapping empty canvas: ${s.chromes.length} (expect 0 deselect)`);

  log('\n=== T8: horizontal touch-scroll of a tray row ===');
  const strip = page.locator('.bank-strip').first();
  const stripBox = await strip.boundingBox();
  const beforeScroll = await page.evaluate((el) => el.scrollLeft, await strip.elementHandle());
  // start the touch ON a tray card (the likely real-world mistake)
  const trayCard2 = page.locator('[data-bank-place="1000"][data-bank-digit="1"]');
  await trayCard2.scrollIntoViewIfNeeded();
  const t2 = await centerOf(trayCard2);
  await drag({ x: t2.x, y: t2.y }, { x: t2.x - 240, y: t2.y });
  const afterScroll = await page.evaluate((el) => el.scrollLeft, await strip.elementHandle());
  s = await stats();
  log(`scrollLeft before=${beforeScroll} after=${afterScroll} pieces=${s.pieces}`);
  log(afterScroll > beforeScroll ? 'PASS: strip scrolled from a card touch' : `FAIL: strip did not scroll when touch started on a card; pieces=${s.pieces} (added=${Number(s.pieces) - 4})`);
});

// ---------------------------------------------------------------------------
await withPage('iPhone portrait 390x844', { viewport: { width: 390, height: 844 } }, async (ctx) => {
  const { page, tap, stats, centerOf, drag } = ctx;
  let s;
  log('\n=== P1: phone — tap-add + chrome visibility ===');
  s = await stats();
  const bankCard = page.locator('[data-bank-place="1"][data-bank-digit="5"]');
  await bankCard.scrollIntoViewIfNeeded();
  const bc = await centerOf(bankCard);
  await tap(bc.x, bc.y);
  s = await stats();
  log(`after tap: pieces=${s.pieces} cards=${s.cards} chromes=${s.chromes.length}`);

  log('\n=== P2: can the toolbar controls be tapped (icon-only sizes) ===');
  const xray = page.locator('button[aria-label="X-ray peek"]');
  const xb = await centerOf(xray);
  await tap(xb.x, xb.y);
  await page.waitForTimeout(150);
  const pressed = await xray.getAttribute('aria-pressed');
  log(`X-ray aria-pressed=${pressed}`);

  log('\n=== P3: tray strip horizontal scroll on phone ===');
  const strip = page.locator('.bank-strip').first();
  await strip.scrollIntoViewIfNeeded();
  const sBox = await strip.boundingBox();
  const beforeScroll = await page.evaluate((el) => el.scrollLeft, await strip.elementHandle());
  // try scrolling by starting on the strip background between cards
  await drag({ x: sBox.x + sBox.width * 0.8, y: sBox.y + sBox.height / 2 }, { x: sBox.x + sBox.width * 0.25, y: sBox.y + sBox.height / 2 });
  const afterScroll = await page.evaluate((el) => el.scrollLeft, await strip.elementHandle());
  log(`scrollLeft before=${beforeScroll} after=${afterScroll}`);

  log('\n=== P4: touch-drag a card on the small canvas ===');
  const card5 = page.locator('.card-node[data-place="1"][data-digit="5"]');
  if ((await card5.count()) === 0) {
    log('(skipped, card missing)');
  } else {
    const cardBox = await centerOf(card5);
    const from = { x: cardBox.box.x + 10, y: cardBox.box.y + 30 };
    await drag(from, { x: from.x + 90, y: from.y - 60 });
    const s2 = await stats();
    log(`pieces=${s2.pieces}`);
    const rect = s2.cardRects[0]?.rect;
    log(`card now at x=${rect?.x?.toFixed(1)} y=${rect?.y?.toFixed(1)}`);
  }

  await page.screenshot({ path: '/private/var/folders/jj/dwh8bmw17yx60ttc9np3zlfr0000gn/T/opencode/phone.png' });
});

log('\nDONE');
