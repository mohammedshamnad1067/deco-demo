/* =========================================================
   DECO · Smooth corners fallback
   Browsers that draw `corner-shape: squircle` need nothing from this file.
   Elsewhere (Safari, Firefox) it clips each rounded element to an iOS-style
   continuous corner, using the element's own border-radius as the iOS radius.
   Bordered elements (fields, option rows) keep a standard radius there.
   Add ?sq=js to the URL to force this path in Chrome for testing.
   ========================================================= */
(function () {
  'use strict';

  const SEL = '.ratio, .hero__tag, .cat__txt, .stage, .stage__cap, .gone, .slot__img, .band__tag, .teaser__plan, .pl__row, .pl__thumb';
  const SMOOTHING = 0.6; // iOS continuous corners
  const force = /[?&]sq=js\b/.test(location.search);
  const native = window.CSS && CSS.supports && CSS.supports('corner-shape', 'squircle');
  if ((native && !force) || !('ResizeObserver' in window)) return;
  if (force) document.documentElement.style.setProperty('--k', '1');

  const rad = (deg) => deg * Math.PI / 180;
  const f = (n) => Math.round(n * 100) / 100;

  /* Corner smoothing as Figma draws it: the middle of each corner stays on the
     radius-r arc, and two cubic curves ease into the straight edges. */
  function path(w, h, radius) {
    const budget = Math.min(w, h) / 2;
    const r = Math.min(radius, budget);
    let s = SMOOTHING;
    let p = (1 + s) * r;
    s = Math.min(s, budget / r - 1);
    p = Math.min(p, budget);
    const arc = 90 * (1 - s);
    const l = Math.sin(rad(arc / 2)) * r * Math.SQRT2;
    const alpha = (90 - arc) / 2;
    const p34 = r * Math.tan(rad(alpha / 2));
    const beta = 45 * s;
    const c = p34 * Math.cos(rad(beta));
    const d = c * Math.tan(rad(beta));
    const b = (p - l - c - d) / 3;
    const a = 2 * b;
    const [A, B, C, D, L, R] = [a, a + b, a + b + c, d, l, r].map(f);
    const bc = f(b + c);
    return `path("M ${f(w - p)} 0 c ${A} 0 ${B} 0 ${C} ${D} a ${R} ${R} 0 0 1 ${L} ${L} c ${D} ${f(c)} ${D} ${bc} ${D} ${C} ` +
      `L ${w} ${f(h - p)} c 0 ${A} 0 ${B} ${-D} ${C} a ${R} ${R} 0 0 1 ${-L} ${L} c ${-f(c)} ${D} ${-bc} ${D} ${-C} ${D} ` +
      `L ${f(p)} ${h} c ${-A} 0 ${-B} 0 ${-C} ${-D} a ${R} ${R} 0 0 1 ${-L} ${-L} c ${-D} ${-f(c)} ${-D} ${-bc} ${-D} ${-C} ` +
      `L 0 ${f(p)} c 0 ${-A} 0 ${-B} ${D} ${-C} a ${R} ${R} 0 0 1 ${L} ${-L} c ${f(c)} ${-D} ${bc} ${-D} ${C} ${-D} Z")`;
  }

  function shape(el, w, h) {
    const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    el.style.clipPath = r > 0 && w > 0 && h > 0 ? path(w, h, r) : '';
  }

  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const box = e.borderBoxSize && e.borderBoxSize[0];
      shape(e.target, box ? box.inlineSize : e.target.offsetWidth, box ? box.blockSize : e.target.offsetHeight);
    }
  });

  const each = (node, fn) => {
    if (node.nodeType !== 1) return;
    if (node.matches(SEL)) fn(node);
    node.querySelectorAll(SEL).forEach(fn);
  };
  const watch = (el) => { if (force) el.style.setProperty('corner-shape', 'round'); ro.observe(el); };

  each(document.body, watch);
  new MutationObserver((list) => {
    for (const m of list) {
      m.addedNodes.forEach((n) => each(n, watch));
      m.removedNodes.forEach((n) => each(n, (el) => ro.unobserve(el)));
    }
  }).observe(document.body, { childList: true, subtree: true });

  /* Radii change at the mobile breakpoint without a size change on every element. */
  matchMedia('(max-width: 760px)').addEventListener('change', () => each(document.body, (el) => shape(el, el.offsetWidth, el.offsetHeight)));
})();
