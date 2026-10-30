/* =========================================================
   DECO · Small effects
   Liquid: ink shapes on their own layer run through an SVG goo filter, so
   touching shapes melt into each other while the text above stays crisp.
   Beam: one pass of light along an element's border, following its corner
   shape. It runs once and never loops.
   Fly: a photo travels to the bag when a piece is added.
   Flip: list items glide to their new places when a filter or sort changes.
   All follow the house motion: ease settle, no bounce, nothing with
   prefers-reduced-motion.
   ========================================================= */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  /* ---------- Liquid ---------- */
  const defs = document.createElementNS(NS, 'svg');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.appendChild(defs);

  /* blur sets how soft the goo is, contrast how tight its edge is. */
  function filter(blur, contrast) {
    const id = `goo-${blur}-${contrast}`;
    if (!document.getElementById(id)) {
      defs.insertAdjacentHTML('beforeend',
        `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">` +
        `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}"/>` +
        `<feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} ${-(contrast / 2 - 0.5)}"/></filter>`);
    }
    return id;
  }

  /* layer: an element whose children are the ink shapes, sitting beside the
     content it mirrors inside the same positioned parent. fit(targets) lays
     shape i over targets[i], ignoring transforms so both can move together. */
  function liquid(layer, { blur = 6, contrast = 18 } = {}) {
    layer.style.filter = `url(#${filter(blur, contrast)})`;
    const shapes = [...layer.children];
    let targets = [];
    const fit = (list) => {
      if (list) targets = list;
      targets.forEach((t, i) => {
        const s = shapes[i];
        if (!s) return;
        s.style.left = `${t.offsetLeft - layer.offsetLeft}px`;
        s.style.top = `${t.offsetTop - layer.offsetTop}px`;
        s.style.width = `${t.offsetWidth}px`;
        s.style.height = `${t.offsetHeight}px`;
      });
    };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => fit()) : null;
    return {
      shapes,
      fit(list) { fit(list); if (ro) { ro.disconnect(); list.forEach((t) => ro.observe(t)); } }
    };
  }

  /* ---------- Beam ---------- */
  /* A rounded rectangle whose corners are superellipse quarters, the same
     curves CSS draws: n = 2 is a circle, n = 4 is corner-shape: squircle. */
  function outline(w, h, r, n) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const e = 2 / n, steps = 18, f = (v) => Math.round(v * 100) / 100, out = [];
    const corner = (cx, cy, sx, sy, down) => {
      for (let i = 0; i <= steps; i++) {
        const t = (down ? 1 - i / steps : i / steps) * Math.PI / 2;
        out.push(`L ${f(cx + sx * r * Math.abs(Math.cos(t)) ** e)} ${f(cy + sy * r * Math.abs(Math.sin(t)) ** e)}`);
      }
    };
    /* clockwise from the top edge */
    corner(w - r, r, 1, -1, true);
    corner(w - r, h - r, 1, 1, false);
    corner(r, h - r, -1, 1, true);
    corner(r, r, -1, -1, false);
    return `M ${f(r)} 0 ${out.join(' ')} Z`;
  }

  function beam(el, { duration = 1200, length = 0.22 } = {}) {
    if (!el || reduce.matches || !el.animate) return;
    const cs = getComputedStyle(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return;
    const bw = parseFloat(cs.borderTopWidth) || 0;
    /* ride the middle of the border, or just inside it when the element clips its overflow */
    const inset = cs.overflow === 'visible' ? bw / 2 : bw + 1;
    const shape = cs.getPropertyValue('corner-top-left-shape') || cs.cornerTopLeftShape || '';
    const n = /superellipse\(2\)|squircle/.test(shape) ? 4 : 2;
    const r = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2) - inset;
    if (cs.position === 'static') el.style.position = 'relative';

    el.querySelector(':scope > .beam')?.remove();
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'beam');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', `${-inset} ${-inset} ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    /* cover the border box exactly, so one unit is one pixel */
    svg.style.cssText = `left:${-bw}px;top:${-bw}px;width:${w}px;height:${h}px`;
    const d = outline(w - 2 * inset, h - 2 * inset, r, n);
    const L = 1000, head = Math.round(L * length * 0.3), tail = Math.round(L * length);
    svg.innerHTML = `<path d="${d}" pathLength="${L}" class="beam__tail"/><path d="${d}" pathLength="${L}" class="beam__head"/>`;
    el.appendChild(svg);

    const run = (p, len, peak) => {
      p.style.strokeDasharray = `${len} ${L - len}`;
      return p.animate([
        { strokeDashoffset: len, opacity: 0 },
        { opacity: peak, offset: 0.12 },
        { opacity: peak, offset: 0.62 },
        { strokeDashoffset: len - L, opacity: 0 }
      ], { duration, easing: EASE, fill: 'forwards' });
    };
    const [t, hd] = svg.querySelectorAll('path');
    run(t, tail, 0.45);
    run(hd, head, 1).finished.then(() => svg.remove(), () => svg.remove());
  }

  /* One pass of light along a bottom rule, left to right. */
  function line(el, { duration = 1200 } = {}) {
    if (!el || reduce.matches || !el.animate) return;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.querySelector(':scope > .beam-line')?.remove();
    const track = document.createElement('span');
    track.className = 'beam-line';
    track.setAttribute('aria-hidden', 'true');
    track.innerHTML = '<i></i>';
    el.appendChild(track);
    track.firstChild.animate([
      { transform: 'translateX(-100%)', opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { opacity: 1, offset: 0.7 },
      { transform: 'translateX(330%)', opacity: 0 }
    ], { duration, easing: EASE, fill: 'forwards' }).finished.then(() => track.remove(), () => track.remove());
  }

  /* ---------- Fly ---------- */
  /* A small copy of a photo travels to a target (the bag icon) and shrinks into it.
     Two nested layers move on different curves, so the path is an arc, not a line.
     Resolves when it lands, straight away with reduced motion. */
  function fly(from, to, { duration = 800 } = {}) {
    if (!from || !to || reduce.matches || !document.body.animate) return Promise.resolve();
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (!a.width || !b.width || a.bottom < 0 || a.top > innerHeight) return Promise.resolve();
    const size = Math.min(a.width, a.height, 140);
    const x0 = a.left + a.width / 2 - size / 2, y0 = a.top + a.height / 2 - size / 2;
    const dx = b.left + b.width / 2 - size / 2 - x0, dy = b.top + b.height / 2 - size / 2 - y0;
    const outer = document.createElement('div');
    outer.className = 'fly';
    outer.setAttribute('aria-hidden', 'true');
    outer.style.cssText = `left:${x0}px;top:${y0}px;width:${size}px;height:${size}px`;
    const inner = document.createElement('div');
    const src = from.currentSrc || from.src;
    if (src) inner.style.backgroundImage = `url("${src}")`;
    outer.appendChild(inner);
    document.body.appendChild(outer);
    outer.animate([{ transform: 'none' }, { transform: `translateX(${dx}px)` }], { duration, easing: EASE, fill: 'forwards' });
    return inner.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translateY(${dy * 0.35}px) scale(.6)`, opacity: 1, offset: 0.45 },
      { transform: `translateY(${dy}px) scale(.14)`, opacity: 0.4 }
    ], { duration, easing: 'cubic-bezier(0.55, 0, 0.75, 0.6)', fill: 'forwards' })
      .finished.then(() => outer.remove(), () => outer.remove());
  }

  /* ---------- Flip ---------- */
  /* Children of a list glide from where they were to where they are after `change()`
     reorders, adds or removes them. Children are matched by data-key; new ones fade in. */
  function flip(list, change, { duration = 480 } = {}) {
    if (!list || reduce.matches || !document.body.animate) { change(); return; }
    const before = new Map();
    for (const el of list.children) if (el.dataset.key) before.set(el.dataset.key, el.getBoundingClientRect());
    change();
    let fresh = 0;
    for (const el of list.children) {
      const a = before.get(el.dataset.key);
      if (!el.dataset.key) continue;
      if (a) {
        const b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing: EASE });
      } else {
        el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration, easing: EASE, delay: Math.min(fresh++, 8) * 40, fill: 'backwards' });
      }
    }
  }

  window.DECO_FX = { liquid, beam, line, fly, flip };
})();
