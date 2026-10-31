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
    ['cove-side-table', 1.56, -5.6, 0, 0, { tag: 'floor' }],
    ['arc-floor-lamp', -.95, -5.95, 0],
    ['puff-ottoman', 2.3, -3.55, 0],
    ['wall-art', 0, -6.93, 0, 1.78],
    ['wall-sconce', -1.85, -6.93, 0, 1.72],
    ['wall-sconce', 1.85, -6.93, 0, 1.72],
    // Bedroom, back left
    ['vale-bed', -8.05, -5.9, 0],
    ['luna-headboard-bed', -5.05, -5.9, 0],
    ['stone-nightstand', -9.5, -6.7, 0, 0, { tag: 'floor' }],
    ['luna-table-lamp', -9.5, -6.7, 0, .55],
    ['tomo-nightstand', -6.6, -6.72, 0, 0, { tag: 'floor' }],
    ['stone-table-lamp', -6.6, -6.72, 0, .5],
    ['mini-storage', -3.6, -6.7, 0],
    ['curve-bedroom-bench', -8.05, -4.33, 0],
    ['throw-blanket', -7.9, -4.33, .14, .45],
    ['dune-dresser', -9.7, -2.6, P / 2, 0, { tag: 'floor' }],
    ['arco-mirror', -9.85, -.85, P / 2],
    // Dining, back right
    ['terra-dining-table', 6.8, -4.1, 0, 0, { tag: [.88, .38, .75] }],
    ['vale-dining-chair', 6.25, -4.92, 0], ['vale-dining-chair', 7.35, -4.92, 0],
    ['vale-dining-chair', 6.25, -3.28, P, 0, { tag: false }], ['vale-dining-chair', 7.35, -3.28, P, 0, { tag: false }],
    ['mod-dining-chair', 5.48, -4.1, P / 2, 0, { tag: false }], ['mod-dining-chair', 8.12, -4.1, -P / 2],
    ['terra-bowl', 6.8, -4.1, 0, .75],
    ['dune-pendant-light', 6.25, -4.1, 0, 1.55, { drop: 3.15 }],
    ['terra-pendant-light', 7.35, -4.1, 0, 1.62, { drop: 3.18 }],
    ['vale-sideboard', 6.8, -6.72, 0, 0, { tag: [.05, .12, .75] }],
    // Left wall
    ['tomo-bookshelf', -9.76, .9, P / 2],
    ['arc-cabinet', -9.72, 2.55, P / 2],
    ['nora-display-shelf', -9.78, 4.0, P / 2],
    ['cloud-cabinet', -9.72, 5.6, P / 2],
    ['arco-wall-mirror', -9.99, 5.6, P / 2, 1.42],
    // Right wall
    ['ridge-tv-unit', 9.72, .3, -P / 2, 0, { tag: 'floor' }],
    ['decor-set', 9.75, .85, -P / 2, .4],
    ['ridge-console-table', 9.76, 3.0, -P / 2, 0, { tag: 'floor' }],
    ['luna-table-lamp', 9.76, 3.0, -P / 2, .78],
    // The stage by the door: two chairs worth walking round
    ['arco-lounge-chair', -.85, 1.05, face(-.85, 1.05, .2, 3.6), .1, { base: 1 }],
    ['nora-accent-chair', .85, 1.05, face(.85, 1.05, -.2, 3.6), .1, { base: 1 }],
    ['pebble-side-table', 0, .5, 0, .1, { base: 1 }],
    // Reading corner, front left
    ['lua-coffee-table', -5.4, 3.1, 0],
    ['curve-bench', -5.4, 1.95, 0],
    ['nest-tables', -7.05, 3.35, 0],
    ['orbit-floor-lamp', -7.15, 2.0, 0],
    // Objects on plinths, front right
    ['stone-vase', 4.6, 3.0, 0, .9],
    ['terra-bowl', 5.5, 3.6, 0, .6],
    ['luna-planter', 4.9, 4.25, 0, .35],
    ['decor-set', 5.95, 2.72, -.3, .75],
    ['stone-vase', 3.95, 3.85, 0, .5],
    // Rugs under the bed, the table and the reading corner, as a showroom lays them
    ['textured-rug', -5.05, -4.75, P / 2],
    ['textured-rug', 6.8, -4.1, P / 2],
    ['textured-rug', -5.6, 2.75, P / 2],
    // Finishes: the same pieces in their other colours, on a low stone platform
    ['mira-lounge-chair', 4.1, -1.2, 0, .12, { finish: 'terracotta', base: 1 }],
    ['mira-lounge-chair', 5.05, -1.2, 0, .12, { finish: 'olive', base: 1 }],
    ['puff-ottoman', 5.92, -1.15, 0, .12, { finish: 'natural', base: 1 }],
    ['puff-ottoman', 6.64, -1.15, 0, .12, { finish: 'olive', base: 1 }],
    ['nora-accent-chair', 7.5, -1.2, 0, .12, { finish: 'terracotta', base: 1 }],
    // Lighting: two lamps on a stone table under three pendants
    ['luna-table-lamp', -6.7, -1.2, 0, .72],
    ['stone-table-lamp', -6.1, -1.55, 0, .72],
    ['dune-pendant-light', -6.75, -1.55, 0, 1.75, { drop: 2.95 }],
    ['terra-pendant-light', -6.0, -1.0, 0, 2.05, { drop: 2.75 }],
    ['dune-pendant-light', -6.45, -.72, 0, 2.4, { drop: 2.3 }],
    // More to sit on and to dress the beds and shelves with
    ['arco-lounge-chair', -3.95, 3.5, face(-3.95, 3.5, -5.4, 3.0), 0, { finish: 'olive' }],
    ['cushion-collection', -5.05, -6.2, 0, .6, { finish: 'natural' }],
    ['stone-vase', -9.68, -3.0, P / 2, .8],
    ['terra-bowl', 9.74, 3.36, 0, .78],
    // The bill counter, front right: a vase at its end and two pendants over it
    ['stone-vase', 7.75, 4.42, 0, 1.01],
    ['terra-pendant-light', 7.75, 4.7, 0, 1.95, { drop: 2.85 }],
    ['terra-pendant-light', 7.75, 5.85, 0, 1.95, { drop: 2.85 }]
  ];
  const PLINTHS = [[4.6, 3.0, .9, .26], [5.5, 3.6, .6, .3], [4.9, 4.25, .35, .3], [5.95, 2.72, .75, .26], [3.95, 3.85, .5, .28]];
  const STAGE = [0, .95, 1.75];
  /* The counter where the bag becomes a bill: centre, and its front turned to face the room (−x). */
  const CTR = { x: 7.75, z: 5.25, turn: -P / 2, L: 2.2, D: .65, H: .96 };
  /* Things a shop is dressed with: [prop, x, z, turn, y, options]. Not for sale and not touchable. */
  const PROPS = [
    ['books', -.22, -3.9, .35, .38, { n: 3, seed: 1 }],
    ['ceramics', .26, -4.12, 0, .38, { seed: 2, n: 2 }],
    ['candles', 1.56, -5.6, 0, .55, { n: 2 }],
    ['setting', 6.25, -4.43, P, .75], ['setting', 7.35, -4.43, P, .75], ['setting', 6.25, -3.77, 0, .75], ['setting', 7.35, -3.77, 0, .75],
    ['setting', 6.0, -4.1, -P / 2, .75], ['setting', 7.6, -4.1, P / 2, .75],
    ['tapers', 6.46, -4.1, 0, .75], ['tapers', 7.14, -4.1, 0, .75],
    ['fruit', 6.8, -4.1, 0, .785],
    ['ceramics', 7.28, -6.72, 0, .75, { seed: 4 }], ['books', 6.3, -6.7, -.2, .75, { n: 2, seed: 3 }],
    ['ceramics', -9.68, -2.2, P / 2, .8, { seed: 5, n: 2 }],
    ['books', 9.7, -.25, -P / 2 + .2, .4, { n: 3, seed: 6 }],
    ['books', -5.22, 3.0, .5, .32, { n: 2, seed: 7 }], ['candles', -5.64, 3.24, 0, .32, { n: 3 }],
    ['ceramics', -7.05, 3.35, 0, .5, { seed: 8, n: 2 }],
    ['olive', -2.6, -6.4], ['olive', 3.6, -6.4], ['olive', -2.0, 6.45], ['olive', 2.0, 6.45], ['olive', -8.6, 6.5],
    ['fig', 9.3, 6.45, 0, 0, { seed: 2 }], ['fig', -9.45, -.05, 0, 0, { seed: 9, s: .9 }],
    ['platform', 5.8, -1.2, 0, 0, { w: 4.55, d: 1.1, h: .12 }],
    ['pedestal', -6.4, -1.3, 0, 0, { r: .65, h: .72 }],
    ['backbar', 9.68, 5.25, -P / 2]
  ];

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
    wall: [[5.4, 1.65, 4.6], [9.8, 1.0, 1.6]],
    finishes: [[5.8, 1.6, 2.4], [5.8, .42, -1.2]],
    lighting: [[-3.7, 1.6, 1.3], [-6.4, 1.25, -1.2]],
    materials: [[-3.3, 1.62, 3.6], [-5.6, .62, 5.5]],
    counter: [[5.55, 1.62, 4.65], [7.75, 1.0, 5.25]]
  };
  /* Hanging signs: [label, line, view, x, z]. */
  const SIGNS = [
    ['Living', 'Sofas, chairs and tables', 'living', 0, -3.3],
    ['Bedroom', 'Beds and nightstands', 'bedroom', -6.55, -3.4],
    ['Dining', 'Table, chairs, pendants', 'dining', 6.8, -2.2],
    ['Storage', 'Shelves and cabinets', 'storage', -8.4, 3.0],
    ['Reading corner', 'Low tables and lamps', 'reading', -5.4, 1.0],
    ['Objects', 'Stone, clay and green', 'objects', 5.05, 2.3],
    ['Finishes', 'One piece, three colours', 'finishes', 5.8, -.6],
    ['Lighting', 'Lamps and pendants', 'lighting', -4.85, -1.25],
    ['Materials', 'Free samples, up to four', 'materials', -5.6, 4.55],
    ['Bill counter', 'Pay for your pieces here', 'counter', 6.95, 5.25]
  ];

  function create(THREE, o) {
    const V3 = THREE.Vector3, UP = new V3(0, 1, 0);
    const { canvas, kit, catalog } = o;
    const mobile = !!o.mobile, reduce = !!o.reduce;
    const post = o.post || null;

    /* ---------- Renderer ---------- */
    /* With post effects the scene renders into its own multisampled buffer, so the canvas needs no antialiasing. */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !post, powerPreference: 'high-performance' });
    /* Resolution follows the frame rate: it starts modest on dense screens and climbs, up to twice the CSS
       pixels on desktop (a 4K frame in a 1080p window), only while frames stay quick. */
    const dprCap = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    let dpr = Math.min(dprCap, 1.25);
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(46, 1, .05, 1200);
    const aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const pmrem = new THREE.PMREMGenerator(renderer);
    const fxp = { composer: null, gtao: null, bloom: null };   // post effects, when they loaded

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
      const tex = pmrem.fromScene(s, .04).texture;
      room.geometry.dispose();
      return tex;
    }
    const studioEnv = envMap();
    scene.environment = studioEnv;
    /* Once the scans have loaded, the room itself is captured from its middle, by day and by night, so
       stone, brass, glass and the polished floor reflect the arches, the sky and the lamps that are really there. */
    const roomEnv = { day: null, night: null };

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
    /* The shadow map is drawn once (nothing in the room moves), so a sharp one costs memory, not frames. */
    const shadowRes = mobile ? 2048 : 4096;
    sun.shadow.mapSize.set(shadowRes, shadowRes);
    Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 24, bottom: -18, near: 5, far: 110 });
    sun.shadow.bias = -.0003; sun.shadow.normalBias = .025; sun.shadow.radius = mobile ? 2.5 : 3.5;
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
    const groundGeo = new THREE.PlaneGeometry(900, 900, mobile ? 120 : 160, mobile ? 120 : 160).rotateX(-P / 2);
    const gp = groundGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) gp.setY(i, dune(gp.getX(i), gp.getZ(i)));
    groundGeo.computeVertexNormals();
    const sand = own(new THREE.MeshStandardMaterial({ color: 0xe4ccb1, roughness: 1 }));
    const ground = mesh(groundGeo, sand, false);
    scene.add(ground);

    /* Terrace and path in travertine. */
    const stone = own(kit.surface('travertine', 0xf6f0e8, 2.2));
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
    /* Lime plaster: soft clouds of wash and a fine sand grain, drawn once and tiled without seams.
       The grain also lifts the surface a fraction of a millimetre, so walls look troweled in raking light. */
    const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
    function plasterTexture() {
      const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d'), rnd = seeded(23);
      x.fillStyle = 'rgb(234,234,234)'; x.fillRect(0, 0, S, S);
      const wrap = (fn, px, py, r) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if (px + dx + r > 0 && px + dx - r < S && py + dy + r > 0 && py + dy - r < S) fn(px + dx, py + dy); };
      for (let i = 0; i < 110; i++) {
        const px = rnd() * S, py = rnd() * S, r = 50 + rnd() * 230, v = rnd() > .5 ? 255 : 200, a = .03 + rnd() * .05;
        wrap((qx, qy) => { const g = x.createRadialGradient(qx, qy, 0, qx, qy, r); g.addColorStop(0, `rgba(${v},${v},${v},${a})`); g.addColorStop(1, `rgba(${v},${v},${v},0)`); x.fillStyle = g; x.fillRect(qx - r, qy - r, r * 2, r * 2); }, px, py, r);
      }
      x.lineCap = 'round';
      for (let i = 0; i < 70; i++) {
        const px = rnd() * S, py = rnd() * S, len = 80 + rnd() * 180, a = rnd() * P, v = rnd() > .5 ? 250 : 214;
        wrap((qx, qy) => { x.strokeStyle = `rgba(${v},${v},${v},${.03 + rnd() * .04})`; x.lineWidth = 10 + rnd() * 26; x.beginPath(); x.moveTo(qx, qy); x.quadraticCurveTo(qx + Math.cos(a) * len * .5 + 20, qy + Math.sin(a) * len * .5 - 20, qx + Math.cos(a) * len, qy + Math.sin(a) * len); x.stroke(); }, px, py, len + 30);
      }
      const img = x.getImageData(0, 0, S, S), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (rnd() - .5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      x.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
      return t;
    }
    const plasterTex = plasterTexture();
    const limewash = (color, extra) => own(kit.triplanar(new THREE.MeshStandardMaterial(Object.assign({ color, map: plasterTex, roughness: .95 }, extra)), .42, .012, .2));
    const plaster = limewash(0xf6efe7);
    const plasterOut = limewash(0xf1e6d9);
    /* The ceiling only sees bounced light; a little of its own glow stands in for it. */
    const ceil = limewash(0xf6efe7, { emissive: 0xf3e4d2, emissiveIntensity: .3 });
    const bronze = own(new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: .36, metalness: .8 }));
    const glass = own(new THREE.MeshStandardMaterial({ color: 0xfff8f0, transparent: true, opacity: .1, roughness: .03, metalness: .2, depthWrite: false, side: THREE.DoubleSide }));

    /* Floor: large honed travertine tiles, drawn once on canvas (the scan reads as wood at this size).
       Cross-cut stone: each tile clouded in its own way, with faint veins, open pores and recessed joints. */
    function tileTexture() {
      const S = 2048, c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d'), n = 4, t = S / n, rnd = seeded(11);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x0 = i * t, y0 = j * t, v = 239 + Math.round(rnd() * 8 - 4);
        x.save(); x.beginPath(); x.rect(x0, y0, t, t); x.clip();
        x.fillStyle = `rgb(${v},${v - 7},${v - 15})`; x.fillRect(x0, y0, t, t);
        /* Clouds: soft lighter and darker patches, as cross-cut stone has. */
        for (let k = 0; k < 34; k++) {
          const cx = x0 + rnd() * t, cy = y0 + rnd() * t, r = 30 + rnd() * 150, col = rnd() > .5 ? '198,174,148' : '255,251,245', a = .05 + rnd() * .07;
          const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
          x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
        /* A few faint wandering veins. */
        x.lineCap = 'round'; x.lineJoin = 'round';
        for (let k = 0; k < 6; k++) {
          let px = x0 + rnd() * t, py = y0 + rnd() * t, a = rnd() * P * 2;
          x.strokeStyle = `rgba(172,144,116,${.05 + rnd() * .07})`; x.lineWidth = .8 + rnd() * 2.2;
          x.beginPath(); x.moveTo(px, py);
          for (let k2 = 0; k2 < 14; k2++) { a += (rnd() - .5) * .9; px += Math.cos(a) * 14; py += Math.sin(a) * 14; x.lineTo(px, py); }
          x.stroke();
        }
        /* Pores: the open holes of travertine, mostly small, a few long. */
        for (let k = 0; k < 1300; k++) {
          const a = .08 + rnd() * .22, big = rnd() > .97;
          x.fillStyle = rnd() > .2 ? `rgba(150,120,94,${a})` : `rgba(118,90,68,${a + .08})`;
          x.beginPath(); x.ellipse(x0 + rnd() * t, y0 + rnd() * t, big ? 3 + rnd() * 7 : .7 + rnd() * 2.4, .5 + rnd() * 1.2, rnd() * P, 0, P * 2); x.fill();
        }
        x.restore();
      }
      x.fillStyle = 'rgba(150,126,104,.85)';
      for (let i = 0; i <= n; i++) { x.fillRect(i * t - 2, 0, 4, S); x.fillRect(0, i * t - 2, S, 4); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = aniso;
      return tex;
    }
    /* Tiles of 90 cm, four to a texture; joints sit on the room's centre lines. */
    const floorMat = own(kit.triplanar(new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: .36 }), 1 / 3.6, .0035, .9));
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
    /* A low stone skirting where the walls meet the floor, piers included. */
    const skirt = (w, x, z, ry) => { const s = mesh(kit.roundedBox(w, .1, .018, .006, 1), stone); s.position.set(x, .05, z); s.rotation.y = ry; s.castShadow = false; walls.add(s); };
    skirt(R.x * 2, 0, -R.z + .009, 0);
    skirt(R.z * 2, -R.x + .009, 0, P / 2); skirt(R.z * 2, R.x - .009, 0, P / 2);
    for (const [a, b] of [[-R.x, -9.65], [-6.35, -5.65], [-2.35, -1.65], [1.65, 2.35], [5.65, 6.35], [9.65, R.x]]) skirt(b - a, (a + b) / 2, R.z - .009, 0);
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

    /* Shafts of late sun through the skylights and the arches: soft beams in the dusty air, by day only.
       Each is the opening's outline swept along the sun; faces fade edge-on and close to the eye. */
    const sunDir = sun.target.position.clone().sub(sun.position).normalize();
    const shaftU = { uOn: { value: 1 }, uCol: { value: new THREE.Color(0xffdcb4) } };
    const shaftMat = own(new THREE.ShaderMaterial({
      uniforms: shaftU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute float along; varying float vA; varying vec3 vN; varying vec3 vV;
        void main(){ vA = along; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform float uOn; uniform vec3 uCol; varying float vA; varying vec3 vN; varying vec3 vV;
        void main(){
          float face = abs(dot(normalize(vN), normalize(vV)));
          float k = clamp(1.0 - vA, 0.0, 1.0), a = pow(face, 1.6) * k * sqrt(k) * smoothstep(0.0, .05, vA) * smoothstep(.8, 3.2, length(vV)) * uOn * .05;
          gl_FragColor = vec4(uCol, a);
        }`
    }));
    function shaft(outline, len) {
      const pos = [], al = [], d = sunDir.clone().multiplyScalar(len);
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length], a2 = a.clone().add(d), b2 = b.clone().add(d);
        for (const [p, t] of [[a, 0], [b, 0], [b2, 1], [a, 0], [b2, 1], [a2, 1]]) { pos.push(p.x, p.y, p.z); al.push(t); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('along', new THREE.Float32BufferAttribute(al, 1));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, shaftMat); m.renderOrder = 2; m.frustumCulled = false;
      return m;
    }
    const shafts = new THREE.Group(); scene.add(shafts);
    for (const x of [-6.5, 0, 6.5]) shafts.add(shaft([new V3(x - 2.2, R.h, -2.2), new V3(x + 2.2, R.h, -2.2), new V3(x + 2.2, R.h, .2), new V3(x - 2.2, R.h, .2)], R.h / -sunDir.y));
    for (const c of BAYS) shafts.add(shaft(archPts(c, R.z - .02), (SPR + BW / 2) / -sunDir.y));
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

    /* ---------- Prices, drawn the way the site writes them ---------- */
    const fmt = (n) => new Intl.NumberFormat('en-GB').format(n);
    const cuts = {};
    /* The dirham sign from the page's sprite: the light cut beside light digits, the regular one beside regular. */
    function dirham(id) {
      if (cuts[id] !== undefined) return cuts[id];
      const sym = document.getElementById(id), p = sym && sym.querySelector('path'), vb = sym && (sym.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
      return (cuts[id] = p && vb && vb[3] ? { path: new Path2D(p.getAttribute('d')), w: vb[2], h: vb[3] } : null);
    }
    /* Sign at the digits' height (.78 em), a .22 em gap, then the number; py is the baseline. Returns the width. */
    function drawPrice(x, n, px, py, size, weight = 400, align = 'left') {
      const s = dirham(weight <= 300 ? 'dirham-light' : 'dirham-regular');
      x.font = `${weight} ${size}px Comfortaa, Quicksand, sans-serif`;
      const text = fmt(n), tw = x.measureText(text).width, sh = size * .78, sw = s ? sh * s.w / s.h : 0, gap = s ? size * .22 : 0, total = sw + gap + tw;
      const x0 = align === 'center' ? px - total / 2 : align === 'right' ? px - total : px;
      if (s) { x.save(); x.translate(x0, py - sh); x.scale(sh / s.h, sh / s.h); x.fill(s.path); x.restore(); }
      const ta = x.textAlign; x.textAlign = 'left'; x.fillText(text, x0 + sw + gap, py); x.textAlign = ta;
      return total;
    }
    const spaced = (s) => s.split('').join(String.fromCharCode(8202));
    function wrapLines(x, text, max) {
      const out = [];
      let line = '';
      for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > max && line) { out.push(line); line = w; } else line = t; }
      if (line) out.push(line);
      return out;
    }

    /* ---------- Price cards: a folded card at each piece, as a showroom labels things. One atlas for all. ---------- */
    const TAG = { cols: 4, rows: 12, w: 256, h: 160, W: .24, H: .15, tilt: .3 };
    const tagCanvas = document.createElement('canvas'); tagCanvas.width = TAG.cols * TAG.w; tagCanvas.height = TAG.rows * TAG.h;
    const tagCtx = tagCanvas.getContext('2d');
    tagCtx.fillStyle = '#F6EFE7'; tagCtx.fillRect(0, 0, tagCanvas.width, tagCanvas.height);
    const tagTex = new THREE.CanvasTexture(tagCanvas); tagTex.colorSpace = THREE.SRGBColorSpace; tagTex.anisotropy = aniso;
    const tagMat = own(new THREE.MeshStandardMaterial({ map: tagTex, roughness: .85 })); tagMat.userData.still = 1;
    const tagBack = own(new THREE.MeshStandardMaterial({ color: 0xf1e8de, roughness: .85 })); tagBack.userData.still = 1;
    const tagBackGeo = new THREE.PlaneGeometry(TAG.W, TAG.H).translate(0, -TAG.H / 2, 0);
    const tagCells = new Map();
    function tagGeo(slug) {
      if (tagCells.has(slug)) return tagCells.get(slug);
      const i = tagCells.size, c = i % TAG.cols, r = Math.floor(i / TAG.cols), p = catalog.bySlug[slug], x = tagCtx;
      const x0 = c * TAG.w, y0 = r * TAG.h;
      x.fillStyle = '#F6EFE7'; x.fillRect(x0, y0, TAG.w, TAG.h);
      x.strokeStyle = 'rgba(59,36,27,.16)'; x.lineWidth = 2; x.strokeRect(x0 + 9, y0 + 9, TAG.w - 18, TAG.h - 18);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillStyle = '#3B241B';
      x.font = '400 24px Comfortaa, Quicksand, sans-serif';
      const lines = wrapLines(x, p.name, TAG.w - 46).slice(0, 2);
      lines.forEach((l, k) => x.fillText(l, x0 + 23, y0 + 44 + k * 28));
      x.fillStyle = '#6F5446'; x.font = '700 12px Quicksand, sans-serif';
      x.fillText(spaced(p.lead === 'made' ? 'MADE TO ORDER' : 'IN STOCK'), x0 + 23, y0 + (lines.length > 1 ? 98 : 72));
      x.fillStyle = '#3B241B';
      drawPrice(x, p.price, x0 + 23, y0 + TAG.h - 25, 30, 400);
      tagTex.needsUpdate = true;
      const geo = new THREE.PlaneGeometry(TAG.W, TAG.H), uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + uv.getX(k)) / TAG.cols, 1 - (r + 1 - uv.getY(k)) / TAG.rows);
      geo.translate(0, -TAG.H / 2, 0);
      tagCells.set(slug, geo);
      return geo;
    }
    function tagMesh(slug) {
      const g = new THREE.Group(), t = TAG.tilt, h = TAG.H * Math.cos(t);
      const f = new THREE.Mesh(tagGeo(slug), tagMat); f.position.y = h; f.rotation.x = -t; f.receiveShadow = true; g.add(f);
      const b = new THREE.Mesh(tagBackGeo, tagBack); b.position.y = h; b.rotation.set(t, P, 0); b.receiveShadow = true; g.add(b);
      return g;
    }
    /* Rugs lift whatever stands on them by their pile. */
    const RUGS = LAYOUT.filter((r) => r[0] === 'textured-rug').map(([, x, z, t = 0]) => ({ x, z, c: Math.cos(t), s: Math.sin(t) }));
    const onRug = (x, z) => RUGS.some((r) => { const dx = x - r.x, dz = z - r.z; return Math.abs(dx * r.c - dz * r.s) < 1 && Math.abs(dx * r.s + dz * r.c) < 1.5; });
    /* The card sits where a hand would put it: on the seat, the bed or the top, front right; on the floor
       beside tall pieces and anything that already carries a lamp or a vase. */
    const probe = new THREE.Raycaster(), DOWN = new V3(0, -1, 0);
    function dress(piece) {
      const { group: g, row, slug } = piece, y0 = row[4] || 0, opt = row[5] || {};
      if (slug === 'textured-rug' || opt.tag === false || (y0 > 0 && !opt.base)) return;
      const turn = g.rotation.y; g.rotation.y = 0; g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g); g.rotation.y = turn; g.updateMatrixWorld(true);
      const lo = b.min.clone().sub(g.position), hi = b.max.clone().sub(g.position), sz = b.getSize(new V3());
      if (Math.max(sz.x, sz.z) < .34) return;
      let spot = null;
      if (Array.isArray(opt.tag)) spot = new V3(opt.tag[0], opt.tag[2] || 0, opt.tag[1]);
      else if (sz.y < 1.3 && opt.tag !== 'floor') {
        const lx = lerp((lo.x + hi.x) / 2, hi.x, .55), lz = lerp((lo.z + hi.z) / 2, hi.z, .5);
        probe.set(g.localToWorld(new V3(lx, hi.y + .5, lz)), DOWN);
        const meshes = []; g.traverse((m) => { if (m.isMesh && !m.material.transparent) meshes.push(m); });
        const n = new V3(), h = probe.intersectObjects(meshes, false).find((x) => x.face && n.copy(x.face.normal).transformDirection(x.object.matrixWorld).y > .6 && x.point.y < g.position.y + .95);
        if (h) spot = g.worldToLocal(h.point.clone());
      }
      if (!spot) spot = new V3(hi.x + .16, 0, hi.z - .12);
      const wp = g.localToWorld(spot.clone());
      if (!y0 && spot.y < .01 && onRug(wp.x, wp.z)) spot.y += .014;
      const t = tagMesh(slug); t.position.copy(spot); t.position.y += .002; t.rotation.y = .28;
      g.add(t);
      g.updateMatrixWorld(true);
    }

    /* ---------- The collection ---------- */
    const pieces = [];     // { slug, row, finish, group, blob }
    const pickables = [];  // meshes that answer the pointer
    const lamps = [];      // { light, power, piece }
    let lampBudget = mobile ? 3 : 6;
    function claim(piece) {
      piece.group.traverse((m) => { if (m.isMesh) { m.userData.piece = piece; pickables.push(m); if (!m.material.userData.glow && !m.material.userData.still && piece.mats.indexOf(m.material) < 0) piece.mats.push(m.material); } });
    }
    function place(row) {
      const [slug, x, z, turn = 0, y = 0, opt = {}] = row;
      const p = catalog.bySlug[slug];
      if (!p) return null;
      const finish = opt.finish && p.finishes.includes(opt.finish) ? opt.finish : p.finishes[0] || null;
      const g = kit.build(slug, finish, opt);
      if (!g) return null;
      g.position.set(x, y, z); g.rotation.y = turn;
      scene.add(g);
      g.updateMatrixWorld(true);
      const piece = { slug, row, finish, group: g, glow: 0, glowTo: 0, mats: [], box: new THREE.Box3().setFromObject(g) };
      dress(piece);
      claim(piece);
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
      const y0 = row[4] || 0, base = row[5] && row[5].base;
      if (!y0 || base) {
        const b = piece.box, s = b.getSize(new V3()), cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
        if (piece.slug !== 'textured-rug' && s.y > .2) piece.blob = blob(s.x * 1.25 + .2, s.z * 1.25 + .2, cx, cz, 0, y0 + (!y0 && onRug(cx, cz) ? .018 : .004));
      }
    }
    /* Lamps worth lighting first: the ones you see from the door. */
    /* Real lights are few (each costs every pixel); the other lamps glow without one. */
    [['arc-floor-lamp', 0], ['dune-pendant-light', 0], ['terra-pendant-light', 0], ['orbit-floor-lamp', 0], ['terra-pendant-light', 2], ['luna-table-lamp', 0], ['dune-pendant-light', 1], ['stone-table-lamp', 0]]
      .forEach(([slug, i]) => { const pc = pieces.filter((x) => x.slug === slug)[i]; if (pc) addLights(pc); });

    /* ---------- Dressing: books, ceramics, settings, plants and stands ---------- */
    const props = [];
    const PROP_BLOB = { olive: () => [1.1, 1.1], fig: (o) => [.95 * (o.s || 1), .95 * (o.s || 1)], platform: (o) => [o.w + .35, o.d + .4], pedestal: (o) => [o.r * 2.7, o.r * 2.7], backbar: () => [2.3, .8] };
    for (const [name, x, z, turn = 0, y = 0, opt = {}] of PROPS) {
      const g = kit.prop(name, opt);
      if (!g) continue;
      g.position.set(x, y, z); g.rotation.y = turn; scene.add(g);
      props.push(g);
      if (!y && PROP_BLOB[name]) { const [w, d] = PROP_BLOB[name](opt); blob(w, d, x, z, turn, onRug(x, z) ? .018 : .004); }
    }

    /* Touchable places that are not for sale: the bill counter and the materials table. They glow on hover like
       the pieces and the signs, and answer a tap with `view` (where to stand) and `act` (what to open). */
    const signs = [];
    function target(group, view, act, mats) {
      const t = { view, act, group, glow: 0, glowTo: 0, mats };
      group.traverse((m) => { if (m.isMesh) { m.userData.sign = t; pickables.push(m); } });
      signs.push(t);
      return t;
    }

    /* ---------- The bill counter ---------- */
    /* A pill-shaped travertine desk, fluted all round, with a walnut top. On it: the customer screen, which
       shows the bill as it grows, a card terminal, a receipt printer whose paper lengthens with every line,
       a brass bell and a small card that says where to pay. */
    const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1024; screenCanvas.height = 640;
    const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = aniso;
    const counter = (() => {
      const g = new THREE.Group(), { L, D, H } = CTR;
      const body = own(kit.surface('travertine', 0xf2e7db)), top = own(kit.surface('walnut')), dark = own(new THREE.MeshStandardMaterial({ color: 0x2a1a13, roughness: .8 }));
      const stand = (shape, h, y, mat) => { const geo = kit.extrude(shape, h, Math.min(.012, h / 3), 48); geo.rotateX(-P / 2); const m = mesh(geo, mat); m.position.y = y + h / 2; g.add(m); return m; };
      stand(kit.roundRect(L - .08, D - .08, (D - .08) / 2), .06, 0, dark);
      stand(kit.roundRect(L, D, D / 2), H - .06, .06, body);
      stand(kit.roundRect(L + .1, D + .1, (D + .1) / 2), .05, H, top);
      /* Flutes: half-round columns standing proud of the body, all the way round. */
      const fr = .034, a = L / 2 - D / 2, rr = D / 2 + fr * .2, per = 4 * a + 2 * P * rr, n = Math.round(per / .078);
      const flutes = new THREE.InstancedMesh(new THREE.CylinderGeometry(fr, fr, H - .1, 14), body, n), ob = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        let s = (i + .5) * per / n, px, pz;
        if (s < 2 * a) { px = -a + s; pz = rr; }
        else if ((s -= 2 * a) < P * rr) { const f = s / rr; px = a + rr * Math.sin(f); pz = rr * Math.cos(f); }
        else if ((s -= P * rr) < 2 * a) { px = a - s; pz = -rr; }
        else { const f = (s - 2 * a) / rr; px = -a - rr * Math.sin(f); pz = -rr * Math.cos(f); }
        ob.position.set(px, .06 + (H - .1) / 2, pz); ob.updateMatrix(); flutes.setMatrixAt(i, ob.matrix);
      }
      flutes.castShadow = flutes.receiveShadow = true; g.add(flutes);
      const y = H + .05;
      /* The customer screen, on a slim brass stand, tipped back towards whoever stands at the counter. */
      const brass = own(kit.surface('brass'));
      const post = mesh(kit.cylinder(.012, .016, .16, 16), brass); post.position.set(.32, y + .08, .02); g.add(post);
      const foot = mesh(kit.cylinder(.06, .065, .012, 32), brass); foot.position.set(.32, y + .006, .02); g.add(foot);
      const scr = new THREE.Group(); scr.position.set(.32, y + .2, .05); scr.rotation.x = -.38; g.add(scr);
      scr.add(mesh(kit.roundedBox(.34, .22, .016, .012, 2), dark));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(.31, .194), own(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: .95, roughness: .25 })));
      face.position.z = .0085; scr.add(face);
      /* Card terminal. */
      const term = new THREE.Group(); term.position.set(.72, y, .16); term.rotation.set(0, -.35, 0); g.add(term);
      const tb = mesh(kit.roundedBox(.08, .022, .16, .009, 2), dark); tb.position.y = .011; term.add(tb);
      const tscr = new THREE.Mesh(new THREE.PlaneGeometry(.058, .05), own(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xd9b48a, emissiveIntensity: .35 })));
      tscr.rotation.x = -P / 2; tscr.position.set(0, .0225, -.035); term.add(tscr);
      /* Receipt printer and its paper. */
      const pr = mesh(kit.roundedBox(.15, .1, .16, .02, 2), own(new THREE.MeshStandardMaterial({ color: 0xe9e1d8, roughness: .5 }))); pr.position.set(-.22, y + .05, -.04); g.add(pr);
      const paperMat = own(new THREE.MeshStandardMaterial({ color: 0xfbf7f1, roughness: .9, side: THREE.DoubleSide }));
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(.08, 1).translate(0, -.5, 0), paperMat);
      paper.position.set(-.22, y + .1, .04); paper.rotation.x = -.5; g.add(paper);
      /* Brass bell. */
      const bell = mesh(kit.turned([[0, 0], [.04, 0], [.042, .004], [.038, .012], [.032, .03], [.018, .044], [.004, .05], [.006, .058], [0, .06]], 40), brass); bell.position.set(-.6, y, .16); g.add(bell);
      const tent = new THREE.Group(); tent.position.set(-.02, y, .2); tent.rotation.y = .1; g.add(tent);
      g.position.set(CTR.x, 0, CTR.z); g.rotation.y = CTR.turn; scene.add(g);
      blob(D + .5, L + .5, CTR.x, CTR.z, 0, .004);
      return { group: g, paper, tent, face, mats: [body, top] };
    })();
    const counterTarget = target(counter.group, 'counter', 'bill', counter.mats);

    /* A small folded card on a surface, with a short message, e.g. "Pay here". */
    function noteCard(lines, w = .2, h = .12) {
      const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
      const x = c.getContext('2d');
      x.fillStyle = '#F6EFE7'; x.fillRect(0, 0, c.width, c.height);
      x.strokeStyle = 'rgba(59,36,27,.16)'; x.lineWidth = 4; x.strokeRect(14, 14, c.width - 28, c.height - 28);
      x.fillStyle = '#3B241B'; x.textAlign = 'center';
      x.font = '300 64px Comfortaa, Quicksand, sans-serif'; x.fillText(lines[0], c.width / 2, c.height * .52);
      if (lines[1]) { x.fillStyle = '#6F5446'; x.font = '700 22px Quicksand, sans-serif'; x.fillText(spaced(lines[1].toUpperCase()), c.width / 2, c.height * .78); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
      const g = new THREE.Group(), t = TAG.tilt, hh = h * Math.cos(t);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, -h / 2, 0), own(new THREE.MeshStandardMaterial({ map: tex, roughness: .85 }))); f.position.y = hh; f.rotation.x = -t; g.add(f);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, -h / 2, 0), tagBack); b.position.y = hh; b.rotation.set(t, P, 0); g.add(b);
      return g;
    }
    counter.tent.add(noteCard(['Pay here', 'Your bill is on the screen']));

    /* ---------- The materials library ---------- */
    const library = kit.prop('library');
    library.position.set(-5.6, 0, 5.5); scene.add(library);
    blob(2.9, 1.4, -5.6, 5.5, 0, .004);
    const libCard = noteCard(['Free samples', 'Up to four, sent to your door'], .24, .14);
    libCard.position.set(.75, .75, .3); libCard.rotation.y = -.2; library.add(libCard);
    const libMats = []; library.traverse((m) => { if (m.isMesh && m.material && libMats.indexOf(m.material) < 0 && m.material.emissive && !m.material.userData.still) libMats.push(m.material); });
    target(library, 'materials', 'samples', libMats);

    /* What the counter shows: the bill as it stands, redrawn whenever the bag changes. */
    let bill = { count: 0, total: 0, lines: 0 };
    function drawScreen() {
      const c = screenCanvas, x = c.getContext('2d'), W = c.width, Hh = c.height;
      const g = x.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, '#2E1E17'); g.addColorStop(1, '#1F140F');
      x.fillStyle = g; x.fillRect(0, 0, W, Hh);
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      x.fillStyle = 'rgba(244,236,228,.55)'; x.font = '700 26px Quicksand, sans-serif'; x.fillText(spaced('DECO ATELIER'), 70, 96);
      x.textAlign = 'right'; x.fillText(spaced('YOUR BILL'), W - 70, 96); x.textAlign = 'left';
      x.fillStyle = 'rgba(244,236,228,.14)'; x.fillRect(70, 126, W - 140, 2);
      x.fillStyle = '#F4ECE4';
      if (bill.count) {
        x.font = '500 40px Quicksand, sans-serif';
        x.fillText(`${bill.count} ${bill.count === 1 ? 'piece' : 'pieces'}`, 70, 214);
        drawPrice(x, bill.total, 70, 410, 148, 300);
        x.fillStyle = 'rgba(244,236,228,.6)'; x.font = '500 30px Quicksand, sans-serif';
        x.fillText('Prices include VAT. Delivery is complimentary.', 70, 492);
        x.fillStyle = '#D9B48A'; x.font = '700 28px Quicksand, sans-serif'; x.fillText(spaced('TAP THE COUNTER TO PAY'), 70, 572);
      } else {
        x.font = '300 92px Comfortaa, Quicksand, sans-serif'; x.fillText('Nothing yet', 70, 330);
        x.fillStyle = 'rgba(244,236,228,.6)'; x.font = '500 32px Quicksand, sans-serif';
        x.fillText('Choose a piece, add it to your bag,', 70, 420); x.fillText('and pay for it here.', 70, 464);
      }
      screenTex.needsUpdate = true;
      /* The paper grows a line's length for each line on the bill. */
      counter.paper.scale.y = .05 + Math.min(10, bill.lines) * .028;
    }
    function setBill(b) {
      const grew = b.count > bill.count;
      bill = { count: b.count || 0, total: b.total || 0, lines: b.lines || 0 };
      drawScreen();
      if (grew && mode !== 'outside') { counterTarget.glowTo = 1; setTimeout(() => { if (hovered !== counterTarget) counterTarget.glowTo = 0; }, 1400); }
    }
    drawScreen();

    /* Hanging signs, drawn on canvas in the site's type. */
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
    const DAY = { top: C(0xd8c3b2), mid: C(0xf6eadf), low: C(0xeedfd0), sun: C(0xfff0dc), fog: C(0xf3e7db), hemiS: C(0xfffaf5), hemiG: C(0xe8e0d6), sunC: C(0xfff3e4) };
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
      blobMat.opacity = lerp(.75, .95, n) * (fxp.gtao && fxp.gtao.enabled ? .55 : 1);
      ceil.emissiveIntensity = lerp(.3, .08, n);
      moteU.uNight.value = n;
      const lit = smooth(.2, 1, n);
      for (const p of pieces) for (const m of p.group.userData.glow) m.emissiveIntensity = lerp(.06, 2.4, lit);
      /* By day the lamps add nothing, and every light costs every pixel: they are switched off, not dimmed. */
      const on = n > .02;
      for (const l of lamps) { l.light.intensity = lerp(.15, 4.6, lit) * l.power; l.light.visible = on; }
      spill.visible = on;
      for (const g of props) {
        for (const m of g.userData.glow) m.emissiveIntensity = lerp(.06, 2.4, lit);
        for (const f of g.userData.flames) { f.visible = lit > .15; f.material.emissiveIntensity = lerp(1, 5, lit); }
      }
      shaftU.uOn.value = 1 - smooth(0, .6, n); shafts.visible = n < .6;
      counter.face.material.emissiveIntensity = lerp(.95, .7, n);
      /* The captured room light changes over at dusk, while everything else is moving too. */
      const env = n < .5 ? roomEnv.day : roomEnv.night;
      if (env) scene.environment = env;
      scene.environmentIntensity = env ? lerp(.5, .42, n) : lerp(.5, .26, n);
      if (env) hemi.intensity = lerp(.38, .24, n);
      if (fxp.bloom) { fxp.bloom.strength = lerp(.12, .32, n); fxp.bloom.threshold = lerp(2.4, 1.35, n); fxp.bloom.radius = lerp(.35, .45, n); }
      if (fxp.gtao) fxp.gtao.blendIntensity = lerp(1, .85, n);
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
      else if (h.sign && o.onZone) o.onZone(h.sign.view, h.sign.act);
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
      if (o.onHover) o.onHover(piece ? { slug: piece.slug, x: ptr.x, y: ptr.y } : sign ? { sign: sign.view, act: sign.act, x: ptr.x, y: ptr.y } : next === noorTarget ? { noor: true, x: ptr.x, y: ptr.y } : null);
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
    /* Swap a piece's finish: rebuild that one in place (or every copy, when `which` is left out). */
    function rebuild(p, finish) {
      const g = kit.build(p.slug, finish, p.row[5]);
      g.position.copy(p.group.position); g.rotation.copy(p.group.rotation);
      scene.remove(p.group);
      p.group.traverse((m) => {
        if (!m.isMesh) return;
        const i = pickables.indexOf(m); if (i >= 0) pickables.splice(i, 1);
        if (m.material && m.material.dispose && !m.material.userData.still) m.material.dispose();
        if (m.geometry && m.geometry.userData.own) m.geometry.dispose();
      });
      scene.add(g); g.updateMatrixWorld(true);
      p.group = g; p.finish = finish; p.mats = []; p.glow = 0;
      dress(p); claim(p);
    }
    function setFinish(slug, finish, which) {
      const list = pieces.filter((p) => p.slug === slug);
      (which === undefined ? list : [list[which] || list[0]]).forEach((p) => p && p.finish !== finish && rebuild(p, finish));
      applyNight(night);
      renderer.shadowMap.needsUpdate = true;
    }
    const finishOf = (slug, which = 0) => { const list = pieces.filter((p) => p.slug === slug), p = list[which] || list[0]; return p ? p.finish : null; };

    /* ---------- Loop ---------- */
    let last = performance.now(), running = false, introDrift = null;
    const parallax = { x: 0, y: 0 };
    const perf = { t: 0, n: 0, good: 0, hold: 0 };
    function setDpr(v) {
      if (v === dpr) return;
      dpr = v;
      renderer.setPixelRatio(dpr);
      if (fxp.composer) fxp.composer.setPixelRatio(dpr);
      moteU.uScale.value = dpr * (size.h / 900);
    }
    /* Quality is a ladder: no bloom at the bottom, then bloom, then occlusion from one pixel per CSS pixel,
       then resolution in tenths up to the cap. Slow seconds step down, three quick ones step up. The first
       seconds after a start, a resize or the light capture do not count (shaders are still compiling). */
    let ladder = [], rung = 0;
    function buildLadder() {
      ladder = fxp.composer ? [{ d: .8, ao: 0, bl: 0 }, { d: .8, ao: 0, bl: 1 }, { d: 1, ao: 0, bl: 1 }] : [{ d: .8 }, { d: .9 }];
      for (let d = 1; d < dprCap + .001; d = Math.round((d + .1) * 100) / 100) ladder.push({ d, ao: 1, bl: 1 });
      if (ladder[ladder.length - 1].d < dprCap) ladder.push({ d: dprCap, ao: 1, bl: 1 });
      const start = Math.min(dprCap, 1.25);
      rung = ladder.reduce((best, r, i) => (Math.abs(r.d - start) < Math.abs(ladder[best].d - start) || (Math.abs(r.d - start) === Math.abs(ladder[best].d - start) && r.ao) ? i : best), 0);
      if (o.lock) rung = ladder.length - 1; // checking the look: hold the top rung
      climb(0);
    }
    function climb(step) {
      rung = clamp(rung + step, 0, ladder.length - 1);
      const r = ladder[rung];
      setDpr(r.d);
      const ao = !!(fxp.gtao && r.ao), bl = !!(fxp.bloom && r.bl !== 0);
      if (fxp.gtao && fxp.gtao.enabled !== ao) { fxp.gtao.enabled = ao; applyNight(night); }
      if (fxp.bloom) fxp.bloom.enabled = bl;
      perf.good = 0;
    }
    function hold(ms = 2500) { perf.hold = performance.now() + ms; perf.t = perf.n = perf.good = 0; }
    function adapt(dtRaw, now) {
      if (now < perf.hold || o.lock) return;
      perf.t += dtRaw; perf.n++;
      if (perf.t < 1) return;
      const avg = perf.t / perf.n; perf.t = perf.n = 0;
      if (avg > 1 / 46) climb(-1);
      else if (avg < 1 / 57) { if (++perf.good >= 3) climb(1); }
      else perf.good = 0;
    }
    function frame(now) {
      const dtRaw = (now - last) / 1000, dt = Math.min(.05, dtRaw); last = now;
      if (dtRaw < .5) adapt(dtRaw, now);
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
      if (fxp.composer) fxp.composer.render(dt);
      else renderer.render(scene, cam);
    }
    function start() { if (running) return; running = true; last = performance.now(); hold(); renderer.setAnimationLoop(frame); }
    function stop() { running = false; renderer.setAnimationLoop(null); }
    function resize() {
      const r = canvas.parentNode.getBoundingClientRect();
      size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
      renderer.setSize(size.w, size.h, false);
      if (fxp.composer) fxp.composer.setSize(size.w, size.h);
      hold(1500);
      cam.aspect = size.w / size.h; cam.updateProjectionMatrix();
      moteU.uScale.value = renderer.getPixelRatio() * (size.h / 900);
    }

    /* ---------- Post effects: occlusion in every crease, bloom on what glows, a soft vignette ---------- */
    function setupPost() {
      if (!post) return;
      try {
        const { EffectComposer, RenderPass, GTAOPass, UnrealBloomPass, OutputPass, ShaderPass } = post;
        /* Only the scene is drawn multisampled, into its own buffer with a depth texture; the effects then run
           on plain half-float buffers (each pass into a multisampled one would pay for another resolve). */
        const msaa = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
        msaa.depthTexture = new THREE.DepthTexture(4, 4);
        const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
        composer.setPixelRatio(dpr);
        const copy = new ShaderPass({
          uniforms: { tDiffuse: { value: null } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }'
        });
        const draw = new RenderPass(scene, cam);
        draw.render = (r, write, read) => {
          r.setRenderTarget(msaa); r.clear(); r.render(scene, cam);
          copy.render(r, read, msaa);
        };
        draw.setSize = (w, h) => msaa.setSize(w, h);
        composer.addPass(draw);
        /* Ambient occlusion from that depth, so the scene is not drawn twice, at half resolution.
           Only what stands within 25 cm of a surface darkens it: contact and creases, no halos on far walls. */
        const gtao = new GTAOPass(scene, cam, 4, 4);
        gtao.setGBuffer(msaa.depthTexture);
        gtao.updateGtaoMaterial({ radius: .35, distanceExponent: 1.4, thickness: .25, scale: 1.1, samples: 9 });
        gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 8 });
        const sizeAO = gtao.setSize.bind(gtao);
        gtao.setSize = (w, h) => sizeAO(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
        composer.addPass(gtao);
        const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), .2, .55, 1.25);
        composer.addPass(bloom);
        composer.addPass(new ShaderPass({
          uniforms: { tDiffuse: { value: null }, uAmt: { value: .28 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
          fragmentShader: 'uniform sampler2D tDiffuse; uniform float uAmt; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); float v = smoothstep(.9, .25, length((vUv - .5) * vec2(1.0, .82))); c.rgb *= mix(1.0 - uAmt, 1.0, v); gl_FragColor = c; }'
        }));
        composer.addPass(new OutputPass());
        Object.assign(fxp, { composer, gtao, bloom, msaa, copy });
        composer.setSize(size.w, size.h);
      } catch (e) {
        console.warn('DECO: post effects off', e);
        fxp.composer = fxp.gtao = fxp.bloom = null;
      }
    }

    /* Capture the room's own light from its middle, by night and by day, under the studio light it was built in. */
    function bake() {
      const rt = new THREE.WebGLCubeRenderTarget(mobile ? 128 : 256, { type: THREE.HalfFloatType });
      const cc = new THREE.CubeCamera(.05, 1000, rt);
      cc.position.set(0, 1.8, .6); scene.add(cc);
      const hide = [noor, motes, shafts, stars], was = hide.map((h) => h.visible), n0 = night;
      hide.forEach((h) => { h.visible = false; });
      sky.position.copy(cc.position);
      const got = { day: roomEnv.day, night: roomEnv.night };
      roomEnv.day = roomEnv.night = null;
      for (const key of ['night', 'day']) {
        applyNight(key === 'night' ? 1 : 0);
        scene.environment = studioEnv;
        cc.update(renderer, scene);
        if (got[key]) got[key].dispose();
        got[key] = pmrem.fromCubemap(rt.texture).texture;
      }
      Object.assign(roomEnv, got);
      scene.remove(cc); rt.dispose();
      hide.forEach((h, i) => { h.visible = was[i]; });
      /* Compile both lightings now (lamps on, lamps off), so dusk never stalls on new shaders. */
      /* Compiled for the buffer the scene really draws into (with effects: linear, untoned), or the variants would differ. */
      renderer.setRenderTarget(fxp.msaa || null);
      for (const v of [1, 0]) { applyNight(v); try { renderer.compile(scene, cam); } catch (e) { /* compiled on first use instead */ } }
      renderer.setRenderTarget(null);
      applyNight(n0);
      hold();
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
      }).then(() => { mode = 'inside'; pulseUntil = performance.now() + (reduce ? 0 : 2600); hold(1500); });
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
      for (const t of [studioEnv, roomEnv.day, roomEnv.night]) if (t) t.dispose();
      try { if (fxp.composer) { fxp.composer.passes.forEach((ps) => ps.dispose && ps.dispose()); fxp.composer.dispose(); fxp.msaa.dispose(); fxp.copy.dispose(); } } catch (e) { /* already gone */ }
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }

    resize();
    setupPost();
    buildLadder();
    applyNight(0);
    Object.assign(cur, introPose());
    renderer.shadowMap.needsUpdate = true;

    return {
      start, stop, resize, intro, enter, focus, unfocus, setFinish, finishOf, setNight, setOffset, destroy, bake, setBill,
      info: () => ({ dpr, post: !!fxp.composer, ao: !!(fxp.gtao && fxp.gtao.enabled), bloom: !!(fxp.bloom && fxp.bloom.enabled), env: !!roomEnv.day }),
      view: goView,
      pulse(ms = 2600) { pulseUntil = performance.now() + (reduce ? 0 : ms); },
      /* For checking the layout while building: stand anywhere, look anywhere. */
      peek(p, t, fov = 50) { flight = null; introDrift = null; mode = 'inside'; cur.pos.set(...p); cur.tgt.set(...t); cur.fov = fov; },
      get mode() { return mode; },
      get night() { return nightTo; },
      count: (slug) => pieces.filter((p) => p.slug === slug).length,
      renderer, _scene: scene, _lamps: lamps, _fx: fxp
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
