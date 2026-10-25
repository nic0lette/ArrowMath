import { ARROW_TIP_WIDTH, CARD_HEIGHT } from 'arrow-cards';
import { SPRING_DEFAULT } from './geometry';

/** The look of a card's digit end bending up when it is aimed at. */
export const PAPER_CURL = {
  /** Bend at the free edge, in degrees. The bend grows evenly along the end. */
  angle: 50,
  /** Longest stretch of card that bends, measured from the free edge. */
  maxLength: 100,
  perspective: 720,
  /** Eye height, as a fraction of the card height from its top edge. */
  viewpoint: 1.2,
  /** How much the light from the left brightens the bent end. */
  shading: 0.5,
  /** Darkness of the shadow the lifted end casts on the table. */
  flapShadow: 0.6,
} as const;

/**
 * Length of the part that bends. A card in a stack bends from where the next
 * card holds it down; the arrow tip never bends.
 */
export function curlLength(width: number, visibleWidth: number): number {
  return Math.max(10, Math.min(visibleWidth, PAPER_CURL.maxLength, width - ARROW_TIP_WIDTH));
}

export interface PaperCurlParams {
  bent: boolean;
  width: number;
  length: number;
}

const H = CARD_HEIGHT;
/** Room around the card bitmap for the stroke, which sits half outside the card. */
const SRC_PAD = 3;
/** Room around the drawn card for the bent end, which grows as it lifts. */
const PAD = 90;
const DEG = Math.PI / 180;
const LAYER_STYLE = 'position:absolute;left:0;top:0;overflow:visible;opacity:0';
const LIGHT_X = -0.55;
const LIGHT_Z = 0.835;

interface Source {
  canvas: HTMLCanvasElement;
  dpr: number;
  ready: boolean;
  waiting: Set<() => void>;
}

const sources = new Map<string, Source>();
let uid = 0;

/**
 * A bitmap of the card as it looks right now, stylesheet tweaks included, for
 * drawing the bent end. Two details keep it identical to the SVG beside it:
 * the viewBox is padded, because an SVG drawn as an image is cut off at its
 * viewBox and would lose the outer half of the stroke; and the image is sized
 * in device pixels, because Chrome draws an SVG image at its own size and
 * scales that, which blurs it on high-density screens.
 */
function cardSource(svg: SVGSVGElement, width: number): Source {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const live = svg.querySelectorAll<SVGElement>('path, line, text');
  clone.querySelectorAll<SVGElement>('path, line, text').forEach((element, index) => {
    // Stylesheet rules (e.g. the move-intent outline) do not reach an SVG
    // drawn as an image.
    const style = getComputedStyle(live[index]);
    element.setAttribute('fill-opacity', style.fillOpacity);
    element.setAttribute('stroke-opacity', style.strokeOpacity);
    element.setAttribute('opacity', style.opacity);
    // The drop shadow is drawn separately, so it can follow the bend.
    element.removeAttribute('filter');
  });
  const outerW = width + SRC_PAD * 2;
  const outerH = H + SRC_PAD * 2;
  clone.setAttribute('viewBox', `${-SRC_PAD} ${-SRC_PAD} ${outerW} ${outerH}`);
  clone.setAttribute('width', String(outerW * dpr));
  clone.setAttribute('height', String(outerH * dpr));
  const markup = new XMLSerializer().serializeToString(clone);

  const key = `${dpr}|${markup}`;
  const cached = sources.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(outerW * dpr);
  canvas.height = Math.round(outerH * dpr);
  const source: Source = { canvas, dpr, ready: false, waiting: new Set() };
  sources.set(key, source);
  // Theme and outline changes make new bitmaps; keep only the recent ones.
  if (sources.size > 48) sources.delete(sources.keys().next().value!);

  const image = new Image();
  image.onload = () => {
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    source.ready = true;
    source.waiting.forEach((redraw) => redraw());
    source.waiting.clear();
  };
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  return source;
}

/** Brightening of a surface turned by `phi` toward the light on the left. */
function shadeFor(phi: number): number {
  const ratio = (Math.sin(phi * DEG) * -LIGHT_X + Math.cos(phi * DEG) * LIGHT_Z) / LIGHT_Z;
  return Math.max(0, ratio - 1) * PAPER_CURL.shading;
}

