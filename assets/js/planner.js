/* =========================================================
   DECO · Room planner
   A top-down plan of one room at true scale. Pieces are drawn at their real
   width and depth, moved with the pointer or the arrow keys, turned in
   quarter turns, and added to the bag together. The plan is kept on this device.
   window.DECO_PLANNER = {
     mount(el, api)          → { unmount }   the planner on #/plan
     preview(el, name, api)  → { unmount }   a still plan of a laid-out room (2D home)
   }
   api comes from shop.js: PRODUCTS, CATEGORIES, FINISHES, bySlug, price, money, esc, ic,
   asset, store, toast, addMany, plural.
   ========================================================= */
(function () {
  'use strict';

  /* Pieces that stand on the floor. Pendants, wall pieces, table-top pieces and textiles stay out. */
  const SKIP = new Set(['dune-pendant-light', 'terra-pendant-light', 'wall-sconce', 'arco-wall-mirror', 'wall-art', 'cushion-collection', 'throw-blanket', 'decor-set', 'terra-bowl', 'luna-table-lamp', 'stone-table-lamp', 'stone-vase']);
  const ROUND = new Set(['sol-round-coffee-table', 'lua-coffee-table', 'cove-side-table', 'pebble-side-table', 'nest-tables', 'puff-ottoman', 'stone-nightstand', 'orbit-floor-lamp', 'luna-planter']);
  const RUG = new Set(['textured-rug']);                  // may lie under other pieces
  const FRONT = new Set(['seating', 'bedroom', 'storage']); // pieces with a front to face the room
  const MIN = 200, MAX = 1200, STEP = 10, SNAP = 5, SETTLE = 8;
  const NEUTRAL = '#CDBBA8';
  /* Laid-out rooms, in cm: [slug, x, y, turn]. x and y are the centre of the piece; turn 0 faces the bottom wall. */
  const PRESETS = {
    living: { name: 'Living room', w: 520, l: 420, items: [['textured-rug', 260, 230, 90], ['luna-sofa', 260, 355, 180], ['sol-round-coffee-table', 260, 225, 0], ['mira-lounge-chair', 185, 95, 0], ['mira-lounge-chair', 335, 95, 0], ['cove-side-table', 400, 375, 0], ['orbit-floor-lamp', 125, 375, 0], ['luna-planter', 475, 45, 0]] },
    bedroom: { name: 'Bedroom', w: 440, l: 400, items: [['vale-bed', 220, 120, 0], ['tomo-nightstand', 90, 35, 0], ['tomo-nightstand', 350, 35, 0], ['curve-bedroom-bench', 220, 260, 0], ['dune-dresser', 220, 365, 180], ['arco-mirror', 430, 300, 90]] },
    dining: { name: 'Dining room', w: 480, l: 420, items: [['terra-dining-table', 240, 220, 0], ['vale-dining-chair', 170, 130, 0], ['vale-dining-chair', 240, 130, 0], ['vale-dining-chair', 310, 130, 0], ['vale-dining-chair', 170, 310, 180], ['vale-dining-chair', 240, 310, 180], ['vale-dining-chair', 310, 310, 180], ['vale-sideboard', 240, 35, 0], ['luna-planter', 445, 385, 0]] }
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const stacked = matchMedia('(max-width: 899px), (max-width: 1024px) and (orientation: portrait)');
  const norm = (deg) => ((deg % 360) + 360) % 360;
  /* Footprint on the floor plan: width and depth swap on a quarter turn. */
  const fp = (it, bySlug) => { const [w, d] = bySlug[it.slug].dims; return norm(it.rot) % 180 ? [d, w] : [w, d]; };
  const boxOf = (it, bySlug) => { const [fw, fd] = fp(it, bySlug); return { x0: it.x - fw / 2, x1: it.x + fw / 2, y0: it.y - fd / 2, y1: it.y + fd / 2, w: fw }; };
  /* Two pieces overlap: rectangles, circles, or one of each. Touching is fine. */
  function hit(a, b, bySlug) {
    const A = boxOf(a, bySlug), B = boxOf(b, bySlug), ra = ROUND.has(a.slug), rb = ROUND.has(b.slug), e = 0.5;
    if (ra && rb) return Math.hypot(a.x - b.x, a.y - b.y) < (A.w + B.w) / 2 - e;
    if (ra || rb) {
      const [c, r] = ra ? [a, B] : [b, A], rad = (ra ? A.w : B.w) / 2;
      return Math.hypot(c.x - clamp(c.x, r.x0, r.x1), c.y - clamp(c.y, r.y0, r.y1)) < rad - e;
    }
    return A.x0 < B.x1 - e && B.x0 < A.x1 - e && A.y0 < B.y1 - e && B.y0 < A.y1 - e;
  }
  const toneOf = (it, FINISHES) => (it.finish && FINISHES[it.finish] ? FINISHES[it.finish].tone : NEUTRAL);
  const pieceClass = (p) => `pp${ROUND.has(p.slug) ? ' pp--round' : ''}${RUG.has(p.slug) ? ' pp--rug' : ''}${FRONT.has(p.category) ? ' pp--front' : ''}`;
  const pieceStyle = (it, p, FINISHES) => { const [w, d] = p.dims, swap = norm(it.rot) % 180; return `--x:${it.x};--y:${it.y};--w:${w};--d:${d};--fw:${swap ? d : w};--fd:${swap ? w : d};--r:${it.rot};--tone:${toneOf(it, FINISHES)}`; };
  const fromPreset = (name, bySlug) => {
    const pr = PRESETS[name];
    return { w: pr.w, l: pr.l, items: pr.items.filter(([s]) => bySlug[s]).map(([slug, x, y, rot]) => ({ slug, x, y, rot, finish: bySlug[slug].finishes[0] || null })) };
  };

  /* ---------- Planner ---------- */
  function mount(el, api) {
    const { esc, ic, price, money, asset, store, bySlug, FINISHES, CATEGORIES, PRODUCTS } = api;
    const FLOOR = PRODUCTS.filter((p) => !SKIP.has(p.slug));
    const cats = CATEGORIES.filter((c) => FLOOR.some((p) => p.category === c.id));
    const kept = store.get('deco-plan', null);
    let W = 480, L = 400, items = [], sel = null, uid = 1, u = 1, tab = cats[0].id, alive = true, guideTimer, suppress = false;
    const cleanups = [];
    const load = (plan) => {
      W = clamp(Math.round(+plan.w / STEP) * STEP || 480, MIN, MAX);
      L = clamp(Math.round(+plan.l / STEP) * STEP || 400, MIN, MAX);
      items = (plan.items || []).filter((x) => bySlug[x.slug] && !SKIP.has(x.slug)).map((x) => ({ id: uid++, slug: x.slug, x: +x.x || W / 2, y: +x.y || L / 2, rot: norm(+x.rot || +x.r || 0), finish: bySlug[x.slug].finishes.includes(x.finish) ? x.finish : bySlug[x.slug].finishes[0] || null }));
    };
    if (kept && Array.isArray(kept.items)) load(kept);
    const snapshot = () => ({ w: W, l: L, items: items.map(({ slug, x, y, rot, finish }) => ({ slug, x, y, rot: norm(rot), finish })) });
    const save = () => store.set('deco-plan', snapshot());

    el.innerHTML = `
      <div class="pl">
        <div class="pl__stage">
          <div class="pl__bar">
            <div class="pl__size">
              ${[['w', 'Width', 'Narrower', 'Wider'], ['l', 'Length', 'Shorter', 'Longer']].map(([k, label, less, more]) => `<div class="step" role="group" aria-label="Room ${label.toLowerCase()}"><span class="t-label soft">${label}</span><button type="button" class="step__b" data-size="${k}" data-d="-1" aria-label="${less}, 10 cm">${ic('minus')}</button><output class="t-h4" data-out="${k}" aria-live="polite"></output><button type="button" class="step__b" data-size="${k}" data-d="1" aria-label="${more}, 10 cm">${ic('plus')}</button></div>`).join('')}
            </div>
          </div>
          <div class="pl__canvas">
            <div class="pl__room" role="group" aria-describedby="plHint">
              <div class="pl__items"></div>
              <div class="pl__g pl__g--x" hidden><span class="t-cap"></span></div>
              <div class="pl__g pl__g--y" hidden><span class="t-cap"></span></div>
              <div class="pl__empty" hidden><p class="t-h3">An empty room.</p><p class="t-small soft">Start from a room we laid out, or add pieces from the list.</p><div class="chips">${Object.entries(PRESETS).map(([k, pr]) => `<button class="chip" type="button" data-preset="${k}">${pr.name}</button>`).join('')}</div></div>
            </div>
            <div class="pl__tools" role="toolbar" aria-label="Selected piece" hidden></div>
          </div>
          <div class="pl__foot"><span class="pl__scale" aria-hidden="true"><i></i><span class="t-cap">1 m</span></span><p class="t-cap soft pl__hint" id="plHint">${matchMedia('(pointer: coarse)').matches ? 'Drag a piece to move it. Tap it to turn it, change its finish or take it out.' : 'Drag to move. Arrow keys nudge, R turns, Delete removes.'}</p><p class="t-cap pl__warn" aria-live="polite"></p></div>
        </div>
        <aside class="pl__side" aria-label="Pieces">
          <div class="pl__lib">
            <p class="t-label soft">Add a piece</p>
            <div class="ttabs pl__tabs" role="tablist" aria-label="Rooms">${cats.map((c) => `<button class="ttab" type="button" role="tab" data-cat="${c.id}">${ic(c.id)}<span>${c.name}</span></button>`).join('')}</div>
            <ul class="pl__list" role="tabpanel"></ul>
          </div>
          <div class="pl__sum">
            <p class="pl__total"><span class="t-h3" data-sum="n"></span><span class="t-price" data-sum="t"></span></p>
            <button class="btn btn--solid btn--block" type="button" data-all>Add the room to your bag</button>
            <button class="text-btn" type="button" data-clear>Clear the room</button>
          </div>
        </aside>
        <p class="sr-only" aria-live="polite" data-live></p>
      </div>`;
    const q = (s) => el.querySelector(s);
    const canvas = q('.pl__canvas'), room = q('.pl__room'), itemsEl = q('.pl__items'), tools = q('.pl__tools'), list = q('.pl__list'), live = q('[data-live]');
    const gx = q('.pl__g--x'), gy = q('.pl__g--y'), empty = q('.pl__empty'), warn = q('.pl__warn');
    const nodes = new Map();
    const find = (id) => items.find((x) => x.id === id);
    const say = (msg) => { live.textContent = ''; setTimeout(() => { if (alive) live.textContent = msg; }, 40); }; // cleared first, so the same words are read again

    /* ---- Where things are ---- */
    const sides = (it) => { const b = boxOf(it, bySlug); return { l: b.x0, r: W - b.x1, t: b.y0, b: L - b.y1 }; };
    const describe = (it) => {
      const p = bySlug[it.slug], s = sides(it), r = Math.round;
      return `${p.name}, ${p.dims[0]} by ${p.dims[1]} cm, ${s.l <= s.r ? `${r(s.l)} cm from the left wall` : `${r(s.r)} cm from the right wall`}, ${s.t <= s.b ? `${r(s.t)} cm from the top wall` : `${r(s.b)} cm from the bottom wall`}`;
    };
    /* Snap to 5 cm, keep inside the walls, and settle flat against a wall within 8 cm of it. */
    function place(it, x, y, settle) {
      const [fw, fd] = fp(it, bySlug);
      x = Math.round(x / SNAP) * SNAP;
      y = Math.round(y / SNAP) * SNAP;
      x = fw >= W ? W / 2 : clamp(x, fw / 2, W - fw / 2);
      y = fd >= L ? L / 2 : clamp(y, fd / 2, L - fd / 2);
      if (settle) {
        if (x - fw / 2 < SETTLE) x = fw / 2; else if (W - x - fw / 2 < SETTLE) x = W - fw / 2;
        if (y - fd / 2 < SETTLE) y = fd / 2; else if (L - y - fd / 2 < SETTLE) y = L - fd / 2;
      }
      it.x = x;
      it.y = y;
    }
    function freeSpot(it) {
      const [fw, fd] = fp(it, bySlug);
      for (let rad = 0; rad <= Math.max(W, L); rad += 20) {
        const n = rad ? Math.ceil((2 * Math.PI * rad) / 30) : 1;
        for (let s = 0; s < n; s++) {
          const a = (s / n) * 2 * Math.PI, x = W / 2 + rad * Math.cos(a), y = L / 2 + rad * Math.sin(a);
          if (x - fw / 2 < 0 || x + fw / 2 > W || y - fd / 2 < 0 || y + fd / 2 > L) continue;
          const t = { ...it, x, y };
          if (RUG.has(it.slug) || !items.some((o) => !RUG.has(o.slug) && hit(t, o, bySlug))) return { x, y };
        }
      }
      return { x: W / 2, y: L / 2 };
    }

    /* ---- Drawing ---- */
    function layout() {
      const cw = canvas.clientWidth;
      if (!cw) return;
      /* Desktop: the whole room fits the first screen, in what is left under the canvas's place on the page.
         Phones and portrait tablets: the width decides, up to most of the screen's height. */
      const top = canvas.getBoundingClientRect().top + window.scrollY;
      const maxH = stacked.matches ? window.innerHeight * 0.7 : Math.max(240, window.innerHeight - top - 56);
      u = Math.min((cw - 8) / W, maxH / L);
      room.style.setProperty('--u', `${u}px`);
      room.style.width = `${W * u}px`;
      room.style.height = `${L * u}px`;
      q('.pl__scale i').style.width = `${100 * u}px`;
      room.setAttribute('aria-label', `Your room, ${(W / 100).toFixed(1)} by ${(L / 100).toFixed(1)} metres`);
      q('[data-out="w"]').textContent = `${(W / 100).toFixed(2)} m`;
      q('[data-out="l"]').textContent = `${(L / 100).toFixed(2)} m`;
      el.querySelectorAll('[data-size]').forEach((b) => (b.disabled = b.dataset.d < 0 ? (b.dataset.size === 'w' ? W : L) <= MIN : (b.dataset.size === 'w' ? W : L) >= MAX));
      if (sel) placeTools();
    }
    function paintItem(it) {
      const p = bySlug[it.slug];
      let n = nodes.get(it.id);
      if (!n) {
        n = document.createElement('button');
        n.type = 'button';
        n.className = pieceClass(p);
        n.dataset.id = it.id;
        n.innerHTML = `<i class="pp__shape"></i><span class="pp__name" aria-hidden="true">${esc(p.name)}</span>`;
        n.addEventListener('pointerdown', (e) => down(e, it.id));
        n.addEventListener('keydown', (e) => keys(e, it.id));
        n.addEventListener('focus', () => select(it.id));
        itemsEl.appendChild(n);
        nodes.set(it.id, n);
      }
      n.style.cssText = pieceStyle(it, p, FINISHES);
      n.setAttribute('aria-label', describe(it));
      n.setAttribute('aria-pressed', String(sel === it.id));
    }
    function paintAll() {
      nodes.forEach((n, id) => { if (!find(id)) { n.remove(); nodes.delete(id); } });
      items.forEach(paintItem);
      clashes();
      paintSum();
      paintTools();
    }
    /* Overlaps show on both pieces, and the first pair is named. A rug may lie under anything. */
    function clashes() {
      const solid = items.filter((it) => !RUG.has(it.slug)), bad = new Set(), pairs = [];
      for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
        if (hit(solid[i], solid[j], bySlug)) { bad.add(solid[i].id); bad.add(solid[j].id); pairs.push([solid[i], solid[j]]); }
      }
      nodes.forEach((n, id) => n.classList.toggle('is-clash', bad.has(id)));
      warn.innerHTML = pairs.length ? `${ic('close')}<span>${esc(bySlug[pairs[0][0].slug].name)} and ${esc(bySlug[pairs[0][1].slug].name)} overlap${pairs.length > 1 ? `, and ${pairs.length - 1} more` : ''}.</span>` : '';
    }
    function paintSum() {
      const n = items.length, total = items.reduce((s, it) => s + bySlug[it.slug].price, 0);
      q('[data-sum="n"]').textContent = n ? api.plural(n, 'piece') : 'No pieces yet';
      q('[data-sum="t"]').innerHTML = n ? price(total) : '';
      q('[data-all]').disabled = !n;
      q('[data-clear]').disabled = !n;
      empty.hidden = n > 0;
    }
    function paintList() {
      el.querySelectorAll('[data-cat]').forEach((t) => { const on = t.dataset.cat === tab; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      list.setAttribute('aria-label', cats.find((c) => c.id === tab).name);
      list.innerHTML = FLOOR.filter((p) => p.category === tab).map((p) => `<li><button class="pl__row" type="button" data-add="${p.slug}" aria-label="Add ${esc(p.name)}, ${p.dims[0]} by ${p.dims[1]} cm, ${money(p.price)}"><span class="pl__thumb"><img src="${asset(p.thumb)}" alt="" loading="lazy" decoding="async" draggable="false"></span><span class="pl__rt"><span class="t-h4">${esc(p.name)}</span><span class="t-cap soft">${p.dims[0]} × ${p.dims[1]} cm</span></span><span class="t-price">${price(p.price)}</span></button></li>`).join('');
    }
    /* The toolbar floats above the selected piece, or below it near the top wall. */
    function paintTools() {
      const it = find(sel);
      tools.hidden = !it;
      if (!it) return;
      const p = bySlug[it.slug];
      const had = tools.contains(document.activeElement) && document.activeElement.dataset;
      tools.innerHTML = `<span class="pl__tinfo"><span class="t-h4">${esc(p.name)}</span><span class="t-cap soft">${p.dims[0]} × ${p.dims[1]} cm · ${price(p.price)}</span></span>
        ${p.finishes.length > 1 ? `<span class="pl__fins" role="radiogroup" aria-label="Finish">${p.finishes.map((k) => `<button type="button" class="pl__fin" role="radio" aria-checked="${k === it.finish}" aria-label="${esc(FINISHES[k].name)}" data-fin="${k}" style="--sw:${FINISHES[k].tone};--swi:url('${new URL(asset(`assets/materials/${FINISHES[k].photo}.jpg`), document.baseURI).href}')"></button>`).join('')}</span>` : ''}
        <span class="pl__tbs"><button type="button" class="pl__tb" data-act="turn" aria-label="Turn a quarter">${ic('rotate')}</button><button type="button" class="pl__tb" data-act="dup" aria-label="Add another ${esc(p.name)}">${ic('plus')}</button><button type="button" class="pl__tb" data-act="del" aria-label="Remove ${esc(p.name)}">${ic('trash')}</button></span>`;
      if (had) { const back = had.fin ? tools.querySelector(`[data-fin="${it.finish}"]`) : had.act ? tools.querySelector(`[data-act="${had.act}"]`) : null; if (back) back.focus(); }
      placeTools();
    }
    function placeTools() {
      const it = find(sel);
      if (!it || tools.hidden) return;
      const b = boxOf(it, bySlug), tw = tools.offsetWidth, th = tools.offsetHeight;
      let top = room.offsetTop + b.y0 * u - th - 12;
      if (top < 0) top = room.offsetTop + b.y1 * u + 12;
      const left = clamp(room.offsetLeft + it.x * u - tw / 2, 0, Math.max(0, canvas.clientWidth - tw));
      tools.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    }
    /* Dashed lines from the piece to the nearest side wall and the nearest end wall, with the distance. */
    function guides(it) {
      const b = boxOf(it, bySlug), s = sides(it), cy = it.y * u, cx = it.x * u;
      const left = s.l <= s.r, top = s.t <= s.b, dx = Math.max(0, left ? s.l : s.r), dy = Math.max(0, top ? s.t : s.b);
      gx.hidden = dx < 1;
      gy.hidden = dy < 1;
      gx.style.cssText = `left:${(left ? 0 : b.x1) * u}px;top:${cy}px;width:${dx * u}px`;
      gy.style.cssText = `top:${(top ? 0 : b.y1) * u}px;left:${cx}px;height:${dy * u}px`;
      gx.firstChild.textContent = `${Math.round(dx)} cm`;
      gy.firstChild.textContent = `${Math.round(dy)} cm`;
      clearTimeout(guideTimer);
    }
    const hideGuides = (later) => { clearTimeout(guideTimer); guideTimer = setTimeout(() => { gx.hidden = gy.hidden = true; }, later ? 1400 : 0); };

    /* ---- Changes ---- */
    function select(id) {
      if (sel === id) return;
      sel = id;
      nodes.forEach((n, nid) => n.setAttribute('aria-pressed', String(nid === id)));
      paintTools();
    }
    function add(slug, x, y) {
      const p = bySlug[slug];
      const it = { id: uid++, slug, x: 0, y: 0, rot: 0, finish: p.finishes[0] || null };
      if (x == null) ({ x, y } = freeSpot(it));
      place(it, x, y, true);
      items.push(it);
      paintItem(it);
      sel = null;
      select(it.id);
      clashes();
      paintSum();
      save();
      nodes.get(it.id).focus({ preventScroll: true });
      say(`${p.name} added. ${describe(it)}.`);
    }
    function remove(id) {
      const i = items.findIndex((x) => x.id === id);
      if (i < 0) return;
      const [it] = items.splice(i, 1);
      if (sel === id) sel = null;
      paintAll();
      save();
      hideGuides();
      const next = items[Math.min(i, items.length - 1)];
      if (next) nodes.get(next.id).focus({ preventScroll: true });
      else (q('[data-add]') || q('[data-preset]')).focus({ preventScroll: true });
      say(`${bySlug[it.slug].name} removed.`);
    }
    function turn(id) {
      const it = find(id);
      if (!it) return;
      it.rot += 90; // keeps counting up, so every turn goes the same way round
      place(it, it.x, it.y, false);
      paintItem(it);
      clashes();
      paintTools();
      save();
      say(`${bySlug[it.slug].name} turned. ${describe(it)}.`);
    }
    function resize(dim, d) {
      const before = dim === 'w' ? W : L;
      if (dim === 'w') W = clamp(W + d * STEP, MIN, MAX); else L = clamp(L + d * STEP, MIN, MAX);
      if ((dim === 'w' ? W : L) === before) return false;
      items.forEach((it) => place(it, it.x, it.y, false));
      layout();
      paintAll();
      save();
      return true;
    }
    function restore(plan) {
      if (!alive) { store.set('deco-plan', plan); return; }
      sel = null;
      load(plan);
      layout();
      paintAll();
      save();
    }

    /* ---- Pointer: drag pieces ---- */
    const toCm = (e) => { const r = room.getBoundingClientRect(); return { x: (e.clientX - r.left) / u, y: (e.clientY - r.top) / u }; };
    function down(e, id) {
      if (e.button !== 0) return;
      const it = find(id), n = nodes.get(id);
      if (!it) return;
      e.preventDefault();
      n.focus({ preventScroll: true });
      select(id);
      const start = toCm(e), ox = start.x - it.x, oy = start.y - it.y;
      let moved = false;
      n.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const p = toCm(ev);
        if (!moved && Math.hypot(p.x - start.x, p.y - start.y) * u < 3) return;
        moved = true;
        n.classList.add('is-drag');
        place(it, p.x - ox, p.y - oy, true);
        n.style.cssText = pieceStyle(it, bySlug[it.slug], FINISHES);
        guides(it);
        clashes();
        placeTools();
      };
      const up = () => {
        n.removeEventListener('pointermove', move);
        n.removeEventListener('pointerup', up);
        n.removeEventListener('pointercancel', up);
        n.classList.remove('is-drag');
        if (!moved) return;
        paintItem(it);
        save();
        hideGuides(true);
        say(describe(it));
      };
      n.addEventListener('pointermove', move);
      n.addEventListener('pointerup', up);
      n.addEventListener('pointercancel', up);
    }
    /* Empty floor: a press there lets go of the selection. */
    room.addEventListener('pointerdown', (e) => { if (!e.target.closest('.pp, .pl__empty')) select(null); });

    /* ---- Keyboard on a piece ---- */
    function keys(e, id) {
      const it = find(id);
      if (!it) return;
      const step = e.shiftKey ? 25 : 5, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) {
        e.preventDefault();
        place(it, it.x + d[0], it.y + d[1], false);
        paintItem(it);
        guides(it);
        hideGuides(true);
        clashes();
        placeTools();
        save();
        say(describe(it));
      } else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); turn(id); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(id); }
      else if (e.key === 'Escape' && sel != null) { e.stopPropagation(); select(null); }
    }

    /* ---- Toolbar ---- */
    tools.addEventListener('click', (e) => {
      const it = find(sel);
      if (!it) return;
      const fin = e.target.closest('[data-fin]'), act = e.target.closest('[data-act]');
      if (fin) { it.finish = fin.dataset.fin; paintItem(it); paintTools(); save(); say(`${bySlug[it.slug].name} in ${FINISHES[it.finish].name.toLowerCase()}.`); }
      else if (act && act.dataset.act === 'turn') turn(it.id);
      else if (act && act.dataset.act === 'del') remove(it.id);
      else if (act && act.dataset.act === 'dup') { const before = it.finish; add(it.slug); find(sel).finish = before; paintItem(find(sel)); paintTools(); save(); }
    });
    tools.addEventListener('keydown', (e) => {
      const fins = [...tools.querySelectorAll('[data-fin]')], i = fins.indexOf(e.target);
      if (i < 0) return;
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      fins[(i + d + fins.length) % fins.length].click();
    });

    /* ---- Room size: press and hold to keep stepping ---- */
    el.querySelectorAll('[data-size]').forEach((b) => {
      let t1, t2;
      const stop = () => { clearTimeout(t1); clearInterval(t2); };
      const stepOnce = () => { if (!resize(b.dataset.size, +b.dataset.d)) stop(); };
      b.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); stepOnce(); t1 = setTimeout(() => (t2 = setInterval(stepOnce, 70)), 420); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, stop));
      b.addEventListener('click', (e) => { if (e.detail === 0) resize(b.dataset.size, +b.dataset.d); }); // keyboard and assistive tech
      cleanups.push(stop);
    });

    /* ---- Library: click adds near the middle; with a mouse, drag a row onto the floor ---- */
    const tabs = [...el.querySelectorAll('[data-cat]')];
    tabs.forEach((t) => {
      t.addEventListener('click', () => { tab = t.dataset.cat; paintList(); });
      t.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const n = tabs[(tabs.indexOf(t) + d + tabs.length) % tabs.length];
        tab = n.dataset.cat;
        paintList();
        n.focus();
      });
    });
    list.addEventListener('click', (e) => { const row = e.target.closest('[data-add]'); if (row && !suppress) add(row.dataset.add); });
    list.addEventListener('pointerdown', (e) => {
      const row = e.target.closest('[data-add]');
      if (!row || e.pointerType !== 'mouse' || e.button !== 0) return;
      const p = bySlug[row.dataset.add], sx = e.clientX, sy = e.clientY;
      let ghost = null;
      const over = (ev) => { const r = room.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; };
      const move = (ev) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          ghost = document.createElement('div');
          ghost.className = `pl__ghost${ROUND.has(p.slug) ? ' pp--round' : ''}`;
          ghost.setAttribute('aria-hidden', 'true');
          ghost.style.cssText = `width:${p.dims[0] * u}px;height:${p.dims[1] * u}px;--tone:${toneOf({ finish: p.finishes[0] }, FINISHES)}`;
          ghost.innerHTML = `<span class="t-cap">${esc(p.name)}</span>`;
          document.body.appendChild(ghost);
          document.body.classList.add('is-placing');
        }
        ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -50%)`;
        ghost.classList.toggle('is-in', over(ev));
      };
      const up = (ev) => {
        stopDrag();
        if (!ghost) return;
        const inside = over(ev);
        ghost.remove();
        document.body.classList.remove('is-placing');
        suppress = true;
        setTimeout(() => (suppress = false), 0);
        if (inside) { const c = toCm(ev); add(p.slug, c.x, c.y); }
      };
      const stopDrag = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      cleanups.push(() => { stopDrag(); if (ghost) ghost.remove(); document.body.classList.remove('is-placing'); });
    });

    /* ---- Presets, bag, clear ---- */
    empty.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      restore(fromPreset(b.dataset.preset, bySlug));
      say(`${PRESETS[b.dataset.preset].name} laid out, ${api.plural(items.length, 'piece')}.`);
      /* The buttons leave with the empty room: the keyboard goes on to the first piece that is not a rug. */
      const first = items.find((it) => !RUG.has(it.slug)) || items[0];
      if (first) { select(first.id); nodes.get(first.id).focus({ preventScroll: true }); }
    });
    q('[data-all]').addEventListener('click', (e) => api.addMany(items.map((it) => ({ slug: it.slug, finish: it.finish, qty: 1 })), { btn: e.currentTarget }));
    q('[data-clear]').addEventListener('click', () => {
      const before = snapshot();
      restore({ w: W, l: L, items: [] });
      api.toast('The room is clear', { label: 'Undo', run: () => restore(before) });
      say('The room is clear.');
    });

    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => layout()) : null;
    if (ro) ro.observe(canvas);
    const onWin = () => layout();
    window.addEventListener('resize', onWin);
    paintList();
    layout();
    paintAll();
    return {
      unmount() {
        alive = false;
        if (ro) ro.disconnect();
        window.removeEventListener('resize', onWin);
        clearTimeout(guideTimer);
        cleanups.forEach((f) => f());
        el.innerHTML = '';
      }
    };
  }

  /* ---------- A still plan, for the 2D home ---------- */
  function preview(el, name, api) {
    const { esc, bySlug, FINISHES } = api;
    const plan = fromPreset(PRESETS[name] ? name : 'living', bySlug);
    el.innerHTML = `<span class="pl__room is-still" aria-hidden="true"><span class="pl__items">${plan.items.map((it) => { const p = bySlug[it.slug]; return `<span class="${pieceClass(p)}" style="${pieceStyle(it, p, FINISHES)}"><i class="pp__shape"></i><span class="pp__name">${esc(p.name)}</span></span>`; }).join('')}</span></span>`;
    const room = el.firstChild;
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const u = Math.min((w * 0.84) / plan.w, (h * 0.8) / plan.l);
      room.style.setProperty('--u', `${u}px`);
      room.style.width = `${plan.w * u}px`;
      room.style.height = `${plan.l * u}px`;
    };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(el);
    fit();
    return { unmount() { if (ro) ro.disconnect(); } };
  }

  window.DECO_PLANNER = { mount, preview };
})();
