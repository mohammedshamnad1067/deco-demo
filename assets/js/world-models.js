/* =========================================================
   DECO · 3D pieces for the atelier on the home page
   Every piece in the catalogue, built from soft primitives at its
   true size (catalogue dims are W × D × H in cm), skinned with the
   real material scans in assets/materials/ through object-space
   triplanar mapping, so bouclé loops and stone pores keep the same
   scale on every shape. Front faces +z, the floor is y = 0.

   DECO_MODELS.create(THREE, { texture, tones, quality }) returns
     build(slug, finish) → THREE.Group, and prop(name, opts) for the
     things a shop is dressed with (books, ceramics, plants, bags).
   A group's userData: { slug, glow: [materials lit at night],
   lights: [[x, y, z, power]] (local points where a lamp shines) }.
   quality 'high' adds a soft sheen to upholstery.
   ========================================================= */
(function () {
  'use strict';

  function create(THREE, { texture, tones, quality }) {
    const V2 = THREE.Vector2, V3 = THREE.Vector3, PI = Math.PI;
    const HI = quality === 'high';

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
    const ellipsoid = (rx, ry, rz) => memo(`el${rx},${ry},${rz}`, () => new THREE.SphereGeometry(1, 28, 16).scale(rx, ry, rz));
    const dome = (r, sy, open = true) => memo(`dm${r},${sy}`, () => new THREE.SphereGeometry(r, 48, 16, 0, PI * 2, 0, PI / 2).scale(1, sy, 1));
    const cylinder = (rt, rb, h, seg = 40, open = false) => memo(`cy${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
    /* A turned piece: [radius, height] pairs through a smooth spline, spun around y. */
    const turned = (pts, seg = 48) => memo(`la${pts.join(';')}|${seg}`, () => {
      const c = new THREE.SplineCurve(pts.map(([x, y]) => new V2(x, y)));
      return new THREE.LatheGeometry(c.getPoints(pts.length * 6).map((p) => new V2(Math.max(0, p.x), p.y)), seg);
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
    /* [texture repeats per metre, roughness, metalness, relief (height of the loops, grain or pores in metres), gloss drift] */
    const FEEL = {
      natural: [3.3, 1, 0, .0026, 0], terracotta: [3.3, 1, 0, .0026, 0], olive: [2.6, .95, 0, .0012, 0],
      travertine: [2, .46, 0, .0004, .7], oak: [1.3, .56, 0, .00045, .6], walnut: [1.3, .5, 0, .00035, .6], smoked: [1.3, .5, 0, .00035, .6],
      brass: [2, .32, .85, .00012, .7], leather: [2.4, .6, 0, .0005, .5]
    };
    const FABRIC = { natural: 1, terracotta: 1, olive: 1 };
    const LUM = 'vec3(.3, .59, .11)';

    /* Object-space triplanar mapping: the scan is projected along x, y and z and blended by the surface normal.
       Its brightness doubles as height: the neighbouring pixels' samples tilt the normal (bouclé loops, open
       grain, stone pores catch the light), and nudge the roughness so highlights break up as they do on real
       oiled wood and honed stone. Relief is in metres, so it fades with distance the way real texture does. */
    function triplanar(m, scale, relief = 0, drift = 0) {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTri = { value: scale };
        sh.uniforms.uRelief = { value: relief };
        sh.uniforms.uDrift = { value: drift };
        sh.vertexShader = 'varying vec3 vTriP;\nvarying vec3 vTriN;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vTriP = (instanceMatrix * vec4(position, 1.0)).xyz; vTriN = mat3(instanceMatrix) * normal;
          #else
            vTriP = position; vTriN = normal;
          #endif`);
        sh.fragmentShader = 'uniform float uTri;\nuniform float uRelief;\nuniform float uDrift;\nvarying vec3 vTriP;\nvarying vec3 vTriN;\nfloat decoH = .5;\nvec2 decoD = vec2(0.0);\n' + sh.fragmentShader
          .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
            #ifdef USE_MAP
              /* Projections that hardly show are skipped (flat faces need one); gradients are taken first, so mip levels stay right. */
              vec4 decoTri(vec3 p, vec3 w) {
                vec2 a = p.zy * uTri, b = p.xz * uTri, c = p.xy * uTri;
                vec2 ax = dFdx(a), ay = dFdy(a), bx = dFdx(b), by = dFdy(b), cx = dFdx(c), cy = dFdy(c);
                vec4 s = vec4(0.0); float k = 0.0;
                if (w.x > .02) { s += textureGrad(map, a, ax, ay) * w.x; k += w.x; }
                if (w.y > .02) { s += textureGrad(map, b, bx, by) * w.y; k += w.y; }
                if (w.z > .02) { s += textureGrad(map, c, cx, cy) * w.z; k += w.z; }
                return s / max(k, 1e-4);
              }
            #endif`)
          .replace('#include <map_fragment>', `
            #ifdef USE_MAP
              vec3 tw = pow(abs(vTriN) / max(length(vTriN), 1e-6), vec3(4.0));
              tw /= max(tw.x + tw.y + tw.z, 1e-6);
              vec4 sampledDiffuseColor = decoTri(vTriP, tw);
              diffuseColor *= sampledDiffuseColor;
              decoH = dot(sampledDiffuseColor.rgb, ${LUM});
              #ifdef DECO_RELIEF
                decoD = vec2(dot(decoTri(vTriP + dFdx(vTriP), tw).rgb, ${LUM}), dot(decoTri(vTriP + dFdy(vTriP), tw).rgb, ${LUM})) - decoH;
              #endif
            #endif`)
          .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (1.0 + (.5 - decoH) * uDrift), .04, 1.0);')
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            #ifdef DECO_RELIEF
            {
              vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
              vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
              float det = dot(sx, r1) * faceDirection;
              vec3 grad = sign(det) * uRelief * (decoD.x * r1 + decoD.y * r2), bent = abs(det) * normal - grad;
              if (abs(det) > 1e-14 && dot(bent, bent) > 1e-28) normal = normalize(bent);
            }
            #endif`);
      };
      if (relief > 0) m.defines = Object.assign(m.defines || {}, { DECO_RELIEF: '' });
      m.customProgramCacheKey = () => 'deco-tri';
      return m;
    }
    const WHITE = new THREE.Color(1, 1, 1);
    function surface(key, tint, scale) {
      const [s0, rough, metal, relief, drift] = FEEL[key] || FEEL.travertine, s = scale || s0;
      const o = { map: texture(PHOTO[key] || 'travertine'), roughness: rough, metalness: metal, color: tint === undefined ? 0xffffff : tint };
      /* Upholstery gets a velvet sheen at grazing angles: the soft rim of light that reads as wool. */
      const m = HI && FABRIC[key]
        ? new THREE.MeshPhysicalMaterial(Object.assign(o, { sheen: 1, sheenRoughness: .55, sheenColor: tone(key).lerp(WHITE, .3).multiplyScalar(.75) }))
        : new THREE.MeshStandardMaterial(o);
      return triplanar(m, s, relief, drift);
    }
    const plain = (color, rough = .85, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    function tone(k, fb = '#CDB49A') { return new THREE.Color((k && tones[k]) || fb); }
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

    /* Many small things, one draw: shapes are baked into a single mesh, each keeping its own colour. */
    function batch() {
      const parts = [], q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new V3();
      return {
        add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
          const m = new THREE.Matrix4().compose(new V3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)).clone(), typeof s === 'number' ? sc.set(s, s, s).clone() : s);
          parts.push([geo, m, new THREE.Color(color)]);
        },
        get size() { return parts.length; },
        mesh(mat) {
          let n = 0;
          const flat = parts.map(([g, m, c]) => { const ng = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m); n += ng.attributes.position.count; return [ng, c]; });
          const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
          let o = 0;
          for (const [g, c] of flat) {
            const k = g.attributes.position.count;
            pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
            for (let i = 0; i < k; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
            o += k; g.dispose();
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
          geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
          geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
          geo.userData.own = 1; // not shared: freed when its piece is rebuilt
          return mesh(geo, mat);
        }
      };
    }
    const tinted = (rough = .9) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough });

    /* A few quiet things for shelves: books and small turned pots. Not for sale on their own.
       A book is two boards and a spine around a block of paper, so the page edges show. */
    const BOOKS = [0xcdb49a, 0x9a5236, 0xe7d8c6, 0x6e6a4e, 0x58372b, 0xb9a48c, 0x3b241b];
    const PAGES = 0xf2e9da;
    function book(b, w, h, d, color, x, y, z, ry = 0, flat = false) {
      /* Standing: w is the spine's thickness, h its height. Flat: w × d is the cover, h the thickness. */
      const t = .0035;
      if (flat) {
        const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
        b.add(roundedBox(w, t, d, .0015, 1), color, x, y + t / 2, z, 0, ry);
        b.add(roundedBox(w, t, d, .0015, 1), color, x, y + h - t / 2, z, 0, ry);
        const [sx, sz] = at(-w / 2 + t / 2, 0); b.add(roundedBox(t, h, d, .0015, 1), color, sx, y + h / 2, sz, 0, ry);
        const [px, pz] = at(t / 2, 0); b.add(roundedBox(w - t * 2.2, h - t * 2, d - t * 2.4, .001, 1), PAGES, px, y + h / 2, pz, 0, ry);
      } else {
        b.add(roundedBox(t, h, d, .0015, 1), color, x - w / 2 + t / 2, y + h / 2, z);
        b.add(roundedBox(t, h, d, .0015, 1), color, x + w / 2 - t / 2, y + h / 2, z);
        b.add(roundedBox(w, h, t, .0015, 1), color, x, y + h / 2, z + d / 2 - t / 2);
        b.add(roundedBox(w - t * 2, h - t * 1.6, d - t * 2.2, .001, 1), PAGES, x, y + h / 2, z - t * .6);
      }
    }
    function books(g, x, y, z, n, seed = 1, into) {
      const b = into || batch();
      let cx = x;
      for (let i = 0; i < n; i++) {
        const h = .17 + ((seed * (i + 3) * 37) % 7) / 100, w = .025 + ((seed * (i + 1) * 13) % 3) / 100;
        book(b, w, h, .15, BOOKS[(seed + i) % BOOKS.length], cx + w / 2, y, z);
        cx += w + .003;
      }
      if (!into) g.add(b.mesh(tinted()));
    }
    const pot = (g, x, y, z, s = 1, color = 0xe8dccd) => put(g, mesh(turned([[0, 0], [.04 * s, 0], [.055 * s, .05 * s], [.05 * s, .1 * s], [.03 * s, .14 * s], [.034 * s, .15 * s], [0, .15 * s]]), plain(color, .55)), x, y, z);

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
      g.userData.lights = [[0, .02, 0, .75]];
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
      const n = 320, leaves = new THREE.InstancedMesh(memo('oliveleaf', () => new THREE.SphereGeometry(1, 6, 4).scale(.034, .006, .011)), leaf, n);
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

    /* ---------- Props: what a shop is dressed with. Not for sale, not touchable. ---------- */
    const PR = {};
    const GLAZE = [0xe8dccd, 0xd8c3a8, 0x9a5236, 0xb58a66, 0xf1e8de, 0x6e6a4e, 0x8c6a4f];
    const rand = (seed) => { let s = seed * 9301 + 49297; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
    /* Candle flames show only at night; the scene finds them by this mark. */
    const flame = (g, x, y, z, s = 1) => { const f = put(g, new THREE.Mesh(ellipsoid(.006 * s, .015 * s, .006 * s), glowing(0xfff3dc, 0xffb05a)), x, y, z); f.userData.flame = 1; return f; };

    /* Coffee-table books, lying flat in a loose stack. */
    PR.books = (o) => {
      const g = new THREE.Group(), b = batch(), r = rand(o.seed || 1);
      let y = 0;
      for (let i = 0; i < (o.n || 3); i++) {
        const w = .22 + r() * .08, d = .27 + r() * .07, h = .02 + r() * .02;
        book(b, w, h, d, BOOKS[Math.floor(r() * BOOKS.length)], (r() - .5) * .02, y, (r() - .5) * .02, (r() - .5) * .35, true);
        y += h;
      }
      g.add(b.mesh(tinted()));
      return g;
    };
    /* A few glazed pieces: a bottle, a round vase, a low bowl. */
    PR.ceramics = (o) => {
      const g = new THREE.Group(), r = rand(o.seed || 1), b = batch();
      const shapes = [
        [[0, 0], [.035, 0], [.05, .03], [.055, .09], [.045, .15], [.018, .2], [.016, .26], [.022, .272], [0, .266]],
        [[0, 0], [.03, 0], [.065, .04], [.07, .08], [.05, .12], [.03, .135], [.032, .146], [0, .14]],
        [[0, 0], [.035, 0], [.07, .02], [.086, .06], [.08, .063], [.062, .026], [0, .02]]
      ];
      const spots = [[-.07, -.02], [.065, .025], [0, .1]];
      for (let i = 0; i < Math.min(3, o.n || 3); i++) {
        const sh = shapes[(i + (o.seed || 0)) % shapes.length];
        b.add(turned(sh, 40), GLAZE[Math.floor(r() * GLAZE.length)], spots[i][0], 0, spots[i][1], 0, r() * 6, 0, .8 + r() * .45);
      }
      g.add(b.mesh(tinted(.38)));
      return g;
    };
    PR.candles = (o) => {
      const g = new THREE.Group(), wax = plain(0xf3ebdf, .62), wick = plain(0x2a1a13, 1), n = o.n || 3, hs = [.12, .085, .06];
      for (let i = 0; i < n; i++) {
        const h = hs[i % 3], x = (i - (n - 1) / 2) * .085, z = (i % 2) * .035;
        put(g, mesh(cylinder(.034, .034, h, 28), wax), x, h / 2, z);
        put(g, new THREE.Mesh(cylinder(.0015, .0015, .012, 6), wick), x, h + .006, z);
        flame(g, x, h + .024, z);
      }
      return g;
    };
    /* A taper in a turned brass holder, for the dining table. */
    PR.tapers = () => {
      const g = new THREE.Group();
      put(g, mesh(turned([[0, 0], [.045, 0], [.047, .006], [.02, .014], [.012, .05], [.019, .062], [.015, .07], [0, .07]], 32), surface('brass')));
      put(g, mesh(cylinder(.011, .012, .26, 16), plain(0xf1e6d6, .6)), 0, .2, 0);
      flame(g, 0, .348, 0, .9);
      return g;
    };
    /* One place at the table: plate, folded linen, brass cutlery, a glass. Front (+z) faces the diner. */
    const glassMat = () => new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: .04, transparent: true, opacity: .2, depthWrite: false, envMapIntensity: 1.6 });
    PR.setting = () => {
      const g = new THREE.Group(), cer = plain(0xf6f0e8, .26), brass = plain(0xc29a5e, .32, .9);
      put(g, mesh(turned([[0, 0], [.1, 0], [.118, .006], [.137, .018], [.142, .021], [.124, .013], [0, .009]], 56), cer));
      put(g, mesh(turned([[0, 0], [.055, 0], [.07, .006], [.088, .015], [.091, .017], [.075, .011], [0, .007]], 48), cer), 0, .011, 0);
      rb(g, .1, .014, .14, .006, surface('natural', 0xeadfd2, 6), 0, .026, .005, 0, .25, 0);
      rb(g, .012, .004, .19, .002, brass, -.175, .002, .01);
      rb(g, .014, .004, .2, .002, brass, .175, .002, .01);
      put(g, new THREE.Mesh(turned([[0, 0], [.032, 0], [.034, .006], [.036, .1], [.033, .1], [.031, .007], [0, .007]], 32), glassMat()), .15, 0, -.13);
      return g;
    };
    PR.fruit = (o) => {
      const g = new THREE.Group(), b = batch(), r = rand(o.seed || 3);
      for (const [x, z, y] of [[0, 0, .045], [.052, .03, .03], [-.048, .034, .03], [.02, -.054, .03], [-.032, -.046, .03]]) {
        b.add(ellipsoid(.034, .031, .034), r() > .45 ? 0xd9b03f : 0xcc7a2e, x, y, z, r(), r(), 0, .9 + r() * .2);
      }
      g.add(b.mesh(tinted(.45)));
      return g;
    };
    /* An olive tree in a stone planter, larger than the one sold as a pot. */
    PR.olive = (o) => { const g = B['luna-planter'](surface('travertine')); g.scale.setScalar(o.s || 1.7); return g; };
    /* A fiddle-leaf fig: three stems in a clay pot, broad leaves larger towards the floor. */
    PR.fig = (o) => {
      const g = new THREE.Group(), r = rand(o.seed || 5);
      put(g, mesh(turned([[0, 0], [.16, 0], [.2, .04], [.22, .3], [.232, .38], [.214, .386], [.2, .36], [0, .35]], 48), surface('travertine', 0xc99f82)));
      put(g, mesh(cylinder(.2, .2, .01, 32), plain(0x3e2a20, 1)), 0, .358, 0);
      const bark = plain(0x6f5a48, .95);
      const stems = [[[0, .36, 0], [.03, .9, .02], [-.02, 1.4, .04], [.04, 1.85, 0]], [[0, .36, 0], [-.06, .8, -.03], [-.16, 1.3, -.06], [-.2, 1.62, -.05]], [[.02, .36, 0], [.08, .72, -.02], [.18, 1.1, -.08], [.25, 1.42, -.06]]];
      const curves = stems.map((st) => new THREE.CatmullRomCurve3(st.map((p) => new V3(...p))));
      for (const st of stems) put(g, mesh(tube(st, .015, 40, 8), bark));
      /* A broad leaf: thin, folded a little along the midrib, narrower at the stalk, its tip lifting. */
      const leafGeo = memo('figleaf', () => {
        const gg = new THREE.SphereGeometry(1, 18, 10), p = gg.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), z = p.getZ(i);
          p.setY(i, p.getY(i) * .3 + Math.abs(x) * .9 + z * z * .5);
          p.setX(i, x * (1 - Math.max(0, -z) * .38));
        }
        gg.computeVertexNormals();
        return gg.scale(.1, .012, .15).translate(0, 0, .14);
      });
      const per = 17, leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .42, side: THREE.DoubleSide }), per * curves.length);
      const ob = new THREE.Object3D(), col = new THREE.Color();
      let k = 0;
      curves.forEach((c, j) => {
        for (let i = 0; i < per; i++, k++) {
          const t = .32 + (i / (per - 1)) * .68, a = i * 2.3 + j * 1.7 + r() * .6, out = new V3(Math.cos(a), 0, Math.sin(a));
          ob.position.copy(c.getPoint(t));
          ob.lookAt(ob.position.clone().add(out.multiplyScalar(1).add(new V3(0, .35 + r() * .5 + t * .3, 0))));
          ob.rotateZ((r() - .5) * .9);
          ob.scale.setScalar(1.15 - t * .5 + r() * .15);
          ob.updateMatrix(); leaves.setMatrixAt(k, ob.matrix);
          leaves.setColorAt(k, col.setHSL(.23 + r() * .04, .36 + r() * .1, .17 + r() * .08, THREE.SRGBColorSpace));
        }
      });
      leaves.castShadow = true;
      g.add(leaves);
      if (o.s) g.scale.setScalar(o.s);
      return g;
    };
    /* DECO paper bags and gift boxes, for the counter. */
    let logoTex = null;
    function logoTexture() {
      if (logoTex) return logoTex;
      const c = document.createElement('canvas'); c.width = 512; c.height = 640;
      const x = c.getContext('2d');
      x.fillStyle = '#E8DAC8'; x.fillRect(0, 0, 512, 640);
      const icon = document.querySelector('#logo-icon path'), word = document.querySelector('#logo-word path');
      x.fillStyle = '#3B241B';
      if (icon) { const k = 150 / 238; x.save(); x.translate(256 - 224 * k / 2, 190); x.scale(k, k); x.fill(new Path2D(icon.getAttribute('d')), 'evenodd'); x.restore(); }
      if (word) { const k = 52 / 238; x.save(); x.translate(256 - 629 * k / 2, 380); x.scale(k, k); x.fill(new Path2D(word.getAttribute('d')), 'evenodd'); x.restore(); }
      logoTex = new THREE.CanvasTexture(c); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
      return logoTex;
    }
    function bagProp(g, x, y, z, ry, s = 1) {
      const bag = new THREE.Group(), kraft = plain(0xe8dac8, .92), cord = plain(0x6f5446, .8);
      rb(bag, .3, .38, .12, .004, kraft, 0, .19, 0);
      put(bag, new THREE.Mesh(new THREE.PlaneGeometry(.3, .375), new THREE.MeshStandardMaterial({ map: logoTexture(), roughness: .92 })), 0, .19, .0605);
      for (const dz of [-.035, .035]) put(bag, mesh(new THREE.TorusGeometry(.055, .0045, 8, 28, PI), cord), 0, .378, dz);
      put(g, bag, x, y, z, 0, ry); bag.scale.setScalar(s);
      return bag;
    }
    function boxProp(g, w, h, d, color, x, y, z, ry) {
      const box = new THREE.Group(), ribbon = plain(0x9a5236, .55);
      rb(box, w, h, d, .006, plain(color, .85), 0, h / 2, 0);
      rb(box, w + .004, h + .004, .025, .002, ribbon, 0, h / 2, 0);
      rb(box, .025, h + .006, d + .004, .002, ribbon, 0, h / 2, 0);
      put(box, mesh(new THREE.TorusGeometry(.022, .006, 8, 20), ribbon), 0, h + .012, 0, PI / 2 - .5, 0, .6);
      put(g, box, x, y, z, 0, ry);
      return box;
    }
    /* The low cabinet behind the counter. Front (+z) faces the counter. */
    PR.backbar = () => {
      const g = new THREE.Group(), wal = surface('walnut');
      rb(g, 1.84, .04, .36, .01, plain(0x2a1a13, .8), 0, .02, 0);
      rb(g, 1.9, .78, .42, .05, wal, 0, .43, 0);
      for (const x of [-.475, 0, .475]) seam(g, .006, .6, x, .43, .212);
      bagProp(g, -.62, .82, 0, .1); bagProp(g, -.3, .82, -.04, -.12, .85);
      boxProp(g, .26, .12, .2, 0xf1e8de, .22, .82, 0, .2); boxProp(g, .2, .1, .16, 0xc9b49a, .24, .94, 0, -.15); boxProp(g, .16, .14, .16, 0x6e6a4e, .58, .82, .02, .4);
      return g;
    };
    /* The materials library: a long oak table laid with what a client can take home as samples. */
    PR.library = () => {
      const g = new THREE.Group(), oak = surface('oak'), W = 2.4, D = .9, H = .75;
      rb(g, W, .05, D, .02, oak, 0, H - .025, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, mesh(cylinder(.03, .026, H - .05, 20), oak), sx * (W / 2 - .12), (H - .05) / 2, sz * (D / 2 - .1));
      [['natural', -.9], ['terracotta', -.58], ['olive', -.26]].forEach(([k, x]) => {
        const m = surface(k);
        for (let i = 0; i < 5; i++) rb(g, .14, .006, .2, .003, m, x + i * .012, H + .003 + i * .0062, -.06 + i * .022, 0, .3 - i * .13, 0);
      });
      [['oak', .12], ['walnut', .3], ['smoked', .48]].forEach(([k, x], i) => rb(g, .14, .04, .2, .008, surface(k), x, H + .02, -.1 + i * .03, 0, -.12 + i * .1, 0));
      for (let i = 0; i < 3; i++) rb(g, .2, .018, .2, .004, surface('travertine'), .86 - i * .035, H + .009 + i * .018, .04 + i * .02, 0, i * .22, 0);
      return g;
    };
    PR.platform = (o) => { const g = new THREE.Group(); rb(g, o.w, o.h, o.d, Math.min(.05, o.h / 2.4), surface('travertine', 0xf3eadf, 1.1), 0, o.h / 2, 0); return g; };
    /* A round stone display table, flared from a slim column. */
    PR.pedestal = (o) => {
      const g = new THREE.Group(), r = o.r || .6, h = o.h || .72;
      put(g, mesh(turned([[0, 0], [r * .5, 0], [r * .52, .02], [r * .36, h * .3], [r * .34, h * .62], [r * .82, h - .06], [r, h - .035], [r, h], [0, h]], 64), surface('travertine')));
      return g;
    };
    function prop(name, o) {
      const make = PR[name];
      if (!make) return null;
      const g = make(o || {});
      g.userData.glow = []; g.userData.flames = [];
      g.traverse((m) => { if (m.userData.flame) g.userData.flames.push(m); else if (m.material && m.material.userData && m.material.userData.glow) g.userData.glow.push(m.material); });
      return g;
    }

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

    return { build, prop, has: (slug) => !!B[slug], roundedBox, turned, extrude, arch, roundRect, cylinder, surface, plain, glowing, triplanar, batch, tinted };
  }

  window.DECO_MODELS = { create };
})();