/**
 * Bends a card's digit end up like paper. Attach it to an empty layer inside
 * the card; while the card bends, the layer draws the whole card on a canvas
 * and hides the card's SVG. Bent and flat parts then come from one renderer,
 * so they can never land on different pixels and show a step in the border.
 *
 * The bend is around a vertical line, so every column of the card stays a
 * straight vertical line on screen; perspective only moves it sideways and
 * makes it taller. The end is drawn one device-pixel column at a time.
 */
export function paperCurl(node: HTMLElement, initial: PaperCurlParams) {
  let params = initial;
  let length = initial.length;
  let theta = 0;
  let velocity = 0;
  let frame = 0;
  let lastTime = 0;
  let source: Source | null = null;
  const card = node.parentElement!;
  const id = `paper-${++uid}`;

  node.innerHTML =
    `<svg class="paper-flap-shadow" height="${H}" style="${LAYER_STYLE}"><defs>` +
    `<linearGradient id="${id}-fg" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#0f172a" stop-opacity="0.55"/><stop offset="1" stop-color="#0f172a" stop-opacity="0"/></linearGradient>` +
    `<filter id="${id}-ff" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs>` +
    `<rect y="3" height="${H - 6}" rx="9" fill="url(#${id}-fg)" filter="url(#${id}-ff)"/></svg>` +
    `<svg class="paper-rest-shadow" height="${H}" style="${LAYER_STYLE}"><defs>` +
    `<linearGradient id="${id}-rg" gradientUnits="userSpaceOnUse" x1="0" y1="0" y2="0"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></linearGradient>` +
    `<mask id="${id}-rm" maskUnits="userSpaceOnUse" x="-20" y="-20" height="${H + 40}"><rect x="-20" y="-20" height="${H + 40}" fill="url(#${id}-rg)"/></mask>` +
    `<filter id="${id}-rf" x="-10%" y="-10%" width="120%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs>` +
    `<path transform="translate(0 3)" fill="#0f172a" fill-opacity="0.12" filter="url(#${id}-rf)" mask="url(#${id}-rm)"/></svg>` +
    `<canvas class="paper-canvas" style="position:absolute;left:${-PAD}px;top:${-PAD}px;display:none"></canvas>`;

  const flapShadow = node.querySelector<SVGSVGElement>('.paper-flap-shadow')!;
  const flapRect = flapShadow.querySelector('rect')!;
  const restShadow = node.querySelector<SVGSVGElement>('.paper-rest-shadow')!;
  const restFade = restShadow.querySelector('stop')!;
  const canvas = node.querySelector<HTMLCanvasElement>('.paper-canvas')!;

  function shape() {
    const { width } = params;
    const outline = card.querySelector('.arrow-card-svg > path')?.getAttribute('d') ?? '';
    flapShadow.setAttribute('width', String(length));
    flapRect.setAttribute('width', String(length));
    restShadow.setAttribute('width', String(width));
    restShadow.querySelector('linearGradient')!.setAttribute('x2', String(length));
    for (const element of restShadow.querySelectorAll('mask, mask rect')) {
      element.setAttribute('width', String(width + 40));
    }
    restShadow.querySelector('path')!.setAttribute('d', outline);
  }
  shape();

  function setCardVisible(visible: boolean) {
    for (const element of card.querySelectorAll<HTMLElement>(':scope > .arrow-card')) {
      element.style.visibility = visible ? '' : 'hidden';
    }
    canvas.style.display = visible ? 'none' : '';
    node.dataset.bent = visible ? 'false' : 'true';
  }

  function draw() {
    const { width } = params;
    const L = length;
    const bending = theta > 0.05;

    // Height of the free edge, for the shadows.
    let edgeZ = 0;
    for (let step = 0; step < 24; step++) {
      edgeZ += (L / 24) * Math.sin(theta * ((step + 0.5) / 24) * DEG);
    }
    const lift = Math.min(1, edgeZ / 36);
    flapShadow.style.opacity = String(PAPER_CURL.flapShadow * lift);
    flapShadow.style.transform = `translate(-1px, ${3 + 7 * lift}px)`;
    restFade.setAttribute('stop-opacity', String(1 - lift));

    if (bending && !source) {
      const svg = card.querySelector<SVGSVGElement>('.arrow-card-svg');
      if (svg) source = cardSource(svg, width);
    }
    if (!bending || !source?.ready) {
      if (bending) source?.waiting.add(draw);
      if (!bending) source = null;
      restShadow.style.opacity = '0';
      setCardVisible(true);
      return;
    }
    restShadow.style.opacity = '1';
    setCardVisible(false);

    // Whole CSS pixels and an exact device-pixel backing store, so the
    // browser shows the canvas 1:1. A half-pixel size gets rounded and the
    // whole canvas is resampled, which blurs it.
    const { dpr } = source;
    const cssW = width + PAD * 2;
    const cssH = H + PAD * 2;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, PAD * dpr, PAD * dpr);
    ctx.imageSmoothingQuality = 'high';

    const p = PAPER_CURL.perspective;
    const ox = width / 2;
    const oy = H * PAPER_CURL.viewpoint;
    const srcTop = -SRC_PAD;
    const srcH = H + SRC_PAD * 2;

    // The flat part in one piece.
    const flatW = width + SRC_PAD - L;
    ctx.drawImage(source.canvas, (L + SRC_PAD) * dpr, 0, flatW * dpr, srcH * dpr, L, srcTop, flatW, srcH);

    // Then the bent end, column by column from the hold out past the edge.
    const du = 1 / dpr;
    const columns: Array<[number, number, number, number, number]> = [];
    let x = L;
    let z = 0;
    let prevScale = 1;
    let prevX = L;
    for (let u = L - du; u > -SRC_PAD - du / 2; u -= du) {
      const r = Math.min(1, Math.max(0, (L - (u + du / 2)) / L));
      const phi = theta * r;
      x -= du * Math.cos(phi * DEG);
      z += du * Math.sin(phi * DEG);
      const scale = p / (p - z);
      const screenX = ox + (x - ox) * scale;
      const midScale = (scale + prevScale) / 2;
      const top = oy + (srcTop - oy) * midScale;
      const columnW = prevX - screenX + 0.6 / dpr;
      ctx.drawImage(source.canvas, (u + SRC_PAD) * dpr, 0, 1, srcH * dpr, screenX, top, columnW, srcH * midScale);
      columns.push([screenX, top, columnW, srcH * midScale, shadeFor(phi)]);
      prevScale = scale;
      prevX = screenX;
    }

    // Light only where the card is, not on its transparent margin.
    ctx.globalCompositeOperation = 'source-atop';
    for (const [left, top, columnW, columnH, shade] of columns) {
      if (shade < 0.003) continue;
      ctx.fillStyle = `rgba(255, 255, 255, ${shade})`;
      ctx.fillRect(left, top, columnW, columnH);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // The bend runs on the same spring as the app's settles.
  function step(time: number) {
    const dt = Math.min(0.032, (time - lastTime) / 1000);
    lastTime = time;
    const target = params.bent ? PAPER_CURL.angle : 0;
    velocity += (SPRING_DEFAULT.stiffness * (target - theta) - SPRING_DEFAULT.damping * velocity) * dt;
    theta += velocity * dt;
    const settled = Math.abs(target - theta) < 0.05 && Math.abs(velocity) < 0.5;
    if (settled) {
      theta = target;
      velocity = 0;
    }
    draw();
    frame = settled ? 0 : requestAnimationFrame(step);
  }

  function start() {
    // Measure a new bend from the card as it is now; while one is under way,
    // keep its length so a card that is pulled out flattens smoothly.
    if (theta === 0 && params.bent) {
      length = params.length;
      shape();
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      theta = params.bent ? PAPER_CURL.angle : 0;
      velocity = 0;
      draw();
      return;
    }
    if (frame) return;
    lastTime = performance.now();
    frame = requestAnimationFrame(step);
  }

  start();

  return {
    update(next: PaperCurlParams) {
      const changed = next.bent !== params.bent || next.width !== params.width;
      params = next;
      if (theta === 0 && !next.bent) length = next.length;
      if (changed) start();
    },
    destroy() {
      cancelAnimationFrame(frame);
      source?.waiting.delete(draw);
    },
  };
}
