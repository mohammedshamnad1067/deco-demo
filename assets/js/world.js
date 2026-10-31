/* =========================================================
   DECO · The 3D atelier (the home page)
   A small building you walk into, where everything that glows can
   be touched: DECO's pavilion of arches, with the whole collection
   inside at its true size. This file is the entry and the interface:
   loader, welcome, top bar, rooms, product panel, guide, sound and
   day/night. The 3D itself lives in world-scene.js and
   world-models.js and loads only here, with three.js from the CDN.

   window.DECO_WORLD = { supported(), mount(el, api) → { unmount } }
   `api` comes from shop.js (catalogue, price(), the bag, saved list,
   toast, go(), find()).
   ========================================================= */
(function () {
  'use strict';

  /* three.js and its post effects as ES modules from jsDelivr; every effect imports this same core URL, so they share one three. */
  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
  const THREE_URL = CDN + '+esm';
  const POST = ['EffectComposer', 'RenderPass', 'GTAOPass', 'UnrealBloomPass', 'OutputPass', 'ShaderPass'];
  const me = document.currentScript, SRC = (me && me.src) || '';
  const BASE = SRC ? SRC.replace(/[^/?#]*([?#].*)?$/, '') : 'assets/js/';
  const VER = (SRC.match(/\?v=[^&#]+/) || [''])[0];

  function supported() {
    /* Opened straight from disk, browsers refuse local photos as WebGL textures; the single-file build carries its own. */
    if (location.protocol === 'file:' && !window.__R) return false;
    try {
      const c = document.createElement('canvas'), gl = window.WebGL2RenderingContext && c.getContext('webgl2');
      if (!gl) return false;
      const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }

  /* ---------- Loading (once per visit) ---------- */
  let threeP = null, partsP = null, postP = null;
  const loadThree = () => threeP || (threeP = window.__DECO_THREE ? Promise.resolve(window.__DECO_THREE()) : import(THREE_URL));
  /* Post effects are a bonus: if they fail or take too long, the atelier opens without them. */
  const loadPost = () => postP || (postP = Promise.race([
    (window.__DECO_POST ? window.__DECO_POST() : Promise.all(POST.map((n) => import(`${CDN}examples/jsm/postprocessing/${n}.js/+esm`)))).then((mods) => Object.assign({}, ...mods)),
    new Promise((ok) => setTimeout(() => ok(null), 15000))
  ]).catch((e) => { console.warn('DECO: post effects unavailable', e); return null; }));
  /* A dropped request is tried once more before the atelier gives up. */
  const loadScript = (url, again = true) => new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = url; s.onload = ok;
    s.onerror = () => { s.remove(); if (again) setTimeout(() => loadScript(url, false).then(ok, no), 600); else no(new Error('Could not load ' + url)); };
    document.head.appendChild(s);
  });
  const loadParts = () => partsP || (partsP = Promise.all([
    window.DECO_MODELS ? 1 : loadScript(BASE + 'world-models.js' + VER),
    window.DECO_SCENE ? 1 : loadScript(BASE + 'world-scene.js' + VER)
  ]));
  function ensureAssets() {
    if (!document.getElementById('world-css')) {
      const l = document.createElement('link'); l.id = 'world-css'; l.rel = 'stylesheet'; l.href = BASE.replace(/js\/$/, 'css/') + 'world.css' + VER;
      document.head.appendChild(l);
    }
  }
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

  const LINES = ['Sanding the oak', 'Weaving the bouclé', 'Honing the travertine', 'Plumping the cushions', 'Oiling the walnut', 'Hanging the pendants', 'Warming the lamps'];
  const ROOMS = ['seating', 'tables', 'storage', 'bedroom', 'lighting', 'decor'];
  const MARK = '<path class="w-mk w-mk--chair" pathLength="1" d="M96 22H144Q174 22 177.9 51.7L188.1 128.3Q192 158 162 158H78Q48 158 51.9 128.3L62.1 51.7Q66 22 96 22Z"/><path class="w-mk w-mk--base" pathLength="1" d="M10 204A110 30 0 1 0 230 204A110 30 0 1 0 10 204Z"/>';

  const dubai = (o) => new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: 'Asia/Dubai' }, o)).format(new Date());
  const dubaiHour = () => +dubai({ hour: 'numeric', hourCycle: 'h23' });
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- Sound: synthesised, so nothing to download ---------- */
  function makeSound() {
    let ctx = null, master = null, wind = null, on = false, night = false, timer = 0;
    function init() {
      if (ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      /* Warm wind: brown noise through a breathing low-pass. */
      const n = ctx.sampleRate * 4, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      let b = 0; for (let i = 0; i < n; i++) { b = (b + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.2; }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = .4;
      const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = .06; lfoG.gain.value = 240; lfo.connect(lfoG).connect(lp.frequency); lfo.start();
      wind = ctx.createGain(); wind.gain.value = .55;
      src.connect(lp).connect(wind).connect(master); src.start();
      /* A quiet open chord underneath, breathing slowly. */
      const pad = ctx.createGain(); pad.gain.value = .016; pad.connect(master);
      [110, 164.81, 246.94, 329.63].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
        o.frequency.value = f; o.detune.value = (i - 1.5) * 3; g.gain.value = .22;
        l.frequency.value = .045 + i * .017; lg.gain.value = .18; l.connect(lg).connect(g.gain); l.start();
        o.connect(g).connect(pad); o.start();
      });
    }
    function env(node, t, peak, att, dec) { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + att); node.gain.exponentialRampToValueAtTime(.0001, t + att + dec); }
    function tone(f, t, peak, dec, type = 'sine', to) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dec);
      env(g, t, peak, .006, dec); o.connect(g).connect(master); o.start(t); o.stop(t + dec + .05);
    }
    function hiss(t, dur, from, to, peak) {
      const n = ctx.sampleRate * dur, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = buf; f.type = 'bandpass'; f.Q.value = .8; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * .4); g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(f).connect(g).connect(master); s.start(t);
    }
    function chirps() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (ctx && on && night) { const t = ctx.currentTime, f = 4300 + Math.random() * 400; for (let k = 0; k < 3; k++) tone(f, t + k * .075, .01, .045); }
        chirps();
      }, 1100 + Math.random() * 2600);
    }
    return {
      get on() { return on; },
      set(v) {
        on = v;
        if (!v && !ctx) return; // never start audio just to keep it silent
        init(); if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(on ? .85 : 0, ctx.currentTime, .5);
        if (on) chirps();
      },
      night(v) { night = v; if (ctx) wind.gain.setTargetAtTime(v ? .3 : .55, ctx.currentTime, 1.2); },
      play(kind) {
        if (!ctx || !on) return;
        const t = ctx.currentTime;
        if (kind === 'tap') tone(640, t, .05, .12, 'triangle', 430);
        else if (kind === 'open') { tone(523.25, t, .035, .5); tone(783.99, t + .07, .03, .6); }
        else if (kind === 'add') { tone(659.25, t, .045, .4); tone(987.77, t + .09, .04, .7); }
        else if (kind === 'whoosh') hiss(t, 1.4, 260, 1600, .05);
        else if (kind === 'door') { tone(110, t, .08, .5, 'sine', 70); hiss(t + .05, 1.1, 400, 900, .025); }
      },
      close() { clearTimeout(timer); if (ctx) ctx.close(); ctx = null; }
    };
  }

  /* ---------- Mount ---------- */
  function mount(el, api) {
    ensureAssets();
    const { PRODUCTS, CATEGORIES, FINISHES, bySlug, price, money, esc, ic, asset } = api;
    const fx = window.DECO_FX || { beam() {}, fly: () => Promise.resolve() };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = () => matchMedia('(max-width: 760px), (max-width: 1024px) and (orientation: portrait)').matches;
    const catOf = (id) => CATEGORIES.find((c) => c.id === id);
    const two = (n) => String(n).padStart(2, '0');
    const plural = (n, w) => `${n} ${n === 1 ? w : w + 's'}`;
    const day = (n) => new Date(Date.now() + n * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    /* Swatch photos sit in a custom property; Chrome resolves its url() against the stylesheet that reads it,
       so the path must be absolute. */
    const abs = (p) => { const u = asset(p); try { return new URL(u, document.baseURI).href; } catch (e) { return u; } };
    const workdays = (n) => { const d = new Date(); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; } return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); };
    const arrival = (p) => (p.lead === 'made' ? `Made for you in 6 to 10 weeks: with you between ${day(42)} and ${day(70)}.` : `In stock: with you between ${workdays(3)} and ${workdays(5)}.`);

    /* #/?piece=<slug> walks straight to that piece once inside; the panel keeps the address in step. */
    const deep = (() => { const s = new URLSearchParams(location.hash.split('?')[1] || '').get('piece'); return bySlug[s] ? s : null; })();
    const pieceUrl = (slug) => `#/${slug ? `?piece=${slug}` : ''}`;
    const markUrl = (slug) => { try { if (location.hash.replace(/^#\/?/, '').split('?')[0] === '') history.replaceState(history.state, '', pieceUrl(slug)); } catch (e) { /* sandboxed */ } };
    let night = (() => { try { const v = sessionStorage.getItem('deco-night'); if (v) return v === '1'; } catch (e) { /* no storage */ } const h = dubaiHour(); return h >= 18 || h < 6; })();
    let wantSound = (() => { try { return sessionStorage.getItem('deco-sound') !== '0'; } catch (e) { return true; } })();

    const root = document.createElement('div');
    root.className = 'w';
    root.dataset.night = night ? '1' : '0';
    root.innerHTML = `
      <canvas class="w-gl" aria-hidden="true"></canvas>
      <div class="w-load" role="status" aria-live="polite">
        <div class="w-load__in">
          <svg class="w-load__mark" viewBox="0 0 240 250" aria-hidden="true">${MARK}</svg>
          <p class="w-load__line"><span class="t-label" data-load-msg>${LINES[0]}</span><span class="w-load__dot" aria-hidden="true"></span><span class="t-h4" data-load-pct>0%</span></p>
        </div>
        <div class="w-load__foot"><p class="t-label">Best with sound on</p><p class="t-cap">Rather shop right away? <a class="text-link" href="#/home">Go to the 2D shop</a></p></div>
      </div>
      <div class="w-hello" aria-hidden="true">
        <div class="w-hello__top">
          <p class="t-label">Welcome to</p>
          <h1 class="t-display">The DECO atelier</h1>
          <p class="t-lead">Forty-five soft pieces in one warm room. Step inside, look around, take one home.</p>
        </div>
        <div class="w-hello__cta">
          <div class="w-hello__row"><button class="btn btn--solid w-btn-in" type="button" data-enter="1">Step inside</button><a class="btn w-btn-glass" href="#/home">${ic('all')}Shop in 2D</a></div>
          <button class="text-link t-cap" type="button" data-enter="0">Step inside without sound</button>
        </div>
      </div>
      <div class="w-hud" hidden>
        <div class="w-top">
          <div class="w-pill">
            <button class="w-tb" type="button" data-menu aria-expanded="false" aria-controls="wMenu">${ic('menu')}<span>Menu</span></button>
            <a class="w-tb w-tb--alt" href="#/home">${ic('all')}<span>Shop in 2D</span></a>
          </div>
          <button class="w-pill w-tb w-bag" type="button" data-bag aria-controls="wBill" aria-expanded="false" aria-label="Your bill">${ic('bag')}<span class="w-bag__t">Bill</span><span class="count" data-bag-count>0</span><span class="w-bag__sum t-price" data-bag-sum hidden></span></button>
          <div class="w-pill">
            <button class="w-tb" type="button" data-night aria-pressed="false" title="Day or night">${ic('sun', 'w-ic-day')}${ic('moon', 'w-ic-night')}<span data-clock>00:00</span></button>
            <button class="w-tb w-tb--ic" type="button" data-sound aria-pressed="false" aria-label="Sound">${ic('sound', 'w-ic-on')}${ic('mute', 'w-ic-off')}</button>
          </div>
        </div>
        <p class="w-tip">${ic('new')}<span>Tap anything that glows</span></p>
        <nav class="w-rooms" aria-label="Rooms">${ROOMS.map((id) => `<button class="w-room" type="button" data-room="${id}">${ic(id)}<span>${esc(catOf(id).name)}</span></button>`).join('')}</nav>
        <button class="w-ask" type="button" data-ask aria-expanded="false" aria-controls="wGuide"><span class="w-av" aria-hidden="true"><svg viewBox="0 0 224 238"><use href="#logo-icon"/></svg></span><span class="w-ask__t"><span class="t-h4">Ask Noor</span><span class="t-cap">Your atelier guide</span></span></button>
      </div>
      <aside class="w-panel" id="wPanel" role="dialog" aria-labelledby="wpName" hidden>
        <header class="wp-head">
          <button class="wp-ic" type="button" data-step="-1" aria-label="Previous piece">${ic('next', 'wp-prev')}</button>
          <p class="t-cap wp-count"><b data-p-idx>01</b> / <span data-p-of>01</span> · <span data-p-cat></span></p>
          <button class="wp-ic" type="button" data-step="1" aria-label="Next piece">${ic('next')}</button>
          <span class="wp-sp"></span>
          <button class="wp-ic" type="button" data-p-share aria-label="Copy a link to this piece" title="Copy a link">${ic('link')}</button>
          <button class="wp-ic wp-save" type="button" data-p-save aria-pressed="false" aria-label="Save">${ic('heart')}</button>
          <button class="wp-ic" type="button" data-p-close aria-label="Close">${ic('close')}</button>
        </header>
        <div class="wp-scroll">
          <div class="wp-view">
            <div class="wp-tabs" role="tablist" aria-label="View"><button type="button" role="tab" aria-selected="true" data-v="3d">${ic('cube')}3D</button><button type="button" role="tab" aria-selected="false" data-v="photo">${ic('eye')}Photo</button></div>
            <canvas class="wp-gl" aria-label="The piece in 3D. Drag to turn it."></canvas>
            <img class="wp-photo" alt="" hidden>
            <p class="wp-hint t-cap">${ic('rotate')}Drag to turn</p>
          </div>
          <div class="wp-body">
            <p class="t-label wp-kick" data-p-kick></p>
            <h2 class="t-h2" id="wpName" data-p-name></h2>
            <p class="wp-price" data-p-price></p>
            <p class="t-small wp-copy" data-p-copy></p>
            <div class="wp-fin" data-p-fin></div>
            <p class="t-cap wp-spec" data-p-spec></p>
            <a class="link" data-p-more href="#/shop">Full details</a>
          </div>
        </div>
        <footer class="wp-foot">
          <div class="wp-buy">
            <div class="qty" role="group" aria-label="Quantity"><button type="button" data-q="-1" aria-label="One fewer">${ic('minus')}</button><output data-p-qty>1</output><button type="button" data-q="1" aria-label="One more">${ic('plus')}</button></div>
            <button class="btn btn--solid" type="button" data-p-add>Add to bag<span class="add__price" data-p-addprice></span></button>
          </div>
        </footer>
      </aside>
      <aside class="w-panel w-bill" id="wBill" role="dialog" aria-labelledby="wbTitle" hidden>
        <header class="wp-head">
          <p class="t-cap wp-count">${ic('bag')}<span data-b-count>Nothing yet</span></p>
          <span class="wp-sp"></span>
          <button class="wp-ic" type="button" data-b-close aria-label="Close the bill">${ic('close')}</button>
        </header>
        <div class="wp-scroll">
          <div class="wb-slip">
            <div class="wb-top">
              <span class="w-av" aria-hidden="true"><svg viewBox="0 0 224 238"><use href="#logo-icon"/></svg></span>
              <span><span class="t-label">DECO atelier</span><span class="t-cap" data-b-when></span></span>
            </div>
            <h2 class="t-h2" id="wbTitle">Your bill</h2>
            <ul class="wb-lines" data-b-lines></ul>
            <div class="wb-sum" data-b-sum></div>
          </div>
        </div>
        <footer class="wp-foot wb-foot">
          <button class="btn btn--solid wb-pay" type="button" data-b-pay>Pay<span class="add__price" data-b-paysum></span></button>
          <p class="t-cap wb-safe">Delivery details and payment come next, on one page.</p>
        </footer>
      </aside>
      <aside class="w-menu" id="wMenu" aria-label="Menu" hidden>
        <div class="w-menu__in">
          <button class="wp-ic w-menu__x" type="button" data-menu-close aria-label="Close">${ic('close')}</button>
          <p class="t-label">The atelier</p>
          <nav class="w-menu__rooms">${ROOMS.map((id) => `<button type="button" data-room="${id}">${ic(id)}<span>${esc(catOf(id).name)}</span><span class="t-cap">${PRODUCTS.filter((p) => p.category === id).length}</span></button>`).join('')}</nav>
          <p class="t-label">The shop</p>
          <nav class="w-menu__big">
            <a href="#/home">Shop in 2D</a><a href="#/shop">All ${PRODUCTS.length} pieces</a><a href="#/materials">Materials and samples</a><a href="#/plan">Room planner</a><a href="#/atelier">Visit the atelier</a><a href="#/saved">Saved</a>
          </nav>
          <nav class="w-menu__small t-small"><a href="#/info/delivery">Delivery</a><a href="#/info/returns">Returns</a><a href="#/info/care">Care</a></nav>
        </div>
      </aside>
      <section class="w-guide" id="wGuide" role="dialog" aria-label="Ask Noor" hidden>
        <header class="wg-head"><span class="w-av" aria-hidden="true"><svg viewBox="0 0 224 238"><use href="#logo-icon"/></svg></span><span><span class="t-h4">Noor</span><span class="t-cap">Atelier guide · answers from this room</span></span><button class="wp-ic" type="button" data-guide-close aria-label="Close">${ic('close')}</button></header>
        <div class="wg-log" data-log aria-live="polite"></div>
        <form class="wg-form" data-guide-form><label class="sr-only" for="wgIn">Ask Noor</label><input id="wgIn" type="text" autocomplete="off" placeholder="Ask about a piece, a finish or delivery"><button class="wp-ic" type="submit" aria-label="Send">${ic('arrow')}</button></form>
      </section>
      <div class="w-label" aria-hidden="true"><span class="t-h4" data-l-name></span><span class="t-price" data-l-price></span></div>`;
    el.appendChild(root);

    const $ = (s) => root.querySelector(s);
    const $$ = (s) => Array.from(root.querySelectorAll(s));
    const canvas = $('.w-gl'), panel = $('.w-panel'), hud = $('.w-hud'), label = $('.w-label'), menu = $('.w-menu'), guide = $('.w-guide');
    const sound = makeSound();
    let THREE = null, kit = null, scene = null, viewer = null, dead = false, state = 'loading', opened = null;
    const timers = [];
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

    /* ---------- Loader ---------- */
    let target = 2, shown = 0, li = 0, raf = 0;
    const pctEl = $('[data-load-pct]'), msgEl = $('[data-load-msg]'), markEl = $('.w-load__mark');
    function loaderFrame() {
      shown = Math.min(target, shown + Math.max(.35, (target - shown) * .08));
      pctEl.textContent = `${Math.round(shown)}%`;
      markEl.style.setProperty('--p', (shown / 100).toFixed(3));
      if (state === 'loading' || shown < 100) raf = requestAnimationFrame(loaderFrame);
    }
    raf = requestAnimationFrame(loaderFrame);
    const msgTimer = setInterval(() => { li = (li + 1) % LINES.length; msgEl.textContent = target >= 100 ? 'Opening the doors' : LINES[li]; }, 1100);

    (async () => {
      try {
        const [mod, , post] = await Promise.all([loadThree(), loadParts(), small() ? null : loadPost()]);
        if (dead) return;
        THREE = mod; target = 22;
        if (document.fonts) await Promise.race([Promise.all(['300 112px Comfortaa', '400 30px Comfortaa', '700 30px Quicksand', '500 40px Quicksand'].map((f) => document.fonts.load(f))), wait(2500)]);
        const manager = new THREE.LoadingManager();
        const loaded = new Promise((ok) => { manager.onLoad = ok; });
        manager.onProgress = (url, n, total) => { target = Math.max(target, 22 + 70 * (n / total)); };
        const loader = new THREE.ImageLoader(manager), cache = new Map();
        /* The travertine scan is vein-cut, with strong bands; softened a little it reads as stone, not oak. */
        const SOFTEN = { travertine: 'contrast(.7) saturate(.75) brightness(1.05)' };
        const soften = (im, f) => { try { const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height; const x = c.getContext('2d'); x.filter = f; x.drawImage(im, 0, 0); return c; } catch (e) { return im; } };
        /* Scans load into textures that exist straight away; a dropped request is tried twice more. */
        const texture = (name, product) => {
          if (cache.has(name)) return cache.get(name);
          const t = new THREE.Texture(), url = asset(product ? `assets/products/${name}.jpg` : `assets/materials/${name}.jpg`);
          t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
          if (product) { t.repeat.set(.62, .856); t.offset.set(.19, .069); } else t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; // scans are not tileable; mirroring hides the seams
          const get = (n) => loader.load(url, (im) => { t.image = !product && SOFTEN[name] ? soften(im, SOFTEN[name]) : im; t.needsUpdate = true; }, undefined, () => { if (n < 2 && !dead) later(() => get(n + 1), 500 * (n + 1)); });
          get(0);
          cache.set(name, t); return t;
        };
        const tones = {}; for (const [k, f] of Object.entries(FINISHES)) tones[k] = f.tone;
        const quality = small() ? 'mid' : 'high';
        kit = window.DECO_MODELS.create(THREE, { texture, tones, quality });
        scene = window.DECO_SCENE.create(THREE, { canvas, kit, catalog: { bySlug, FINISHES }, mobile: small(), reduce, post, lock: /[?&]hq\b/.test(location.search), onPick: openPanel, onHover: hover, onZone: zone, onNoor: () => (guide.classList.contains('is-on') ? closeGuide() : openGuide()) });
        scene.setNight(night, true);
        syncBill();
        await Promise.race([loaded, wait(20000)]);
        if (dead) return;
        /* With the scans in, the room's own light is captured for reflections. */
        try { scene.bake(); } catch (e) { console.warn('DECO: room light not captured', e); }
        target = 100;
        scene.start();
        await wait(reduce ? 200 : 900);
        if (dead) return;
        state = 'hello';
        root.classList.add('is-ready');
        later(() => clearInterval(msgTimer), 1200);
        $('.w-hello').removeAttribute('aria-hidden');
        scene.intro();
      } catch (err) {
        if (dead) return;
        console.error(err);
        state = 'failed';
        cancelAnimationFrame(raf); clearInterval(msgTimer);
        $('.w-load__in').innerHTML = `<svg class="w-load__mark" viewBox="0 0 240 250" aria-hidden="true" style="--p:1">${MARK}</svg><p class="t-h3">The 3D atelier did not open on this device.</p><p class="t-body">Everything is in the 2D shop too.</p><p class="w-hello__row"><a class="btn btn--solid" href="#/home">Shop in 2D</a></p>`;
      }
    })();

    /* ---------- Enter ---------- */
    async function enter(withSound) {
      if (state !== 'hello') return;
      state = 'entering';
      wantSound = withSound;
      try { sessionStorage.setItem('deco-sound', withSound ? '1' : '0'); } catch (e) { /* no storage */ }
      sound.set(withSound); sound.night(night); syncSound();
      sound.play('door'); later(() => sound.play('whoosh'), 300);
      root.classList.add('is-in');
      $('.w-hello').setAttribute('aria-hidden', 'true');
      await scene.enter();
      if (dead) return;
      state = 'inside';
      hud.hidden = false;
      if (deep) later(() => openPanel(deep, 0), reduce ? 0 : 350);
      requestAnimationFrame(() => root.classList.add('has-hud'));
      /* The hint teaches twice, then gets out of the way. */
      later(() => { const t = $('.w-tip span'); if (t && !root.classList.contains('tip-gone')) t.textContent = 'Drag to look around. Tap the floor to walk.'; }, 4800);
      later(() => root.classList.add('tip-gone'), 10500);
      const first = $('.w-room'); if (first && document.activeElement && document.activeElement.closest('.w-hello')) first.focus({ preventScroll: true });
    }
    $$('[data-enter]').forEach((b) => b.addEventListener('click', () => enter(b.dataset.enter === '1')));

    /* ---------- Top bar ---------- */
    const clock = () => { const c = $('[data-clock]'); if (c) c.textContent = `${dubai({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} Dubai`; };
    clock();
    const clockTimer = setInterval(clock, 20000);
    function syncNight() {
      root.dataset.night = night ? '1' : '0';
      const b = $('[data-night]'); b.setAttribute('aria-pressed', String(night)); b.setAttribute('aria-label', night ? 'Night. Switch to day' : 'Day. Switch to night');
    }
    function setNightMode(v) {
      night = v; syncNight();
      try { sessionStorage.setItem('deco-night', v ? '1' : '0'); } catch (e) { /* no storage */ }
      if (scene) scene.setNight(v);
      sound.night(v); sound.play('tap');
    }
    syncNight();
    $('[data-night]').addEventListener('click', () => setNightMode(!night));
    function syncSound() { const b = $('[data-sound]'); b.setAttribute('aria-pressed', String(sound.on)); b.setAttribute('aria-label', sound.on ? 'Sound on. Turn it off' : 'Sound off. Turn it on'); }
    $('[data-sound]').addEventListener('click', () => { sound.set(!sound.on); syncSound(); try { sessionStorage.setItem('deco-sound', sound.on ? '1' : '0'); } catch (e) { /* no storage */ } sound.play('tap'); });
    /* ---------- The bill: the bag read as a receipt, paid at the counter ---------- */
    const bagCount = $('[data-bag-count]'), bagSum = $('[data-bag-sum]'), billEl = $('.w-bill');
    let billOpen = false;
    const items = () => (api.bagItems ? api.bagItems() : []);
    const total = () => (api.bagTotal ? api.bagTotal() : 0);
    function syncBill() {
      const n = api.bagCount(), t = total();
      bagCount.textContent = n;
      bagSum.hidden = !n; bagSum.innerHTML = n ? price(t) : '';
      $('[data-bag]').setAttribute('aria-label', n ? `Your bill: ${plural(n, 'piece')}, ${money(t)}` : 'Your bill, empty');
      if (scene) scene.setBill({ count: n, total: t, lines: items().length });
      if (billOpen) renderBill();
    }
    function renderBill() {
      const list = items(), n = api.bagCount(), t = total();
      const f = document.activeElement, keep = f && billEl.contains(f) && f.dataset && f.dataset.bq ? `[data-bq="${f.dataset.bq}"][data-i="${f.dataset.i}"]` : null;
      $('[data-b-count]').textContent = n ? plural(n, 'piece') : 'Nothing yet';
      $('[data-b-when]').textContent = `Alserkal Avenue, Dubai · ${dubai({ weekday: 'short', day: 'numeric', month: 'short' })}, ${dubai({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`;
      $('[data-b-lines]').innerHTML = list.length ? list.map((it, i) => {
        const p = bySlug[it.slug], fin = it.finish && FINISHES[it.finish];
        return `<li class="wb-line">
          <img src="${asset(p.thumb)}" alt="" width="64" height="64">
          <div class="wb-line__t">
            <button type="button" class="wb-name t-h4" data-b-open="${p.slug}">${esc(p.name)}</button>
            <p class="t-cap">${fin ? `${esc(fin.name)} · ` : ''}${p.lead === 'made' ? 'Made to order' : 'In stock'}</p>
            <div class="qty qty--sm" role="group" aria-label="How many ${esc(p.name)}"><button type="button" data-bq="-1" data-i="${i}" aria-label="One fewer">${ic('minus')}</button><output>${it.qty}</output><button type="button" data-bq="1" data-i="${i}" aria-label="One more"${it.qty >= 10 ? ' disabled' : ''}>${ic('plus')}</button></div>
          </div>
          <div class="wb-line__p"><span class="t-price">${price(p.price * it.qty)}</span><button class="wb-x" type="button" data-bx="${i}" aria-label="Take ${esc(p.name)} off the bill">${ic('close')}</button></div>
        </li>`;
      }).join('') : `<li class="wb-empty"><p class="t-body">Nothing on your bill yet.</p><p class="t-small">Tap anything that glows, choose a finish, then Add to bag. It appears here, and on the counter's screen.</p>
          <div class="wg-chips">${PRODUCTS.filter((p) => p.tag === 'Bestseller').slice(0, 3).map((p) => `<button class="chip" type="button" data-b-open="${p.slug}">${ic(p.category)}${esc(p.name)}</button>`).join('')}</div></li>`;
      $('[data-b-sum]').innerHTML = list.length ? `<div><span>Subtotal</span><span class="t-price">${price(t)}</span></div>
        <div><span>Delivery in the UAE</span><span>Complimentary</span></div>
        <div class="wb-total"><span class="t-h4">Total</span><span class="t-price">${price(t)}</span></div>
        <p class="t-cap">Prices include VAT.</p>` : '';
      const pay = $('[data-b-pay]');
      pay.disabled = !list.length; $('[data-b-paysum]').innerHTML = list.length ? price(t) : '';
      pay.setAttribute('aria-label', list.length ? `Pay ${money(t)}` : 'Pay');
      if (keep) { const b = billEl.querySelector(keep); if (b && !b.disabled) b.focus({ preventScroll: true }); }
    }
    function openBill() {
      if (!scene || state !== 'inside') return;
      if (opened) closePanel(true);
      closeGuide(); closeMenu();
      billOpen = true; renderBill();
      billEl.hidden = false;
      const t = document.getElementById('toast'); if (t) t.classList.remove('is-on', 'is-split'); // the bill says it all
      requestAnimationFrame(() => { billEl.classList.add('is-on'); root.classList.add('has-panel', 'has-bill'); offset(); });
      $('[data-bag]').setAttribute('aria-expanded', 'true');
      scene.view('counter');
      sound.play('open');
      root.classList.add('tip-gone'); label.classList.remove('is-on');
      later(() => { const c = $('[data-b-close]'); if (c && billOpen && !small()) c.focus({ preventScroll: true }); }, 60);
    }
    function closeBill() {
      if (!billOpen) return;
      billOpen = false;
      billEl.classList.remove('is-on'); root.classList.remove('has-bill');
      if (!opened) { root.classList.remove('has-panel'); if (scene) scene.setOffset(0, 0); }
      $('[data-bag]').setAttribute('aria-expanded', 'false');
      later(() => { if (!billOpen) billEl.hidden = true; }, 650);
    }
    const offBag = api.onBag ? api.onBag(() => syncBill()) : null;
    syncBill();
    $('[data-bag]').addEventListener('click', () => (billOpen ? closeBill() : openBill()));
    $('[data-b-close]').addEventListener('click', () => { closeBill(); $('[data-bag]').focus(); });
    billEl.addEventListener('click', (e) => {
      const q = e.target.closest('[data-bq]'), x = e.target.closest('[data-bx]'), op = e.target.closest('[data-b-open]');
      const takeOff = (i) => { const it = items()[i]; if (!it) return; const name = bySlug[it.slug].name; api.removeLine(i); api.toast(`${name} is off your bill`, api.undoRemove ? { label: 'Undo', run: api.undoRemove } : false); };
      if (q) { const i = +q.dataset.i, it = items()[i]; if (!it) return; sound.play('tap'); if (it.qty + +q.dataset.bq < 1) takeOff(i); else api.setQty(i, it.qty + +q.dataset.bq); }
      else if (x) { sound.play('tap'); takeOff(+x.dataset.bx); }
      else if (op) { closeBill(); openPanel(op.dataset.bOpen, 0); }
    });
    $('[data-b-pay]').addEventListener('click', (e) => {
      if (!items().length) return;
      fx.beam(e.currentTarget); sound.play('add');
      later(() => api.go('#/checkout'), reduce ? 0 : 420);
    });

    /* ---------- Hover label ---------- */
    function hover(h) {
      if (!h || state !== 'inside') { label.classList.remove('is-on'); return; }
      if (h.slug) { const p = bySlug[h.slug]; $('[data-l-name]').textContent = p.name; $('[data-l-price]').innerHTML = price(p.price); }
      else if (h.noor) { $('[data-l-name]').textContent = 'Noor'; $('[data-l-price]').textContent = 'Ask me anything'; }
      else {
        const s = { living: 'Living', bedroom: 'Bedroom', dining: 'Dining', storage: 'Storage', reading: 'Reading corner', objects: 'Objects', finishes: 'Finishes', lighting: 'Lighting', materials: 'Materials', counter: 'Bill counter' }[h.sign] || '';
        $('[data-l-name]').textContent = s;
        const lp = $('[data-l-price]');
        if (h.sign === 'counter') { if (api.bagCount()) lp.innerHTML = `Pay ${price(total())}`; else lp.textContent = 'Your bill, empty'; }
        else lp.textContent = h.act === 'samples' ? 'Free samples' : 'Walk over';
      }
      const r = root.getBoundingClientRect(), x = h.x - r.left, y = h.y - r.top, flip = x > r.width - 240;
      label.style.transform = `translate(${flip ? x - 14 : x + 16}px, ${y + 16}px) translateX(${flip ? '-100%' : '0'})`;
      label.classList.add('is-on');
    }

    /* ---------- Product panel ---------- */
    let qty = 1, view = '3d';
    /* Each copy in the room keeps its own finish; the panel shows the one that was tapped. */
    const finishOf = (p) => (scene && scene.finishOf(p.slug, opened && opened.slug === p.slug ? opened.which : 0)) || p.finishes[0] || null;
    function offset() {
      if (!scene) return;
      const el = billOpen ? billEl : opened ? panel : null;
      if (!el) { scene.setOffset(0, 0); return; }
      if (small()) scene.setOffset(0, Math.round(el.offsetHeight / 2 - 24));
      else scene.setOffset(Math.round((el.offsetWidth + 16) / 2), 0);
    }
    function fillFinish(p) {
      const k = finishOf(p), box = $('[data-p-fin]');
      if (!p.finishes.length) { box.innerHTML = ''; return; }
      box.innerHTML = `<div class="opt__head"><span class="t-label">Finish</span><span class="t-small">${esc(FINISHES[k].name)}</span></div>
        ${p.finishes.length > 1 ? `<div class="swatches" role="radiogroup" aria-label="Finish">${p.finishes.map((f) => `<button class="swatch" type="button" role="radio" aria-checked="${f === k}" aria-label="${esc(FINISHES[f].name)}" data-fin="${f}" style="--sw:${FINISHES[f].tone};--swi:url('${abs(`assets/materials/${FINISHES[f].photo}.jpg`)}')"></button>`).join('')}</div>` : ''}`;
    }
    function fill(p) {
      const cat = catOf(p.category), list = opened.list;
      $('[data-p-idx]').textContent = two(opened.i + 1); $('[data-p-of]').textContent = two(list.length); $('[data-p-cat]').textContent = cat.name;
      $('[data-p-kick]').textContent = `${cat.name}${p.tag ? ' · ' + p.tag : ''}`;
      $('[data-p-name]').textContent = p.name;
      $('[data-p-price]').innerHTML = price(p.price);
      $('[data-p-copy]').textContent = p.copy;
      fillFinish(p);
      $('[data-p-spec]').textContent = `W ${p.dims[0]} × D ${p.dims[1]} × H ${p.dims[2]} cm. ${arrival(p)}`;
      qty = 1; $('[data-p-qty]').textContent = '1'; $('[data-p-addprice]').innerHTML = price(p.price);
      $('[data-p-more]').setAttribute('href', `#/product/${p.slug}`);
      const ph = $('.wp-photo'); ph.src = asset(p.img); ph.alt = p.name;
      $('[data-p-save]').setAttribute('aria-pressed', String(!!(api.isSaved && api.isSaved(p.slug))));
      $('[data-p-save]').setAttribute('aria-label', `Save ${p.name}`);
      $$('.w-room').forEach((b) => b.classList.toggle('is-on', b.dataset.room === p.category));
    }
    function setView(v) {
      view = v;
      $$('.wp-tabs [data-v]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.v === v)));
      $('.wp-photo').hidden = v !== 'photo';
      $('.wp-gl').style.visibility = v === '3d' ? '' : 'hidden';
      $('.wp-hint').hidden = v !== '3d';
      if (viewer) { if (v === '3d') viewer.start(); else viewer.stop(); }
    }
    function openPanel(slug, which = 0) {
      if (!scene || (state !== 'inside')) return;
      const p = bySlug[slug];
      if (!p) return;
      const list = PRODUCTS.filter((x) => x.category === p.category);
      const was = !!opened;
      if (billOpen) closeBill();
      opened = { slug, list, i: list.indexOf(p), which: Math.max(0, which | 0) };
      closeGuide(); closeMenu();
      fill(p);
      panel.hidden = false;
      requestAnimationFrame(() => { panel.classList.add('is-on'); root.classList.add('has-panel'); offset(); });
      if (!viewer) { viewer = window.DECO_SCENE.viewer(THREE, $('.wp-gl'), kit, { reduce }); }
      requestAnimationFrame(() => { viewer.resize(); viewer.show(slug, finishOf(p)); if (view === '3d') viewer.start(); });
      scene.focus(slug, which);
      markUrl(slug);
      sound.play(was ? 'tap' : 'open');
      root.classList.add('tip-gone');
      label.classList.remove('is-on');
      if (!was) later(() => { const c = $('[data-p-close]'); if (c && !small()) c.focus({ preventScroll: true }); }, 60);
    }
    function closePanel(keepCamera) {
      if (!opened) return;
      opened = null;
      markUrl(null);
      panel.classList.remove('is-on'); root.classList.remove('has-panel');
      $$('.w-room').forEach((b) => b.classList.remove('is-on'));
      if (scene) { scene.setOffset(0, 0); if (!keepCamera) scene.unfocus(); }
      if (viewer) viewer.stop();
      later(() => { if (!opened) panel.hidden = true; }, 650);
    }
    function step(d) {
      if (!opened) return;
      const L = opened.list, p = L[(opened.i + d + L.length) % L.length];
      openPanel(p.slug, 0);
    }
    $$('[data-step]').forEach((b) => b.addEventListener('click', () => step(+b.dataset.step)));
    $('[data-p-close]').addEventListener('click', () => closePanel());
    $$('.wp-tabs [data-v]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));
    $('[data-p-fin]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fin]');
      if (!b || !opened) return;
      const p = bySlug[opened.slug];
      scene.setFinish(p.slug, b.dataset.fin, opened.which);
      fillFinish(p);
      if (viewer) viewer.show(p.slug, b.dataset.fin);
      fx.beam(b);
      sound.play('tap');
      const nb = $(`[data-fin="${b.dataset.fin}"]`); if (nb) nb.focus({ preventScroll: true });
    });
    $$('[data-q]').forEach((b) => b.addEventListener('click', () => {
      if (!opened) return;
      qty = Math.max(1, Math.min(10, qty + +b.dataset.q));
      $('[data-p-qty]').textContent = qty; $('[data-p-addprice]').innerHTML = price(bySlug[opened.slug].price * qty);
    }));
    $('[data-p-add]').addEventListener('click', (e) => {
      if (!opened) return;
      const p = bySlug[opened.slug], btn = e.currentTarget, from = $('.wp-view'), n = qty;
      api.addToBag(p.slug, finishOf(p), n, { quiet: true });
      fx.beam(btn);
      sound.play('add');
      const r = from.getBoundingClientRect();
      fx.fly({ getBoundingClientRect: () => r, currentSrc: asset(p.thumb) }, $('[data-bag] .ic')).then(() => {
        bagCount.classList.remove('is-bump'); void bagCount.offsetWidth; bagCount.classList.add('is-bump'); later(() => bagCount.classList.remove('is-bump'), 480);
        if (!dead && !billOpen) api.toast(`${n > 1 ? `${n} × ` : ''}${p.name} ${n > 1 ? 'are' : 'is'} on your bill`, { label: 'View bill', run: () => openBill() });
      });
    });
    $('[data-p-share]').addEventListener('click', () => {
      if (!opened) return;
      const url = location.href.split('#')[0] + pieceUrl(opened.slug), done = () => api.toast(`Link copied. It opens the ${bySlug[opened.slug].name} in the 3D atelier.`, false);
      sound.play('tap');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => window.prompt('Copy this link', url));
      else window.prompt('Copy this link', url);
    });
    $('[data-p-save]').addEventListener('click', (e) => {
      if (!opened || !api.toggleSave) return;
      const on = api.toggleSave(opened.slug);
      e.currentTarget.setAttribute('aria-pressed', String(on));
      sound.play('tap');
    });
    const offSaved = api.onSaved ? api.onSaved(() => { if (opened) $('[data-p-save]').setAttribute('aria-pressed', String(api.isSaved(opened.slug))); }) : null;

    /* Places: the counter opens the bill; the materials table, Noor on samples; anything else, a walk. */
    function zone(v, act) {
      if (v === 'counter' || act === 'bill') { openBill(); return; }
      closePanel(true); closeBill();
      scene.view(v);
      if (act === 'samples') later(() => { openGuide(); answer('samples'); }, reduce ? 0 : 1100);
    }

    /* Rooms: open the first piece of a family, then step through it. */
    root.addEventListener('click', (e) => {
      const r = e.target.closest('[data-room]');
      if (!r || !scene || state !== 'inside') return;
      const first = PRODUCTS.find((p) => p.category === r.dataset.room);
      if (first) openPanel(first.slug, 0);
    });

    /* ---------- Menu ---------- */
    function openMenu() { closeGuide(); menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-on')); $('[data-menu]').setAttribute('aria-expanded', 'true'); later(() => { const f = menu.querySelector('button, a'); if (f) f.focus({ preventScroll: true }); }, 60); sound.play('tap'); }
    function closeMenu() { if (menu.hidden) return; menu.classList.remove('is-on'); $('[data-menu]').setAttribute('aria-expanded', 'false'); later(() => { if (!menu.classList.contains('is-on')) menu.hidden = true; }, 500); }
    $('[data-menu]').addEventListener('click', () => (menu.classList.contains('is-on') ? closeMenu() : openMenu()));
    $('[data-menu-close]').addEventListener('click', () => { closeMenu(); $('[data-menu]').focus(); });
    menu.addEventListener('click', (e) => { if (e.target.closest('[data-room]')) closeMenu(); });

    /* ---------- Noor, the guide: answers from the catalogue, then walks you there ---------- */
    const log = $('[data-log]');
    let greeted = false;
    function say(html, chips, who = 'noor') {
      const m = document.createElement('div');
      m.className = `wg-msg wg-msg--${who}`;
      m.innerHTML = `<p class="t-small">${html}</p>${chips && chips.length ? `<div class="wg-chips">${chips.map((c, i) => `<button class="chip" type="button" data-c="${i}">${c.icon ? ic(c.icon) : ''}${esc(c.label)}</button>`).join('')}</div>` : ''}`;
      if (chips) m.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => act(chips[+b.dataset.c])));
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
    }
    function reply(text) {
      const dots = document.createElement('div'); dots.className = 'wg-msg wg-msg--noor wg-typing'; dots.innerHTML = '<span></span><span></span><span></span>';
      log.appendChild(dots); log.scrollTop = log.scrollHeight;
      later(() => { dots.remove(); answer(text); }, reduce ? 0 : 520);
    }
    function act(c) {
      sound.play('tap');
      if (c.slug) { if (small()) closeGuide(); openPanel(c.slug, 0); }
      else if (c.view) { if (small()) closeGuide(); closePanel(true); scene.view(c.view); }
      else if (c.href) api.go(c.href);
      else if (c.night !== undefined) setNightMode(c.night);
      else if (c.ask) { say(esc(c.ask), null, 'you'); reply(c.ask); }
    }
    const pieceChip = (p) => ({ label: p.name, slug: p.slug, icon: p.category });
    const FIN_WORDS = { boucle: 'natural', natural: 'natural', terracotta: 'terracotta', olive: 'olive', wool: 'olive', travertine: 'travertine', stone: 'travertine', marble: 'travertine', oak: 'oak', walnut: 'walnut', smoked: 'smoked' };
    const ROOM_WORDS = { sofa: 'living', living: 'living', lounge: 'living', bed: 'bedroom', bedroom: 'bedroom', sleep: 'bedroom', dining: 'dining', dinner: 'dining', table: 'dining', storage: 'storage', shelf: 'storage', cabinet: 'storage', read: 'reading', reading: 'reading', vase: 'objects', objects: 'objects', decor: 'objects' };
    function answer(text) {
      const t = norm(text), words = t.split(/[^a-z0-9]+/).filter(Boolean);
      const has = (re) => re.test(t);
      if (has(/^(hi|hello|hey|salam|marhaba|good (morning|evening|afternoon))\b/)) return say('Hello. I can walk you to any piece in this room, or tell you about finishes and delivery. What are you looking for?', starters());
      if (has(/deliver|arriv|how long|when will|ship|lead time|weeks/)) return say(`Furniture is made for you in 6 to 10 weeks. Ordered today, it would reach you between ${day(42)} and ${day(70)}. Lighting and decor ship in 3 to 5 working days. Delivery anywhere in the UAE is complimentary, and our own team carries it in and places it.`, [{ label: 'How it is made', href: '#/atelier', icon: 'made' }, { label: 'Delivery details', href: '#/info/delivery', icon: 'truck' }]);
      if (has(/return|refund|exchange/)) return say('Lighting and decor can go back within 14 days; we collect them for free. Furniture is made for you, so it cannot be returned. Order free samples first and we will help you choose.', [{ label: 'Free samples', href: '#/materials', icon: 'swatch' }]);
      if (has(/sample|swatch|try the (fabric|finish)/)) return say('You can have up to four finishes sent to your door, free. Hold them in your hand before you choose.', [{ label: 'Choose samples', href: '#/materials', icon: 'swatch' }]);
      if (has(/visit|showroom|address|where are you|opening|open on|hours|al quoz|alserkal/)) return say('The real atelier is Warehouse 41, Alserkal Avenue, Al Quoz 1. Saturday to Thursday, 10:00 to 19:00; Friday by appointment.', [{ label: 'Book a visit', href: '#/atelier', icon: 'calendar' }]);
      if (has(/\b(night|dark|evening|lamps on)\b/)) { const was = night; setNightMode(true); return say(was ? 'The lamps are already on.' : 'There. The lamps are on.'); }
      if (has(/\b(day|morning|sun|bright)\b/) && !has(/deliver/)) { const was = night; setNightMode(false); return say(was ? 'Here is the afternoon light again.' : 'It is bright in here already.'); }
      if (has(/\b(bill|pay|paying|counter|checkout|check out|cashier|till|cart|basket|my bag)\b/)) {
        later(() => openBill(), reduce ? 0 : 600);
        return say(api.bagCount() ? `Your bill comes to ${price(total())}. The counter is by the door, on the right. Follow me.` : 'The counter is by the door, on the right. Add a piece to your bag and it appears on the bill there.');
      }
      const fin = words.map((w) => FIN_WORDS[w]).find(Boolean);
      if (fin) {
        const f = FINISHES[fin], list = PRODUCTS.filter((p) => p.finishes.includes(fin));
        return say(`${esc(f.name)}: ${esc(f.line)} It comes on ${plural(list.length, 'piece')} here.`, [...list.slice(0, 3).map(pieceChip), { label: `All in ${f.name.toLowerCase()}`, href: `#/shop?finish=${fin}`, icon: 'all' }]);
      }
      if (has(/small|compact|apartment|studio flat|tiny|narrow/)) {
        const list = PRODUCTS.filter((p) => ['seating', 'tables', 'storage'].includes(p.category) && p.dims[0] <= 80);
        return say('For a smaller room, these keep a light footprint and still feel generous:', list.slice(0, 5).map(pieceChip));
      }
      const num = t.match(/(\d[\d,.]*)\s*(k|thousand)?/);
      if (num && has(/under|below|less|budget|max|up to|cheaper/)) {
        let n = parseFloat(num[1].replace(/,/g, '')); if (num[2]) n *= 1000;
        const list = PRODUCTS.filter((p) => p.price <= n).sort((a, b) => b.price - a.price);
        return list.length ? say(`${plural(list.length, 'piece')} at ${price(n)} or less. A few to start with:`, list.slice(0, 5).map(pieceChip)) : say(`Nothing here is under ${price(n)}. The smallest piece is the Terra Bowl.`, [pieceChip(bySlug['terra-bowl'])]);
      }
      const room = words.map((w) => ROOM_WORDS[w.replace(/s$/, '')]).find(Boolean);
      const found = api.find ? api.find(text) : [];
      if (found.length) {
        const chips = found.slice(0, 5).map(pieceChip);
        if (room) chips.push({ label: 'Walk me there', view: room, icon: 'arrow' });
        return say(found.length === 1 ? 'This one. I can take you to it.' : `I found ${found.length} pieces for “${esc(text)}”.`, chips);
      }
      if (room) { act({ view: room }); return say('Follow me.'); }
      return say(`I could not find “${esc(text)}” in this room. Try sofa, lamp, travertine, or a budget like “under 3,000”.`, starters());
    }
    const starters = () => [{ label: 'Sofas and chairs', ask: 'sofa' }, { label: 'For a small room', ask: 'something for a small room' }, { label: 'What is bouclé?', ask: 'boucle' }, { label: 'When would it arrive?', ask: 'delivery' }, { label: 'Under 2,000', ask: 'under 2000' }];
    function openGuide() {
      closeMenu();
      guide.hidden = false; requestAnimationFrame(() => guide.classList.add('is-on'));
      $('[data-ask]').setAttribute('aria-expanded', 'true');
      if (!greeted) { greeted = true; say('Hello, I am Noor. I can walk you to any piece in this room, or tell you about finishes and delivery.', starters()); }
      later(() => { if (!small()) $('#wgIn').focus({ preventScroll: true }); }, 80);
      sound.play('tap');
    }
    function closeGuide() { if (guide.hidden) return; guide.classList.remove('is-on'); $('[data-ask]').setAttribute('aria-expanded', 'false'); later(() => { if (!guide.classList.contains('is-on')) guide.hidden = true; }, 500); }
    $('[data-ask]').addEventListener('click', () => (guide.classList.contains('is-on') ? closeGuide() : openGuide()));
    $('[data-guide-close]').addEventListener('click', () => { closeGuide(); $('[data-ask]').focus(); });
    $('[data-guide-form]').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('#wgIn'), v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      say(esc(v), null, 'you');
      reply(v);
    });

    /* ---------- Keyboard, size and visibility ---------- */
    function onKey(e) {
      if (state !== 'inside') { if (e.key === 'Enter' && state === 'hello' && !e.target.closest('a, button, input')) enter(wantSound); return; }
      if (document.querySelector('.panel.is-on, .search.is-on')) return; // the shop's own panels are open on top
      if (e.key === 'Escape') { if (guide.classList.contains('is-on')) { closeGuide(); $('[data-ask]').focus(); } else if (menu.classList.contains('is-on')) { closeMenu(); $('[data-menu]').focus(); } else if (billOpen) { closeBill(); $('[data-bag]').focus(); } else if (opened) closePanel(); return; }
      if (opened && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('input, textarea, .swatches, .wp-tabs')) { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    }
    document.addEventListener('keydown', onKey);
    let rT = 0;
    function onResize() { clearTimeout(rT); rT = setTimeout(() => { if (scene) scene.resize(); if (viewer) viewer.resize(); offset(); }, 80); }
    window.addEventListener('resize', onResize);
    function onVis() { if (!scene) return; if (document.hidden) { scene.stop(); if (viewer) viewer.stop(); } else { scene.start(); if (viewer && opened && view === '3d') viewer.start(); } }
    document.addEventListener('visibilitychange', onVis);

    /* ---------- Unmount ---------- */
    function unmount() {
      dead = true;
      cancelAnimationFrame(raf); clearInterval(msgTimer); clearInterval(clockTimer); clearTimeout(rT);
      timers.forEach(clearTimeout);
      document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis);
      if (offBag) offBag(); if (offSaved) offSaved();
      sound.close();
      if (viewer) viewer.destroy();
      if (scene) scene.destroy();
      root.remove();
    }
    if (/[?&]debug\b/.test(location.search)) window.__decoWorld = { get scene() { return scene; }, open: openPanel, close: closePanel, enter, night: setNightMode, bill: openBill, closeBill };
    return { unmount };
  }

  window.DECO_WORLD = { supported, mount };
})();
