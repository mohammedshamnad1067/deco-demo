/* =========================================================
   DECO · 3D pieces for the atelier on the home page
   Every piece in the catalogue, built from soft primitives at its
   true size (catalogue dims are W × D × H in cm), skinned with the
   real material scans in assets/materials/ through object-space
   triplanar mapping, so bouclé loops and stone pores keep the same
   scale on every shape. Front faces +z, the floor is y = 0.

   DECO_MODELS.create(THREE, { texture, tones }) returns
     build(slug, finish) → THREE.Group
   A group's userData: { slug, glow: [materials lit at night],
   lights: [[x, y, z, power]] (local points where a lamp shines) }.
   ========================================================= */
(function () {
  'use strict';

  function create(THREE, { texture, tones }) {
    const V2 = THREE.Vector2, V3 = THREE.Vector3, PI = Math.PI;

    /* ---------- Geometry (cached per shape, shared by every copy) ---------- */
    const cache = new Map();
    const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

    /* A box with spherical corners: an odd-segmented unit box whose vertices are pulled onto the rounded hull. */
    function roundedBox(w, h, d, r, s = 3) {
      return memo(`rb${w},${h},${d},${r},${s}`, () => {
        r = Math.max(0.002, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
        const n = s * 2 + 1, half = 0.5 / n;
        const g = new THREE.BoxGeometry(1, 1, 1, n, n, n).toNonIndexed();
        const pos = g.attributes.position, nor = g.attributes.normal, p = new V3(), q = new V3();
        const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i);
          const sx = Math.sign(p.x), sy = Math.sign(p.y), sz = Math.sign(p.z);
          q.set(p.x - sx * half, p.y - sy * half, p.z - sz * half).normalize();
          pos.setXYZ(i, ix * sx + q.x * r, iy * sy + q.y * r, iz * sz + q.z * r);
          nor.setXYZ(i, q.x, q.y, q.z);
        }
        return g;
      });
    }
    const ellipsoid = (rx, ry, rz) => memo(`el${rx},${ry},${rz}`, () => new THREE.SphereGeometry(1, 36, 22).scale(rx, ry, rz));
    const dome = (r, sy, open = true) => memo(`dm${r},${sy}`, () => new THREE.SphereGeometry(r, 48, 16, 0, PI * 2, 0, PI / 2).scale(1, sy, 1));
    const cylinder = (rt, rb, h, seg = 40, open = false) => memo(`cy${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
    /* A turned piece: [radius, height] pairs through a smooth spline, spun around y. */
    const turned = (pts, seg = 64) => memo(`la${pts.join(';')}`, () => {
      const c = new THREE.SplineCurve(pts.map(([x, y]) => new V2(x, y)));
      return new THREE.LatheGeometry(c.getPoints(pts.length * 10).map((p) => new V2(Math.max(0, p.x), p.y)), seg);
    });
    const tube = (pts, r, seg = 100, radial = 18) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new V3(x, y, z))), seg, r, radial, false);

    function roundRect(w, h, r, cx = 0, cy = 0, path) {
      const s = path || new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }
    /* An arch: straight sides from y0 and a half-circle top, h tall in all. */
    function arch(w, h, y0 = 0, path) {
      const s = path || new THREE.Shape(), r = w / 2;
      s.moveTo(-r, y0); s.lineTo(-r, y0 + h - r); s.absarc(0, y0 + h - r, r, PI, 0, true); s.lineTo(r, y0); s.lineTo(-r, y0);
      return s;
    }
    function ellipseShape(rx, ry, path) { const s = path || new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, PI * 2, false, 0); return s; }
    /* Extrude a flat shape along z, centred, with a soft bevel. */
    function extrude(shape, depth, bevel = 0.01, curve = 40) {
      const core = Math.max(0.001, depth - 2 * bevel);
      const g = new THREE.ExtrudeGeometry(shape, { depth: core, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: curve });
      g.translate(0, 0, -core / 2);
      return g;
    }

    /* ---------- Materials ---------- */
    const PHOTO = { natural: 'boucle', terracotta: 'terracotta', olive: 'wool', travertine: 'travertine', oak: 'white-oak', walnut: 'walnut', smoked: 'smoked-oak', brass: 'brass', leather: 'leather' };
    /* [texture repeats per metre, roughness, metalness] */
    const FEEL = { natural: [3.3, 1, 0], terracotta: [3.3, 1, 0], olive: [2.6, .95, 0], travertine: [1.2, .46, 0], oak: [1.3, .56, 0], walnut: [1.3, .5, 0], smoked: [1.3, .5, 0], brass: [2, .32, .85], leather: [2.4, .6, 0] };

    /* Object-space triplanar mapping: the scan is projected along x, y and z and blended by the surface normal. */
    function triplanar(m, scale) {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTri = { value: scale };
        sh.vertexShader = 'varying vec3 vTriP;\nvarying vec3 vTriN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriP = position;\nvTriN = normal;');
        sh.fragmentShader = 'uniform float uTri;\nvarying vec3 vTriP;\nvarying vec3 vTriN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec3 tw = pow(abs(normalize(vTriN)), vec3(4.0));
            tw /= (tw.x + tw.y + tw.z);
            vec4 sampledDiffuseColor = texture2D(map, vTriP.zy * uTri) * tw.x + texture2D(map, vTriP.xz * uTri) * tw.y + texture2D(map, vTriP.xy * uTri) * tw.z;
            diffuseColor *= sampledDiffuseColor;
          #endif`);
      };
      m.customProgramCacheKey = () => 'deco-tri';
      return m;
    }
    function surface(key, tint, scale) {
      const [s0, rough, metal] = FEEL[key] || FEEL.travertine, s = scale || s0;
      const o = { map: texture(PHOTO[key] || 'travertine'), roughness: rough, metalness: metal, color: tint === undefined ? 0xffffff : tint };
      return triplanar(new THREE.MeshStandardMaterial(o), s);
    }
    const plain = (color, rough = .85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const tone = (k, fb = '#CDB49A') => new THREE.Color((k && tones[k]) || fb);
    /* Lit at night: the scene raises emissiveIntensity when the lamps come on. */
    function glowing(color = 0xfff4e6, emissive = 0xffc58a, side = THREE.FrontSide) {
      const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: .05, roughness: .9, side });
      m.userData.glow = 1;
      return m;
    }
    const mirror = () => new THREE.MeshStandardMaterial({ color: 0xe4ddd6, metalness: 1, roughness: .04 });
    const shadowLine = () => plain(0x2a1a13, 1);

    function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }
    function put(g, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; }
    const rb = (g, w, h, d, r, mat, x, y, z, rx, ry, rz) => put(g, mesh(roundedBox(w, h, d, r), mat), x, y, z, rx, ry, rz);
    const feet = (g, mat, xs, zs, r = .028, h = .06) => { for (const x of xs) for (const z of zs) put(g, mesh(cylinder(r, r * .9, h, 20), mat), x, h / 2, z); };
    /* A thin dark seam on a front face, for drawers and doors. */
    const seam = (g, w, h, x, y, z) => put(g, new THREE.Mesh(roundedBox(w, h, .006, Math.min(w, h) / 2.2, 1), shadowLine()), x, y, z);

    /* A few quiet things for shelves: books and small turned pots. Not for sale on their own. */
    const BOOKS = [0xcdb49a, 0x9a5236, 0xe7d8c6, 0x6e6a4e, 0x58372b];
    function books(g, x, y, z, n, seed = 1) {
      let cx = x;
      for (let i = 0; i < n; i++) {
        const h = .17 + ((seed * (i + 3) * 37) % 7) / 100, w = .025 + ((seed * (i + 1) * 13) % 3) / 100;
        rb(g, w, h, .15, .004, plain(BOOKS[(seed + i) % BOOKS.length], .9), cx + w / 2, y + h / 2, z);
        cx += w + .004;
      }
    }
    const pot = (g, x, y, z, s = 1, color = 0xe8dccd) => put(g, mesh(turned([[0, 0], [.04 * s, 0], [.055 * s, .05 * s], [.05 * s, .1 * s], [.03 * s, .14 * s], [.034 * s, .15 * s], [0, .15 * s]]), plain(color, .9)), x, y, z);

    /* ---------- The pieces ---------- */
    const B = {};

    /* Seating */
    B['mira-lounge-chair'] = (F) => {
      const g = new THREE.Group(), oak = surface('smoked');
      rb(g, .66, .09, .72, .035, oak, 0, .045, 0);
      rb(g, .8, .3, .84, .14, F, 0, .24, .02);
      rb(g, .8, .44, .3, .14, F, 0, .45, -.26, -.2);
      rb(g, .6, .09, .5, .045, F, 0, .41, .1);
      return g;
    };
    B['luna-sofa'] = (F) => {
      const g = new THREE.Group();
      feet(g, surface('walnut'), [-.95, .95], [-.33, .33], .03, .05);
      rb(g, 2.2, .3, .95, .13, F, 0, .2, 0);
      rb(g, 2.2, .46, .32, .16, F, 0, .51, -.315);
      for (const s of [-1, 1]) rb(g, .34, .4, .95, .16, F, s * .93, .46, 0);
      for (const s of [-1, 1]) rb(g, .78, .16, .64, .075, F, s * .395, .41, .1);
      return g;
    };
    B['arco-lounge-chair'] = (F, k) => {
      const g = new THREE.Group(), r = .1, x = .425 - r;
      const pts = [[-x, 0, .3], [-x, .24, .31], [-x, .4, .08], [-x * .86, .46, -.22], [0, .5, -.32], [x * .86, .46, -.22], [x, .4, .08], [x, .24, .31], [x, 0, .3]];
      put(g, mesh(tube(pts, r, 140, 22), F), 0, r, 0);
      for (const s of [-1, 1]) put(g, mesh(ellipsoid(r, r, r), F), s * x, r, .3);
      const seat = new THREE.MeshStandardMaterial({ color: tone(k).multiplyScalar(.85), roughness: .8 });
      rb(g, .62, .14, .62, .06, seat, 0, .32, 0);
      for (const s of [-1, 1]) rb(g, .1, .26, .1, .05, F, s * .24, .13, -.24);
      return g;
    };
    /* A tub: a horseshoe wall with a fully rounded rim (the bevel), its arms stepping down towards the front. */
    B['nora-accent-chair'] = (F) => {
      const g = new THREE.Group(), b = .075, gap = .66;
      const s = new THREE.Shape();
      s.absarc(0, 0, .39 - b, -PI / 2 + gap, 3 * PI / 2 - gap, false);
      s.absarc(0, 0, .22 + b, 3 * PI / 2 - gap, -PI / 2 + gap, true);
      s.closePath();
      const shell = memo('nora-shell', () => {
        const geo = extrude(s, .66, b, 64); geo.rotateX(-PI / 2);
        const p = geo.attributes.position, sm = (a, c, x) => { const t = Math.max(0, Math.min(1, (x - a) / (c - a))); return t * t * (3 - 2 * t); };
        for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); p.setY(i, y - sm(-.08, .3, z) * .17 * sm(-.12, .33, y)); }
        return geo;
      });
      put(g, mesh(shell, F), 0, .43, 0);
      put(g, mesh(turned([[0, 0], [.24, 0], [.262, .03], [.27, .13], [.255, .19], [.2, .225], [0, .23]]), F), 0, .22, .02);
      rb(g, .72, .12, .7, .055, F, 0, .06, 0);
      return g;
    };
    B['vale-dining-chair'] = (F) => {
      const g = new THREE.Group();
      rb(g, .52, .12, .5, .05, F, 0, .44, .02);
      for (const [x, z] of [[-.2, .18], [.2, .18], [-.2, -.18], [.2, -.18]]) rb(g, .11, .4, .11, .05, F, x, .2, z);
      const band = mesh(new THREE.TorusGeometry(.21, .055, 16, 48, PI), F);
      put(g, band, 0, .72, -.03, -PI / 2);
      for (const s of [-1, 1]) rb(g, .09, .28, .09, .04, F, s * .21, .58, -.03);
      return g;
    };
    B['puff-ottoman'] = (F) => {
      const g = new THREE.Group();
      for (let i = 0; i < 6; i++) { const a = i * PI / 3; put(g, mesh(ellipsoid(.165, .2, .165), F), Math.cos(a) * .135, .2, Math.sin(a) * .135); }
      put(g, mesh(ellipsoid(.16, .07, .16), F), 0, .36, 0);
      return g;
    };
    B['curve-bench'] = (F) => {
      const g = new THREE.Group();
      rb(g, 1.3, .08, .3, .03, plain(0x3b241b, .7), 0, .04, 0);
      rb(g, 1.4, .4, .4, .16, F, 0, .25, 0);
      return g;
    };
    B['mod-dining-chair'] = (F) => {
      const g = new THREE.Group(), oak = surface('oak');
      for (const [x, z] of [[-.21, .19], [.21, .19], [-.21, -.19], [.21, -.19]]) put(g, mesh(cylinder(.022, .017, .44, 16), oak), x, .22, z);
      rb(g, .5, .05, .48, .02, oak, 0, .465, 0);
      rb(g, .48, .085, .46, .04, F, 0, .53, .01);
      for (const s of [-1, 1]) put(g, mesh(cylinder(.018, .018, .3, 12), oak), s * .21, .64, -.21, -.08);
      rb(g, .5, .22, .07, .035, F, 0, .7, -.225, -.1);
      return g;
    };

    /* Tables */
    B['sol-round-coffee-table'] = (F) => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.46, 0], [.5, .03], [.5, .09], [.46, .12], [0, .12]]), F), 0, .26, 0);
      for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; put(g, mesh(turned([[0, 0], [.085, 0], [.09, .02], [.085, .13], [.09, .24], [.085, .26], [0, .26]], 40), F), Math.cos(a) * .28, 0, Math.sin(a) * .28); }
      return g;
    };
    B['lua-coffee-table'] = (F) => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.49, 0], [.55, .05], [.55, .15], [.5, .2], [0, .2]]), F), 0, .12, 0);
      for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; put(g, mesh(ellipsoid(.075, .065, .075), F), Math.cos(a) * .36, .065, Math.sin(a) * .36); }
      return g;
    };
    B['cove-side-table'] = (F) => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.15, 0], [.16, .02], [.13, .07], [.12, .3], [.13, .44], [.18, .49], [.2, .52], [.19, .55], [0, .55]]), F));
      return g;
    };
    B['ridge-console-table'] = (F) => {
      const g = new THREE.Group(), t = .075, W = 1.2, H = .78, r = .14, ri = .06;
      const s = new THREE.Shape();
      s.moveTo(-W / 2, 0); s.lineTo(-W / 2, H - r); s.quadraticCurveTo(-W / 2, H, -W / 2 + r, H);
      s.lineTo(W / 2 - r, H); s.quadraticCurveTo(W / 2, H, W / 2, H - r); s.lineTo(W / 2, 0);
      s.lineTo(W / 2 - t, 0); s.lineTo(W / 2 - t, H - t - ri); s.quadraticCurveTo(W / 2 - t, H - t, W / 2 - t - ri, H - t);
      s.lineTo(-W / 2 + t + ri, H - t); s.quadraticCurveTo(-W / 2 + t, H - t, -W / 2 + t, H - t - ri); s.lineTo(-W / 2 + t, 0); s.lineTo(-W / 2, 0);
      put(g, mesh(extrude(s, .38, .012), F));
      return g;
    };
    B['terra-dining-table'] = (F) => {
      const g = new THREE.Group();
      rb(g, 2, .07, 1, .03, F, 0, .715, 0);
      for (const [x, z] of [[-.7, -.25], [.7, -.25], [-.7, .25], [.7, .25]]) put(g, mesh(turned([[0, 0], [.1, 0], [.105, .02], [.095, .34], [.1, .66], [.095, .68], [0, .68]], 40), F), x, 0, z);
      return g;
    };
    B['nest-tables'] = (F) => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.27, 0], [.275, .02], [.275, .04], [.26, .05], [0, .05]]), F), 0, .45, 0);
      put(g, mesh(turned([[0, 0], [.13, 0], [.14, .03], [.12, .2], [.14, .44], [.13, .45], [0, .45]], 48), F));
      put(g, mesh(turned([[0, 0], [.2, 0], [.205, .02], [.205, .035], [.19, .045], [0, .045]]), F), .3, .325, .2);
      put(g, mesh(turned([[0, 0], [.1, 0], [.11, .03], [.09, .16], [.11, .32], [.1, .33], [0, .33]], 48), F), .3, 0, .2);
      return g;
    };
    B['pebble-side-table'] = (F) => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.12, 0], [.19, .05], [.225, .17], [.215, .31], [.17, .42], [.12, .475], [0, .48]]), F));
      return g;
    };

    /* Storage */
    B['vale-sideboard'] = (F) => {
      const g = new THREE.Group();
      feet(g, surface('walnut'), [-.6, .6], [-.15, .15], .028, .07);
      rb(g, 1.42, .68, .46, .1, F, 0, .41, 0);
      for (const s of [-1, 1]) put(g, mesh(new THREE.CapsuleGeometry(.215, .05, 10, 28), F), s * .72, .36, 0, PI / 2);
      seam(g, .006, .5, 0, .41, .232);
      return g;
    };
    B['arc-cabinet'] = (F) => {
      const g = new THREE.Group(), door = surface('travertine', 0xf1e8de);
      rb(g, 1.1, .05, .4, .02, F, 0, .025, 0);
      rb(g, 1.2, .78, .45, .05, F, 0, .44, 0);
      for (const s of [-1, 1]) {
        put(g, mesh(extrude(arch(.5, .64), .03, .008), door), s * .29, .1, .232);
        put(g, mesh(ellipsoid(.018, .018, .018), surface('brass')), s * .07, .42, .255);
      }
      return g;
    };
    B['tomo-bookshelf'] = (F) => {
      const g = new THREE.Group();
      const s = roundRect(.9, 1.8, .14, 0, .9);
      s.holes.push(roundRect(.72, 1.62, .07, 0, .9, new THREE.Path()));
      put(g, mesh(extrude(s, .38, .02), F));
      for (const y of [.36, .7, 1.04, 1.38]) rb(g, .72, .05, .34, .02, F, 0, y, 0);
      books(g, -.33, .385, 0, 7, 2); pot(g, .22, .385, 0, 1.2);
      books(g, -.1, .725, 0, 9, 3);
      pot(g, -.2, 1.065, .02, 1.4, 0xd8c3a8); books(g, .05, 1.065, 0, 5, 5);
      books(g, -.32, 1.405, 0, 4, 7); pot(g, .2, 1.405, 0, 1, 0x9a5236);
      return g;
    };
    B['cloud-cabinet'] = (F) => {
      const g = new THREE.Group();
      for (const x of [-.66, .66]) for (const z of [-.14, .14]) put(g, mesh(ellipsoid(.045, .045, .045), F), x, .045, z);
      rb(g, 1.6, .52, .45, .17, F, 0, .34, 0);
      for (const x of [-.27, .27]) seam(g, .006, .32, x, .34, .226);
      return g;
    };
    B['ridge-tv-unit'] = (F) => {
      const g = new THREE.Group();
      rb(g, 1.9, .06, .4, .01, plain(0x2a1a13, .8), 0, .03, 0);
      rb(g, 2, .34, .45, .025, F, 0, .23, 0);
      for (const x of [-.333, .333]) seam(g, .005, .26, x, .23, .226);
      for (const x of [-.666, 0, .666]) seam(g, .12, .012, x, .35, .226);
      return g;
    };
    B['nora-display-shelf'] = (F) => {
      const g = new THREE.Group();
      const s = arch(.7, 1.5);
      s.holes.push(arch(.54, 1.37, .07, new THREE.Path()));
      put(g, mesh(extrude(s, .35, .02), F));
      for (const y of [.5, .86]) rb(g, .54, .035, .31, .015, F, 0, y, 0);
      pot(g, -.12, .07, 0, 1.6, 0xe8dccd); pot(g, .13, .07, .02, 1.1, 0xd8c3a8);
      books(g, -.22, .52, 0, 5, 4); pot(g, .16, .52, 0, 1.1, 0x9a5236);
      pot(g, 0, .88, 0, 1.5, 0xf1e8de);
      return g;
    };
    B['mini-storage'] = (F) => {
      const g = new THREE.Group();
      for (const x of [-.2, .2]) for (const z of [-.15, .15]) put(g, mesh(ellipsoid(.04, .04, .04), F), x, .04, z);
      rb(g, .55, .47, .45, .13, F, 0, .315, 0);
      seam(g, .4, .006, 0, .315, .226);
      return g;
    };

    /* Bedroom */
    function bedBase(g, F) {
      feet(g, surface('walnut'), [-.82, .82], [-.9, .9], .03, .05);
      rb(g, 1.8, .3, 2.02, .1, F, 0, .2, .04);
      const linen = plain(0xf6efe7, .95), cover = surface('natural', 0xf3e9de);
      rb(g, 1.64, .22, 1.86, .09, linen, 0, .45, .08);
      rb(g, 1.7, .1, 1.24, .05, cover, 0, .58, .4);
      for (const s of [-1, 1]) rb(g, .62, .15, .38, .07, linen, s * .38, .63, -.6, -.32);
    }
    B['vale-bed'] = (F) => {
      const g = new THREE.Group();
      bedBase(g, F);
      rb(g, 1.8, .52, .2, .09, F, 0, .46, -.95);
      put(g, mesh(new THREE.CapsuleGeometry(.19, 1.42, 10, 32), F), 0, .75, -.92, 0, 0, PI / 2);
      return g;
    };
    B['luna-headboard-bed'] = (F) => {
      const g = new THREE.Group();
      bedBase(g, F);
      for (const s of [-1, 1]) rb(g, .93, .66, .22, .11, F, s * .45, .67, -.95);
      return g;
    };
    B['tomo-nightstand'] = (F) => {
      const g = new THREE.Group();
      for (const x of [-.2, .2]) for (const z of [-.13, .13]) put(g, mesh(new THREE.CapsuleGeometry(.04, .08, 8, 16), F), x, .08, z);
      rb(g, .55, .36, .42, .09, F, 0, .32, 0);
      seam(g, .4, .006, 0, .32, .211);
      return g;
    };
    B['stone-nightstand'] = (F) => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.2, 0], [.222, .025], [.225, .27], [.222, .52], [.2, .55], [0, .55]]), F));
      put(g, new THREE.Mesh(new THREE.TorusGeometry(.226, .003, 6, 64), shadowLine()), 0, .4, 0, PI / 2);
      return g;
    };
    B['curve-bedroom-bench'] = (F) => {
      const g = new THREE.Group();
      rb(g, 1.1, .08, .3, .03, plain(0x3b241b, .7), 0, .04, 0);
      rb(g, 1.2, .4, .4, .16, F, 0, .25, 0);
      return g;
    };
    B['dune-dresser'] = (F) => {
      const g = new THREE.Group();
      for (const x of [-.62, .62]) for (const z of [-.16, .16]) put(g, mesh(cylinder(.035, .03, .06, 20), F), x, .03, z);
      rb(g, 1.5, .74, .5, .1, F, 0, .43, 0);
      seam(g, 1.3, .006, 0, .43, .251); seam(g, .006, .6, 0, .43, .251);
      for (const x of [-.37, .37]) for (const y of [.62, .24]) seam(g, .14, .012, x, y, .251);
      return g;
    };
    B['arco-mirror'] = (F) => {
      const g = new THREE.Group(), lean = new THREE.Group();
      const s = arch(.7, 1.6);
      s.holes.push(arch(.52, 1.43, .08, new THREE.Path()));
      put(lean, mesh(extrude(s, .08, .015), F));
      put(lean, new THREE.Mesh(new THREE.ShapeGeometry(arch(.53, 1.44, .075), 48), mirror()), 0, 0, -.01);
      put(g, lean, 0, 0, .1, -.11);
      return g;
    };

    /* Lighting */
    B['luna-table-lamp'] = (F) => {
      const g = new THREE.Group(), glow = glowing();
      put(g, mesh(turned([[0, 0], [.09, 0], [.135, .05], [.15, .13], [.12, .21], [.05, .26], [0, .27]]), F));
      put(g, mesh(cylinder(.025, .025, .08, 16), F), 0, .3, 0);
      put(g, mesh(dome(.225, .62), F), 0, .37, 0);
      put(g, new THREE.Mesh(dome(.212, .58), glowing(0xfff4e6, 0xffc58a, THREE.BackSide)), 0, .368, 0);
      put(g, new THREE.Mesh(ellipsoid(.045, .045, .045), glow), 0, .33, 0);
      g.userData.lights = [[0, .31, 0, 1]];
      return g;
    };
    B['stone-table-lamp'] = (F) => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.08, 0], [.125, .06], [.13, .15], [.1, .25], [.03, .29], [0, .3]]), F));
      put(g, mesh(cylinder(.012, .012, .1, 12), surface('brass')), 0, .33, 0);
      const shade = new THREE.Mesh(cylinder(.11, .2, .22, 48, true), glowing(0xf3e6d6, 0xffc58a, THREE.DoubleSide));
      shade.castShadow = true;
      put(g, shade, 0, .44, 0);
      g.userData.lights = [[0, .4, 0, .8]];
      return g;
    };
    B['arc-floor-lamp'] = (F) => {
      const g = new THREE.Group(), brass = surface('brass'), fx = -.53, sx = .5;
      put(g, mesh(turned([[0, 0], [.14, 0], [.155, .03], [.15, .1], [.12, .13], [0, .14]]), F), fx, 0, 0);
      put(g, mesh(tube([[fx, .13, 0], [fx + .02, .9, 0], [fx + .12, 1.55, 0], [-.05, 1.88, 0], [.3, 1.86, 0], [sx, 1.72, 0], [sx + .02, 1.62, 0]], .012, 120, 10), brass));
      put(g, mesh(dome(.2, .7), F), sx + .02, 1.48, 0);
      put(g, new THREE.Mesh(dome(.19, .66), glowing(0xfff4e6, 0xffc58a, THREE.BackSide)), sx + .02, 1.478, 0);
      g.userData.lights = [[sx, 1.4, 0, 1.2]];
      return g;
    };
    function pendant(F, profile, drop) {
      const g = new THREE.Group();
      const shell = mesh(turned(profile), F); shell.material.side = THREE.DoubleSide;
      put(g, shell);
      const top = profile[0][1];
      put(g, new THREE.Mesh(ellipsoid(.05, .05, .05), glowing()), 0, .06, 0);
      put(g, new THREE.Mesh(cylinder(.004, .004, drop, 6), plain(0x2a1a13, .6)), 0, top + drop / 2, 0);
      put(g, mesh(cylinder(.06, .06, .02, 24), plain(0xe9ddd0, .8)), 0, top + drop, 0);
      g.userData.lights = [[0, .02, 0, 1.4]];
      return g;
    }
    B['dune-pendant-light'] = (F, k, o) => pendant(F, [[0, .3], [.1, .29], [.19, .24], [.24, .15], [.25, .03], [.245, 0]], (o && o.drop) || 1);
    B['terra-pendant-light'] = (F, k, o) => pendant(F, [[0, .2], [.15, .19], [.25, .14], [.295, .05], [.3, 0]], (o && o.drop) || 1);
    B['wall-sconce'] = (F) => {
      const g = new THREE.Group();
      rb(g, .12, .3, .03, .015, F, 0, 0, .015);
      const half = memo('sconce', () => new THREE.CylinderGeometry(.09, .09, .1, 32, 1, false, -PI / 2, PI));
      put(g, mesh(half, F), 0, .085, .03);
      put(g, mesh(half, F), 0, -.085, .03);
      put(g, new THREE.Mesh(roundedBox(.15, .05, .07, .02, 2), glowing()), 0, 0, .045);
      g.userData.lights = [[0, 0, .12, .6]];
      return g;
    };
    B['orbit-floor-lamp'] = () => {
      const g = new THREE.Group(), bronze = surface('brass', 0x8a6a4a);
      put(g, mesh(turned([[0, 0], [.14, 0], [.15, .015], [.13, .03], [0, .032]]), bronze));
      put(g, mesh(cylinder(.009, .009, 1.36, 10), bronze), 0, .71, 0);
      put(g, new THREE.Mesh(ellipsoid(.14, .14, .14), glowing(0xfff8f0, 0xffd29e)), 0, 1.46, 0);
      g.userData.lights = [[0, 1.46, 0, 1]];
      return g;
    };

    /* Decor */
    B['stone-vase'] = (F) => { const g = new THREE.Group(); put(g, mesh(turned([[0, 0], [.09, 0], [.12, .03], [.14, .13], [.135, .25], [.1, .33], [.07, .36], [.075, .395], [.064, .4], [.054, .38], [.05, .3], [0, .3]]), F)); return g; };
    B['terra-bowl'] = (F) => { const g = new THREE.Group(); put(g, mesh(turned([[0, 0], [.06, 0], [.1, .012], [.14, .06], [.15, .12], [.135, .12], [.12, .075], [.08, .04], [0, .034]]), F)); return g; };
    B['luna-planter'] = (F) => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.11, 0], [.15, .05], [.16, .14], [.15, .24], [.13, .29], [.12, .3], [.112, .28], [0, .27]]), F));
      put(g, mesh(cylinder(.115, .115, .01, 32), plain(0x4a2e24, 1)), 0, .27, 0);
      const bark = plain(0x6f5446, .95), leaf = plain(0x7d7a58, .8);
      put(g, mesh(tube([[0, .27, 0], [.02, .6, .01], [-.03, .9, 0], [.01, 1.1, .02]], .022, 30, 8), bark));
      for (const [x, z] of [[-.16, .05], [.15, -.04], [.02, .14]]) put(g, mesh(tube([[0, .85, 0], [x * .6, 1.0, z * .6], [x, 1.12, z]], .01, 12, 6), bark));
      const n = 320, leaves = new THREE.InstancedMesh(ellipsoid(.034, .006, .011), leaf, n);
      const crowns = [[-.16, 1.16, .05, .2], [.15, 1.14, -.04, .19], [.02, 1.28, .14, .2], [0, 1.2, 0, .22]];
      const o = new THREE.Object3D(), col = new THREE.Color();
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < n; i++) {
        const [cx, cy, cz, cr] = crowns[i % crowns.length], u = rnd() * PI * 2, v = Math.acos(2 * rnd() - 1), rr = cr * Math.cbrt(rnd());
        o.position.set(cx + rr * Math.sin(v) * Math.cos(u), cy + rr * Math.cos(v) * .8, cz + rr * Math.sin(v) * Math.sin(u));
        o.rotation.set(rnd() * PI, rnd() * PI, rnd() * PI);
        o.updateMatrix(); leaves.setMatrixAt(i, o.matrix);
        leaves.setColorAt(i, col.setHSL(.15, .14 + rnd() * .08, .3 + rnd() * .14));
      }
      leaves.castShadow = true;
      g.add(leaves);
      return g;
    };
    B['arco-wall-mirror'] = (F) => {
      const g = new THREE.Group();
      const s = ellipseShape(.3, .4);
      s.holes.push(ellipseShape(.225, .325, new THREE.Path()));
      put(g, mesh(extrude(s, .04, .012), F), 0, 0, .02);
      put(g, new THREE.Mesh(new THREE.ShapeGeometry(ellipseShape(.23, .33), 64), mirror()), 0, 0, .012);
      return g;
    };
    B['textured-rug'] = () => {
      const g = new THREE.Group(), wool = surface('natural', 0xd6b994, 2.2);
      const r = mesh(roundedBox(2, .014, 3, .006, 1), wool); r.castShadow = false;
      put(g, r, 0, .007, 0);
      return g;
    };
    B['cushion-collection'] = (F, k) => {
      const g = new THREE.Group(), other = surface(k === 'natural' ? 'terracotta' : 'natural');
      rb(g, .46, .44, .15, .075, F, -.22, .22, 0, -.12, .12, .03);
      rb(g, .42, .4, .14, .07, other, .22, .2, .03, -.14, -.1, -.04);
      return g;
    };
    B['throw-blanket'] = () => {
      const g = new THREE.Group(), knit = surface('terracotta', 0xd8a58a);
      rb(g, .62, .07, .4, .03, knit, 0, .035, 0);
      const fringe = new THREE.InstancedMesh(cylinder(.004, .004, .07, 5), knit, 22), o = new THREE.Object3D();
      for (let i = 0; i < 22; i++) { o.position.set(-.29 + i * .0276, .012, .225); o.rotation.set(PI / 2 - .2, 0, 0); o.updateMatrix(); fringe.setMatrixAt(i, o.matrix); }
      g.add(fringe);
      return g;
    };
    B['wall-art'] = () => {
      const g = new THREE.Group(), oak = surface('oak');
      const s = roundRect(.6, .8, .01);
      s.holes.push(roundRect(.53, .73, .005, 0, 0, new THREE.Path()));
      put(g, mesh(extrude(s, .03, .004), oak), 0, 0, .015);
      const tex = texture('wall-art', true);
      put(g, new THREE.Mesh(new THREE.PlaneGeometry(.53, .73), new THREE.MeshStandardMaterial({ map: tex, roughness: .9 })), 0, 0, .008);
      return g;
    };
    B['decor-set'] = (F) => {
      const g = new THREE.Group();
      const s = arch(.16, .24);
      s.holes.push(arch(.08, .15, 0, new THREE.Path()));
      put(g, mesh(extrude(s, .06, .008), F), -.06, 0, 0);
      rb(g, .18, .03, .13, .005, plain(0xe7d8c6, .9), .07, .015, .02, 0, .2, 0);
      rb(g, .16, .028, .12, .005, plain(0xcdb49a, .9), .075, .044, .02, 0, -.1, 0);
      return g;
    };

    /* ---------- Build ---------- */
    function build(slug, finish, opts) {
      const make = B[slug];
      if (!make) return null;
      const k = finish || null;
      const F = k ? surface(k) : surface('travertine');
      const g = make(F, k, opts || {});
      g.userData.slug = slug;
      g.userData.glow = [];
      g.traverse((o) => { if (o.material && o.material.userData && o.material.userData.glow) g.userData.glow.push(o.material); });
      g.userData.lights = g.userData.lights || [];
      return g;
    }

    return { build, has: (slug) => !!B[slug], roundedBox, turned, extrude, arch, roundRect, surface, plain, glowing };
  }

  window.DECO_MODELS = { create };
})();
