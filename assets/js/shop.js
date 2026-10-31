/* =========================================================
   DECO shop · pages, bag, saved list, search and checkout
   Pages are hash routes, so the site runs from any static host
   or straight from the file system. Links go through go(), which
   adds a history entry and keeps each page's scroll position.
     #/                the 3D store (assets/js/world.js), or the 2D home without WebGL
     #/home            the 2D home
     #/shop  #/shop/<category|new>   ?finish=a,b&min=&max=&stock=made|stock&sort=
     #/product/<slug>  #/saved?l=a,b  #/materials/<finish>  #/atelier  #/plan
     #/checkout  #/order/<ref>  #/info/<page>
   Every text element uses one of the type roles in site.css
   (t-display, t-h1 … t-label). Nothing sets its own size.
   ========================================================= */
(function () {
  'use strict';

  const { CATEGORIES, FINISHES, PRODUCTS } = window.DECO_CATALOG;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* Icons live in the sprite at the top of index.html and in assets/icons/. */
  const ic = (n, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const num = (n) => new Intl.NumberFormat('en-GB').format(n);
  /* money() is for text only (labels read aloud); price() shows the official UAE dirham sign (U+20C3) from the
     sprite, because fonts do not carry it yet. */
  const money = (n) => `AED ${num(n)}`;
  const price = (n) => `<svg class="cur" role="img" aria-label="AED"><use class="cur--regular" href="#dirham-regular"/><use class="cur--light" href="#dirham-light"/><use class="cur--bold" href="#dirham"/></svg>${num(n)}`;
  /* Every image path goes through asset(): the single-file build answers with an inlined copy (window.__R). */
  const asset = (p) => (window.__R ? window.__R(p) : p);
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const joinAnd = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
  const bySlug = Object.fromEntries(PRODUCTS.map((p) => [p.slug, p]));
  const catOf = (id) => CATEGORIES.find((c) => c.id === id);
  const countIn = (id) => PRODUCTS.filter((p) => p.category === id).length;
  const NEW = PRODUCTS.filter((p) => p.tag === 'New');
  const BEST = PRODUCTS.filter((p) => p.tag === 'Bestseller');
  const KEYS = Object.keys(FINISHES);
  const main = $('#main'), hd = $('#hd');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const visible = (el) => !!el && el.getClientRects().length > 0;
  const fx = window.DECO_FX;

  const ICON = '<svg class="statement__icon" viewBox="0 0 224 238" aria-hidden="true"><use href="#logo-icon"/></svg>';
  const MARK = '<svg class="done__mark" viewBox="0 0 240 250" aria-hidden="true"><path pathLength="1" d="M96 22H144Q174 22 177.9 51.7L188.1 128.3Q192 158 162 158H78Q48 158 51.9 128.3L62.1 51.7Q66 22 96 22Z"/><path pathLength="1" d="M10 204A110 30 0 1 0 230 204A110 30 0 1 0 10 204Z"/></svg>';
  const crumbs = (items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([label, href], i) => (i ? ic('next', 'crumbs__sep') : '') + (href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`)).join('')}</nav>`;
  const matSrc = (k) => asset(`assets/materials/${FINISHES[k].photo}.jpg`);
  /* A url() inside a custom property resolves against the stylesheet that reads it (assets/css/),
     so swatch photos are passed as absolute addresses. */
  const abs = (p) => new URL(p, document.baseURI).href;
  const swatchStyle = (k) => `--sw:${FINISHES[k].tone};--swi:url('${abs(matSrc(k))}')`;
  const finishName = (k) => (k && FINISHES[k] ? FINISHES[k].name : '');
  const defaultFinish = (p) => p.finishes[0] || null;
  const leadLine = (p) => (p.lead === 'made' ? 'Made to order in our Dubai workshop, ready in 6 to 10 weeks' : 'In stock, ships in 3 to 5 days');
  const img = (src, alt, eager) => `<img src="${asset(src)}" alt="${esc(alt || '')}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  /* Pieces shown in a finish, the ones photographed in it first. */
  const inFinish = (k) => PRODUCTS.filter((p) => p.finishes.includes(k)).sort((a, b) => (b.finishes[0] === k) - (a.finishes[0] === k) || a.order - b.order);

  /* ---------- Dates ---------- */
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  /* Working days run Monday to Friday. */
  const addWork = (d, n) => { let x = new Date(d); while (n > 0) { x = addDays(x, 1); if (x.getDay() % 6) n--; } return x; };
  const dfmt = (d, o) => d.toLocaleDateString('en-GB', o);
  const dayMon = (d) => dfmt(d, { day: 'numeric', month: 'short' });
  const wdDayMon = (d) => dfmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
  const longDay = (d) => dfmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
  const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const fromIso = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  /* When a piece reaches you: made to order in 6 to 10 weeks, stock in 3 to 5 working days. */
  const arrives = (lead) => (lead === 'made' ? [addDays(today(), 42), addDays(today(), 70)] : [addWork(today(), 3), addWork(today(), 5)]);
  const arrivalLine = (p) => { const [a, b] = arrives(p.lead); return p.lead === 'made' ? `With you between ${dayMon(a)} and ${dayMon(b)}` : `With you between ${wdDayMon(a)} and ${wdDayMon(b)}`; };

  /* ---------- Units ----------
     Lengths in centimetres or inches. The choice is kept for the visitor (product Size view, door check). */
  let units = store.get('deco-units', 'cm') === 'in' ? 'in' : 'cm';
  const inch = (cm) => { const v = Math.round((cm / 2.54) * 2) / 2; return `${v >= 1 ? Math.floor(v) : ''}${v % 1 ? '½' : ''}`; };
  const len = (cm) => (units === 'in' ? `${inch(cm)} in` : `${cm} cm`);
  const pair = (a, b) => (units === 'in' ? `${inch(a)} by ${inch(b)} in` : `${a} by ${b} cm`);
  const dimsText = (p) => { const [w, d, h] = p.dims, f = units === 'in' ? inch : String; return `W ${f(w)} × D ${f(d)} × H ${f(h)} ${units}`; };

  /* ---------- Changes other parts listen to (bag, saved list, sample box) ---------- */
  const subs = { bag: new Set(), saved: new Set(), samples: new Set() };
  const on = (k, fn) => { subs[k].add(fn); return () => subs[k].delete(fn); };
  const emit = (k, ...a) => [...subs[k]].forEach((fn) => { try { fn(...a); } catch (e) { console.error(e); } });
  const bump = (el) => { el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump'); setTimeout(() => el.classList.remove('is-bump'), 480); };

  /* ---------- Bag ---------- */
  let bagGone = null;   // the line just taken out, offered back with Undo until the panel closes or the bag changes
  let countHold = 0;    // while a photo flies to the bag, the count waits for it to land
  const bag = {
    items: store.get('deco-bag', []).filter((i) => bySlug[i.slug] && i.qty > 0),
    save(gone) { store.set('deco-bag', this.items); bagGone = gone || null; renderBag(); if (!countHold) updateCount(true); emit('bag', this.count()); },
    add(slug, finish, qty, later) {
      const hit = this.items.find((i) => i.slug === slug && i.finish === finish);
      if (hit) hit.qty = Math.min(10, hit.qty + qty); else this.items.push({ slug, finish, qty: Math.min(10, qty) });
      if (!later) this.save();
    },
    set(i, qty) { if (qty < 1) takeOut(i); else { this.items[i].qty = Math.min(10, qty); this.save(); } },
    count() { return this.items.reduce((n, i) => n + i.qty, 0); },
    total() { return this.items.reduce((n, i) => n + bySlug[i.slug].price * i.qty, 0); },
    clear() { this.items = []; this.save(); }
  };
  function takeOut(i, toSaved) {
    const it = bag.items[i];
    if (!it) return;
    const wasSaved = saved.has(it.slug);
    bag.items.splice(i, 1);
    if (toSaved && !wasSaved) saved.set(it.slug, true);
    bag.save({ it, i, toSaved, wasSaved });
  }
  function putBack() {
    const g = bagGone;
    if (!g) return;
    const hit = bag.items.find((x) => x.slug === g.it.slug && x.finish === g.it.finish);
    if (hit) hit.qty = Math.min(10, hit.qty + g.it.qty); else bag.items.splice(Math.min(g.i, bag.items.length), 0, g.it);
    if (g.toSaved && !g.wasSaved) saved.set(g.it.slug, false);
    bag.save();
  }
  function updateCount(b) {
    const n = bag.count(), el = $('#bagCount');
    el.textContent = n;
    $('#bagBtn').setAttribute('aria-label', `Bag, ${plural(n, 'item')}`);
    if (b) bump(el);
  }
  /* Adding anywhere: one pass of light on the button, the photo flies to the bag, the count moves when it lands. */
  function addToBag(slug, finish, qty, { btn, from, quiet } = {}) {
    const p = bySlug[slug];
    if (!p) return;
    countHold++;
    bag.add(slug, p.finishes.includes(finish) ? finish : defaultFinish(p), Math.max(1, qty || 1));
    if (btn) fx.beam(btn);
    fx.fly(from, $('#bagBtn .ic')).then(() => { countHold--; updateCount(true); if (!quiet) toast(`${p.name} is in your bag`); });
  }
  function addMany(list, { btn, from } = {}) {
    const items = list.filter((x) => bySlug[x.slug]);
    if (!items.length) return;
    countHold++;
    items.forEach((x) => { const p = bySlug[x.slug]; bag.add(x.slug, p.finishes.includes(x.finish) ? x.finish : defaultFinish(p), x.qty || 1, true); });
    bag.save();
    if (btn) fx.beam(btn);
    const n = items.reduce((s, x) => s + (x.qty || 1), 0);
    fx.fly(from, $('#bagBtn .ic')).then(() => { countHold--; updateCount(true); toast(`${n === 1 ? 'One piece is' : plural(n, 'piece') + ' are'} in your bag`); });
  }
  function lineHTML(item, i, editable) {
    const p = bySlug[item.slug];
    return `<li class="line">
      <a class="ratio" href="#/product/${p.slug}" tabindex="-1">${img(p.thumb)}</a>
      <div class="line__info">
        <div class="line__top"><a class="t-h4" href="#/product/${p.slug}">${esc(p.name)}</a><span class="t-price">${price(p.price * item.qty)}</span></div>
        ${item.finish ? `<span class="t-cap line__opt">${esc(finishName(item.finish))}</span>` : ''}
        ${editable ? `<div class="line__row">
          <div class="qty qty--sm" role="group" aria-label="Quantity of ${esc(p.name)}"><button type="button" data-q="${i}" data-d="-1" aria-label="One fewer">${ic('minus')}</button><output>${item.qty}</output><button type="button" data-q="${i}" data-d="1" aria-label="One more">${ic('plus')}</button></div>
          <span class="line__acts"><button class="line__rm" type="button" data-move="${i}" aria-label="Move ${esc(p.name)} to your saved list">${ic('heart')}</button><button class="line__rm" type="button" data-rm="${i}" aria-label="Remove ${esc(p.name)}">${ic('trash')}</button></span></div>` : `<span class="t-cap line__opt">Quantity ${item.qty}</span>`}
      </div></li>`;
  }
  const miniHTML = (p) => `<li class="mini"><a class="ratio" href="#/product/${p.slug}" tabindex="-1">${img(p.thumb)}</a><a class="mini__txt" href="#/product/${p.slug}"><span class="t-h4">${esc(p.name)}</span><span class="t-price">${price(p.price)}</span></a><button class="mini__add" type="button" data-mini="${p.slug}" aria-label="Add ${esc(p.name)} to your bag">${ic('plus')}</button></li>`;
  function renderBag() {
    const body = $('#bagBody'), foot = $('#bagFoot'), g = bagGone;
    const gone = g ? `<li class="gone"><span class="t-small" role="status">${esc(bySlug[g.it.slug].name)} ${g.toSaved ? 'is in your saved list' : 'is out of your bag'}.</span><button class="text-btn" type="button" data-undo>Undo</button></li>` : '';
    if (!bag.items.length) {
      const fromSaved = saved.list.length > 0;
      const pool = (fromSaved ? saved.list.map((s) => bySlug[s]) : BEST).slice(0, 4);
      body.innerHTML = `${gone ? `<ul>${gone}</ul>` : ''}<div class="empty empty--bag">${ic('bag', 'empty__ic')}<p class="t-h2">Your bag is empty.</p><p class="t-body">Every piece is made for one room. Start with yours.</p><a class="btn" href="#/shop">Shop the collection</a></div>
        <div class="minis"><p class="t-label">${fromSaved ? 'From your saved list' : 'Bestsellers'}</p><ul>${pool.map(miniHTML).join('')}</ul></div>`;
      foot.hidden = true;
    } else {
      const rows = bag.items.map((it, i) => lineHTML(it, i, true));
      if (g) rows.splice(Math.min(g.i, rows.length), 0, gone);
      body.innerHTML = `<ul>${rows.join('')}</ul>`;
      foot.hidden = false;
      $('#bagTotal').innerHTML = price(bag.total());
    }
    markLoaded(body);
  }
  $('#bagBody').addEventListener('click', (e) => {
    const t = (s) => e.target.closest(s), body = $('#bagBody');
    let b, next;
    if ((b = t('[data-q]'))) {
      const i = +b.dataset.q, d = +b.dataset.d;
      bag.set(i, bag.items[i].qty + d);
      next = bagGone ? '[data-undo]' : `[data-q="${i}"][data-d="${d}"]`;
    } else if ((b = t('[data-rm]'))) { takeOut(+b.dataset.rm); next = '[data-undo]'; }
    else if ((b = t('[data-move]'))) { takeOut(+b.dataset.move, true); next = '[data-undo]'; }
    else if ((b = t('[data-undo]'))) { putBack(); next = '[data-q][data-d="1"]'; }
    else if ((b = t('[data-mini]'))) { const p = bySlug[b.dataset.mini]; bag.add(p.slug, defaultFinish(p), 1); toast(`${p.name} is in your bag`, false); next = '[data-q][data-d="1"]'; }
    else return;
    /* The list redraws: keep the keyboard where the hand was. */
    const f = $(next, body) || $('a, button', body);
    if (f) f.focus({ preventScroll: true });
  });

  /* ---------- Saved list and recently viewed (kept on this device) ---------- */
  let savedHold = 0;
  const saved = {
    list: store.get('deco-saved', []).filter((s) => bySlug[s]),
    has(s) { return this.list.includes(s); },
    set(s, isOn, at) {
      const i = this.list.indexOf(s);
      if (isOn && i < 0) this.list.splice(at == null ? 0 : Math.min(at, this.list.length), 0, s);
      else if (!isOn && i >= 0) this.list.splice(i, 1);
      else return;
      store.set('deco-saved', this.list);
      $$(`[data-save="${s}"]`).forEach((b) => b.setAttribute('aria-pressed', String(isOn)));
      if (!savedHold) updateSaved(true);
      if (!bag.items.length) renderBag(); // an empty bag suggests pieces from the saved list
      emit('saved', this.list.length, s, isOn);
    }
  };
  function updateSaved(b) {
    const n = saved.list.length, el = $('#savedCount');
    el.textContent = n;
    el.hidden = !n;
    $('#savedBtn').setAttribute('aria-label', `Saved, ${plural(n, 'piece')}`);
    $$('[data-saved-n]').forEach((x) => (x.textContent = n || ''));
    if (b && n) bump(el);
  }
  /* Saving flies the photo to the heart in the header; taking it off the list can be undone. */
  function toggleSave(slug, from) {
    const p = bySlug[slug];
    if (!p) return false;
    if (saved.has(slug)) {
      const at = saved.list.indexOf(slug);
      saved.set(slug, false);
      toast(`${p.name} is no longer saved`, { label: 'Undo', run: () => saved.set(slug, true, at) });
      return false;
    }
    savedHold++;
    saved.set(slug, true);
    const target = visible($('#savedBtn')) ? $('#savedBtn .ic') : $('#menuBtn .ic');
    fx.fly(from, target).then(() => { savedHold--; updateSaved(true); toast(`${p.name} is saved`, { label: 'View saved', run: () => go('#/saved') }); });
    return true;
  }
  const heart = (p, cls) => `<button class="heart${cls ? ' ' + cls : ''}" type="button" data-save="${p.slug}" aria-pressed="${saved.has(p.slug)}" aria-label="Save ${esc(p.name)}">${ic('heart')}</button>`;
  const recent = {
    list: store.get('deco-recent', []).filter((s) => bySlug[s]),
    add(s) { this.list = [s, ...this.list.filter((x) => x !== s)].slice(0, 12); store.set('deco-recent', this.list); }
  };
  const searches = {
    list: store.get('deco-searches', []).filter((x) => typeof x === 'string').slice(0, 6),
    add(q) { q = q.trim(); if (!q) return; this.list = [q, ...this.list.filter((x) => fold(x) !== fold(q))].slice(0, 6); store.set('deco-searches', this.list); },
    clear() { this.list = []; store.set('deco-searches', []); }
  };
  /* Free finish samples: up to four in one box. */
  const samples = {
    list: store.get('deco-samples', []).filter((k) => FINISHES[k]).slice(0, 4),
    has(k) { return this.list.includes(k); },
    set(list) { this.list = list.slice(0, 4); store.set('deco-samples', this.list); emit('samples', this.list.length); }
  };

  /* ---------- Panels and dialogs: bag, search, menu, quick view, filters, sample box ----------
     One open at a time over the scrim. Focus moves in, stays in (Tab wraps), and returns on close.
     The page behind is inert while a panel is open. */
  const scrim = $('#scrim');
  let openEl = null, opener = null;
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const focusables = (root) => $$(FOCUSABLE, root).filter((el) => visible(el) && !el.closest('[inert]'));
  const behind = () => [$('.bar'), hd, main, $('.ft')];
  function openPanel(el) {
    closeMega();
    if (openEl === el) return;
    if (openEl) { const o = opener; closePanels(true); opener = o; } else opener = document.activeElement;
    openEl = el;
    clearTimeout(el._t);
    el.hidden = false; scrim.hidden = false;
    document.body.classList.add('is-locked');
    behind().forEach((x) => x && (x.inert = true));
    void el.offsetWidth; // start the slide from where it is hidden, without waiting a frame
    el.classList.add('is-on');
    scrim.classList.add('is-on');
    const f = el.querySelector('[data-autofocus]') || focusables(el)[0];
    setTimeout(() => f && f.focus({ preventScroll: true }), 60);
  }
  function closePanels(instant) {
    if (!openEl) return;
    const el = openEl;
    openEl = null;
    el.classList.remove('is-on'); scrim.classList.remove('is-on');
    document.body.classList.remove('is-locked');
    behind().forEach((x) => x && (x.inert = false));
    el._t = setTimeout(() => { if (openEl !== el) el.hidden = true; if (!openEl) scrim.hidden = true; }, instant ? 0 : 480);
    if (el.id === 'bag' && bagGone) { bagGone = null; renderBag(); }
    if (el.onclose) el.onclose();
    if (!instant) {
      if (opener && opener.focus && document.contains(opener) && visible(opener)) opener.focus({ preventScroll: true });
      opener = null;
    }
  }
  scrim.addEventListener('click', () => closePanels());
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close-panel]')) closePanels(); });
  const typing = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (openEl) { e.preventDefault(); closePanels(); } closeMega(); return; }
    if (e.key === 'Tab' && openEl) {
      const f = focusables(openEl);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], a = document.activeElement, inside = openEl.contains(a);
      if (e.shiftKey && (a === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !inside)) { e.preventDefault(); first.focus(); }
      return;
    }
    /* "/" opens search from anywhere, unless you are typing. */
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target) && !(openEl && openEl.id === 'search')) { e.preventDefault(); openSearch(); }
  });
  function openSearch() {
    const inp = $('#searchInput');
    openPanel($('#search'));
    renderSearch(inp.value);
    setTimeout(() => inp.select(), 70);
  }
  const openMenu = () => openPanel($('#mnav'));
  const openBag = () => openPanel($('#bag'));
  /* Page panels (filters, sample box) live on <body>, outside the view, and leave with it. */
  function makePanel(id, label, html, cls) {
    const el = document.createElement('aside');
    el.className = `panel${cls ? ' ' + cls : ''}`;
    el.id = id;
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', `${id}Title`);
    el.innerHTML = `<div class="panel__hd"><h2 class="t-h3" id="${id}Title">${label}</h2><button class="panel__close" type="button" data-close-panel aria-label="Close">${ic('close')}</button></div>${html}`;
    document.body.appendChild(el);
    return el;
  }
  $('#bagBtn').addEventListener('click', openBag);
  $('#menuBtn').addEventListener('click', openMenu);
  $('#searchBtn').addEventListener('click', openSearch);

  /* ---------- 3D store ----------
     assets/js/world.js defines window.DECO_WORLD when it is there. Links into it show only where it can run. */
  let worldOk;
  function hasWorld() {
    if (worldOk === undefined && window.DECO_WORLD) {
      try { worldOk = !!window.DECO_WORLD.supported(); } catch (e) { worldOk = false; }
    }
    return !!worldOk;
  }

  /* ---------- Mega menu, phone menu, footer ---------- */
  const mega = $('#mega'), shopBtn = $('#shopBtn');
  const EXPLORE = [
    ['#/materials', 'swatch', 'Materials and samples', '7'],
    ['#/plan', 'plan', 'Room planner', ''],
    ['#/atelier', 'pin', 'Visit the atelier', ''],
    ['#/saved', 'heart', 'Saved', 'saved'],
    ['#/', 'door', '3D store', 'world']
  ];
  const exploreLink = ([href, icon, label, extra]) => `<a href="${href}"${extra === 'world' ? ' data-world' : ''}>${ic(icon)}${label}<span${extra === 'saved' ? ' data-saved-n' : ''}>${extra === 'saved' ? saved.list.length || '' : extra === 'world' ? '' : extra}</span></a>`;
  $('#megaList').innerHTML = `<p class="t-label">Shop by room</p>` +
    CATEGORIES.map((c) => `<a href="#/shop/${c.id}">${ic(c.id)}${c.name}<span>${countIn(c.id)}</span></a>`).join('') +
    `<a class="link" href="#/shop">Shop all ${PRODUCTS.length}</a>`;
  $('#megaExplore').innerHTML = `<p class="t-label">Explore</p>${EXPLORE.map(exploreLink).join('')}`;
  $('#megaTiles').innerHTML = [['#/shop/new', asset('assets/products/mira-lounge-chair-sm.jpg'), 'New in', `${NEW.length} pieces`], ['#/materials', matSrc('natural'), 'Free samples', 'Seven finishes, sent to your door']]
    .map(([href, src, t, n]) => `<a class="mega__tile" href="${href}"><span class="ratio"><img src="${src}" alt="" loading="lazy" decoding="async"></span><span class="t-h4">${t}</span><span class="t-cap soft">${n}</span></a>`).join('');
  let megaTimer;
  function openMega() { clearTimeout(megaTimer); mega.classList.add('is-on'); hd.classList.add('is-open'); shopBtn.setAttribute('aria-expanded', 'true'); markLoaded(mega); }
  function closeMega() { clearTimeout(megaTimer); mega.classList.remove('is-on'); hd.classList.remove('is-open'); shopBtn.setAttribute('aria-expanded', 'false'); }
  shopBtn.addEventListener('click', () => (mega.classList.contains('is-on') ? closeMega() : openMega()));
  /* Hover opens the menu only with a mouse; on touch the tap toggles it. */
  const canHover = window.matchMedia('(hover: hover)');
  shopBtn.addEventListener('mouseenter', () => { if (canHover.matches) openMega(); });
  [shopBtn, mega].forEach((el) => el.addEventListener('mouseleave', () => { megaTimer = setTimeout(closeMega, 220); }));
  mega.addEventListener('mouseenter', () => clearTimeout(megaTimer));
  mega.addEventListener('click', (e) => { if (e.target.closest('a')) closeMega(); });
  /* Leaving the menu with the keyboard closes it. */
  mega.addEventListener('focusout', (e) => { const to = e.relatedTarget; if (to && !mega.contains(to) && to !== shopBtn) closeMega(); });

  $('#mnavLinks').innerHTML = `<a href="#/shop">${ic('all')}Shop all<span>${PRODUCTS.length}</span></a><a href="#/shop/new">${ic('new')}New in<span>${NEW.length}</span></a>` +
    CATEGORIES.map((c) => `<a href="#/shop/${c.id}">${ic(c.id)}${c.name}<span>${countIn(c.id)}</span></a>`).join('') +
    `<p class="t-label mnav__label">Explore</p>${EXPLORE.map(exploreLink).join('')}<button type="button" id="mSearchBtn">${ic('search')}Search<span></span></button>`;
  $('#mSearchBtn').addEventListener('click', openSearch);
  $('#ftShop').innerHTML = `<li><a href="#/shop/new">New in</a></li>` + CATEGORIES.map((c) => `<li><a href="#/shop/${c.id}">${c.name}</a></li>`).join('') + `<li><a href="#/shop">All ${PRODUCTS.length} pieces</a></li>`;

  /* ---------- Search ----------
     Accent-insensitive ("boucle" finds bouclé). Every word has to match somewhere, and pieces rank by
     where it matched: name 3, room, finish or tag 2, description 1. */
  const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = (q) => fold(q).split(/[^a-z0-9]+/).filter(Boolean);
  const forms = (w) => (w.length > 3 && w.endsWith('s') ? [w, w.slice(0, -1)] : [w]); // "sofas" finds "sofa"
  const INDEX = PRODUCTS.map((p) => {
    const c = catOf(p.category);
    return { p, f: [[fold(p.name), 3], [fold(`${c.name} ${c.line}`), 2], [fold(p.finishes.map(finishName).join(' ')), 2], [fold(p.tag), 2], [fold(p.copy), 1]] };
  });
  function find(q) {
    const t = words(q), out = [];
    if (!t.length) return [];
    for (const { p, f } of INDEX) {
      let score = 0;
      for (const w of t) {
        const ws = forms(w);
        let best = 0;
        for (const [txt, wt] of f) if (wt > best && ws.some((x) => txt.includes(x))) best = wt;
        if (!best) { score = 0; break; }
        score += best + (f[0][0].startsWith(w) ? 0.5 : 0);
      }
      if (score) out.push([score, p]);
    }
    return out.sort((a, b) => b[0] - a[0] || a[1].order - b[1].order).map((x) => x[1]);
  }
  /* Wraps the matched words in <mark>, comparing folded letters but keeping the original ones. */
  function hl(text, t) {
    const chars = [...String(text)], map = [];
    let flat = '';
    chars.forEach((ch, i) => { const f = fold(ch); flat += f; for (let k = 0; k < f.length; k++) map.push(i); });
    const lit = new Array(chars.length).fill(false);
    t.flatMap(forms).forEach((w) => { let at = flat.indexOf(w); while (at > -1) { for (let k = at; k < at + w.length; k++) lit[map[k]] = true; at = flat.indexOf(w, at + w.length); } });
    let out = '', open = false;
    chars.forEach((ch, i) => { if (lit[i] !== open) { out += open ? '</mark>' : '<mark>'; open = lit[i]; } out += esc(ch); });
    return out + (open ? '</mark>' : '');
  }
  const searchInput = $('#searchInput'), searchRes = $('#searchRes');
  function renderSearch(q) {
    const t = words(q);
    const chip = (href, inner) => `<a class="chip" href="${href}" data-sr>${inner}</a>`;
    const roomChip = (c) => chip(`#/shop/${c.id}`, `${ic(c.id)}${c.name}`);
    const finChip = (k) => chip(`#/shop?finish=${k}`, `<i class="chip__sw" style="${swatchStyle(k)}"></i>${esc(FINISHES[k].name)}`);
    const group = (label, inner, extra) => `<div class="sgroup"><div class="sgroup__hd"><p class="t-label">${label}</p>${extra || ''}</div>${inner}</div>`;
    let status;
    if (!t.length) {
      const popular = PRODUCTS.filter((p) => p.tag).slice(0, 6);
      searchRes.innerHTML = (searches.list.length ? group('Recent searches', `<div class="chips">${searches.list.map((s) => `<button class="chip" type="button" data-sr data-again="${esc(s)}">${ic('clock')}${esc(s)}</button>`).join('')}</div>`, '<button class="text-btn" type="button" data-forget>Clear</button>') : '') +
        group('Rooms', `<div class="chips">${CATEGORIES.map(roomChip).join('')}</div>`) +
        group('Finishes', `<div class="chips">${KEYS.map(finChip).join('')}</div>`) +
        group('Popular now', `<ul class="grid">${popular.map((p) => cardHTML(p, 0, true, [])).join('')}</ul>`);
      status = '';
    } else {
      const list = find(q), long = t.filter((w) => w.length > 2);
      const hit = (txt) => long.some((w) => forms(w).some((x) => fold(txt).includes(x)));
      const rooms = CATEGORIES.filter((c) => hit(`${c.name} ${c.line}`)), fins = KEYS.filter((k) => hit(`${FINISHES[k].name} ${FINISHES[k].kind}`));
      searchRes.innerHTML = (rooms.length || fins.length ? `<div class="sgroup"><div class="chips">${rooms.map(roomChip).join('')}${fins.map(finChip).join('')}</div></div>` : '') +
        (list.length ? group(plural(list.length, 'piece'), `<ul class="grid">${list.slice(0, 12).map((p) => cardHTML(p, 0, true, t)).join('')}</ul>`)
          : `<p class="t-body soft search__none">Nothing matches “${esc(q.trim())}”. Try sofa, travertine or lamp.</p>`);
      status = list.length ? plural(list.length, 'piece') : 'Nothing matches';
    }
    $('#searchStatus').textContent = status;
    markLoaded(searchRes);
  }
  searchInput.addEventListener('input', () => renderSearch(searchInput.value));
  /* Arrow keys move from the field into the results and between them; typing goes back to the field. */
  searchInput.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown') return;
    const f = $('[data-sr]', searchRes);
    if (f) { e.preventDefault(); f.focus(); }
  });
  searchRes.addEventListener('keydown', (e) => {
    const items = $$('[data-sr]', searchRes), i = items.indexOf(document.activeElement);
    if (i < 0 || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); (items[i + 1] || items[i]).focus(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); (i ? items[i - 1] : searchInput).focus(); }
    else if (e.key === 'Backspace') { e.preventDefault(); searchInput.focus(); searchInput.value = searchInput.value.slice(0, -1); renderSearch(searchInput.value); }
    else if (e.key.length === 1 && e.key !== ' ') { e.preventDefault(); searchInput.focus(); searchInput.value += e.key; renderSearch(searchInput.value); }
  });
  searchRes.addEventListener('click', (e) => {
    const again = e.target.closest('[data-again]');
    if (again) { searchInput.value = again.dataset.again; renderSearch(searchInput.value); searchInput.focus(); return; }
    if (e.target.closest('[data-forget]')) { searches.clear(); renderSearch(''); searchInput.focus(); return; }
    if (e.target.closest('a[href^="#/"]') && words(searchInput.value).length) searches.add(searchInput.value);
  });
  /* Enter opens the first piece and remembers the search. */
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const first = $('.card__media a', searchRes);
    if (!first || !words(searchInput.value).length) return;
    searches.add(searchInput.value);
    go(first.getAttribute('href'));
  });

  /* ---------- Toast ----------
     The action pill melts out of the message, and back in before it leaves.
     action: {label, run}; left out it is View bag; false shows the message alone. */
  let toastTimers = [], toastInk, toastRun = null;
  function toast(msg, action) {
    const el = $('#toast'), btn = $('#toastBtn'), box = $('.toast__msg', el);
    const act = action === false ? null : action || { label: 'View bag', run: openBag };
    const wasOn = el.classList.contains('is-on');
    $('#toastMsg').textContent = msg;
    btn.hidden = !act;
    if (act) btn.textContent = act.label; else el.classList.remove('is-split');
    toastRun = act ? act.run : null;
    el.hidden = false;
    toastInk = toastInk || fx.liquid($('.goo', el), { blur: 6, contrast: 18 });
    toastInk.fit(act ? [box, btn] : [box, box]);
    el.style.setProperty('--tuck', act ? `${-Math.round(btn.offsetWidth * 0.6 + 12)}px` : '0px');
    toastTimers.forEach(clearTimeout);
    const hold = act && act.label === 'Undo' ? 5200 : 3200;
    void el.offsetWidth;
    el.classList.add('is-on');
    toastTimers = [setTimeout(() => act && el.classList.add('is-split'), wasOn ? 0 : 200), setTimeout(() => el.classList.remove('is-split'), hold), setTimeout(() => el.classList.remove('is-on'), hold + 360)];
  }
  $('#toastBtn').addEventListener('click', () => {
    toastTimers.forEach(clearTimeout);
    $('#toast').classList.remove('is-split', 'is-on');
    const run = toastRun;
    toastRun = null;
    if (run) run();
  });

  /* ---------- Cards ---------- */
  /* sr: the search words, when the card sits in search results (highlights the name, joins the arrow-key list). */
  function cardHTML(p, i, still, sr) {
    const fin = p.finishes;
    const meta = fin.length > 1 ? `<span class="dots">${fin.map((k) => `<i style="${swatchStyle(k)}"></i>`).join('')}</span>${fin.length} finishes`
      : fin.length === 1 ? esc(finishName(fin[0])) : esc(catOf(p.category).name);
    return `<li class="card${still ? '' : ' rv'}" data-key="${p.slug}" style="--d:${(i || 0) % 4}">
      <div class="card__media">
        <a class="ratio" href="#/product/${p.slug}" aria-label="${esc(p.name)}, ${money(p.price)}"${sr ? ' data-sr' : ''}>${p.tag ? `<span class="card__tag">${esc(p.tag)}</span>` : ''}${img(p.thumb)}</a>
        ${heart(p, 'card__heart')}
        <button class="card__add" type="button" data-qv="${p.slug}" aria-label="Quick view of ${esc(p.name)}">${ic('eye')}Quick view</button>
      </div>
      <a class="card__body" href="#/product/${p.slug}" tabindex="-1" aria-hidden="true">
        <span class="card__row"><span class="t-h4">${sr && sr.length ? hl(p.name, sr) : esc(p.name)}</span><span class="t-price">${price(p.price)}</span></span>
        <span class="card__meta t-cap">${meta}</span>
      </a>
    </li>`;
  }
  /* Hearts and quick view pills anywhere: cards, the product page, quick view. */
  const photoNear = (el) => { const box = el.closest('.card, .qv, .view'); return box && $('.card__media img, .qv__media img, .stage__photo img', box); };
  document.addEventListener('click', (e) => {
    const s = e.target.closest('[data-save]');
    if (s) { e.preventDefault(); toggleSave(s.dataset.save, photoNear(s)); return; }
    const q = e.target.closest('[data-qv]');
    if (q) { e.preventDefault(); quickView(q.dataset.qv); }
  });

  function markLoaded(root) {
    $$('img', root).forEach((im) => {
      if (im.complete && im.naturalWidth) im.classList.add('is-loaded');
      else im.addEventListener('load', () => im.classList.add('is-loaded'), { once: true });
    });
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.01 }) : null;
  function reveal(root) { $$('.rv', root).forEach((el) => (io && !motion.matches ? io.observe(el) : el.classList.add('is-in'))); }

  /* ---------- Finish, quantity, Add to bag ----------
     One configurator for the product page and quick view. Parts are found by data attributes inside root. */
  const swatchesHTML = (p) => (p.finishes.length > 1 ? `<div class="swatches" role="radiogroup" aria-label="Finish">${p.finishes.map((k, i) => `<button class="swatch" type="button" role="radio" aria-checked="${!i}" tabindex="${i ? -1 : 0}" aria-label="${esc(FINISHES[k].name)}" data-fin="${k}" style="${swatchStyle(k)}"></button>`).join('')}</div>` : '');
  const optHTML = (p, sample) => (p.finishes.length ? `<div class="opt">
      <div class="opt__head"><span class="t-label">Finish</span><span class="t-small" data-fin-name>${esc(finishName(p.finishes[0]))}</span></div>
      ${swatchesHTML(p)}
      ${p.finishes.length > 1 ? '<p class="t-cap soft" data-fin-note></p>' : ''}
      ${sample ? `<a class="sample t-cap" href="#/materials/${p.finishes[0]}" data-sample></a>` : ''}
    </div>` : '');
  const qtyHTML = () => `<div class="qty" role="group" aria-label="Quantity"><button type="button" data-step="-1" aria-label="One fewer">${ic('minus')}</button><output data-qty aria-live="polite">1</output><button type="button" data-step="1" aria-label="One more">${ic('plus')}</button></div>`;
  /* Arrow keys (and Home, End) move through radios or tabs; the choice follows the focus. */
  function radioKeys(e, list, pick) {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const n = d ? list[(list.indexOf(e.currentTarget) + d + list.length) % list.length] : e.key === 'Home' ? list[0] : e.key === 'End' ? list[list.length - 1] : null;
    if (!n) return;
    e.preventDefault();
    n.focus();
    pick(n);
  }
  function configure(root, p, { photo, onFinish } = {}) {
    const fin = p.finishes, st = { finish: defaultFinish(p), qty: 1 }, sw = $$('[data-fin]', root);
    const paint = () => {
      sw.forEach((x) => { const isOn = x.dataset.fin === st.finish; x.setAttribute('aria-checked', String(isOn)); x.tabIndex = isOn ? 0 : -1; });
      $$('[data-fin-name]', root).forEach((el) => (el.textContent = finishName(st.finish)));
      $$('[data-fin-note]', root).forEach((el) => (el.textContent = st.finish === fin[0] ? `Shown in ${finishName(fin[0]).toLowerCase()}.` : `The photo shows ${finishName(fin[0]).toLowerCase()}.`));
      $$('[data-fin-dot]', root).forEach((el) => el.setAttribute('style', swatchStyle(st.finish)));
      $$('[data-sample]', root).forEach((a) => { a.setAttribute('href', `#/materials/${st.finish}`); a.innerHTML = `${ic('swatch')}Free sample of ${esc(finishName(st.finish).toLowerCase())}`; });
    };
    const paintQty = () => {
      $$('[data-qty]', root).forEach((o) => (o.textContent = st.qty));
      $$('[data-total]', root).forEach((el) => (el.innerHTML = price(p.price * st.qty)));
    };
    const pick = (k) => { if (k === st.finish || !fin.includes(k)) return; st.finish = k; paint(); if (onFinish) onFinish(k); };
    sw.forEach((b) => {
      b.addEventListener('click', () => pick(b.dataset.fin));
      b.addEventListener('keydown', (e) => radioKeys(e, sw, (n) => pick(n.dataset.fin)));
    });
    $$('[data-step]', root).forEach((b) => b.addEventListener('click', () => { st.qty = clamp(st.qty + +b.dataset.step, 1, 10); paintQty(); }));
    $$('[data-buy]', root).forEach((b) => b.addEventListener('click', () => addToBag(p.slug, st.finish, st.qty, { btn: b, from: photo && photo() })));
    if (fin.length) paint();
    paintQty();
    return st;
  }

  /* ---------- Quick view ----------
     Centred over the page on desktop; a sheet from the bottom in the stacked layout. */
  function quickView(slug) {
    const p = bySlug[slug];
    if (!p) return;
    const box = $('#qvIn'), cat = catOf(p.category), f0 = p.finishes[0];
    box.innerHTML = `
      <div class="qv__media">
        <a class="ratio" href="#/product/${p.slug}" tabindex="-1" aria-hidden="true">${img(p.img, '', true)}</a>
        ${f0 ? `<span class="qv__chip t-cap"><i data-fin-dot style="${swatchStyle(f0)}"></i><span data-fin-name>${esc(finishName(f0))}</span></span>` : ''}
      </div>
      <div class="qv__info">
        <div class="qv__top"><p class="t-label soft">${cat.name}${p.tag ? ' · ' + esc(p.tag) : ''}</p><button class="panel__close" type="button" data-close-panel aria-label="Close">${ic('close')}</button></div>
        <h2 class="t-h2" id="qvTitle">${esc(p.name)}</h2>
        <p class="qv__price">${price(p.price)}</p>
        <p class="t-body soft qv__copy">${esc(p.copy)}</p>
        ${optHTML(p, false)}
        <div class="buy">${qtyHTML()}<button class="btn btn--solid" type="button" data-buy>Add to bag<span class="add__price" data-total></span></button></div>
        <div class="qv__more"><button class="save" type="button" data-save="${p.slug}" aria-pressed="${saved.has(p.slug)}" aria-label="Save ${esc(p.name)}">${ic('heart')}<span class="save__off">Save</span><span class="save__on">Saved</span></button><a class="link" href="#/product/${p.slug}">Full details</a></div>
      </div>`;
    configure(box, p, { photo: () => $('.qv__media img', box) });
    markLoaded(box);
    openPanel($('#qv'));
  }

  /* ---------- Pages ---------- */
  /* The 3D store fills the screen; the 2D header, bar and footer step aside while it is mounted. */
  function world() {
    let inst = null;
    return {
      title: 'DECO · Walk through the atelier',
      nav: 'world',
      html: '<div class="world-root" id="worldRoot"></div>',
      bind() {
        document.body.classList.add('is-world');
        try { inst = window.DECO_WORLD.mount($('#worldRoot'), worldApi); } catch (e) {
          console.error(e);
          worldOk = false; // fall back to the 2D home
          setTimeout(() => route(), 0);
        }
      },
      leave() {
        try { if (inst && inst.unmount) inst.unmount(); } catch (e) { console.error(e); }
        inst = null;
        document.body.classList.remove('is-world');
      }
    };
  }

  const featuredHTML = (list) => list.slice(0, 4).map((p, i) => cardHTML(p, i)).join('');
  function home() {
    const rec = recent.list.slice(0, 4).map((s) => bySlug[s]);
    let teaser = null;
    return {
      title: 'DECO · Modern living, made to order in Dubai',
      html: `
      <section class="hero">
        <img class="hero__img" src="${asset('assets/products/hero-boucle.jpg')}" alt="Two Mira Lounge Chairs in natural bouclé on a warm studio floor, in afternoon light" width="1927" height="816" data-subject="653 1482 728" fetchpriority="high">
        <div class="wrap hero__in">
          <div class="hero__copy">
            <h1 class="t-h1">For a calmer tomorrow.</h1>
            <p class="t-lead">Soft, sculptural furniture, made to order in our Dubai workshop.</p>
            <div class="hero__cta"><a class="btn btn--solid" href="#/shop">Shop the collection</a><a class="link" href="#/shop/new">New in</a></div>
          </div>
          <a class="hero__tag" href="#/product/mira-lounge-chair"><span class="t-label">On the cover</span><span class="t-h4">Mira Lounge Chair</span><span class="t-price">${price(bySlug['mira-lounge-chair'].price)}</span></a>
        </div>
      </section>

      <section class="sec wrap statement rv">
        ${ICON}
        <h2 class="t-h2">Soft shapes, made slowly, for rooms that breathe.</h2>
        <p class="t-body">Every piece is shaped and upholstered by hand in Al Quoz, then carried into your home by the people who made it.</p>
      </section>

      <section class="sec wrap">
        <div class="head rv"><div class="head__t"><p class="t-label">Shop by room</p><h2 class="t-h2">Six families, one soft shape</h2></div><a class="link" href="#/shop">Shop all ${PRODUCTS.length}</a></div>
        <div class="cats">${CATEGORIES.map((c, i) => `<a class="cat rv" style="--d:${i % 3}" href="#/shop/${c.id}"><span class="ratio">${img(`assets/products/${c.cover}.jpg`)}</span><span class="cat__txt"><span class="t-h3">${c.name}</span><span class="t-cap">${countIn(c.id)} pieces</span></span></a>`).join('')}</div>
      </section>

      <section class="sec wrap">
        <div class="head rv"><div class="head__t"><p class="t-label">The collection</p><h2 class="t-h2">New and loved</h2></div>
          <div class="seg" role="tablist" aria-label="Show"><span class="goo" aria-hidden="true"><i class="is-on"></i><i></i></span><button class="seg__tab is-on" type="button" role="tab" aria-selected="true" data-set="new">New in</button><button class="seg__tab" type="button" role="tab" aria-selected="false" data-set="best">Bestsellers</button></div></div>
        <ul class="grid" id="featGrid">${featuredHTML(NEW)}</ul>
      </section>

      ${explorerHTML()}

      <section class="sec wrap teaser">
        <a class="teaser__plan rv" href="#/plan" id="planTeaser" aria-label="Open the room planner"></a>
        <div class="teaser__copy rv" style="--d:1">
          <p class="t-label">Room planner</p>
          <h2 class="t-h2">See it in your room before it is made.</h2>
          <p class="t-body">Set your room to size and place each piece at its true footprint. Turn it, move it, and see what fits before you order.</p>
          <a class="link" href="#/plan">Plan your room</a>
        </div>
      </section>

      <section class="sec wrap split">
        <div class="split__img rv"><span class="ratio">${img('assets/products/nora-accent-chair.jpg', 'Nora Accent Chair in natural bouclé')}</span></div>
        <div class="split__copy rv" style="--d:1">
          <p class="t-label">Made in Dubai</p>
          <h2 class="t-h2">Every piece begins at our bench in Al Quoz.</h2>
          <p class="t-body">Frames are cut and shaped by hand, then upholstered in wool bouclé or finished in honed stone. Nothing waits in a warehouse. We start making when you order.</p>
          <div class="split__facts"><div><b>6–10</b><span class="t-cap soft">weeks from order to your door</span></div><div><b>11</b><span class="t-cap soft">makers in one workshop</span></div></div>
          <a class="link" href="#/atelier">Visit the atelier</a>
        </div>
      </section>

      <section class="sec wrap" data-world>
        <a class="promo3d rv" href="#/">
          <span class="ratio promo3d__img">${img('assets/products/hero.jpg', '')}</span>
          <span class="promo3d__txt"><span class="t-label">The 3D store</span><span class="t-h2">Walk through the atelier in 3D.</span><span class="t-body">Every piece at its true size, in one warm room. Walk around it, choose a finish, add it to your bag.</span><span class="link">Step inside</span></span>
        </a>
      </section>

      ${rec.length >= 2 ? `<section class="sec wrap"><div class="head rv"><div class="head__t"><p class="t-label">Recently viewed</p><h2 class="t-h2">Pieces you looked at</h2></div><a class="link" href="#/saved">Your saved list</a></div><ul class="grid">${rec.map((p, i) => cardHTML(p, i)).join('')}</ul></section>` : ''}

      <section class="sec wrap">
        <ul class="promise rv">
          <li>${ic('truck', 'promise__ic')}<span class="t-h4">Complimentary delivery</span><span class="t-small">White glove, anywhere in the UAE</span></li>
          <li>${ic('made', 'promise__ic')}<span class="t-h4">Made to order</span><span class="t-small">Furniture in 6 to 10 weeks</span></li>
          <li>${ic('swatch', 'promise__ic')}<span class="t-h4">Free samples</span><span class="t-small"><a class="text-link" href="#/materials">Every finish</a>, sent to your door</span></li>
          <li>${ic('return', 'promise__ic')}<span class="t-h4">14-day returns</span><span class="t-small">On lighting and decor</span></li>
        </ul>
      </section>`,
      bind() {
        const seg = $('.seg', main), tabs = $$('[data-set]', seg), ink = fx.liquid($('.goo', seg), { blur: 5, contrast: 18 });
        ink.fit(tabs);
        const pickSet = (b) => {
          if (b.classList.contains('is-on')) return;
          tabs.forEach((x, j) => { const isOn = x === b; x.classList.toggle('is-on', isOn); x.setAttribute('aria-selected', String(isOn)); x.tabIndex = isOn ? 0 : -1; ink.shapes[j].classList.toggle('is-on', isOn); });
          const g = $('#featGrid');
          g.innerHTML = featuredHTML(b.dataset.set === 'new' ? NEW : BEST);
          markLoaded(g); reveal(g);
        };
        tabs.forEach((b, j) => { b.tabIndex = j ? -1 : 0; b.addEventListener('click', () => pickSet(b)); b.addEventListener('keydown', (e) => radioKeys(e, tabs, pickSet)); });
        bindExplorer($('#fe', main));
        if (window.DECO_PLANNER) teaser = window.DECO_PLANNER.preview($('#planTeaser'), 'living', planApi);
      },
      leave() { if (teaser && teaser.unmount) teaser.unmount(); }
    };
  }

  /* Finishes explorer (2D home): seven swatches, the material close up, and pieces made in it. */
  function explorerHTML() {
    return `<section class="sec wrap fe" id="fe">
        <div class="head rv"><div class="head__t"><p class="t-label">Materials</p><h2 class="t-h2">Seven finishes, chosen by hand</h2></div><a class="link" href="#/materials">Order free samples</a></div>
        <div class="fe__grid">
          <div class="fe__media rv"><span class="ratio stack">${KEYS.map((k, i) => `<img src="${matSrc(k)}" alt="" data-k="${k}"${i ? '' : ' class="is-on"'} loading="lazy" decoding="async">`).join('')}</span></div>
          <div class="fe__info rv" style="--d:1">
            <div class="fe__tabs" role="tablist" aria-label="Finishes">${KEYS.map((k, i) => `<button class="swatch" type="button" role="tab" id="fe-${k}" aria-selected="${!i}" aria-controls="fePanel" tabindex="${i ? -1 : 0}" aria-label="${esc(FINISHES[k].name)}" data-k="${k}" style="${swatchStyle(k)}"></button>`).join('')}</div>
            <div class="fe__panel" id="fePanel" role="tabpanel" aria-labelledby="fe-${KEYS[0]}" aria-live="polite"></div>
          </div>
        </div>
      </section>`;
  }
  function bindExplorer(fe) {
    if (!fe) return;
    const tabs = $$('[role="tab"]', fe), imgs = $$('.stack img', fe), panel = $('#fePanel', fe);
    const show = (k) => {
      tabs.forEach((t) => { const isOn = t.dataset.k === k; t.setAttribute('aria-selected', String(isOn)); t.tabIndex = isOn ? 0 : -1; });
      imgs.forEach((im) => im.classList.toggle('is-on', im.dataset.k === k));
      panel.setAttribute('aria-labelledby', 'fe-' + k);
      const F = FINISHES[k], used = inFinish(k);
      panel.innerHTML = `<p class="t-label soft">${F.kind}</p><h3 class="t-h2">${esc(F.name)}</h3><p class="t-body soft">${esc(F.line)}</p>
        <ul class="fe__minis">${used.slice(0, 3).map((p) => `<li><a href="#/product/${p.slug}"><span class="ratio">${img(p.thumb)}</span><span class="t-h4">${esc(p.name)}</span><span class="t-price">${price(p.price)}</span></a></li>`).join('')}</ul>
        <a class="link" href="#/shop?finish=${k}">All ${used.length} pieces in ${esc(F.name.toLowerCase())}</a>`;
      markLoaded(panel);
    };
    tabs.forEach((t) => { t.addEventListener('click', () => show(t.dataset.k)); t.addEventListener('keydown', (e) => radioKeys(e, tabs, (n) => show(n.dataset.k))); });
    show(tabs[0].dataset.k);
  }

  /* ---------- Shop ----------
     Filters live in the URL (finish=a,b&min=&max=&stock=made|stock&sort=), so a filtered room can be shared
     and Back returns to it. The grid reuses its cards, so photos never load twice. */
  const PRICES = PRODUCTS.map((p) => p.price);
  const PMIN = Math.floor(Math.min(...PRICES) / 50) * 50, PMAX = Math.ceil(Math.max(...PRICES) / 500) * 500;
  const PSTEPS = 100, BINS = 24, LOGR = Math.log(PMAX / PMIN);
  /* The price slider runs on a log scale, so a bowl and a sofa both get room; values snap to round numbers. */
  const niceP = (v) => { const s = v < 1000 ? 10 : v < 3000 ? 50 : v < 10000 ? 100 : 500; return Math.round(v / s) * s; };
  const pAt = (t) => (t <= 0 ? PMIN : t >= PSTEPS ? PMAX : niceP(PMIN * Math.exp((LOGR * t) / PSTEPS)));
  const tAt = (v) => clamp(Math.round((PSTEPS * Math.log(v / PMIN)) / LOGR), 0, PSTEPS);
  const SORTS = [['featured', 'Featured'], ['price-asc', 'Price, low to high'], ['price-desc', 'Price, high to low'], ['name', 'Name']];
  function sortList(list, sort) {
    const l = list.slice();
    if (sort === 'price-asc') l.sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') l.sort((a, b) => b.price - a.price);
    else if (sort === 'name') l.sort((a, b) => a.name.localeCompare(b.name));
    else l.sort((a, b) => a.order - b.order);
    return l;
  }
  function readFilters(q, base) {
    const has = new Set(base.flatMap((p) => p.finishes));
    const min = clamp(+q.get('min') || PMIN, PMIN, PMAX), max = clamp(+q.get('max') || PMAX, min, PMAX);
    return {
      finish: new Set((q.get('finish') || '').split(',').filter((k) => has.has(k))),
      min, max,
      stock: ['made', 'stock'].includes(q.get('stock')) ? q.get('stock') : '',
      sort: SORTS.some(([v]) => v === q.get('sort')) ? q.get('sort') : 'featured'
    };
  }
  /* skip leaves one filter out, for the live counts beside its own options. */
  const passes = (p, f, skip) => (skip === 'finish' || !f.finish.size || p.finishes.some((k) => f.finish.has(k)))
    && (skip === 'price' || (p.price >= f.min && p.price <= f.max))
    && (skip === 'stock' || !f.stock || p.lead === f.stock);
  const priced = (f) => f.min > PMIN || f.max < PMAX;
  const queryOf = (f) => {
    const q = [];
    if (f.finish.size) q.push('finish=' + [...f.finish].join(','));
    if (f.min > PMIN) q.push('min=' + f.min);
    if (f.max < PMAX) q.push('max=' + f.max);
    if (f.stock) q.push('stock=' + f.stock);
    if (f.sort !== 'featured') q.push('sort=' + f.sort);
    return q.length ? '?' + q.join('&') : '';
  };
  const priceRange = (f) => (f.min <= PMIN ? `Up to ${price(f.max)}` : f.max >= PMAX ? `From ${price(f.min)}` : `${price(f.min)} to ${price(f.max)}`);
  function shop(id, q) {
    const isNew = id === 'new', cat = catOf(id);
    if (id && !isNew && !cat) return notFound();
    const base = isNew ? NEW : cat ? PRODUCTS.filter((p) => p.category === cat.id) : PRODUCTS;
    const path = isNew ? '#/shop/new' : cat ? `#/shop/${cat.id}` : '#/shop';
    const f = readFilters(q, base), qs = queryOf(f);
    const title = isNew ? 'New in' : cat ? cat.name : 'All pieces';
    const lead = isNew ? `The latest ${base.length} pieces from the workshop.` : cat ? `${cat.line}. ${base.length} pieces, made in Dubai.` : `${base.length} pieces across six rooms, made in Dubai.`;
    const tab = (href, icon, label, isOn) => `<a class="ttab${isOn ? ' is-on' : ''}" href="${href}${qs}" data-base="${href}"${isOn ? ' aria-current="page"' : ''}>${ic(icon)}<span>${label}</span></a>`;
    const fins = KEYS.filter((k) => base.some((p) => p.finishes.includes(k)));
    const first = sortList(base.filter((p) => passes(p, f)), f.sort);
    let panel = null, deb;
    return {
      title: `${title} · DECO`,
      nav: isNew ? 'new' : 'shop',
      html: `
      <section class="wrap">
        <header class="shop__head">
          <div>${crumbs([['Home', '#/home'], ...(cat || isNew ? [['Shop', '#/shop'], [title]] : [['Shop']])])}<h1 class="t-h1">${title}</h1></div>
          <p class="t-lead">${lead}</p>
        </header>
        <div class="shop__bar">
          <nav class="ttabs" aria-label="Categories">${tab('#/shop', 'all', 'All', !cat && !isNew)}${tab('#/shop/new', 'new', 'New in', isNew)}${CATEGORIES.map((c) => tab(`#/shop/${c.id}`, c.id, c.name, cat && cat.id === c.id)).join('')}</nav>
          <div class="shop__tools">
            <button class="tool" type="button" id="filterBtn" aria-controls="filters" aria-expanded="false">${ic('filter')}<span class="t-label">Filter</span><span class="count" id="filterCount" hidden></span></button>
            <label class="sort"><span class="t-label">Sort</span><span class="select"><select id="sort">${SORTS.map(([v, l]) => `<option value="${v}"${v === f.sort ? ' selected' : ''}>${l}</option>`).join('')}</select></span></label>
          </div>
        </div>
        <div class="shop__state"><p class="t-small soft" id="shopCount" aria-live="polite"></p><div class="chips" id="shopChips"></div><button class="text-btn" type="button" id="shopClear" data-clear hidden>Clear all</button></div>
        <ul class="grid" id="shopGrid">${first.map((p, i) => cardHTML(p, i)).join('')}</ul>
        <div class="empty shop__empty" id="shopEmpty"${first.length ? ' hidden' : ''}>${ic('filter', 'empty__ic')}<h2 class="t-h2">Nothing matches these filters.</h2><p class="t-body">Try another finish or a wider price range.</p><button class="btn" type="button" data-clear>Clear filters</button></div>
      </section>`,
      bind() {
        const root = $('.view', main), grid = $('#shopGrid'), btn = $('#filterBtn');
        const cache = new Map($$('#shopGrid > li').map((li) => [li.dataset.key, li]));
        const node = (p) => {
          let n = cache.get(p.slug);
          if (!n) {
            const t = document.createElement('template');
            t.innerHTML = cardHTML(p, 0, true).trim();
            n = t.content.firstElementChild;
            markLoaded(n);
            cache.set(p.slug, n);
          } else $('[data-save]', n).setAttribute('aria-pressed', String(saved.has(p.slug)));
          return n;
        };
        const bins = Array(BINS).fill(0);
        base.forEach((p) => bins[clamp(Math.floor((BINS * Math.log(p.price / PMIN)) / LOGR), 0, BINS - 1)]++);
        const tall = Math.max(...bins, 1);
        panel = makePanel('filters', 'Filter', `
          <div class="panel__body fpanel__body">
            ${fins.length ? `<fieldset class="fgroup"><legend class="t-label">Finish</legend><div class="fopts">${fins.map((k) => `<label class="fopt"><input class="sr-only" type="checkbox" value="${k}"><i class="fopt__sw" style="${swatchStyle(k)}"></i><span class="t-small fopt__t">${esc(FINISHES[k].name)}</span><span class="t-cap fopt__n" data-n="${k}"></span></label>`).join('')}</div></fieldset>` : ''}
            <fieldset class="fgroup"><legend class="t-label">Price</legend>
              <div class="hist" aria-hidden="true">${bins.map((c) => `<i style="--h:${(c / tall).toFixed(3)}"></i>`).join('')}</div>
              <div class="range"><span class="range__fill"></span><input type="range" min="0" max="${PSTEPS}" step="1" data-end="lo" aria-label="Lowest price"><input type="range" min="0" max="${PSTEPS}" step="1" data-end="hi" aria-label="Highest price"></div>
              <div class="range__out"><p><span class="t-cap soft">From</span><span class="t-price" data-out="lo"></span></p><p><span class="t-cap soft">To</span><span class="t-price" data-out="hi"></span></p></div>
            </fieldset>
            <fieldset class="fgroup"><legend class="t-label">Availability</legend><div class="fopts">
              <button class="fopt" type="button" aria-pressed="false" data-stock="stock">${ic('box')}<span class="fopt__t"><span class="t-small">In stock</span><span class="t-cap soft">Ships in 3 to 5 days</span></span><span class="t-cap fopt__n" data-n="stock"></span></button>
              <button class="fopt" type="button" aria-pressed="false" data-stock="made">${ic('made')}<span class="fopt__t"><span class="t-small">Made to order</span><span class="t-cap soft">Ready in 6 to 10 weeks</span></span><span class="t-cap fopt__n" data-n="made"></span></button>
            </div></fieldset>
          </div>
          <div class="panel__ft fpanel__ft"><button class="text-btn" type="button" data-clear>Clear all</button><button class="btn btn--solid" type="button" data-close-panel id="fShow"></button></div>`, 'fpanel');
        const lo = $('[data-end="lo"]', panel), hi = $('[data-end="hi"]', panel), bars = $$('.hist i', panel);
        const boxes = $$('input[type="checkbox"]', panel), stocks = $$('[data-stock]', panel);
        const syncRange = () => { lo.value = tAt(f.min); hi.value = tAt(f.max); };
        const paintRange = () => {
          const a = +lo.value, b = +hi.value;
          $('.range', panel).style.cssText = `--a:${a / PSTEPS};--b:${b / PSTEPS}`;
          $('[data-out="lo"]', panel).innerHTML = price(f.min);
          $('[data-out="hi"]', panel).innerHTML = price(f.max);
          lo.setAttribute('aria-valuetext', money(f.min));
          hi.setAttribute('aria-valuetext', money(f.max));
          bars.forEach((bar, i) => { const mid = PMIN * Math.exp((LOGR * (i + 0.5)) / BINS); bar.classList.toggle('is-in', mid >= f.min && mid <= f.max); });
          lo.classList.toggle('is-top', a > PSTEPS / 2); // two thumbs at the top end: the low one comes forward so it can still move
          const n = base.filter((p) => passes(p, f)).length;
          $('#fShow').textContent = n ? `Show ${plural(n, 'piece')}` : 'No pieces match';
        };
        const paintPanel = () => {
          boxes.forEach((c) => {
            const n = base.filter((p) => p.finishes.includes(c.value) && passes(p, f, 'finish')).length;
            c.checked = f.finish.has(c.value);
            c.disabled = !n && !c.checked;
            $(`[data-n="${c.value}"]`, panel).textContent = n;
          });
          stocks.forEach((b) => {
            const n = base.filter((p) => p.lead === b.dataset.stock && passes(p, f, 'stock')).length, isOn = f.stock === b.dataset.stock;
            b.setAttribute('aria-pressed', String(isOn));
            b.disabled = !n && !isOn;
            $(`[data-n="${b.dataset.stock}"]`, panel).textContent = n;
          });
          paintRange();
        };
        const chipsHTML = () => [...f.finish].map((k) => `<button class="chip chip--x" type="button" data-rm-f="finish" data-v="${k}" aria-label="Remove the filter ${esc(FINISHES[k].name)}"><i class="chip__sw" style="${swatchStyle(k)}"></i>${esc(FINISHES[k].name)}${ic('close')}</button>`).join('') +
          (priced(f) ? `<button class="chip chip--x" type="button" data-rm-f="price" aria-label="Remove the price filter">${priceRange(f)}${ic('close')}</button>` : '') +
          (f.stock ? `<button class="chip chip--x" type="button" data-rm-f="stock" aria-label="Remove the filter ${f.stock === 'made' ? 'made to order' : 'in stock'}">${f.stock === 'made' ? 'Made to order' : 'In stock'}${ic('close')}</button>` : '');
        const apply = (firstRun) => {
          clearTimeout(deb);
          const list = sortList(base.filter((p) => passes(p, f)), f.sort), q2 = queryOf(f);
          history.replaceState(history.state, '', path + q2);
          routedHref = location.href;
          $$('.ttab', root).forEach((a) => a.setAttribute('href', a.dataset.base + q2));
          if (!firstRun) fx.flip(grid, () => grid.replaceChildren(...list.map(node)));
          $('#shopEmpty').hidden = list.length > 0;
          const active = f.finish.size + (priced(f) ? 1 : 0) + (f.stock ? 1 : 0);
          $('#shopCount').textContent = active ? `${list.length} of ${plural(base.length, 'piece')}` : plural(base.length, 'piece');
          $('#shopChips').innerHTML = chipsHTML();
          $('#shopClear').hidden = !active;
          $('#filterCount').textContent = active;
          $('#filterCount').hidden = !active;
          btn.setAttribute('aria-label', active ? `Filter, ${active} active` : 'Filter');
          paintPanel();
        };
        const clearAll = () => { f.finish.clear(); f.min = PMIN; f.max = PMAX; f.stock = ''; syncRange(); apply(); };
        boxes.forEach((c) => c.addEventListener('change', () => { if (c.checked) f.finish.add(c.value); else f.finish.delete(c.value); apply(); }));
        stocks.forEach((b) => b.addEventListener('click', () => { f.stock = f.stock === b.dataset.stock ? '' : b.dataset.stock; apply(); }));
        /* While a thumb is dragged the readouts and bars follow at once; the grid waits for a pause. */
        const onRange = (e) => {
          let a = +lo.value, b = +hi.value;
          if (a > b) { if (e.target === lo) lo.value = a = b; else hi.value = b = a; }
          f.min = pAt(a); f.max = pAt(b);
          paintRange();
          clearTimeout(deb);
          deb = setTimeout(apply, 180);
        };
        [lo, hi].forEach((r) => { r.addEventListener('input', onRange); r.addEventListener('change', () => apply()); });
        panel.addEventListener('click', (e) => { if (e.target.closest('[data-clear]')) clearAll(); });
        root.addEventListener('click', (e) => {
          if (e.target.closest('[data-clear]')) { clearAll(); btn.focus(); return; }
          const rm = e.target.closest('[data-rm-f]');
          if (!rm) return;
          const k = rm.dataset.rmF;
          if (k === 'finish') f.finish.delete(rm.dataset.v);
          else if (k === 'price') { f.min = PMIN; f.max = PMAX; syncRange(); }
          else f.stock = '';
          apply();
          ($('#shopChips .chip') || btn).focus();
        });
        $('#sort').addEventListener('change', (e) => { f.sort = e.target.value; apply(); });
        btn.addEventListener('click', () => { openPanel(panel); btn.setAttribute('aria-expanded', 'true'); });
        panel.onclose = () => btn.setAttribute('aria-expanded', 'false');
        syncRange();
        apply(true);
        const cur = $('.shop__bar .ttab.is-on');
        /* On phones the tabs scroll sideways: centre the current one so its neighbours show on both sides. */
        const strip = cur && cur.parentNode;
        if (strip && strip.scrollWidth > strip.clientWidth) strip.scrollLeft += cur.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - cur.offsetWidth) / 2;
      },
      leave() { clearTimeout(deb); if (panel) panel.remove(); }
    };
  }

  /* ---------- Product ---------- */
  /* Size view: the piece's outer box in isometric projection, to scale, with its three dimensions.
     Faces are ink at low strength, visible edges solid, hidden edges dashed; the labels are HTML on top. */
  function isoHTML(p) {
    const [W, D, H] = p.dims, c = Math.cos(Math.PI / 6);
    const P = (x, y, z) => [(x - y) * c, (x + y) / 2 - z];
    const o = Math.max(W, D, H) * 0.13;
    const A = P(0, 0, 0), B = P(W, 0, 0), C = P(W, D, 0), E = P(0, D, 0);
    const A2 = P(0, 0, H), B2 = P(W, 0, H), C2 = P(W, D, H), E2 = P(0, D, H);
    const hx = B[0] + o * 1.7 * c, hTick = o * 0.3 * c;
    const dims = {
      w: { line: [P(0, D + o, 0), P(W, D + o, 0)], ext: [[E, P(0, D + o * 1.3, 0)], [C, P(W, D + o * 1.3, 0)]], at: P(W / 2, D + o * 2.15, 0), v: W },
      d: { line: [P(W + o, 0, 0), P(W + o, D, 0)], ext: [[B, P(W + o * 1.3, 0, 0)], [C, P(W + o * 1.3, D, 0)]], at: P(W + o * 2.15, D / 2, 0), v: D },
      h: { line: [[hx, B[1]], [hx, B2[1]]], ext: [[B, [hx + hTick, B[1]]], [B2, [hx + hTick, B2[1]]]], at: [hx + o * 1.05, (B[1] + B2[1]) / 2], v: H }
    };
    const pts = [A, B, C, E, A2, B2, C2, E2, ...Object.values(dims).flatMap((d) => [...d.line, d.at, ...d.ext.flat()])];
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const size = Math.max(x1 - x0, y1 - y0) * 1.16, vx = (x0 + x1) / 2 - size / 2, vy = (y0 + y1) / 2 - size / 2;
    const r = (n) => Math.round(n * 100) / 100;
    const pl = (list) => list.map((q) => `${r(q[0])},${r(q[1])}`).join(' ');
    const ln = ([a, b], cls) => `<line x1="${r(a[0])}" y1="${r(a[1])}" x2="${r(b[0])}" y2="${r(b[1])}"${cls ? ` class="${cls}"` : ''}/>`;
    const pct = (q) => `left:${r(((q[0] - vx) / size) * 100)}%;top:${r(((q[1] - vy) / size) * 100)}%`;
    return `<div class="iso" id="iso">
      <svg viewBox="${r(vx)} ${r(vy)} ${r(size)} ${r(size)}" aria-hidden="true">
        <polygon class="iso__top" points="${pl([A2, B2, C2, E2])}"/><polygon class="iso__left" points="${pl([E, C, C2, E2])}"/><polygon class="iso__right" points="${pl([B, C, C2, B2])}"/>
        <g class="iso__hidden">${ln([A, B])}${ln([A, E])}${ln([A, A2])}</g>
        <g class="iso__edge"><polygon points="${pl([A2, B2, C2, E2])}"/>${ln([E, C])}${ln([B, C])}${ln([E, E2])}${ln([C, C2])}${ln([B, B2])}</g>
        ${Object.entries(dims).map(([k, d]) => `<g class="iso__dim" data-dim="${k}">${ln(d.line)}${d.ext.map((e) => ln(e, 'iso__ext')).join('')}</g>`).join('')}
      </svg>
      ${Object.entries(dims).map(([k, d]) => `<span class="iso__lbl t-cap" data-dim="${k}" style="${pct(d.at)}"><span class="sr-only">${{ w: 'Width', d: 'Depth', h: 'Height' }[k]} </span><span data-len="${d.v}">${len(d.v)}</span></span>`).join('')}
    </div>`;
  }
  /* Will it fit through the door? Upright if the narrow side of its footprint and its height pass;
     otherwise on its side, through its two smallest measures. 2 cm of clearance either way. */
  function fitCheck(p, dw, dh) {
    const [W, D, H] = p.dims, a = Math.min(W, D), ok = (x, y) => x + 2 <= dw && y + 2 <= dh;
    if (ok(a, H)) return { how: 'upright', w: a, h: H, spare: Math.min(dw - a, dh - H) };
    const [s1, s2] = [...p.dims].sort((x, y) => x - y);
    const ways = [[s1, s2], [s2, s1]].filter(([x, y]) => ok(x, y)).map(([x, y]) => ({ how: 'side', w: x, h: y, spare: Math.min(dw - x, dh - y) }));
    if (ways.length) return ways.sort((m, n) => n.spare - m.spare)[0];
    return { how: 'no', w: s1, h: s2, need: [s1 + 2, s2 + 2] };
  }
  const fitHTML = () => `<details class="fit"><summary class="t-label">Will it fit through your door?</summary><div class="acc__body t-small">
      <p>Measure the narrowest door or lift on the way in. We allow 2 cm of clearance.</p>
      <div class="fit__grid">
        <svg class="fit__svg" viewBox="0 0 160 260" aria-hidden="true"><path class="fit__wall" fill-rule="evenodd"/><path class="fit__door"/><line class="fit__floor" x1="0" y1="252" x2="160" y2="252"/><rect class="fit__piece" rx="3"/></svg>
        <div class="fit__ctl">
          <label class="slide"><span class="slide__hd"><span>Door width</span><output data-out="w"></output></span><input type="range" min="60" max="120" step="1" value="80" data-door="w"></label>
          <label class="slide"><span class="slide__hd"><span>Door height</span><output data-out="h"></output></span><input type="range" min="180" max="240" step="1" value="200" data-door="h"></label>
        </div>
      </div>
      <p class="fit__verdict" aria-live="polite"></p>
    </div></details>`;
  function product(slug) {
    const p = bySlug[slug];
    if (!p) return notFound();
    const cat = catOf(p.category), fin = p.finishes;
    const related = PRODUCTS.filter((x) => x.category === p.category && x.slug !== p.slug).slice(0, 4);
    const rec = recent.list.filter((s) => s !== slug).slice(0, 4).map((s) => bySlug[s]);
    let barIO = null;
    return {
      title: `${p.name} · DECO`,
      nav: 'shop',
      html: `
      <section class="wrap pdp">
        ${crumbs([['Shop', '#/shop'], [cat.name, `#/shop/${cat.id}`], [p.name]])}
        <div class="pdp__grid">
          <div class="pdp__media">
            <div class="stage" id="stage" data-pane="photo">
              <div class="stage__pane stage__photo is-on" id="pane-photo" role="tabpanel" aria-labelledby="tab-photo"><button class="stage__zoom" type="button" id="zoom" aria-label="Zoom into the photo">${img(p.img, `${p.name}${fin.length ? ' in ' + finishName(fin[0]).toLowerCase() : ''}`, true)}</button></div>
              ${fin.length ? `<div class="stage__pane stage__finish" id="pane-finish" role="tabpanel" aria-labelledby="tab-finish" inert>${fin.map((k, i) => `<img src="${matSrc(k)}" alt="Close-up of ${esc(FINISHES[k].name.toLowerCase())}" data-k="${k}"${i ? '' : ' class="is-on"'} loading="lazy" decoding="async">`).join('')}<p class="stage__cap"><span class="t-label">Close-up</span><span class="t-h4" data-fin-name>${esc(finishName(fin[0]))}</span></p></div>` : ''}
              <div class="stage__pane stage__size" id="pane-size" role="tabpanel" aria-labelledby="tab-size" inert>${isoHTML(p)}<div class="units" role="group" aria-label="Units"><button type="button" data-unit="cm" aria-pressed="${units === 'cm'}">cm</button><button type="button" data-unit="in" aria-pressed="${units === 'in'}">in</button></div></div>
              <div class="stage__tabs" role="tablist" aria-label="View">
                <button class="stage__tab" type="button" role="tab" id="tab-photo" aria-selected="true" aria-controls="pane-photo" data-pane="photo"><img class="stage__thumb" src="${asset(p.thumb)}" alt="">Photo</button>
                ${fin.length ? `<button class="stage__tab" type="button" role="tab" id="tab-finish" aria-selected="false" aria-controls="pane-finish" tabindex="-1" data-pane="finish"><i class="stage__dot" data-fin-dot style="${swatchStyle(fin[0])}"></i>Finish</button>` : ''}
                <button class="stage__tab" type="button" role="tab" id="tab-size" aria-selected="false" aria-controls="pane-size" tabindex="-1" data-pane="size">${ic('ruler')}Size</button>
              </div>
              <span class="pdp__zoom" aria-hidden="true">${ic('zoom')}</span>
            </div>
          </div>
          <div class="pdp__info">
            <div class="pdp__title">
              <p class="t-label">${cat.name}${p.tag ? ' · ' + esc(p.tag) : ''}</p>
              <h1 class="t-h1">${esc(p.name)}</h1>
              <p class="pdp__price">${price(p.price)}</p>
            </div>
            <p class="t-body pdp__copy">${esc(p.copy)}</p>
            ${optHTML(p, true)}
            <div class="buy buy--save">${qtyHTML()}<button class="btn btn--solid" type="button" id="addBtn" data-buy>Add to bag<span class="add__price" data-total></span></button>${heart(p, 'heart--buy')}</div>
            <ul class="assure t-small">
              <li>${ic(p.lead === 'made' ? 'made' : 'box')}<span>${leadLine(p)}</span></li>
              <li>${ic('calendar')}<span>${arrivalLine(p)}</span></li>
              <li>${ic('truck')}<span>Complimentary white-glove delivery in the UAE</span></li>
              <li>${p.lead === 'made' ? `${ic('swatch')}<span>Free samples of <a class="text-link" href="#/materials/${fin[0] || ''}">every finish</a></span>` : `${ic('return')}<span>14 days to return, collected for free</span>`}</li>
            </ul>
            <div class="acc">
              <details open><summary class="t-label">Details</summary><div class="acc__body t-small"><dl class="spec">
                <dt>Size</dt><dd data-dims>${dimsText(p)}</dd>
                ${fin.length ? `<dt>Finish</dt><dd>${fin.map((k) => esc(FINISHES[k].name)).join(', ')}</dd>` : ''}
                <dt>Made</dt><dd>${p.lead === 'made' ? 'By hand, in Al Quoz, Dubai' : 'By our partner studios, finished in Dubai'}</dd>
              </dl></div></details>
              ${p.lead === 'made' ? fitHTML() : ''}
              <details><summary class="t-label">Delivery and returns</summary><div class="acc__body t-small"><p>Furniture is delivered by our own team, unwrapped and placed where you want it. Lighting and decor ship by courier. <a class="text-link" href="#/info/delivery">Read more</a></p></div></details>
              <details><summary class="t-label">Care</summary><div class="acc__body t-small"><p>${fin.length ? esc(FINISHES[fin[0]].care) : 'Dust with a soft, dry cloth.'} <a class="text-link" href="#/info/care">Care guide</a></p></div></details>
            </div>
          </div>
        </div>
      </section>
      <div class="buybar" id="buybar" role="region" aria-label="Add ${esc(p.name)} to your bag" inert>
        <div class="buybar__txt"><span class="t-h4">${esc(p.name)}</span><span class="t-price" data-total></span></div>
        <button class="btn btn--solid" type="button" id="barAdd" data-buy>Add to bag</button>
      </div>
      ${related.length ? `<section class="sec wrap"><div class="head rv"><div class="head__t"><p class="t-label">${cat.name}</p><h2 class="t-h2">You may also like</h2></div><a class="link" href="#/shop/${cat.id}">View all ${countIn(cat.id)}</a></div><ul class="grid">${related.map((r, i) => cardHTML(r, i)).join('')}</ul></section>` : ''}
      ${rec.length ? `<section class="sec wrap"><div class="head rv"><div class="head__t"><p class="t-label">Recently viewed</p><h2 class="t-h2">Pieces you looked at</h2></div></div><ul class="grid">${rec.map((r, i) => cardHTML(r, i)).join('')}</ul></section>` : ''}`,
      bind() {
        recent.add(p.slug);
        const root = $('.view', main), stage = $('#stage'), tabs = $$('.stage__tab', stage);
        const panes = { photo: $('#pane-photo'), finish: $('#pane-finish'), size: $('#pane-size') };
        let pane = 'photo';
        /* Photo, Finish and Size crossfade in one frame. Tabs, arrow keys and a sideways swipe move between them. */
        const show = (name) => {
          if (!panes[name] || name === pane) return;
          pane = name;
          stage.dataset.pane = name;
          Object.entries(panes).forEach(([k, el]) => { if (el) { el.classList.toggle('is-on', k === name); el.inert = k !== name; } });
          tabs.forEach((t) => { const isOn = t.dataset.pane === name; t.setAttribute('aria-selected', String(isOn)); t.tabIndex = isOn ? 0 : -1; });
          zoom.classList.remove('is-zoom');
        };
        tabs.forEach((t) => { t.addEventListener('click', () => show(t.dataset.pane)); t.addEventListener('keydown', (e) => radioKeys(e, tabs, (n) => show(n.dataset.pane))); });
        let sx = null, sy = 0;
        stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
        stage.addEventListener('pointercancel', () => (sx = null));
        stage.addEventListener('pointerup', (e) => {
          if (sx == null) return;
          const dx = e.clientX - sx, dy = e.clientY - sy, order = tabs.map((t) => t.dataset.pane);
          sx = null;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) show(order[(order.indexOf(pane) + (dx < 0 ? 1 : -1) + order.length) % order.length]);
        });
        const zoom = $('#zoom');
        const move = (e) => { const r = zoom.getBoundingClientRect(); zoom.style.setProperty('--zx', ((e.clientX - r.left) / r.width) * 100 + '%'); zoom.style.setProperty('--zy', ((e.clientY - r.top) / r.height) * 100 + '%'); };
        zoom.addEventListener('click', (e) => { zoom.classList.toggle('is-zoom'); move(e); });
        zoom.addEventListener('mousemove', (e) => { if (zoom.classList.contains('is-zoom')) move(e); });
        zoom.addEventListener('mouseleave', () => zoom.classList.remove('is-zoom'));
        /* Picking a finish shows it up close, or the photo again when the photo is in that finish. */
        configure(root, p, {
          photo: () => $('#zoom img'),
          onFinish: (k) => { $$('.stage__finish img', stage).forEach((im) => im.classList.toggle('is-on', im.dataset.k === k)); show(k === fin[0] ? 'photo' : 'finish'); }
        });
        markLoaded(stage);
        /* Size labels: hovering one lights its line. Units switch here and in the Details. */
        const iso = $('#iso');
        $$('.iso__lbl', iso).forEach((l) => { l.addEventListener('mouseenter', () => (iso.dataset.hl = l.dataset.dim)); l.addEventListener('mouseleave', () => delete iso.dataset.hl); });
        const fitEl = $('.fit', root);
        const paintUnits = () => {
          $$('[data-len]', iso).forEach((el) => (el.textContent = len(+el.dataset.len)));
          $$('[data-unit]', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.unit === units)));
          $('[data-dims]', root).textContent = dimsText(p);
          if (fitEl) paintFit();
        };
        $$('[data-unit]', root).forEach((b) => b.addEventListener('click', () => { units = b.dataset.unit; store.set('deco-units', units); paintUnits(); }));
        /* Door check */
        const paintFit = () => {
          const dw = +$('[data-door="w"]', fitEl).value, dh = +$('[data-door="h"]', fitEl).value, r = fitCheck(p, dw, dh), x0 = (160 - dw) / 2, top = 252 - dh;
          $('[data-out="w"]', fitEl).textContent = len(dw);
          $('[data-out="h"]', fitEl).textContent = len(dh);
          $('.fit__wall', fitEl).setAttribute('d', `M0 0H160V252H0Z M${x0} ${top}H${x0 + dw}V252H${x0}Z`);
          $('.fit__door', fitEl).setAttribute('d', `M${x0} 252V${top}H${x0 + dw}V252`);
          const pc = $('.fit__piece', fitEl);
          [['x', 80 - r.w / 2], ['y', 252 - r.h], ['width', r.w], ['height', r.h]].forEach(([k, v]) => pc.setAttribute(k, v));
          fitEl.classList.toggle('is-no', r.how === 'no');
          $('.fit__verdict', fitEl).innerHTML = r.how === 'no'
            ? `${ic('close')}<span>It needs an opening of at least ${pair(r.need[0], r.need[1])}. <a class="text-link" href="mailto:hello@deco.ae?subject=${encodeURIComponent('The way in for a ' + p.name)}">Write to us</a> before you order and we will plan the way in with you.</span>`
            : `${ic('check')}<span>It goes through ${r.how === 'upright' ? 'upright' : 'on its side'}, with ${len(r.spare)} to spare.</span>`;
        };
        if (fitEl) { $$('[data-door]', fitEl).forEach((s) => s.addEventListener('input', paintFit)); paintFit(); }
        /* Phones: a bar keeps Add to bag in reach whenever the main button is off screen. CSS shows it only in the stacked layout. */
        const bar = $('#buybar');
        if ('IntersectionObserver' in window) {
          barIO = new IntersectionObserver(([e]) => { const isOn = !e.isIntersecting; bar.classList.toggle('is-on', isOn); bar.inert = !isOn; });
          barIO.observe($('.buy', root));
        }
      },
      leave() { if (barIO) barIO.disconnect(); }
    };
  }

  /* ---------- Forms ---------- */
  const EMIRATES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
  const okEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  const field = (id, label, type, ac, req) => `<div class="field"><label for="${id}">${label}${req ? '' : ' · optional'}</label><input id="${id}" name="${id}" type="${type}" autocomplete="${ac}"${req ? ' required' : ''} aria-describedby="${id}-err"><span class="field__err" id="${id}-err" aria-live="polite"></span></div>`;
  const emirateField = (id) => `<div class="field field--select"><label for="${id}">Emirate</label><select id="${id}" name="${id}" autocomplete="address-level1">${EMIRATES.map((e) => `<option>${e}</option>`).join('')}</select></div>`;
  /* Checks shared by every form: an error shows when you leave the field or submit, and clears as soon as it is fixed. */
  function checker(form, rules, onInput) {
    const inp = (id) => form.querySelector('#' + id);
    const check = (id) => {
      const el = inp(id), res = rules[id](el.value), ok = res === true, wrap = el.closest('.field');
      wrap.classList.toggle('is-bad', !ok);
      el.setAttribute('aria-invalid', String(!ok));
      $('.field__err', wrap).textContent = ok ? '' : res;
      return ok;
    };
    Object.keys(rules).forEach((id) => {
      inp(id).addEventListener('blur', () => { if (inp(id).value) check(id); });
      inp(id).addEventListener('input', () => { if (inp(id).closest('.field').classList.contains('is-bad')) check(id); if (onInput) onInput(); });
    });
    return {
      valid: (ids) => (ids || Object.keys(rules)).every((id) => rules[id](inp(id).value) === true),
      all() { const bad = Object.keys(rules).filter((id) => !check(id)); if (bad.length) inp(bad[0]).focus(); return !bad.length; }
    };
  }

  /* ---------- Saved list ----------
     #/saved is yours; #/saved?l=a,b is a list someone shared, which you can keep. */
  function savedPage(q) {
    const shared = q.has('l'), from = (q.get('l') || '').split(',').filter((s, i, a) => bySlug[s] && a.indexOf(s) === i);
    const list = () => (shared ? from : saved.list).map((s) => bySlug[s]);
    const first = list();
    let off = null;
    return {
      title: shared ? 'A shared list · DECO' : 'Saved · DECO',
      nav: 'saved',
      html: `
      <section class="wrap saved">
        <header class="shop__head">
          <div>${crumbs([['Home', '#/home'], [shared ? 'Shared list' : 'Saved']])}<h1 class="t-h1">${shared ? 'A list shared with you' : 'Saved'}</h1></div>
          <p class="t-lead">${shared ? 'Pieces someone chose for you. Keep the ones you like on your own list.' : 'The pieces you are thinking about, kept on this device.'}</p>
        </header>
        <div class="saved__bar" id="savedBar"${first.length ? '' : ' hidden'}>
          <p class="saved__sum"><span class="t-h3" id="savedN"></span><span class="t-price" id="savedT"></span></p>
          <div class="saved__acts">
            ${shared ? '<button class="btn btn--solid" type="button" data-keep>Save all to my list</button><button class="btn" type="button" data-all>Add all to bag</button>' : '<button class="btn btn--solid" type="button" data-all>Add all to bag</button>'}
            <button class="tool" type="button" data-share>${ic('link')}<span class="t-label">Copy link to this list</span></button>
          </div>
        </div>
        <ul class="grid" id="savedGrid">${first.map((p, i) => cardHTML(p, i)).join('')}</ul>
        <div class="empty" id="savedEmpty"${first.length ? ' hidden' : ''}>${ic('heart', 'empty__ic')}<h2 class="t-h2">${shared ? 'This list is empty.' : 'Nothing saved yet.'}</h2><p class="t-body">Tap the heart on any piece to keep it here.</p><a class="btn" href="#/shop">Shop the collection</a></div>
      </section>`,
      bind() {
        const root = $('.view', main), grid = $('#savedGrid');
        const cache = new Map($$('li', grid).map((li) => [li.dataset.key, li]));
        const node = (p) => {
          let n = cache.get(p.slug);
          if (!n) { const t = document.createElement('template'); t.innerHTML = cardHTML(p, 0, true).trim(); n = t.content.firstElementChild; markLoaded(n); cache.set(p.slug, n); }
          else $('[data-save]', n).setAttribute('aria-pressed', String(saved.has(p.slug))); // it missed changes while out of the page
          return n;
        };
        const paint = () => {
          const l = list();
          $('#savedBar').hidden = !l.length;
          $('#savedEmpty').hidden = l.length > 0;
          $('#savedN').textContent = plural(l.length, 'piece');
          $('#savedT').innerHTML = price(l.reduce((s, p) => s + p.price, 0));
          const keep = $('[data-keep]', root);
          if (keep) { const all = l.every((p) => saved.has(p.slug)); keep.disabled = all; keep.textContent = all ? 'All on your list' : 'Save all to my list'; }
        };
        /* Taking a heart off removes the card here; the others close the gap. Undo brings it back. */
        off = on('saved', () => { if (!shared) fx.flip(grid, () => grid.replaceChildren(...list().map(node))); paint(); });
        root.addEventListener('click', (e) => {
          const l = list();
          if (e.target.closest('[data-all]')) addMany(l.map((p) => ({ slug: p.slug, finish: defaultFinish(p), qty: 1 })), { btn: e.target.closest('[data-all]'), from: $('.card__media img', grid) });
          else if (e.target.closest('[data-keep]')) {
            const add = l.filter((p) => !saved.has(p.slug));
            add.slice().reverse().forEach((p) => saved.set(p.slug, true));
            fx.beam(e.target.closest('[data-keep]'));
            toast(`${add.length === 1 ? 'One piece is' : plural(add.length, 'piece') + ' are'} on your list`, { label: 'View saved', run: () => go('#/saved') });
          } else if (e.target.closest('[data-share]')) {
            const url = `${location.href.split('#')[0]}#/saved?l=${l.map((p) => p.slug).join(',')}`;
            const ask = () => window.prompt('Copy this link to share the list', url);
            if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(() => toast('The link to this list is copied', false), ask);
            else ask();
          }
        });
        paint();
      },
      leave() { if (off) off(); }
    };
  }

  /* ---------- Materials and samples ---------- */
  function materials(key) {
    let cur = FINISHES[key] ? key : KEYS[0];
    const kinds = [...new Set(KEYS.map((k) => FINISHES[k].kind))];
    let panel = null, pill = null, off = null;
    return {
      title: 'Materials and samples · DECO',
      nav: 'materials',
      html: `
      <section class="wrap mat">
        <header class="shop__head">
          <div>${crumbs([['Home', '#/home'], ['Materials']])}<h1 class="t-h1">Seven finishes, sent to your door.</h1></div>
          <p class="t-lead">Order up to four free samples. Hold them in your own light, beside your own floor, before you choose.</p>
        </header>
        <div class="mat__rail" role="tablist" aria-label="Finishes">${kinds.map((kind) => `<div class="mat__group" role="presentation"><p class="t-label soft" aria-hidden="true">${kind}</p><div class="mat__tabs" role="presentation">${KEYS.filter((k) => FINISHES[k].kind === kind).map((k) => `<button class="mtab" type="button" role="tab" id="mt-${k}" aria-controls="matView" aria-selected="${k === cur}" tabindex="${k === cur ? 0 : -1}" data-k="${k}"><i class="mtab__sw" style="${swatchStyle(k)}"></i><span class="t-small">${esc(FINISHES[k].name)}</span></button>`).join('')}</div></div>`).join('')}</div>
        <div class="mat__view" id="matView" role="tabpanel" aria-labelledby="mt-${cur}">
          <div class="mat__media"><div class="ratio stack mat__photo" id="matPhoto">${KEYS.map((k) => `<img src="${matSrc(k)}" alt="" data-k="${k}"${k === cur ? ' class="is-on"' : ''} decoding="async">`).join('')}<span class="lens" aria-hidden="true"></span></div></div>
          <div class="mat__info" id="matInfo"></div>
        </div>
      </section>`,
      bind() {
        const tabs = $$('.mtab', main), photo = $('#matPhoto'), info = $('#matInfo'), lens = $('.lens', photo);
        if (key !== cur) { history.replaceState(history.state, '', '#/materials/' + cur); routedHref = location.href; } // an unknown finish shows the first
        const paintInfo = () => {
          const F = FINISHES[cur], used = inFinish(cur), isIn = samples.has(cur), full = samples.list.length >= 4;
          const rooms = [...new Set(used.map((p) => catOf(p.category).name.toLowerCase()))];
          const hadFocus = document.activeElement && document.activeElement.id === 'sampleBtn';
          info.innerHTML = `<p class="t-label soft">${F.kind} · ${pad2(KEYS.indexOf(cur) + 1)} of ${pad2(KEYS.length)}</p>
            <h2 class="t-h1">${esc(F.name)}</h2>
            <p class="t-lead">${esc(F.line)}</p>
            <dl class="spec t-small"><dt>Care</dt><dd>${esc(F.care)}</dd><dt>Used on</dt><dd>${plural(used.length, 'piece')} in ${joinAnd(rooms)}</dd></dl>
            <ul class="mat__thumbs">${used.slice(0, 4).map((p) => `<li><a href="#/product/${p.slug}"><span class="ratio">${img(p.thumb)}</span><span class="t-cap">${esc(p.name)}</span></a></li>`).join('')}</ul>
            <div class="mat__cta"><button class="btn${isIn ? '' : ' btn--solid'}" type="button" id="sampleBtn"${!isIn && full ? ' disabled' : ''}>${isIn ? 'Remove from sample box' : 'Add a free sample'}</button><a class="link" href="#/shop?finish=${cur}">Shop ${plural(used.length, 'piece')}</a></div>
            ${!isIn && full ? '<p class="t-cap soft">Your box holds four. Take one out to add this one.</p>' : ''}`;
          markLoaded(info);
          if (hadFocus) $('#sampleBtn').focus();
        };
        /* The URL follows the finish, without adding history. */
        const pick = (k) => {
          if (k === cur) return;
          cur = k;
          tabs.forEach((t) => { const isOn = t.dataset.k === k; t.setAttribute('aria-selected', String(isOn)); t.tabIndex = isOn ? 0 : -1; });
          $$('img', photo).forEach((im) => im.classList.toggle('is-on', im.dataset.k === k));
          $('#matView').setAttribute('aria-labelledby', 'mt-' + k);
          history.replaceState(history.state, '', '#/materials/' + k);
          routedHref = location.href;
          lens.style.backgroundImage = `url("${matSrc(k)}")`;
          paintInfo();
        };
        tabs.forEach((t) => { t.addEventListener('click', () => pick(t.dataset.k)); t.addEventListener('keydown', (e) => radioKeys(e, tabs, (n) => pick(n.dataset.k))); });
        /* On phones the rail scrolls sideways: bring the current finish into the middle. */
        const rail = $('.mat__rail', main), curTab = $(`#mt-${cur}`);
        if (rail.scrollWidth > rail.clientWidth) rail.scrollLeft += curTab.getBoundingClientRect().left - rail.getBoundingClientRect().left - (rail.clientWidth - curTab.offsetWidth) / 2;
        /* A 2.5× lens follows the mouse over the photo. Not on touch screens. */
        if (fine.matches) {
          const Z = 2.5;
          lens.style.backgroundImage = `url("${matSrc(cur)}")`;
          photo.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            const r = photo.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, R = lens.offsetWidth / 2;
            const im = $('img.is-on', photo), ar = im && im.naturalWidth ? im.naturalHeight / im.naturalWidth : 4 / 3;
            /* The scan covers the square: fitted to its width when portrait, to its height when landscape, centred. */
            const iw = ar >= 1 ? r.width : r.height / ar, ih = iw * ar, ox = (r.width - iw) / 2, oy = (r.height - ih) / 2;
            lens.style.transform = `translate(${x - R}px, ${y - R}px)`;
            lens.style.backgroundSize = `${iw * Z}px ${ih * Z}px`;
            lens.style.backgroundPosition = `${R - (x - ox) * Z}px ${R - (y - oy) * Z}px`;
            photo.classList.add('is-lens');
          });
          photo.addEventListener('pointerleave', () => photo.classList.remove('is-lens'));
        }
        /* Sample box: a pill bottom right, and a panel with four places and a short form. */
        pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'sbox';
        pill.setAttribute('aria-controls', 'samples');
        document.body.appendChild(pill);
        panel = makePanel('samples', 'Sample box', `<div class="panel__body sb">
            <div class="sb__box" id="sbBox"><p class="t-small soft sb__intro">Up to four cuttings, free, in one card folder. They reach you in 3 to 5 working days.</p><ul class="slots" id="sbSlots"></ul>
              <form class="sb__form" id="sbForm" novalidate><p class="t-label soft">Where should they go?</p>${field('sbName', 'Name', 'text', 'name', true)}${field('sbEmail', 'Email', 'email', 'email', true)}${field('sbAddr', 'Street, building, villa or apartment', 'text', 'street-address', true)}${emirateField('sbEm')}<button class="btn btn--solid btn--block" type="submit">Send my samples</button></form>
              <p class="t-small soft" id="sbHint">Choose a finish, then Add a free sample.</p></div>
            <div class="sb__done" id="sbDone" hidden></div></div>`);
        const paintBox = () => {
          const n = samples.list.length;
          pill.innerHTML = `${ic('swatch')}<span class="t-label">Sample box · ${n} of 4</span>`;
          pill.setAttribute('aria-label', `Sample box, ${n} of 4`);
          $('#sbSlots', panel).innerHTML = [0, 1, 2, 3].map((i) => {
            const k = samples.list[i];
            return k ? `<li class="slot"><span class="slot__img" style="${swatchStyle(k)}"></span><span class="slot__txt"><span class="t-h4">${esc(FINISHES[k].name)}</span><span class="t-cap soft">${FINISHES[k].kind}</span></span><button class="line__rm" type="button" data-unsample="${k}" aria-label="Take ${esc(FINISHES[k].name)} out of the box">${ic('close')}</button></li>`
              : '<li class="slot slot--empty"><span class="slot__img"></span><span class="t-cap soft">Empty place</span></li>';
          }).join('');
          $('#sbForm', panel).hidden = !n;
          $('#sbHint', panel).hidden = n > 0;
          paintInfo();
        };
        const toggleSample = (k) => {
          const isIn = samples.has(k);
          if (!isIn && samples.list.length >= 4) return;
          samples.set(isIn ? samples.list.filter((x) => x !== k) : [...samples.list, k]);
          if (!isIn) { fx.beam(pill); toast(`${FINISHES[k].name} is in your sample box`, { label: 'View box', run: () => openPanel(panel) }); }
        };
        off = on('samples', paintBox);
        info.addEventListener('click', (e) => { if (e.target.closest('#sampleBtn')) toggleSample(cur); });
        pill.addEventListener('click', () => openPanel(panel));
        panel.addEventListener('click', (e) => {
          const rm = e.target.closest('[data-unsample]');
          if (!rm) return;
          samples.set(samples.list.filter((x) => x !== rm.dataset.unsample));
          ($('[data-unsample]', panel) || $('.panel__close', panel)).focus();
        });
        const form = $('#sbForm', panel);
        const chk = checker(form, { sbName: (v) => v.trim().length > 1 || 'Enter your name.', sbEmail: (v) => okEmail(v) || 'Enter an email we can reply to.', sbAddr: (v) => v.trim().length > 4 || 'Enter the address for the post.' });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if (!samples.list.length || !chk.all()) return;
          const names = samples.list.map((k) => FINISHES[k].name.toLowerCase()), who = $('#sbName', panel).value.trim().split(' ')[0];
          const done = $('#sbDone', panel);
          done.innerHTML = `${MARK}<p class="t-label soft">Samples</p><h3 class="t-h2" tabindex="-1">They are on their way, ${esc(who)}.</h3><p class="t-body soft">${esc(joinAnd(names).replace(/^./, (c) => c.toUpperCase()))} leave the workshop today, in one folder. Expect them by ${wdDayMon(addWork(today(), 5))}.</p><button class="btn" type="button" data-close-panel>Close</button>`;
          done.hidden = false;
          $('#sbBox', panel).hidden = true;
          form.reset();
          samples.set([]);
          $('h3', done).focus();
        });
        panel.onclose = () => setTimeout(() => { $('#sbDone', panel).hidden = true; $('#sbBox', panel).hidden = false; }, 480);
        paintBox();
      },
      leave() { if (off) off(); if (panel) panel.remove(); if (pill) pill.remove(); }
    };
  }

  /* ---------- Atelier ---------- */
  const STEPS = [
    { t: 'Confirm', w: [1, 1], icon: 'phone', pic: 'assets/materials/boucle.jpg', text: 'We call within a day to confirm the finish, the size and the way into your home. Samples go out the same week if you want them.' },
    { t: 'Frame', w: [2, 3], icon: 'made', pic: 'assets/materials/walnut.jpg', text: 'The frame is cut from solid timber and joined by hand, with dowels and glue wherever it carries weight.' },
    { t: 'Shape', w: [4, 5], icon: 'seating', pic: 'assets/materials/wool.jpg', text: 'Layers of foam and fibre are cut, glued and shaped over the frame until every curve sits right.' },
    { t: 'Upholstery', w: [6, 7], icon: 'swatch', pic: 'assets/materials/terracotta.jpg', text: 'The cloth is cut for your piece and fitted seam by seam. Bouclé takes longest: every loop has to run the same way.' },
    { t: 'Last look', w: [8, 8], icon: 'check', pic: 'assets/products/luna-sofa.jpg', text: 'The maker who built it checks it with the workshop lead, in daylight. Then it is wrapped in blankets, never plastic.' },
    { t: 'At your door', w: [9, 10], icon: 'truck', pic: 'assets/products/mira-lounge-chair.jpg', text: 'Our own team carries it in, unwraps it, places it where you want it and takes the packaging away.' }
  ];
  const stepAt = (wk) => STEPS.findIndex((s) => wk >= s.w[0] && wk <= s.w[1]);
  const weeksOf = (w) => (w[0] === w[1] ? `Week ${w[0]}` : `Weeks ${w[0]} to ${w[1]}`);
  const TOPICS = ['Seating', 'Beds', 'Stone tables', 'Lighting', 'Finishes'];
  const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => `${pad2(h)}:00`);
  /* The next twelve days the atelier is open: every day but Friday. */
  const openDays = () => { const out = []; let d = today(); while (out.length < 12) { d = addDays(d, 1); if (d.getDay() !== 5) out.push(d); } return out; };
  /* A calendar file for the visit. Dubai is UTC+4 all year. */
  function icsFor(v) {
    const d = fromIso(v.date), h = +v.time.slice(0, 2);
    const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), h - 4)), end = new Date(start.getTime() + 36e5);
    const stamp = (x) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const text = (s) => s.replace(/([,;\\])/g, '\\$1');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DECO//Atelier visit//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:visit-${v.date}-${h}-${v.made || Date.now()}@deco.ae`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      'SUMMARY:Visit to the DECO atelier', `LOCATION:${text('Warehouse 41, Alserkal Avenue, Al Quoz 1, Dubai')}`,
      `DESCRIPTION:${text('Sit in every piece and hold every finish.' + (v.topics.length ? ' You asked to see: ' + v.topics.join(', ').toLowerCase() + '.' : '') + ' hello@deco.ae · +971 4 000 0000')}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  function atelier() {
    const arco = bySlug['arco-lounge-chair'];
    return {
      title: 'The atelier · DECO',
      nav: 'atelier',
      html: `
      <section class="wrap atl">
        <header class="shop__head">
          <div>${crumbs([['Home', '#/home'], ['Atelier']])}<h1 class="t-h1">Made slowly, a few streets from you.</h1></div>
          <p class="t-lead">Eleven makers in one workshop in Al Quoz. Every frame is cut, shaped and upholstered here, then carried to your door by the same hands.</p>
        </header>
        <div class="band">
          <span class="ratio band__img">${img('assets/products/hero.jpg', 'The Arco Lounge Chair in terracotta bouclé on the workshop floor, in afternoon light', true)}</span>
          <a class="band__tag" href="#/product/${arco.slug}"><span class="t-label">In the photo</span><span class="t-h4">${esc(arco.name)}</span><span class="t-price">${price(arco.price)}</span></a>
        </div>
      </section>

      <section class="sec wrap tl">
        <div class="head rv"><div class="head__t"><p class="t-label">From your order to your door</p><h2 class="t-h2">Ten weeks, by hand</h2></div></div>
        <div class="tl__grid">
          <div class="tl__main rv">
            <div class="tl__track" style="--p:0">
              <span class="tl__rail"><span class="tl__fill"></span></span>
              ${STEPS.map((s) => `<i class="tl__tick" style="--at:${((s.w[0] - 1) / 9).toFixed(4)}"></i>`).join('')}
              <span class="tl__bubble t-label" aria-hidden="true">Week 1</span>
              <input class="tl__range" type="range" min="1" max="10" step="1" value="1" aria-label="Week of the making">
            </div>
            <ol class="tl__steps">${STEPS.map((s, i) => `<li><button class="tl__step" type="button" data-i="${i}" aria-pressed="${!i}">${ic(s.icon)}<span class="t-h4">${s.t}</span><span class="t-cap soft">${weeksOf(s.w)}</span></button></li>`).join('')}</ol>
            <div class="tl__now" id="tlNow"></div>
          </div>
          <div class="tl__pic rv" style="--d:1"><span class="ratio stack">${STEPS.map((s, i) => `<img src="${asset(s.pic)}" alt="" data-i="${i}"${i ? '' : ' class="is-on"'} loading="lazy" decoding="async">`).join('')}</span></div>
        </div>
      </section>

      <section class="sec wrap"><ul class="facts rv">
        <li><span class="t-h1">11</span><span class="t-small soft">makers in one workshop</span></li>
        <li><span class="t-h1">6–10</span><span class="t-small soft">weeks from your order to your door</span></li>
        <li><span class="t-h1">${PRODUCTS.length}</span><span class="t-small soft">pieces, each made for one room</span></li>
      </ul></section>

      <section class="sec wrap visit" id="visit">
        <div class="visit__info rv">
          <p class="t-label soft">Visit</p>
          <h2 class="t-h2">Sit in it first.</h2>
          <p class="t-body soft">Sit in every piece, hold every finish and meet the people who make them. A visit takes about an hour.</p>
          <ul class="assure t-small">
            <li>${ic('pin')}<span>Warehouse 41, Alserkal Avenue<br>Al Quoz 1, Dubai</span></li>
            <li>${ic('clock')}<span>Saturday to Thursday, 10:00 to 19:00<br>Friday by appointment</span></li>
            <li>${ic('mail')}<a class="text-link" href="mailto:hello@deco.ae">hello@deco.ae</a></li>
            <li>${ic('phone')}<a class="text-link" href="tel:+97140000000">+971 4 000 0000</a></li>
          </ul>
        </div>
        <div class="book rv" style="--d:1" id="book"></div>
      </section>`,
      bind() {
        /* Ten weeks on one slider: the steps, the picture and the text follow the week. */
        const range = $('.tl__range', main), track = $('.tl__track', main), now = $('#tlNow'), stepB = $$('.tl__step', main), pics = $$('.tl__pic img', main);
        const setWeek = (wk) => {
          const i = stepAt(wk), s = STEPS[i];
          range.value = wk;
          track.style.setProperty('--p', ((wk - 1) / 9).toFixed(4));
          $('.tl__bubble', track).textContent = `Week ${wk}`;
          range.setAttribute('aria-valuetext', `Week ${wk} of 10, ${s.t}`);
          stepB.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
          pics.forEach((im, j) => im.classList.toggle('is-on', j === i));
          now.innerHTML = `<p class="t-label soft">Week ${wk} of 10</p><h3 class="t-h2">${s.t}</h3><p class="t-body soft">${s.text}</p>`;
        };
        range.addEventListener('input', () => setWeek(+range.value));
        stepB.forEach((b) => b.addEventListener('click', () => setWeek(STEPS[+b.dataset.i].w[0])));
        setWeek(1);

        /* Booking card: a day, an hour, what to see, a name. Kept on this device. */
        const book = $('#book');
        let visit = store.get('deco-visit', null);
        if (visit && (!visit.date || fromIso(visit.date) < today())) visit = null;
        let pick = visit ? { ...visit, topics: visit.topics.slice() } : { date: '', time: '', topics: [], name: '', email: '' };
        const paintChoice = () => {
          $$('[data-day]', book).forEach((b) => { const isOn = b.dataset.day === pick.date; b.setAttribute('aria-checked', String(isOn)); b.tabIndex = isOn ? 0 : -1; });
          const times = $$('[data-time]', book);
          times.forEach((b, i) => { const isOn = b.dataset.time === pick.time; b.setAttribute('aria-checked', String(isOn)); b.tabIndex = isOn || (!pick.time && !i) ? 0 : -1; });
          $$('[data-topic]', book).forEach((b) => b.setAttribute('aria-pressed', String(pick.topics.includes(b.dataset.topic))));
        };
        const paintForm = () => {
          const days = openDays();
          if (!days.some((d) => isoDay(d) === pick.date)) pick.date = isoDay(days[0]);
          book.innerHTML = `<form class="book__form" novalidate>
              <div class="book__hd"><h3 class="t-h3">Book a visit</h3><p class="t-cap soft">One hour, with the people who make the pieces</p></div>
              <fieldset class="book__fs"><legend class="t-label soft">Day</legend><div class="days" role="radiogroup" aria-label="Day">${days.map((d) => `<button class="chip day" type="button" role="radio" data-day="${isoDay(d)}" aria-label="${longDay(d)}"><span class="t-cap">${dfmt(d, { weekday: 'short' })}</span><span class="t-h4">${d.getDate()}</span><span class="t-cap">${dfmt(d, { month: 'short' })}</span></button>`).join('')}</div></fieldset>
              <fieldset class="book__fs"><legend class="t-label soft">Time</legend><div class="times" role="radiogroup" aria-label="Time" aria-describedby="bkTime-err">${HOURS.map((h) => `<button class="chip" type="button" role="radio" data-time="${h}">${h}</button>`).join('')}</div><span class="field__err" id="bkTime-err" aria-live="polite"></span></fieldset>
              <fieldset class="book__fs"><legend class="t-label soft">What would you like to see? · optional</legend><div class="chips">${TOPICS.map((t) => `<button class="chip" type="button" aria-pressed="false" data-topic="${t}">${t}</button>`).join('')}</div></fieldset>
              <div class="row2">${field('bkName', 'Name', 'text', 'name', true)}${field('bkEmail', 'Email', 'email', 'email', true)}</div>
              <button class="btn btn--solid btn--block" type="submit">Book my visit</button>
              ${visit ? '<button class="text-btn book__cancel" type="button" data-cancel>Cancel my visit</button>' : ''}
            </form>`;
          const form = $('form', book);
          $('#bkName', book).value = pick.name || '';
          $('#bkEmail', book).value = pick.email || '';
          paintChoice();
          const days2 = $$('[data-day]', book), times = $$('[data-time]', book);
          days2.forEach((b) => b.addEventListener('keydown', (e) => radioKeys(e, days2, (n) => { pick.date = n.dataset.day; paintChoice(); })));
          times.forEach((b) => b.addEventListener('keydown', (e) => radioKeys(e, times, (n) => { pick.time = n.dataset.time; paintChoice(); $('#bkTime-err', book).textContent = ''; })));
          const chk = checker(form, { bkName: (v) => v.trim().length > 1 || 'Enter your name.', bkEmail: (v) => okEmail(v) || 'Enter an email we can reply to.' });
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!pick.time) { $('#bkTime-err', book).textContent = 'Choose a time.'; times[0].focus(); return; }
            if (!chk.all()) return;
            visit = { date: pick.date, time: pick.time, topics: pick.topics.slice(), name: $('#bkName', book).value.trim(), email: $('#bkEmail', book).value.trim(), made: Date.now() };
            store.set('deco-visit', visit);
            paintDone(true);
          });
        };
        const paintDone = (fresh) => {
          const d = fromIso(visit.date);
          book.innerHTML = `<div class="book__done">${MARK}<p class="t-label soft">Your visit</p><h3 class="t-h2" tabindex="-1">See you on ${longDay(d)} at ${visit.time}.</h3>
            <p class="t-body soft">Warehouse 41, Alserkal Avenue, Al Quoz 1. The details are on their way to ${esc(visit.email)}${visit.topics.length ? `, and we will have ${esc(joinAnd(visit.topics.map((t) => t.toLowerCase())))} ready for you` : ''}.</p>
            <div class="book__acts"><button class="tool" type="button" data-ics>${ic('calendar')}<span class="t-label">Add to calendar</span></button><button class="text-btn" type="button" data-change>Change or cancel</button></div></div>`;
          if (fresh) { fx.beam(book); $('h3', book).focus({ preventScroll: true }); }
        };
        book.addEventListener('click', (e) => {
          const t = (s) => e.target.closest(s);
          let b;
          if ((b = t('[data-day]'))) { pick.date = b.dataset.day; paintChoice(); }
          else if ((b = t('[data-time]'))) { pick.time = b.dataset.time; paintChoice(); $('#bkTime-err', book).textContent = ''; }
          else if ((b = t('[data-topic]'))) { const x = b.dataset.topic; pick.topics = pick.topics.includes(x) ? pick.topics.filter((y) => y !== x) : [...pick.topics, x]; paintChoice(); }
          else if (t('[data-change]')) { pick = { ...visit, topics: visit.topics.slice() }; paintForm(); $('[data-day][aria-checked="true"]', book).focus(); }
          else if (t('[data-cancel]')) { visit = null; store.set('deco-visit', null); pick.time = ''; paintForm(); toast('Your visit is cancelled', false); }
          else if (t('[data-ics]')) {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([icsFor(visit)], { type: 'text/calendar;charset=utf-8' }));
            a.download = 'deco-atelier-visit.ics';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          }
        });
        /* Typing in the name or email keeps them if the form is drawn again. */
        book.addEventListener('input', (e) => { if (e.target.id === 'bkName') pick.name = e.target.value; if (e.target.id === 'bkEmail') pick.email = e.target.value; });
        if (visit) paintDone(); else paintForm();
      }
    };
  }

  /* ---------- Room planner (assets/js/planner.js) ---------- */
  function plan() {
    let inst = null;
    return {
      title: 'Room planner · DECO',
      nav: 'plan',
      html: `
      <section class="wrap pln">
        <header class="shop__head">
          <div>${crumbs([['Home', '#/home'], ['Room planner']])}<h1 class="t-h1">Try it in your room first.</h1></div>
          <p class="t-lead">Set your room to size, then place pieces at their true footprint. Drag to move, R to turn.</p>
        </header>
        <div class="planner" id="planner"></div>
      </section>`,
      bind() {
        if (window.DECO_PLANNER) inst = window.DECO_PLANNER.mount($('#planner'), planApi);
        else $('#planner').innerHTML = '<p class="t-body soft">The planner could not load. Refresh the page to try again.</p>';
      },
      leave() { if (inst && inst.unmount) inst.unmount(); }
    };
  }

  /* ---------- Checkout ---------- */
  /* Delivery timing: weeks for made-to-order bags (from the first Monday once the making is done), days for stock. */
  function whenChoices() {
    const made = bag.items.some((i) => bySlug[i.slug].lead === 'made');
    if (made) {
      const from = addDays(today(), 42);
      let d = from;
      while (d.getDay() !== 1) d = addDays(d, 1);
      return { made, from, opts: [0, 1, 2, 3, 4].map((n) => { const x = addDays(d, 7 * n); return [isoDay(x), `Week of ${dayMon(x)}`]; }) };
    }
    const opts = [];
    let d = addWork(today(), 3);
    for (let n = 0; n < 5; n++) { opts.push([isoDay(d), wdDayMon(d)]); d = addWork(d, 1); }
    return { made, opts };
  }
  const whenHTML = (w, chosen) => {
    const keep = w.opts.some(([v]) => v === chosen);
    return `<fieldset class="when"><legend class="t-label soft">${w.made ? 'Delivery week' : 'Delivery day'}</legend>
      <div class="chips">${w.opts.map(([v, label], i) => `<label class="chip"><input class="sr-only" type="radio" name="when" value="${v}" data-label="${label}"${(keep ? v === chosen : !i) ? ' checked' : ''}><span>${label}</span></label>`).join('')}</div>
      <p class="t-cap soft">${w.made ? `Made-to-order pieces are ready from ${dayMon(w.from)}. We call to agree the day.` : 'We call the day before with a two-hour window.'}</p></fieldset>`;
  };
  const sumHTML = () => `<h2 class="t-h3">Your order</h2>
      <ul>${bag.items.map((it, i) => lineHTML(it, i, false)).join('')}</ul>
      <div class="sum t-small">
        <div><span>Subtotal</span><span class="t-price">${price(bag.total())}</span></div>
        <div><span>Delivery</span><span>Complimentary</span></div>
        <div class="sum__total"><span class="t-h4">Total</span><span class="t-price">${price(bag.total())}</span></div>
      </div>
      <p class="t-cap soft">Prices include VAT.</p>`;
  function checkout() {
    let off = null;
    /* An empty bag here can fill again from the bag panel (Undo, or a suggestion): the form comes back. */
    if (!bag.items.length) return { title: 'Checkout · DECO', html: `<section class="wrap co"><div class="empty">${ic('bag', 'empty__ic')}<h1 class="t-h1">Your bag is empty.</h1><p class="t-body">Every piece is made for one room. Start with yours.</p><a class="btn" href="#/shop">Shop the collection</a></div></section>`,
      bind() { off = on('bag', () => { if (bag.items.length) route(false, false, true); }); }, leave() { if (off) off(); } };
    const legend = (n, t) => `<legend><span class="fs__n"><span class="t-label">${n}</span>${ic('check')}</span><span class="t-h3">${t}</span></legend>`;
    return {
      title: 'Checkout · DECO',
      html: `
      <section class="wrap co">
        ${crumbs([['Shop', '#/shop'], ['Checkout']])}
        <div class="co__intro"><h1 class="t-h1">Checkout</h1><p class="t-body soft">Three short steps. We confirm every piece with the workshop before you pay.</p></div>
        <div class="co__grid">
          <form id="coForm" novalidate>
            <fieldset class="fs">${legend('01', 'Contact')}
              <div class="row2">${field('email', 'Email', 'email', 'email', true)}${field('phone', 'Phone', 'tel', 'tel', true)}</div>
            </fieldset>
            <fieldset class="fs">${legend('02', 'Delivery')}
              ${field('name', 'Full name', 'text', 'name', true)}
              ${field('address', 'Street, building, villa or apartment', 'text', 'street-address', true)}
              <div class="row2">${field('area', 'Area', 'text', 'address-level3', false)}${emirateField('emirate')}</div>
              <div class="field"><label for="notes">Delivery notes · optional</label><textarea id="notes" name="notes" placeholder="Building access, lift size, the best day for us to come."></textarea></div>
              <label class="radio"><input type="radio" name="ship" value="White-glove delivery" checked>${ic('truck')}<span><span class="t-h4">White-glove delivery</span><span class="t-small">Unwrapped and placed by our team</span></span><span class="t-cap">Complimentary</span></label>
              <label class="radio"><input type="radio" name="ship" value="Collect from the atelier">${ic('pin')}<span><span class="t-h4">Collect from the atelier</span><span class="t-small">Alserkal Avenue, Al Quoz 1</span></span><span class="t-cap">Complimentary</span></label>
              <div id="coWhen">${whenHTML(whenChoices())}</div>
            </fieldset>
            <fieldset class="fs">${legend('03', 'Payment')}
              <label class="radio"><input type="radio" name="pay" value="Secure payment link" checked>${ic('lock')}<span><span class="t-h4">Secure payment link</span><span class="t-small">Sent by email once we confirm your order</span></span><span></span></label>
              <label class="radio"><input type="radio" name="pay" value="Bank transfer">${ic('bank')}<span><span class="t-h4">Bank transfer</span><span class="t-small">Our details come with your confirmation</span></span><span></span></label>
              <p class="t-cap soft co__note">${ic('lock')}No card details are taken on this page.</p>
            </fieldset>
            <button class="btn btn--solid btn--block" type="submit">Place order ·<span id="coTotal">${price(bag.total())}</span></button>
          </form>
          <aside class="co__sum" id="coSum" aria-label="Order summary">${sumHTML()}</aside>
        </div>
      </section>`,
      bind() {
        const form = $('#coForm'), steps = $$('.fs', form);
        /* A step's number turns into a check once its required fields are right. */
        const paintSteps = () => {
          const a = chk.valid(['email', 'phone']), b = chk.valid(['name', 'address']);
          steps[0].classList.toggle('is-ok', a);
          steps[1].classList.toggle('is-ok', b);
          steps[2].classList.toggle('is-ok', a && b);
        };
        const chk = checker(form, {
          email: (v) => okEmail(v) || 'Enter an email we can reply to.',
          phone: (v) => v.replace(/\D/g, '').length >= 8 || 'Enter a phone number for delivery.',
          name: (v) => v.trim().length > 1 || 'Enter the name for delivery.',
          address: (v) => v.trim().length > 4 || 'Enter the delivery address.'
        }, paintSteps);
        form.addEventListener('change', (e) => {
          if (e.target.matches('.radio input')) fx.beam(e.target.closest('.radio'));
          if (e.target.name === 'when') fx.beam(e.target.closest('.chip'));
        });
        /* The bag can change from its panel while you are here: keep the summary honest. */
        off = on('bag', () => {
          if (!bag.items.length) { route(false, false, true); return; }
          $('#coSum').innerHTML = sumHTML();
          markLoaded($('#coSum'));
          $('#coTotal').innerHTML = price(bag.total());
          const chosen = $('input[name="when"]:checked', form);
          $('#coWhen').innerHTML = whenHTML(whenChoices(), chosen && chosen.value);
        });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if (!chk.all()) return;
          const fd = new FormData(form), w = $('input[name="when"]:checked', form);
          const ref = 'DC' + String(Date.now()).slice(-6);
          const o = { ref, name: fd.get('name').trim().split(' ')[0], email: fd.get('email').trim(), ship: fd.get('ship'), pay: fd.get('pay'), when: w ? w.dataset.label : '', made: whenChoices().made, items: bag.items.slice(), total: bag.total() };
          try { sessionStorage.setItem('deco-order', JSON.stringify(o)); } catch (err) { /* ignore */ }
          if (off) { off(); off = null; }
          bag.clear();
          go('#/order/' + ref, true);
        });
        paintSteps();
      },
      leave() { if (off) off(); }
    };
  }

  function order(ref) {
    let o = null;
    try { o = JSON.parse(sessionStorage.getItem('deco-order') || 'null'); } catch (e) { /* ignore */ }
    if (!o || o.ref !== ref) return { title: 'Order · DECO', html: `<section class="wrap"><div class="done"><h1 class="t-h1">Order ${esc(ref || '')}</h1><p class="t-body soft">We have your order. A confirmation is on its way by email.</p><a class="btn" href="#/shop">Keep browsing</a></div></section>` };
    const pay = o.pay === 'Bank transfer' ? 'bank transfer details' : 'secure payment link';
    return {
      title: 'Thank you · DECO',
      html: `
      <section class="wrap"><div class="done">
        ${MARK}
        <p class="t-label soft">Order ${esc(o.ref)}</p>
        <h1 class="t-h1">Thank you, ${esc(o.name)}.</h1>
        <p class="t-body soft">We will confirm every piece with the workshop and email ${esc(o.email)} within one working day, with a ${pay} and a delivery date.</p>
        <ul>${o.items.map((it, i) => lineHTML(it, i, false)).join('')}</ul>
        <div class="sum t-small"><div><span>${esc(o.ship)}</span><span>Complimentary</span></div>${o.when ? `<div><span>${o.made ? 'Delivery week' : 'Delivery day'}</span><span>${esc(o.when)}</span></div>` : ''}<div class="sum__total"><span class="t-h4">Total</span><span class="t-price">${price(o.total)}</span></div></div>
        <div class="next"><p class="t-label soft">What happens next</p><ol>
          <li>${ic('mail')}<span><span class="t-h4">Within one working day</span><span class="t-small soft">We confirm every piece with the workshop and send your ${pay}.</span></span></li>
          ${o.made ? `<li>${ic('made')}<span><span class="t-h4">Over the coming weeks</span><span class="t-small soft">Your pieces are made by hand in Al Quoz. <a class="text-link" href="#/atelier">See how they are made</a></span></span></li>` : ''}
          <li>${ic('truck')}<span><span class="t-h4">${o.when ? esc(o.when) : 'On the day'}</span><span class="t-small soft">We call to agree the time, then carry it in and place it.</span></span></li>
          ${o.made ? '' : `<li>${ic('pin')}<span><span class="t-h4">Any time before</span><span class="t-small soft">Sit in the rest of the collection. <a class="text-link" href="#/atelier">Visit the atelier</a></span></span></li>`}
        </ol></div>
        <a class="btn" href="#/shop">Keep browsing</a>
      </div></section>`
    };
  }

  const INFO_ICON = { delivery: 'truck', returns: 'return', care: 'care' };
  const INFO = {
    delivery: ['Delivery', 'Placed by the people who made it.', `<p>Furniture is delivered anywhere in the UAE by our own team, at no charge. We call to agree a day, carry each piece in, unwrap it and place it where you want it. We take the packaging with us.</p><h2 class="t-h3">Timing</h2><ul><li>Made-to-order furniture: 6 to 10 weeks from your order</li><li>Lighting and decor: 3 to 5 working days</li></ul><h2 class="t-h3">Outside the UAE</h2><p>We deliver across the Gulf on request. Write to hello@deco.ae with your address for a quote.</p>`],
    returns: ['Returns', 'Fourteen days to decide.', `<p>Lighting and decor can be returned within 14 days of delivery, unused and in their packaging. We collect them for free.</p><p>Made-to-order furniture is built for you, so it cannot be returned. Order <a class="text-link" href="#/materials">free samples</a> of any finish first, and we will help you choose.</p>`],
    care: ['Care', 'Made to last, with a little help.', `<h2 class="t-h3">Bouclé and wool</h2><p>Brush with a soft brush in one direction. Blot spills straight away with a dry cloth; never rub.</p><h2 class="t-h3">Stone</h2><p>Wipe with a damp cloth and a drop of pH neutral soap. Use coasters for wine and citrus. Reseal once a year; we do it for free in the first year.</p><h2 class="t-h3">Timber</h2><p>Dust with a dry cloth. Re-oil twice a year with the care kit that comes with every piece.</p>`]
  };
  function info(id) {
    const page = INFO[id];
    if (!page) return notFound();
    const side = [['delivery', 'Delivery'], ['returns', 'Returns'], ['care', 'Care']].map(([k, l]) => `<a href="#/info/${k}"${k === id ? ' aria-current="page"' : ''}>${l}</a>`).join('') + '<a href="#/atelier">Visit the atelier</a>';
    return {
      title: `${page[0]} · DECO`,
      html: `<section class="wrap page">${crumbs([['Home', '#/home'], [page[0]]])}<div class="page__grid"><header>${ic(INFO_ICON[id], 'page__ic')}<p class="t-label soft">${page[0]}</p><h1 class="t-h1">${page[1]}</h1><nav class="side" aria-label="Help">${side}</nav></header><div class="page__body t-body">${page[2]}</div></div></section>`
    };
  }

  function notFound() {
    return { title: 'Not found · DECO', html: `<section class="wrap"><div class="empty">${ic('search', 'empty__ic')}<h1 class="t-h1">We could not find that page.</h1><a class="btn" href="#/shop">Shop the collection</a></div></section>` };
  }

  /* ---------- Router ----------
     Links go through go(): a new history entry with its own key, so Back returns to the same scroll position.
     Address bar edits still arrive through popstate or hashchange. */
  let view = null, routedHref = '', key = '';
  const scrolls = new Map();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const newKey = () => Math.random().toString(36).slice(2, 10);
  const isRoute = () => !location.hash || location.hash.startsWith('#/');
  function build() {
    const h = location.hash.startsWith('#/') ? location.hash.slice(2) : '';
    const [path, qs = ''] = h.split('?');
    const [a = '', b = ''] = path.split('/').map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    const q = new URLSearchParams(qs);
    if (!a) return hasWorld() ? world() : home();
    if (a === 'home') return home();
    if (a === 'shop') return shop(b, q);
    if (a === 'product') return product(b);
    if (a === 'saved') return savedPage(q);
    if (a === 'materials') return materials(b);
    if (a === 'atelier') return atelier();
    if (a === 'info' && b === 'atelier') { history.replaceState(history.state, '', '#/atelier'); return atelier(); }
    if (a === 'info') return info(b);
    if (a === 'plan') return plan();
    if (a === 'checkout') return checkout();
    if (a === 'order') return order(b);
    return notFound();
  }
  /* keep: redraw the current page in place (the bag changed under checkout), leaving panels and scroll alone. */
  function route(restore, user, keep) {
    const y = restore ? scrolls.get(key) || 0 : 0;
    if (!keep) { closePanels(true); opener = null; closeMega(); }
    if (view && view.leave) { try { view.leave(); } catch (e) { console.error(e); } }
    view = build();
    routedHref = location.href;
    document.body.classList.toggle('has-world', hasWorld());
    main.innerHTML = `<div class="view">${view.html}</div>`;
    document.title = view.title;
    $$('.hd__link[data-nav]').forEach((l) => { const isOn = l.dataset.nav === view.nav; l.classList.toggle('is-on', isOn); if (isOn) l.setAttribute('aria-current', 'page'); else l.removeAttribute('aria-current'); });
    shopBtn.classList.toggle('is-on', view.nav === 'shop');
    if (view.bind) { try { view.bind(); } catch (e) { console.error(e); } }
    markLoaded(main);
    reveal(main);
    if (!keep) window.scrollTo(0, y);
    watchHero();
    frameHero();
    if (user) main.focus({ preventScroll: true });
  }
  function go(href, replace) {
    if (!String(href).startsWith('#/')) { location.href = href; return; }
    if (key) scrolls.set(key, window.scrollY);
    if (href === location.hash) replace = true; // the same page again: no second history entry
    key = newKey();
    history[replace ? 'replaceState' : 'pushState']({ k: key }, '', href);
    route(false, true);
  }
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    /* The skip link moves focus to the page, not to a route. */
    if (href === '#main') { e.preventDefault(); main.focus(); return; }
    if (!href.startsWith('#/')) return;
    e.preventDefault();
    go(href);
  });
  window.addEventListener('popstate', (e) => {
    if (key) scrolls.set(key, window.scrollY);
    key = e.state && e.state.k ? e.state.k : newKey();
    if (!e.state || !e.state.k) history.replaceState({ k: key }, '', location.href);
    if (location.href === routedHref || !isRoute()) return;
    route(true, true);
  });
  window.addEventListener('hashchange', () => {
    if (location.href === routedHref || !isRoute()) return;
    if (!history.state || !history.state.k) { if (key) scrolls.set(key, window.scrollY); key = newKey(); history.replaceState({ k: key }, '', location.href); }
    route(false, true);
  });
  let scrollTick = 0;
  window.addEventListener('scroll', () => {
    if (scrollTick) return;
    scrollTick = requestAnimationFrame(() => { scrollTick = 0; if (key) scrolls.set(key, window.scrollY); });
  }, { passive: true });

  /* The header blends into the hero photo while the photo is under it, and turns solid once it is scrolled past. */
  let heroIO;
  function watchHero() {
    if (heroIO) heroIO.disconnect();
    const photo = $('.hero__img', main);
    hd.classList.toggle('is-over', !!photo);
    if (!photo || !('IntersectionObserver' in window)) return;
    heroIO = new IntersectionObserver(([e]) => hd.classList.toggle('is-over', e.isIntersecting), { rootMargin: `-${hd.offsetHeight}px 0px 0px 0px` });
    heroIO.observe(photo);
  }
  window.matchMedia('(max-width: 760px)').addEventListener('change', watchHero);

  /* Hero framing. data-subject on the photo gives the furniture's left, right and bottom edge in image pixels.
     Where the copy sits over the photo, the furniture starts just right of the longest line of copy;
     where the photo sits above the copy, the furniture is centred. The crop never leaves a gap. */
  function frameHero() {
    const photo = $('.hero__img', main), copy = $('.hero__copy', main);
    if (!photo || !copy || !photo.dataset.subject) return;
    const iw = +photo.getAttribute('width'), ih = +photo.getAttribute('height');
    const [a, b, base = ih] = photo.dataset.subject.split(' ').map(Number);
    const W = photo.offsetWidth, H = photo.offsetHeight, left = photo.parentNode.getBoundingClientRect().left; // layout size: ignores the reveal scale
    if (!W || !H) return;
    const k = Math.max(W / iw, H / ih);
    let x;
    if (getComputedStyle(photo).position === 'absolute') {
      const range = document.createRange();
      const edge = (el) => { range.selectNodeContents(el); return range.getBoundingClientRect().right; };
      const ends = [...copy.children].flatMap((el) => (el.children.length && !el.matches('h1, p') ? [...el.children] : [el])).map((el) => (el.matches('h1, p') ? edge(el) : el.getBoundingClientRect().right));
      x = Math.max(...ends) - left + 48 - a * k;
    } else {
      x = W / 2 - ((a + b) / 2) * k;
    }
    let zoom = 1;
    if (x > 0) {
      /* The photo already fills the width and cannot slide right: zoom it from its left edge, anchored at the
         furniture's base so nothing is cut below, until the furniture clears the copy and still fits. */
      zoom = Math.min((x + a * k) / (a * k), (W - 48) / (b * k));
      x = 0;
    }
    x = Math.min(0, Math.max(W - iw * k, x));
    photo.style.objectPosition = `${Math.round(x)}px 50%`;
    photo.style.transformOrigin = zoom > 1 ? `0 ${Math.round((H - ih * k) / 2 + base * k)}px` : '';
    photo.style.scale = zoom > 1 ? zoom.toFixed(3) : '';
  }
  if ('ResizeObserver' in window) new ResizeObserver(() => frameHero()).observe(main);
  if (document.fonts) document.fonts.ready.then(frameHero);

  /* ---------- Header and footer ---------- */
  const onScroll = () => hd.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  $('#letterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#letterEmail').value.trim(), ok = okEmail(v);
    $('#letterMsg').textContent = ok ? 'Thank you. The next letter leaves the workshop soon.' : 'That email looks unfinished.';
    if (ok) fx.line($('#letterForm'));
  });

  /* ---------- What the 3D store and the planner can use ---------- */
  const worldApi = {
    PRODUCTS, CATEGORIES, FINISHES, bySlug, price, money, esc, ic, asset, store,
    addToBag: (slug, finish, qty, opts) => addToBag(slug, finish, qty, opts),
    bagCount: () => bag.count(),
    /* The bill at the 3D counter reads and edits the same bag. */
    bagItems: () => bag.items.map((i) => ({ slug: i.slug, finish: i.finish, qty: i.qty })),
    bagTotal: () => bag.total(),
    setQty: (i, qty) => bag.set(i, qty),
    removeLine: (i) => takeOut(i),
    undoRemove: () => putBack(),
    onBag: (fn) => on('bag', fn),
    openBag,
    isSaved: (slug) => saved.has(slug),
    toggleSave: (slug) => toggleSave(slug),
    onSaved: (fn) => on('saved', fn),
    toast, go, find, openSearch, openMenu
  };
  const planApi = Object.assign({}, worldApi, { fx, addMany, len, plural });

  if (!history.state || !history.state.k) history.replaceState({ k: newKey() }, '', location.href);
  key = history.state.k;
  renderBag();
  updateCount(false);
  updateSaved(false);
  route();
})();
