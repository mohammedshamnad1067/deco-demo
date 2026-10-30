/* =========================================================
   DECO · The 3D atelier
   A pavilion of soft arches on warm sand, at golden hour or at
   night, with every piece of the collection inside at its true
   size. world.js drives it; this file owns the renderer, the
   scene, the camera and the pointer.
   DECO_SCENE.create(THREE, opts) → the api at the end of create().
   Units are metres. The room runs x −10…10, z −7…7, floor y 0;
   the entrance is the middle arch at z = 7.
   ========================================================= */
(function () {
  'use strict';

  const P = Math.PI;
  const R = { x: 10, z: 7, h: 5, t: .35 };
  const EYE = 1.62;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const EASE = {
    inOut: (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    settle: (t) => 1 - Math.pow(1 - t, 4)
  };
  const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

  /* Where every piece stands: [slug, x, z, turn, y, options]. Turn 0 faces the entrance (+z). */
  const LAYOUT = [
    // Living, back centre
    ['textured-rug', 0, -4.3, P / 2],
    ['luna-sofa', 0, -5.65, 0],
    ['cushion-collection', -.5, -5.74, 0, .38],
    ['sol-round-coffee-table', 0, -4.0, 0],
    ['mira-lounge-chair', -.95, -2.55, face(-.95, -2.55, 0, -4)],
    ['mira-lounge-chair', .95, -2.55, face(.95, -2.55, 0, -4)],
    ['cove-side-table', 1.56, -5.6, 0],
    ['arc-floor-lamp', -.95, -5.95, 0],
    ['puff-ottoman', 2.3, -3.55, 0],
    ['wall-art', 0, -6.93, 0, 1.78],
    ['wall-sconce', -1.85, -6.93, 0, 1.72],
    ['wall-sconce', 1.85, -6.93, 0, 1.72],
    // Bedroom, back left
    ['vale-bed', -8.05, -5.9, 0],
    ['luna-headboard-bed', -5.05, -5.9, 0],
    ['stone-nightstand', -9.5, -6.7, 0],
    ['luna-table-lamp', -9.5, -6.7, 0, .55],
    ['tomo-nightstand', -6.6, -6.72, 0],
    ['stone-table-lamp', -6.6, -6.72, 0, .5],
    ['mini-storage', -3.6, -6.7, 0],
    ['curve-bedroom-bench', -8.05, -4.33, 0],
    ['throw-blanket', -7.9, -4.33, .14, .45],
    ['dune-dresser', -9.7, -2.6, P / 2],
    ['arco-mirror', -9.85, -.85, P / 2],
    // Dining, back right
    ['terra-dining-table', 6.8, -4.1, 0],
    ['vale-dining-chair', 6.25, -4.92, 0], ['vale-dining-chair', 7.35, -4.92, 0],
    ['vale-dining-chair', 6.25, -3.28, P], ['vale-dining-chair', 7.35, -3.28, P],
    ['mod-dining-chair', 5.48, -4.1, P / 2], ['mod-dining-chair', 8.12, -4.1, -P / 2],
    ['terra-bowl', 6.8, -4.1, 0, .75],
    ['dune-pendant-light', 6.25, -4.1, 0, 1.55, { drop: 3.15 }],
    ['terra-pendant-light', 7.35, -4.1, 0, 1.62, { drop: 3.18 }],
    ['vale-sideboard', 6.8, -6.72, 0],
    // Left wall
    ['tomo-bookshelf', -9.76, .9, P / 2],
    ['arc-cabinet', -9.72, 2.55, P / 2],
    ['nora-display-shelf', -9.78, 4.0, P / 2],
    ['cloud-cabinet', -9.72, 5.6, P / 2],
    ['arco-wall-mirror', -9.99, 5.6, P / 2, 1.42],
    // Right wall
    ['ridge-tv-unit', 9.72, .3, -P / 2],
    ['decor-set', 9.75, .85, -P / 2, .4],
    ['ridge-console-table', 9.76, 3.0, -P / 2],
    ['luna-table-lamp', 9.76, 3.0, -P / 2, .78],
    // The stage by the door: two chairs worth walking round
    ['arco-lounge-chair', -.85, 1.05, face(-.85, 1.05, .2, 3.6), .1],
    ['nora-accent-chair', .85, 1.05, face(.85, 1.05, -.2, 3.6), .1],
    ['pebble-side-table', 0, .5, 0, .1],
    // Reading corner, front left
    ['lua-coffee-table', -5.4, 3.1, 0],
    ['curve-bench', -5.4, 1.95, 0],
    ['nest-tables', -7.05, 3.35, 0],
    ['orbit-floor-lamp', -7.15, 2.0, 0],
    // Objects on plinths, front right
    ['stone-vase', 4.6, 3.0, 0, .9],
    ['terra-bowl', 5.5, 3.6, 0, .6],
    ['luna-planter', 4.9, 4.25, 0, .35]
  ];
  const PLINTHS = [[4.6, 3.0, .9, .26], [5.5, 3.6, .6, .3], [4.9, 4.25, .35, .3]];
  const STAGE = [0, .95, 1.75];

  /* Places to stand: [eye, look at]. */
  const VIEWS = {
    entry: [[0, EYE, 5.7], [0, .95, -3.2]],
    living: [[0, 1.5, -.5], [0, .7, -5.2]],
    stage: [[0, 1.5, 4.5], [0, .5, .9]],
    bedroom: [[-4.4, 1.65, -1.1], [-6.8, .55, -5.6]],
    dining: [[4.7, 1.7, -.7], [6.9, .85, -4.6]],
    storage: [[-5.6, 1.6, 3.6], [-9.8, 1.0, 2.9]],
    reading: [[-2.6, 1.6, 6.0], [-5.6, .55, 2.8]],
    objects: [[2.4, 1.55, 6.3], [5.0, .85, 3.5]],
    wall: [[5.4, 1.65, 4.6], [9.8, 1.0, 1.6]]
  };
  /* Hanging signs: [label, line, view, x, z]. */
  const SIGNS = [
    ['Living', 'Sofas, chairs and tables', 'living', 0, -3.3],
    ['Bedroom', 'Beds and nightstands', 'bedroom', -6.55, -3.4],
    ['Dining', 'Table, chairs, pendants', 'dining', 6.8, -2.2],
    ['Storage', 'Shelves and cabinets', 'storage', -8.4, 3.0],
    ['Reading corner', 'Low tables and lamps', 'reading', -5.4, 1.0],
    ['Objects', 'Stone, clay and green', 'objects', 5.05, 2.3]
  ];

  function create(THREE, o) {
    const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
    const { canvas, kit, catalog } = o;
    const mobile = !!o.mobile, reduce = !!o.reduce;

    /* ---------- Renderer ---------- */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    /* Resolution follows the frame rate: it starts modest on dense screens and climbs only while frames stay quick. */
    const dprCap = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.6);
    let dpr = Math.min(dprCap, 1.25);
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(46, 1, .05, 1200);

    /* Image-based light: a soft warm studio rendered once into an environment map. */
    function envMap() {
      const s = new THREE.Scene(), room = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: 0x847a72, side: THREE.BackSide }));
      s.add(room);
      const panel = (w, h, x, y, z, color, k) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
      };
      panel(14, 4, 0, 5.8, 0, 0xfff7ee, 2.6);
      panel(10, 5, 0, 2, 11.8, 0xfff0de, 3);
      panel(6, 6, -11.8, 1.5, -2, 0xffe8d0, 1.5);
      panel(8, 3, 11.8, 2, 3, 0xfff8f0, 1.2);
      const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, .04).texture;
      pm.dispose(); room.geometry.dispose();
      return tex;
    }
    scene.environment = envMap();

    /* ---------- Sky, stars and haze ---------- */
    const skyU = { uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uLow: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uSun: { value: new V3(-.55, .32, .77).normalize() }, uGlow: { value: 1 } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), new THREE.ShaderMaterial({
      uniforms: skyU, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow; uniform vec3 uSunCol; uniform vec3 uSun; uniform float uGlow; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(uMid, uTop, pow(clamp(h, 0.0, 1.0), .55)) : mix(uMid, uLow, clamp(-h * 6.0, 0.0, 1.0));
          float s = max(dot(normalize(vDir), uSun), 0.0);
          c += uSunCol * (pow(s, 1400.0) * 4.0 + pow(s, 22.0) * .4 * uGlow + pow(s, 3.0) * .1 * uGlow);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    }));
    sky.frustumCulled = false;
    scene.add(sky);
    const starPos = [];
    for (let i = 0; i < (mobile ? 600 : 1100); i++) {
      const u = Math.random() * P * 2, v = Math.acos(1 - Math.random() * .92);
      starPos.push(Math.sin(v) * Math.cos(u) * 700, Math.cos(v) * 700, Math.sin(v) * Math.sin(u) * 700);
    }
    const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff0dc, size: mobile ? 1.6 : 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    stars.frustumCulled = false;
    scene.add(stars);
    scene.fog = new THREE.Fog(0xf2dcc6, 70, 380);

    /* ---------- Light ---------- */
    const hemi = new THREE.HemisphereLight(0xfff0e0, 0xc9a882, 1);
    const sun = new THREE.DirectionalLight(0xffd7a6, 3);
    sun.position.set(-30, 24, 34); sun.target.position.set(0, 0, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 24, bottom: -18, near: 5, far: 110 });
    sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 2.5;
    const fill = new THREE.DirectionalLight(0xfff2e4, .5);
    fill.position.set(6, 20, -4);
    const spill = new THREE.PointLight(0xffc48a, 0, 18, 1.4);
    spill.position.set(0, 3, 9.4);
    scene.add(hemi, sun, sun.target, fill, spill);

    /* ---------- Shared bits ---------- */
    const mats = [];
    const own = (m) => { mats.push(m); return m; };
    function mesh(geo, mat, cast = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; return m; }
    function blobTexture() {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 6, 64, 64, 64);
      gr.addColorStop(0, 'rgba(40,24,16,.55)'); gr.addColorStop(.55, 'rgba(40,24,16,.22)'); gr.addColorStop(1, 'rgba(40,24,16,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    }
    const blobTex = blobTexture();
    const blobMat = own(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: .8, polygonOffset: true, polygonOffsetFactor: -2 }));
    function blob(w, d, x, z, ry, y = .004) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), blobMat);
      m.rotation.set(-P / 2, 0, ry); m.position.set(x, y, z); m.renderOrder = 1; scene.add(m); return m;
    }

    /* ---------- Desert ---------- */
    const dune = (x, z) => {
      const k = smooth(30, 90, Math.hypot(x * .8, z - 4));
      const h = Math.sin(x * .045 + z * .021) * 2.4 + Math.sin(x * .021 - z * .057 + 1.3) * 3.1 + Math.sin(x * .12 + z * .08) * .45 + 3.1;
      return h * k - .06 * (1 - k);
    };
    const groundGeo = new THREE.PlaneGeometry(900, 900, mobile ? 140 : 220, mobile ? 140 : 220).rotateX(-P / 2);
    const gp = groundGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) gp.setY(i, dune(gp.getX(i), gp.getZ(i)));
    groundGeo.computeVertexNormals();
    const sand = own(new THREE.MeshStandardMaterial({ color: 0xe4ccb1, roughness: 1 }));
    const ground = mesh(groundGeo, sand, false);
    scene.add(ground);

    /* Terrace and path in travertine. */
    const stone = own(kit.surface('travertine', 0xf3eadf, 1.1));
    const terrace = mesh(kit.roundedBox(23, .12, 7.4, .05), stone, false);
    terrace.position.set(0, -.02, 11.05); scene.add(terrace);
    for (let i = 0; i < 9; i++) {
      const s = mesh(kit.roundedBox(1.5, .08, .66, .04), stone, false);
      s.position.set(Math.sin(i * 1.7) * .14, -.01, 15.7 + i * 1.12); s.rotation.y = Math.sin(i * 2.3) * .05; scene.add(s);
    }

    /* Palms: a ringed trunk along a soft curve, fronds on bent strips. */
    function frondTexture() {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const x = c.getContext('2d'); x.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const t = i / 46, px = 20 + t * 470, len = 52 * Math.sin(Math.min(1, t * 1.15) * P) + 8;
        for (const s of [-1, 1]) {
          x.strokeStyle = `rgb(${96 + (i % 5) * 6},${98 + (i % 3) * 7},${62 + (i % 4) * 4})`; x.lineWidth = 5;
          x.beginPath(); x.moveTo(px, 64); x.quadraticCurveTo(px + 12, 64 + s * len * .5, px + 26, 64 + s * len); x.stroke();
        }
      }
      x.strokeStyle = 'rgb(120,112,78)'; x.lineWidth = 5; x.beginPath(); x.moveTo(4, 64); x.lineTo(500, 64); x.stroke();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    }
    const frondMat = own(new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: .45, side: THREE.DoubleSide, roughness: .9 }));
    const barkMat = own(new THREE.MeshStandardMaterial({ color: 0x8b6f58, roughness: 1 }));
    const frondGeo = (() => {
      const g = new THREE.PlaneGeometry(3, 1, 16, 2).rotateX(-P / 2).translate(1.5, 0, 0), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, x * .42 - x * x * .27 - Math.abs(z) * .22); }
      g.computeVertexNormals(); return g;
    })();
    const ringGeo = new THREE.CylinderGeometry(.19, .21, .34, 10);
    function palm(x, z, h, lean, turn) {
      const g = new THREE.Group(), c = new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(lean * .2, h * .35, 0), new V3(lean * .62, h * .72, 0), new V3(lean, h, 0)]);
      const n = Math.round(h / .3);
      for (let i = 0; i < n; i++) {
        const t = i / n, r = mesh(ringGeo, barkMat), s = lerp(1.15, .72, t);
        r.position.copy(c.getPoint(t)); r.quaternion.setFromUnitVectors(UP, c.getTangent(t)); r.scale.set(s, 1, s); g.add(r);
      }
      const top = c.getPoint(1);
      for (let i = 0; i < 13; i++) {
        const f = mesh(frondGeo, frondMat); f.position.copy(top);
        f.rotation.set(0, i / 13 * P * 2 + turn, Math.sin(i * 1.9) * .18 + .05); g.add(f);
      }
      g.position.set(x, dune(x, z) - .1, z); g.rotation.y = turn; scene.add(g);
    }
    [[-14.5, -2, 9, 1.6, .3], [-18.5, 5, 7.4, -1.2, 1.4], [15, -4, 8.6, -1.4, 2.1], [18.5, 6, 7, 1.1, .8], [-13.5, 12, 6.4, .9, 2.6], [14, 13, 5.8, -.8, 4], [-30, -14, 10, 1.4, 1], [32, -10, 9, -1.5, 3]]
      .forEach(([x, z, h, l, t]) => palm(x, z, h, l, t));
    /* Agaves: a fan of soft blades. */
    const bladeGeo = new THREE.ConeGeometry(.07, .9, 6).translate(0, .45, 0);
    const agaveMat = own(new THREE.MeshStandardMaterial({ color: 0x86825f, roughness: .9 }));
    function agave(x, z, s) {
      const g = new THREE.Group();
      for (let i = 0; i < 14; i++) { const b = mesh(bladeGeo, agaveMat); b.rotation.set(Math.sin(i * 2.1) * .2 + .55 + (i % 3) * .12, i * 2.4, 0, 'YXZ'); g.add(b); }
      g.position.set(x, dune(x, z) - .02, z); g.scale.setScalar(s); scene.add(g);
    }
    [[-5.6, 9.2, 1], [5.8, 9.4, .9], [-12.5, 8.4, 1.3], [12.8, 8, 1.2], [-8.5, 15, .8], [9, 16, 1], [-22, 10, 1.4], [24, 13, 1.2]].forEach(([x, z, s]) => agave(x, z, s));

    /* ---------- The pavilion ---------- */
    const plaster = own(new THREE.MeshStandardMaterial({ color: 0xf3ece4, roughness: .94 }));
    const plasterOut = own(new THREE.MeshStandardMaterial({ color: 0xefe4d7, roughness: .96 }));
    /* The ceiling only sees bounced light; a little of its own glow stands in for it. */
    const ceil = own(new THREE.MeshStandardMaterial({ color: 0xf3ece4, roughness: .94, emissive: 0xf3e4d2, emissiveIntensity: .3 }));
    const bronze = own(new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: .4, metalness: .7 }));
    const glass = own(new THREE.MeshStandardMaterial({ color: 0xfff8f0, transparent: true, opacity: .1, roughness: .04, metalness: .2, depthWrite: false, side: THREE.DoubleSide }));

    /* Floor: large stone tiles, drawn once on canvas (the scan of travertine reads as wood at this size). */
    function tileTexture() {
      const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d'), n = 2, t = S / n;
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const v = 238 + Math.round(rnd() * 6 - 3);
        x.fillStyle = `rgb(${v},${v - 7},${v - 15})`; x.fillRect(i * t, j * t, t, t);
        for (let k = 0; k < 7; k++) { x.strokeStyle = `rgba(190,165,140,${.05 + rnd() * .06})`; x.lineWidth = 6 + rnd() * 18; x.beginPath(); const y0 = j * t + rnd() * t; x.moveTo(i * t, y0); x.bezierCurveTo(i * t + t * .3, y0 + rnd() * 40 - 20, i * t + t * .7, y0 + rnd() * 40 - 20, i * t + t, y0 + rnd() * 30 - 15); x.stroke(); }
        for (let k = 0; k < 700; k++) { x.fillStyle = `rgba(160,130,104,${.05 + rnd() * .12})`; x.beginPath(); x.ellipse(i * t + rnd() * t, j * t + rnd() * t, .6 + rnd() * 3.2, .5 + rnd() * 1.4, 0, 0, P * 2); x.fill(); }
      }
      x.fillStyle = 'rgba(176,152,128,.7)';
      for (let i = 0; i <= n; i++) { x.fillRect(i * t - 1.5, 0, 3, S); x.fillRect(0, i * t - 1.5, S, 3); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
      tex.repeat.set((R.x * 2) / 1.8, (R.z * 2) / 1.8);
      return tex;
    }
    const floorMat = own(new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: .38 }));
    const fl = mesh(new THREE.PlaneGeometry(R.x * 2, R.z * 2).rotateX(-P / 2), floorMat, false);
    fl.position.y = .001; scene.add(fl);
    const slab = mesh(kit.roundedBox(R.x * 2 + .9, .34, R.z * 2 + .9, .06), stone, false);
    slab.position.set(0, -.172, 0); scene.add(slab);
    const walls = new THREE.Group(); scene.add(walls);
    const box = (w, h, d, x, y, z, m) => { const b = mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); walls.add(b); return b; };
    const W2 = R.x + R.t;
    box(W2 * 2, R.h, R.t, 0, R.h / 2, -R.z - R.t / 2, plaster);
    box(R.t, R.h, R.z * 2 + R.t * 2, -R.x - R.t / 2, R.h / 2, 0, plaster);
    box(R.t, R.h, R.z * 2 + R.t * 2, R.x + R.t / 2, R.h / 2, 0, plaster);
    /* The front: five arched bays, the middle one the door. */
    const BAYS = [-8, -4, 0, 4, 8], BW = 3.3, SPR = 2.4;
    const front = new THREE.Shape();
    front.moveTo(-W2, 0);
    for (const c of BAYS) { front.lineTo(c - BW / 2, 0); front.lineTo(c - BW / 2, SPR); front.absarc(c, SPR, BW / 2, P, 0, true); front.lineTo(c + BW / 2, 0); }
    front.lineTo(W2, 0); front.lineTo(W2, R.h); front.lineTo(-W2, R.h); front.lineTo(-W2, 0);
    const fw = mesh(kit.extrude(front, R.t, .0, 64), plasterOut);
    fw.position.set(0, 0, R.z + R.t / 2); walls.add(fw);
    /* Glass in the side bays, a frame round every arch, and two doors that swing in. */
    const archPts = (c, z) => { const pts = [new V3(c - BW / 2, 0, z), new V3(c - BW / 2, SPR, z)]; for (let i = 1; i < 24; i++) { const a = P - i / 24 * P; pts.push(new V3(c + Math.cos(a) * BW / 2, SPR + Math.sin(a) * BW / 2, z)); } pts.push(new V3(c + BW / 2, SPR, z), new V3(c + BW / 2, 0, z)); return pts; };
    const zf = R.z + R.t / 2;
    for (const c of BAYS) {
      const frame = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPts(c, zf), false, 'centripetal'), 96, .035, 8), bronze, false);
      walls.add(frame);
      const bar = mesh(new THREE.BoxGeometry(BW, .05, .05), bronze, false); bar.position.set(c, SPR, zf); walls.add(bar);
      const top = new THREE.Shape(); top.moveTo(c - BW / 2, SPR); top.absarc(c, SPR, BW / 2, P, 0, true); top.lineTo(c - BW / 2, SPR);
      const tg = new THREE.Mesh(new THREE.ShapeGeometry(top, 48), glass); tg.position.z = zf; walls.add(tg);
      if (c !== 0) { const pane = new THREE.Mesh(new THREE.PlaneGeometry(BW, SPR), glass); pane.position.set(c, SPR / 2, zf); walls.add(pane); }
    }
    const doors = [-1, 1].map((s) => {
      const hinge = new THREE.Group(); hinge.position.set(s * BW / 2, 0, zf);
      const leaf = new THREE.Group(); leaf.position.x = -s * BW / 4;
      const fr = kit.roundRect(BW / 2, SPR, .02, 0, SPR / 2); fr.holes.push(kit.roundRect(BW / 2 - .1, SPR - .1, .01, 0, SPR / 2, new THREE.Path()));
      leaf.add(mesh(kit.extrude(fr, .04, 0, 8), bronze, false));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(BW / 2 - .1, SPR - .1), glass); pane.position.y = SPR / 2; leaf.add(pane);
      const pull = mesh(new THREE.CylinderGeometry(.015, .015, .6, 8), bronze, false); pull.position.set(s * (BW / 4 - .14), 1.1, .05); leaf.add(pull);
      hinge.add(leaf); walls.add(hinge);
      return { hinge, s };
    });
    /* Roof with three skylights; it lets the late sun through, as skylights do. */
    const roofShape = kit.roundRect(W2 * 2 + .6, R.z * 2 + 1.3, .5);
    for (const x of [-6.5, 0, 6.5]) roofShape.holes.push(kit.roundRect(4.4, 2.4, .4, x, 1, new THREE.Path()));
    const roofGeo = kit.extrude(roofShape, .42, .04, 32); roofGeo.rotateX(-P / 2);
    const roof = mesh(roofGeo, ceil, false); roof.position.y = R.h + .21; walls.add(roof);
    for (const x of [-6.5, 0, 6.5]) { const sk = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.4).rotateX(P / 2), glass); sk.position.set(x, R.h + .3, -1); walls.add(sk); }
    /* An arch in relief behind the sofa, to hold the art. */
    const relief = mesh(kit.extrude(kit.arch(4.6, 4.2), .06, .015), own(new THREE.MeshStandardMaterial({ color: 0xf7f1ea, roughness: .95 })), false);
    relief.position.set(0, 0, -R.z + .03); walls.add(relief);
    /* Plinths for the objects, and a low round stage for two chairs. */
    for (const [x, z, h, r] of PLINTHS) { const pl = mesh(kit.turned([[0, 0], [r, 0], [r + .005, .02], [r, h - .02], [r - .01, h], [0, h]]), stone); pl.position.set(x, 0, z); scene.add(pl); }
    const stage = mesh(kit.turned([[0, 0], [STAGE[2], 0], [STAGE[2] + .01, .03], [STAGE[2], .085], [STAGE[2] - .02, .1], [0, .1]], 96), stone);
    stage.position.set(STAGE[0], 0, STAGE[1]); scene.add(stage);
    blob(STAGE[2] * 2.3, STAGE[2] * 2.3, STAGE[0], STAGE[1], 0, .003);

    /* The DECO mark on the front, cut from the logo in the page's sprite. It glows at night. */
    const logoMat = own(new THREE.MeshStandardMaterial({ color: 0x3b241b, roughness: .55, metalness: .1, emissive: 0xffc98a, emissiveIntensity: 0 }));
    function logo() {
      const paths = [['#logo-icon path', 0], ['#logo-word path', 275]];
      const shapes = [];
      /* The logo is drawn with even-odd fill: a ring nested an odd number of times is a hole. */
      const inside = (pt, poly) => {
        let c = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const a = poly[i], b = poly[j];
          if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
        }
        return c;
      };
      for (const [sel, dx] of paths) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const rings = el.getAttribute('d').split(/(?=M)/).map((sub) => {
          const n = sub.replace(/[MLZ]/g, ' ').trim().split(/[\s,]+/).map(Number), pts = [];
          for (let i = 0; i + 1 < n.length; i += 2) pts.push(new THREE.Vector2(n[i] + dx, -n[i + 1]));
          return pts;
        }).filter((r) => r.length > 2);
        const depth = rings.map((r, i) => rings.reduce((k, o, j) => k + (j !== i && inside(r[0], o) ? 1 : 0), 0));
        const solids = [];
        rings.forEach((r, i) => { if (depth[i] % 2 === 0) solids.push({ ring: r, depth: depth[i], shape: new THREE.Shape(r) }); });
        rings.forEach((r, i) => {
          if (depth[i] % 2 === 0) return;
          const host = solids.find((s) => s.depth === depth[i] - 1 && inside(r[0], s.ring));
          if (host) host.shape.holes.push(new THREE.Path(r));
        });
        shapes.push(...solids.map((s) => s.shape));
      }
      if (!shapes.length) return;
      const g = new THREE.ExtrudeGeometry(shapes, { depth: 7, bevelEnabled: false, curveSegments: 4 });
      const k = .62 / 238; g.scale(k, k, k); g.translate(-904 * k / 2, 238 * k / 2, 0);
      const m = mesh(g, logoMat, false); m.position.set(0, (SPR + BW / 2 + R.h) / 2, R.z + R.t + .002); scene.add(m);
    }
    logo();

    /* Path lights for the night. */
    const lampGlow = own(new THREE.MeshStandardMaterial({ color: 0xfff1df, emissive: 0xffc68c, emissiveIntensity: 0, roughness: .8 }));
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const b = mesh(kit.turned([[0, 0], [.07, 0], [.075, .36], [.06, .42], [0, .44]]), stone); b.position.set(s * 1.4, 0, 15.4 + i * 2.4); scene.add(b);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .06, 16), lampGlow); l.position.set(s * 1.4, .39, 15.4 + i * 2.4); scene.add(l);
    }
    /* Two olive trees at the door. */
    for (const s of [-1, 1]) { const t = kit.build('luna-planter', 'travertine'); t.scale.setScalar(1.7); t.position.set(s * 2.75, .04, 8.4); scene.add(t); blob(1.1, 1.1, s * 2.75, 8.4, 0, .046); }

    /* ---------- The collection ---------- */
    const pieces = [];     // { slug, row, group, blob, lights: [] }
    const pickables = [];  // meshes that answer the pointer
    const lamps = [];      // { light, power, piece }
    let lampBudget = mobile ? 3 : 6;
    function place(row, finish) {
      const [slug, x, z, turn = 0, y = 0, opt] = row;
      const p = catalog.bySlug[slug];
      if (!p) return null;
      const g = kit.build(slug, finish || p.finishes[0] || null, opt);
      if (!g) return null;
      g.position.set(x, y, z); g.rotation.y = turn;
      scene.add(g);
      g.updateMatrixWorld(true);
      const piece = { slug, row, group: g, glow: 0, glowTo: 0, mats: [] };
      g.traverse((m) => { if (m.isMesh) { m.userData.piece = piece; pickables.push(m); if (!m.material.userData.glow && piece.mats.indexOf(m.material) < 0) piece.mats.push(m.material); } });
      return piece;
    }
    function addLights(piece) {
      for (const [lx, ly, lz, power] of piece.group.userData.lights) {
        if (lampBudget <= 0) break;
        lampBudget--;
        const light = new THREE.PointLight(0xffd4ac, 0, 8, 1.7);
        light.position.copy(piece.group.localToWorld(new V3(lx, ly, lz)));
        scene.add(light); lamps.push({ light, power, piece });
      }
    }
    for (const row of LAYOUT) {
      const piece = place(row);
      if (!piece) continue;
      pieces.push(piece);
      if (!row[4]) {
        const b = new THREE.Box3().setFromObject(piece.group), s = b.getSize(new V3());
        if (piece.slug !== 'textured-rug' && s.y > .2) piece.blob = blob(s.x * 1.25 + .2, s.z * 1.25 + .2, (b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, 0);
      }
    }
    /* Lamps worth lighting first: the ones you see from the door. */
    ['arc-floor-lamp', 'dune-pendant-light', 'terra-pendant-light', 'orbit-floor-lamp', 'luna-table-lamp', 'stone-table-lamp', 'wall-sconce'].forEach((slug) => pieces.filter((pc) => pc.slug === slug).forEach(addLights));

    /* Hanging signs, drawn on canvas in the site's type. */
    const signs = [];
    function signTexture(label, line) {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 320;
      const x = c.getContext('2d');
      x.fillStyle = '#F4ECE4'; x.fillRect(0, 0, 1024, 320);
      x.fillStyle = '#3B241B'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '300 112px Comfortaa, Quicksand, sans-serif'; x.fillText(label, 512, 142);
      x.fillStyle = '#6F5446'; x.font = '700 30px Quicksand, sans-serif';
      const caps = line.toUpperCase().split('').join(String.fromCharCode(8202));
      x.fillText(caps, 512, 242);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
    }
    const cord = own(new THREE.MeshStandardMaterial({ color: 0x3b241b, roughness: .6 }));
    const boardMat = own(new THREE.MeshStandardMaterial({ color: 0xf4ece4, roughness: .9 }));
    for (const [label, line, view, x, z] of SIGNS) {
      const g = new THREE.Group(), w = 1.25, h = .39, y = 3.35, own2 = own(boardMat.clone());
      const board = mesh(kit.roundedBox(w, h, .03, .05, 2), own2); board.castShadow = false; g.add(board);
      const faceMat = own(new THREE.MeshStandardMaterial({ map: signTexture(label, line), roughness: .9 }));
      for (const s of [1, -1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(w - .06, h - .06), faceMat); f.position.z = s * .0155; f.rotation.y = s > 0 ? 0 : P; g.add(f); }
      for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, R.h - y - h / 2, 4), cord); c.position.set(s * (w / 2 - .12), h / 2 + (R.h - y - h / 2) / 2, 0); g.add(c); }
      g.position.set(x, y, z); g.rotation.y = Math.atan2(0 - x, 7 - z);
      scene.add(g);
      const sign = { view, group: g, glow: 0, glowTo: 0, mats: [own2] };
      g.traverse((m) => { if (m.isMesh) { m.userData.sign = sign; pickables.push(m); } });
      signs.push(sign);
    }

    /* Noor, the guide: a small warm light that keeps you company inside. Tap it to talk. */
    const noor = new THREE.Group();
    const haloTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,236,206,1)'); gr.addColorStop(.25, 'rgba(255,214,160,.55)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    /* A glow and a brighter heart, both sprites; an invisible ball takes the taps. */
    const noorCore = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 8), own(new THREE.MeshBasicMaterial({ visible: false })));
    const noorHalo = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .85 })));
    const noorHeart = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xfff6ea })));
    noorHalo.scale.setScalar(.46); noorHeart.scale.setScalar(.13);
    noor.add(noorHalo, noorHeart, noorCore);
    noor.visible = false; noor.scale.setScalar(.001);
    noorCore.userData.noor = true; pickables.push(noorCore);
    scene.add(noor);
    let noorOn = 0;
    const fwd = new V3(), side = new V3(), want = new V3();
    function stepNoor(now, dt) {
      const show = mode === 'inside' && !flight ? 1 : 0;
      noorOn += (show - noorOn) * Math.min(1, dt * 5);
      noor.visible = noorOn > .02;
      if (!noor.visible) return;
      cam.getWorldDirection(fwd); side.crossVectors(fwd, UP).normalize();
      want.copy(cam.position).addScaledVector(fwd, 2.1).addScaledVector(side, -1.05);
      want.y = cam.position.y - .44 + (reduce ? 0 : Math.sin(now / 900) * .035);
      noorHalo.material.opacity = .7 + (reduce ? 0 : Math.sin(now / 650) * .12);
      if (noorOn < .1) noor.position.copy(want); else noor.position.lerp(want, 1 - Math.pow(.04, dt));
      noor.scale.setScalar(Math.max(.001, noorOn) * (1 + (hovered && hovered.noor ? .18 : 0)));
    }

    /* Floating motes: dust in the sun by day, fireflies by night. */
    const NM = mobile ? 140 : 300, mp = [], ms = [];
    for (let i = 0; i < NM; i++) {
      const inside = i % 3 === 0;
      mp.push(inside ? (Math.random() - .5) * 22 : (Math.random() - .5) * 60, inside ? .4 + Math.random() * 3.6 : .3 + Math.random() * 3, inside ? (Math.random() - .5) * 15 : 9 + Math.random() * 24);
      ms.push(Math.random());
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    moteGeo.setAttribute('seed', new THREE.Float32BufferAttribute(ms, 1));
    const moteU = { uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 1 } };
    const motes = new THREE.Points(moteGeo, new THREE.ShaderMaterial({
      uniforms: moteU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float seed; uniform float uTime; uniform float uNight; uniform float uScale; varying float vA;
        void main(){
          vec3 p = position; float t = uTime * (.12 + seed * .18) + seed * 40.0;
          p += vec3(sin(t) * .6, sin(t * 1.3 + seed * 6.0) * .35, cos(t * .8) * .6);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float blink = .55 + .45 * sin(uTime * (1.2 + seed * 2.0) + seed * 20.0);
          vA = mix(.22, blink, uNight);
          gl_PointSize = mix(2.2, 5.5, uNight) * uScale * (12.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uNight; varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0.0, d) * vA; gl_FragColor = vec4(mix(vec3(1.0, .93, .82), vec3(1.0, .78, .45), uNight) * a, a); }`
    }));
    motes.frustumCulled = false;
    scene.add(motes);

    /* ---------- Day and night ---------- */
    const C = (h) => new THREE.Color(h);
    const DAY = { top: C(0xd8c3b2), mid: C(0xf6eadf), low: C(0xeedfd0), sun: C(0xfff0dc), fog: C(0xf3e7db), hemiS: C(0xfff8f1), hemiG: C(0xe9d9c8), sunC: C(0xffeedb) };
    const NIGHT = { top: C(0x140c09), mid: C(0x3b2318), low: C(0x24160f), sun: C(0x6a4a33), fog: C(0x2c1b13), hemiS: C(0x9a8272), hemiG: C(0x3a281e), sunC: C(0xcdb8a2) };
    let night = 0, nightFrom = 0, nightTo = 0, nightT = 1, nightDur = 1;
    const tmp = new THREE.Color();
    function applyNight(n) {
      night = n;
      skyU.uTop.value.lerpColors(DAY.top, NIGHT.top, n);
      skyU.uMid.value.lerpColors(DAY.mid, NIGHT.mid, n);
      skyU.uLow.value.lerpColors(DAY.low, NIGHT.low, n);
      skyU.uSunCol.value.lerpColors(DAY.sun, NIGHT.sun, n);
      skyU.uGlow.value = 1 - n * .85;
      scene.fog.color.lerpColors(DAY.fog, NIGHT.fog, n);
      hemi.color.lerpColors(DAY.hemiS, NIGHT.hemiS, n); hemi.groundColor.lerpColors(DAY.hemiG, NIGHT.hemiG, n);
      hemi.intensity = lerp(.85, .44, n);
      sun.color.lerpColors(DAY.sunC, NIGHT.sunC, n); sun.intensity = lerp(2.9, .22, n);
      fill.intensity = lerp(.45, .08, n);
      scene.environmentIntensity = lerp(.5, .26, n);
      stars.material.opacity = smooth(.45, 1, n);
      logoMat.emissiveIntensity = lerp(0, 2.2, smooth(.3, 1, n));
      lampGlow.emissiveIntensity = lerp(0, 3, smooth(.3, 1, n));
      spill.intensity = lerp(0, 34, smooth(.3, 1, n));
      blobMat.opacity = lerp(.75, .95, n);
      ceil.emissiveIntensity = lerp(.3, .08, n);
      moteU.uNight.value = n;
      const lit = smooth(.2, 1, n);
      for (const p of pieces) for (const m of p.group.userData.glow) m.emissiveIntensity = lerp(.06, 2.4, lit);
      for (const l of lamps) l.light.intensity = lerp(.15, 6.2, lit) * l.power;
      renderer.toneMappingExposure = lerp(1, 1.12, n);
    }
    function setNight(on, instant) {
      nightFrom = night; nightTo = on ? 1 : 0; nightT = 0; nightDur = instant || reduce ? 1 : 2200;
      if (instant || reduce) { applyNight(nightTo); nightT = 1; }
    }

    /* ---------- Camera ---------- */
    const cur = { pos: new V3(), tgt: new V3(), fov: 46 };
    const off = { x: 0, y: 0, tx: 0, ty: 0 };
    let mode = 'outside';
    let flight = null;
    let size = { w: 1, h: 1 };
    const introPose = () => {
      /* Wide screens see the whole front; tall ones the three middle arches. */
      const aspect = size.w / size.h, vf = 46 * P / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
      const d = Math.max(24, (aspect < 1 ? 7.6 : 13.6) / Math.tan(hf / 2));
      return { pos: new V3(0, 3 + d * .045, 7 + d), tgt: new V3(0, aspect < 1 ? 3.8 : 3.1, 0), fov: 46 };
    };
    function applyCamera() {
      cam.position.copy(cur.pos); cam.lookAt(cur.tgt);
      if (cam.fov !== cur.fov) { cam.fov = cur.fov; cam.updateProjectionMatrix(); }
      if (Math.abs(off.x) > .5 || Math.abs(off.y) > .5) cam.setViewOffset(size.w, size.h, off.x, off.y, size.w, size.h);
      else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    }
    /* A flight: position and aim travel together; `via` bends the path through a point (the doorway). */
    function fly(to, ms = 1600, via, onStep) {
      return new Promise((done) => {
        if (flight) flight.done();
        const from = { pos: cur.pos.clone(), tgt: cur.tgt.clone(), fov: cur.fov };
        const d = reduce ? 1 : ms;
        flight = { t0: performance.now(), d, from, to, via, onStep, done };
      });
    }
    function stepFlight(now) {
      if (!flight) return;
      const f = flight, k = clamp((now - f.t0) / f.d, 0, 1), e = EASE.inOut(k);
      if (f.via) {
        const a = f.from.pos, b = f.via, c = f.to.pos, u = 1 - e;
        cur.pos.set(u * u * a.x + 2 * u * e * b.x + e * e * c.x, u * u * a.y + 2 * u * e * b.y + e * e * c.y, u * u * a.z + 2 * u * e * b.z + e * e * c.z);
      } else cur.pos.lerpVectors(f.from.pos, f.to.pos, e);
      cur.tgt.lerpVectors(f.from.tgt, f.to.tgt, e);
      cur.fov = lerp(f.from.fov, f.to.fov || f.from.fov, e);
      if (f.onStep) f.onStep(k);
      if (k >= 1) { flight = null; f.done(); }
    }
    const view = (name) => { const [p, t] = VIEWS[name]; return { pos: new V3(...p), tgt: new V3(...t), fov: 50 }; };

    /* Look around (inside) and turn around a piece (focused), with a little glide after release. */
    const spin = { yaw: 0, pitch: 0 };
    function look(dx, dy) {
      const d = cur.tgt.clone().sub(cur.pos), len = d.length();
      let yaw = Math.atan2(d.x, d.z), pitch = Math.asin(clamp(d.y / len, -1, 1));
      yaw -= dx; pitch = clamp(pitch + dy, -.62, .5);
      cur.tgt.set(cur.pos.x + Math.sin(yaw) * Math.cos(pitch) * len, cur.pos.y + Math.sin(pitch) * len, cur.pos.z + Math.cos(yaw) * Math.cos(pitch) * len);
    }
    function orbit(dx, dy) {
      const d = cur.pos.clone().sub(cur.tgt), r = d.length();
      let az = Math.atan2(d.x, d.z), el = Math.acos(clamp(d.y / r, -1, 1));
      az -= dx * 1.4; el = clamp(el - dy * 1.4, .35, 1.52);
      cur.pos.set(cur.tgt.x + r * Math.sin(el) * Math.sin(az), cur.tgt.y + r * Math.cos(el), cur.tgt.z + r * Math.sin(el) * Math.cos(az));
      cur.pos.x = clamp(cur.pos.x, -R.x + .35, R.x - .35); cur.pos.z = clamp(cur.pos.z, -R.z + .35, R.z + 3);
    }

    /* ---------- Pointer ---------- */
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const ptr = { x: 0, y: 0, nx: 0, ny: 0, down: false, moved: 0, lx: 0, ly: 0, dirty: false, pts: new Map(), pinch: 0 };
    let hovered = null;
    function hit(cx, cy) {
      const r = canvas.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      cam.updateMatrixWorld();
      ray.setFromCamera(ndc, cam);
      const h = ray.intersectObjects(pickables, false).find((x) => x.object.visible && (!x.object.userData.noor || noor.visible));
      if (h) return h.object.userData.piece ? { piece: h.object.userData.piece, point: h.point } : h.object.userData.noor ? { noor: true } : { sign: h.object.userData.sign, point: h.point };
      const fh = ray.intersectObject(fl, false)[0];
      return fh ? { floor: fh.point } : null;
    }
    function onDown(e) {
      ptr.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptr.pts.size === 2) { const [a, b] = [...ptr.pts.values()]; ptr.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      ptr.down = true; ptr.moved = 0; ptr.lx = e.clientX; ptr.ly = e.clientY; spin.yaw = spin.pitch = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    }
    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.nx = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (ptr.pts.has(e.pointerId)) ptr.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptr.pts.size === 2 && mode !== 'outside') {
        const [a, b] = [...ptr.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (ptr.pinch) zoom((ptr.pinch - d) * .06);
        ptr.pinch = d; ptr.moved += 10; return;
      }
      if (ptr.down && mode !== 'outside' && !flight) {
        const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
        ptr.moved += Math.abs(dx) + Math.abs(dy);
        if (ptr.moved > 5) {
          const k = (mode === 'focus' ? 1.5 : 1.6) / size.h;
          spin.yaw = dx * k; spin.pitch = dy * k;
          if (mode === 'focus') orbit(spin.yaw, -spin.pitch); else look(spin.yaw, spin.pitch);
          canvas.style.cursor = 'grabbing';
        }
      }
      ptr.lx = e.clientX; ptr.ly = e.clientY; ptr.dirty = true;
    }
    function onUp(e) {
      ptr.pts.delete(e.pointerId);
      if (ptr.pts.size) return;
      const tap = ptr.moved < 7;
      ptr.down = false; ptr.pinch = 0;
      canvas.style.cursor = '';
      /* Keep a little of the last movement as a glide, never a spin. */
      spin.yaw *= .35; spin.pitch *= .35;
      if (!tap || mode === 'outside' || flight) return;
      spin.yaw = spin.pitch = 0;
      const h = hit(e.clientX, e.clientY);
      if (!h) return;
      if (h.piece && o.onPick) o.onPick(h.piece.slug, pieces.filter((p) => p.slug === h.piece.slug).indexOf(h.piece));
      else if (h.noor && o.onNoor) o.onNoor();
      else if (h.sign && o.onZone) o.onZone(h.sign.view);
      else if (h.floor && mode === 'inside') walk(h.floor);
    }
    function zoom(d) {
      if (mode === 'focus') {
        const dir = cur.pos.clone().sub(cur.tgt), r = clamp(dir.length() * (1 + d * .1), .9, 7);
        cur.pos.copy(cur.tgt).add(dir.setLength(r));
      } else if (mode === 'inside') cur.fov = clamp(cur.fov + d * 2.5, 30, 64);
    }
    const onWheel = (e) => { if (mode === 'outside') return; e.preventDefault(); zoom(Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 60)); };
    const onLeave = () => { ptr.nx = ptr.ny = 0; setHover(null); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const noorTarget = { noor: true, glowTo: 0, glow: 0, mats: [] };
    function setHover(h) {
      const piece = h && h.piece, sign = h && h.sign, next = piece || sign || (h && h.noor ? noorTarget : null);
      if (next !== hovered) {
        if (hovered) hovered.glowTo = 0;
        hovered = next;
        if (hovered) hovered.glowTo = 1;
        canvas.style.cursor = hovered ? 'pointer' : '';
      }
      if (o.onHover) o.onHover(piece ? { slug: piece.slug, x: ptr.x, y: ptr.y } : sign ? { sign: sign.view, x: ptr.x, y: ptr.y } : next === noorTarget ? { noor: true, x: ptr.x, y: ptr.y } : null);
    }
    function walk(point) {
      const to = new V3(clamp(point.x, -R.x + .9, R.x - .9), EYE, clamp(point.z, -R.z + .9, R.z - .4));
      const shift = to.clone().sub(cur.pos);
      if (shift.length() < .4) return;
      fly({ pos: to, tgt: cur.tgt.clone().add(shift), fov: cur.fov }, clamp(shift.length() * 260, 700, 1800));
    }

    /* ---------- Glow: hover, and a gentle pulse to show what can be touched ---------- */
    let pulseUntil = 0;
    const warm = new THREE.Color(0x8a5a32);
    function stepGlow(now, dt) {
      const pulsing = now < pulseUntil;
      const wave = pulsing ? (Math.sin((pulseUntil - now) / 260) * .5 + .5) * .55 : 0;
      for (const list of [pieces, signs]) for (const p of list) {
        const to = Math.max(p.glowTo, wave);
        if (Math.abs(to - p.glow) < .002 && !pulsing) continue;
        p.glow += (to - p.glow) * Math.min(1, dt * 9);
        for (const m of p.mats) { m.emissive.copy(warm).multiplyScalar(p.glow * .55); }
      }
    }

    /* ---------- Focus on a piece ---------- */
    let before = null;
    function focus(slug, which = 0) {
      const list = pieces.filter((p) => p.slug === slug), piece = list[which] || list[0];
      if (!piece) return Promise.resolve();
      if (mode !== 'focus') before = { pos: cur.pos.clone(), tgt: cur.tgt.clone(), fov: cur.fov };
      mode = 'focus';
      const b = new THREE.Box3().setFromObject(piece.group), c = b.getCenter(new V3()), s = b.getSize(new V3());
      const r = Math.max(.32, Math.hypot(s.x, s.z, s.y * .9) / 2);
      const turn = piece.group.rotation.y, front = new V3(Math.sin(turn), 0, Math.cos(turn));
      const toCam = cur.pos.clone().sub(c); toCam.y = 0;
      const side = Math.sign(front.x * toCam.z - front.z * toCam.x) || 1;
      const dir = front.applyAxisAngle(UP, -side * .45);
      /* Far enough that the piece fits the narrower of the two directions (tall screens are narrow). */
      const hHalf = Math.atan(Math.tan((42 * P) / 360) * (size.w / size.h));
      const dist = clamp(Math.max(r * 3.1, (r * 1.35) / Math.tan(hHalf)), 1.5, 8);
      const pos = c.clone().add(dir.multiplyScalar(dist));
      pos.y = clamp(c.y + r * .75 + .25, .75, 3.2);
      pos.x = clamp(pos.x, -R.x + .4, R.x - .4); pos.z = clamp(pos.z, -R.z + .4, R.z - .2);
      return fly({ pos, tgt: c, fov: 42 }, 1500);
    }
    function unfocus() {
      if (mode !== 'focus') return Promise.resolve();
      mode = 'inside';
      const back = before || view('entry');
      before = null;
      return fly(back, 1300);
    }
    /* Swap a piece's finish: rebuild it in place. */
    function setFinish(slug, finish) {
      for (const p of pieces) {
        if (p.slug !== slug) continue;
        const g = kit.build(slug, finish, p.row[5]);
        g.position.copy(p.group.position); g.rotation.copy(p.group.rotation);
        scene.remove(p.group);
        p.group.traverse((m) => { if (m.isMesh) { const i = pickables.indexOf(m); if (i >= 0) pickables.splice(i, 1); if (m.material && m.material.dispose) m.material.dispose(); } });
        scene.add(g); g.updateMatrixWorld(true);
        p.group = g; p.mats = []; p.glow = 0;
        g.traverse((m) => { if (m.isMesh) { m.userData.piece = p; pickables.push(m); if (!m.material.userData.glow && p.mats.indexOf(m.material) < 0) p.mats.push(m.material); } });
      }
      applyNight(night);
      renderer.shadowMap.needsUpdate = true;
    }

    /* ---------- Loop ---------- */
    let last = performance.now(), running = false, introDrift = null;
    const parallax = { x: 0, y: 0 };
    const perf = { t: 0, n: 0, good: 0 };
    function adapt(dtRaw) {
      perf.t += dtRaw; perf.n++;
      if (perf.t < 1) return;
      const avg = perf.t / perf.n; perf.t = perf.n = 0;
      const set = (v) => { dpr = v; perf.good = 0; renderer.setPixelRatio(dpr); moteU.uScale.value = dpr * (size.h / 900); };
      if (avg > 1 / 46 && dpr > .8) set(Math.max(.8, +(dpr - .15).toFixed(2)));
      else if (avg < 1 / 57) { if (++perf.good >= 3 && dpr < dprCap) set(Math.min(dprCap, +(dpr + .1).toFixed(2))); }
      else perf.good = 0;
    }
    function frame(now) {
      const dtRaw = (now - last) / 1000, dt = Math.min(.05, dtRaw); last = now;
      if (dtRaw < .5) adapt(dtRaw);
      if (nightT < 1) { nightT = Math.min(1, nightT + (dt * 1000) / nightDur); applyNight(lerp(nightFrom, nightTo, EASE.inOut(nightT))); }
      if (flight) stepFlight(now);
      else if (mode === 'outside') {
        const base = introDrift ? introDrift(now) : introPose();
        parallax.x += ((reduce ? 0 : ptr.nx) - parallax.x) * Math.min(1, dt * 2.2);
        parallax.y += ((reduce ? 0 : ptr.ny) - parallax.y) * Math.min(1, dt * 2.2);
        cur.pos.copy(base.pos).add(new V3(parallax.x * 1.8, -parallax.y * .7, 0));
        cur.tgt.copy(base.tgt); cur.fov = base.fov;
      } else if (!ptr.down && (Math.abs(spin.yaw) > 1e-4 || Math.abs(spin.pitch) > 1e-4) && !reduce) {
        if (mode === 'focus') orbit(spin.yaw, -spin.pitch); else look(spin.yaw, spin.pitch);
        const k = Math.pow(.86, dt * 60); spin.yaw *= k; spin.pitch *= k;
      }
      off.x += (off.tx - off.x) * Math.min(1, dt * 6); off.y += (off.ty - off.y) * Math.min(1, dt * 6);
      applyCamera();
      stepNoor(now, dt);
      sky.position.copy(cam.position);
      moteU.uTime.value = reduce ? 0 : now / 1000;
      if (ptr.dirty && !ptr.down && mode !== 'outside' && !flight) { ptr.dirty = false; setHover(hit(ptr.x, ptr.y)); }
      stepGlow(now, dt);
      renderer.render(scene, cam);
    }
    function start() { if (running) return; running = true; last = performance.now(); renderer.setAnimationLoop(frame); }
    function stop() { running = false; renderer.setAnimationLoop(null); }
    function resize() {
      const r = canvas.parentNode.getBoundingClientRect();
      size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
      renderer.setSize(size.w, size.h, false);
      cam.aspect = size.w / size.h; cam.updateProjectionMatrix();
      moteU.uScale.value = renderer.getPixelRatio() * (size.h / 900);
    }

    /* ---------- Enter ---------- */
    function intro() {
      const end = introPose(), t0 = performance.now(), d = reduce ? 1 : 7000;
      const startPos = end.pos.clone().add(new V3(0, 3.5, 9));
      introDrift = (now) => { const k = EASE.settle(clamp((now - t0) / d, 0, 1)); return { pos: startPos.clone().lerp(introPose().pos, k), tgt: end.tgt, fov: end.fov }; };
    }
    function enter() {
      introDrift = null;
      const to = view('entry');
      to.fov = 52;
      return fly(to, 3600, new V3(0, 2.3, 14), (k) => {
        const open = smooth(.28, .62, k);
        for (const d of doors) d.hinge.rotation.y = d.s * 1.32 * open; // they swing out onto the terrace
      }).then(() => { mode = 'inside'; pulseUntil = performance.now() + (reduce ? 0 : 2600); });
    }
    function goView(name) {
      if (!VIEWS[name]) return Promise.resolve();
      if (mode === 'focus') { mode = 'inside'; before = null; }
      return fly(view(name), 1700);
    }
    function setOffset(x, y) { off.tx = x || 0; off.ty = y || 0; }

    /* ---------- Clean up ---------- */
    function destroy() {
      stop();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('wheel', onWheel);
      scene.traverse((m) => {
        if (m.geometry) m.geometry.dispose();
        if (m.material) [].concat(m.material).forEach((mt) => { if (mt.map && mt.map.isCanvasTexture) mt.map.dispose(); mt.dispose(); });
      });
      if (scene.environment) scene.environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }

    resize();
    applyNight(0);
    Object.assign(cur, introPose());
    renderer.shadowMap.needsUpdate = true;

    return {
      start, stop, resize, intro, enter, focus, unfocus, setFinish, setNight, setOffset, destroy,
      view: goView,
      pulse(ms = 2600) { pulseUntil = performance.now() + (reduce ? 0 : ms); },
      /* For checking the layout while building: stand anywhere, look anywhere. */
      peek(p, t, fov = 50) { flight = null; introDrift = null; mode = 'inside'; cur.pos.set(...p); cur.tgt.set(...t); cur.fov = fov; },
      get mode() { return mode; },
      get night() { return nightTo; },
      count: (slug) => pieces.filter((p) => p.slug === slug).length,
      renderer, _scene: scene, _lamps: lamps
    };
  }

  /* ---------- A small turntable for the product panel ---------- */
  function viewer(THREE, canvas, kit, o) {
    const reduce = !!(o && o.reduce);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, .02, 60);
    const pm = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x9b8775, side: THREE.BackSide })));
    for (const [x, y, z, k] of [[0, 4.9, 0, 3], [4.9, 1, 2, 2], [-4.9, 1.5, 3, 1.4]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2e2).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); }
    scene.environment = pm.fromScene(env, .03).texture; pm.dispose();
    scene.environmentIntensity = .75;
    const key = new THREE.DirectionalLight(0xfff0e0, 2.2); key.position.set(2.5, 4, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -.0005; key.shadow.normalBias = .02;
    scene.add(key, new THREE.HemisphereLight(0xfff4ea, 0xd8c2aa, .7));
    const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: .18 }));
    ground.receiveShadow = true; scene.add(ground);
    const holder = new THREE.Group(); scene.add(holder);
    let model = null, spinV = reduce ? 0 : .22, drag = null, last = performance.now(), running = false, dist = 3, aim = new THREE.Vector3(), userSpun = false;
    function fit() {
      const b = new THREE.Box3().setFromObject(holder), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      const r = Math.max(.15, s.length() / 2);
      dist = r / Math.sin((cam.fov * Math.PI / 180) / 2) * 1.08;
      aim.set(0, c.y, 0);
      const k = key.shadow.camera; k.left = k.bottom = -r * 1.6; k.right = k.top = r * 1.6; k.near = .1; k.far = 20; k.updateProjectionMatrix();
      key.target.position.copy(aim); key.position.set(aim.x + 2.5 * r, aim.y + 4 * r, aim.z + 3 * r);
    }
    function show(slug, finish) {
      if (model) { holder.remove(model); model.traverse((m) => { if (m.isMesh && m.material.dispose) m.material.dispose(); }); }
      model = kit.build(slug, finish, { drop: .25 });
      if (!model) return;
      const b = new THREE.Box3().setFromObject(model), c = b.getCenter(new THREE.Vector3());
      model.position.set(-c.x, -b.min.y + (b.min.y > .05 ? 0 : 0), -c.z);
      for (const m of model.userData.glow) m.emissiveIntensity = .9;
      holder.rotation.y = userSpun ? holder.rotation.y : -.5;
      holder.add(model);
      fit();
    }
    const down = (e) => { drag = { x: e.clientX, v: 0 }; spinV = 0; userSpun = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* gone */ } };
    const move = (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; holder.rotation.y += dx * .012; drag.v = dx * .012 * 60; };
    const up = () => { if (drag) spinV = reduce ? 0 : drag.v; drag = null; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!drag && spinV) { holder.rotation.y += spinV * dt; spinV *= userSpun ? Math.pow(.25, dt) : 1; if (Math.abs(spinV) < .002) spinV = 0; }
      const el = .32;
      cam.position.set(aim.x, aim.y + Math.sin(el) * dist, aim.z + Math.cos(el) * dist);
      cam.lookAt(aim);
      renderer.render(scene, cam);
    }
    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
    }
    return {
      show, resize,
      start() { if (running) return; running = true; last = performance.now(); renderer.setAnimationLoop(frame); },
      stop() { running = false; renderer.setAnimationLoop(null); },
      destroy() {
        renderer.setAnimationLoop(null);
        canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
        scene.traverse((m) => { if (m.material && m.material.dispose) m.material.dispose(); });
        if (scene.environment) scene.environment.dispose();
        renderer.dispose(); renderer.forceContextLoss();
      }
    };
  }

  window.DECO_SCENE = { create, viewer, LAYOUT, VIEWS };
})();
