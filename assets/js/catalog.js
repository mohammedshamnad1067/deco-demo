/* =========================================================
   DECO · Catalogue
   Sample prices, sizes and copy. Replace with real data before launch.
   Images: assets/products/<slug>.jpg (1600 px) and <slug>-sm.jpg (800 px).
   ========================================================= */
(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'seating', name: 'Seating', line: 'Sofas, chairs and benches', cover: 'nora-accent-chair' },
    { id: 'tables', name: 'Tables', line: 'Coffee, side, console and dining', cover: 'sol-round-coffee-table' },
    { id: 'storage', name: 'Storage', line: 'Sideboards, cabinets and shelves', cover: 'vale-sideboard' },
    { id: 'bedroom', name: 'Bedroom', line: 'Beds, nightstands and dressers', cover: 'vale-bed' },
    { id: 'lighting', name: 'Lighting', line: 'Table, floor, pendant and wall', cover: 'luna-table-lamp' },
    { id: 'decor', name: 'Decor', line: 'Vases, textiles, mirrors and art', cover: 'stone-vase' }
  ];

  /* Finishes. `photo` is a file in assets/materials/ used for the swatch and the close-ups.
     `kind` groups them on the Materials page; `line` and `care` are shown there and in the finish explorer. */
  const FINISHES = {
    natural:    { name: 'Natural bouclé', photo: 'boucle', tone: '#F4E4D8', kind: 'Upholstery',
                  line: 'Undyed wool bouclé. Small loops of yarn catch the light and soften every edge.',
                  care: 'Brush in one direction with a soft brush. Blot spills at once; never rub.' },
    terracotta: { name: 'Terracotta bouclé', photo: 'terracotta', tone: '#9A5236', kind: 'Upholstery',
                  line: 'The same wool bouclé, dyed the red-brown of fired clay. Warm by day, deep by lamplight.',
                  care: 'Brush in one direction with a soft brush. Blot spills at once; never rub.' },
    olive:      { name: 'Olive wool', photo: 'wool', tone: '#6E6A4E', kind: 'Upholstery',
                  line: 'A dense, felted wool with a smooth face. Quiet, hard-wearing and soft to the hand.',
                  care: 'Vacuum with a soft brush head. Blot spills with a damp cloth.' },
    travertine: { name: 'Travertine', photo: 'travertine', tone: '#D8C3A8', kind: 'Stone',
                  line: 'Honed travertine, filled and sealed. Every slab has its own veins and pores, so no two pieces match.',
                  care: 'Wipe with a damp cloth and a drop of pH-neutral soap. Use coasters for wine and citrus.' },
    oak:        { name: 'White oak', photo: 'white-oak', tone: '#CDB49A', kind: 'Timber',
                  line: 'Solid white oak in a pale matt oil. The grain stays open and soft to the touch.',
                  care: 'Dust with a dry cloth. Re-oil twice a year with the care kit.' },
    walnut:     { name: 'Black walnut', photo: 'walnut', tone: '#58372B', kind: 'Timber',
                  line: 'Solid black walnut, oiled. Dark and warm, with a grain that deepens over the years.',
                  care: 'Dust with a dry cloth. Re-oil twice a year with the care kit.' },
    smoked:     { name: 'Smoked oak', photo: 'smoked-oak', tone: '#4A2E24', kind: 'Timber',
                  line: 'White oak darkened by fuming, not stain, then oiled. The colour runs into the grain.',
                  care: 'Dust with a dry cloth. Re-oil twice a year with the care kit.' }
  };
  const SOFT = ['terracotta', 'natural', 'olive'];
  const SOFT_N = ['natural', 'terracotta', 'olive'];
  const WOOD = ['oak', 'walnut', 'smoked'];

  /* [slug, name, category, price AED, finishes, W×D×H cm, lead, copy, tag] */
  const RAW = [
    ['mira-lounge-chair', 'Mira Lounge Chair', 'seating', 6900, SOFT_N, [80, 88, 68], 'made', 'One soft wrap of bouclé over a smoked oak frame. Low, deep and quiet. Shown as a pair.', 'New'],
    ['luna-sofa', 'Luna Sofa', 'seating', 14900, SOFT_N, [220, 95, 74], 'made', 'A deep, rounded sofa in natural bouclé. One continuous back that wraps into the arms.', 'Bestseller'],
    ['arco-lounge-chair', 'Arco Lounge Chair', 'seating', 7800, SOFT, [85, 88, 72], 'made', 'One arch of bouclé over a low seat of flat wool. Sit lower, sit longer.', 'New'],
    ['nora-accent-chair', 'Nora Accent Chair', 'seating', 5900, SOFT_N, [78, 80, 76], 'made', 'A sculpted shell that holds you on three sides. Upholstered by hand.', ''],
    ['vale-dining-chair', 'Vale Dining Chair', 'seating', 2450, SOFT, [56, 58, 78], 'made', 'A soft, solid dining chair with an open back. Easy to pull in, hard to leave.', ''],
    ['puff-ottoman', 'Puff Ottoman', 'seating', 2200, SOFT, [60, 60, 40], 'made', 'Six soft lobes around one seam. A footrest, a seat, a side table.', ''],
    ['curve-bench', 'Curve Bench', 'seating', 3600, SOFT, [140, 40, 45], 'made', 'One continuous curve, upholstered from end to end.', ''],
    ['mod-dining-chair', 'Mod Dining Chair', 'seating', 1950, ['natural', 'terracotta'], [52, 54, 80], 'made', 'A bouclé seat and curved back on a solid oak frame.', ''],

    ['sol-round-coffee-table', 'Sol Round Coffee Table', 'tables', 6400, ['travertine'], [100, 100, 38], 'made', 'A thick round of stone on four turned columns.', 'Bestseller'],
    ['lua-coffee-table', 'Lua Coffee Table', 'tables', 5800, ['travertine'], [110, 110, 32], 'made', 'Low and generous, on short rounded feet.', ''],
    ['cove-side-table', 'Cove Side Table', 'tables', 1900, ['travertine'], [40, 40, 55], 'made', 'A single column with a soft rolled top.', ''],
    ['ridge-console-table', 'Ridge Console Table', 'tables', 4700, ['travertine'], [120, 38, 78], 'made', 'One folded slab of stone, rounded at every turn.', ''],
    ['terra-dining-table', 'Terra Dining Table', 'tables', 11800, ['travertine'], [200, 100, 75], 'made', 'Seats eight on four solid columns. Honed and sealed for daily use.', 'New'],
    ['nest-tables', 'Nest Tables', 'tables', 3900, ['travertine'], [55, 55, 50], 'made', 'Two tables that tuck into each other. Set of two.', ''],
    ['pebble-side-table', 'Pebble Side Table', 'tables', 2100, ['travertine'], [45, 45, 48], 'made', 'Shaped like a stone from the shore, with a flat top for a cup.', ''],

    ['vale-sideboard', 'Vale Sideboard', 'storage', 9400, SOFT, [180, 48, 75], 'made', 'A long upholstered case with soft bolsters at each end.', 'New'],
    ['arc-cabinet', 'Arc Cabinet', 'storage', 7200, ['travertine'], [120, 45, 85], 'made', 'Two arched doors, inspired by the niche it stands in.', ''],
    ['tomo-bookshelf', 'Tomo Bookshelf', 'storage', 6900, SOFT, [90, 38, 180], 'made', 'Five rounded shelves in one soft frame.', ''],
    ['cloud-cabinet', 'Cloud Cabinet', 'storage', 6200, ['travertine'], [160, 45, 60], 'made', 'A low, rounded cabinet on four small feet.', ''],
    ['ridge-tv-unit', 'Ridge TV Unit', 'storage', 5600, WOOD, [200, 45, 40], 'made', 'Solid timber, three drawers, a low line along the wall.', ''],
    ['nora-display-shelf', 'Nora Display Shelf', 'storage', 4800, SOFT, [70, 35, 150], 'made', 'An arched shelf for the few things worth looking at.', ''],
    ['mini-storage', 'Mini Storage', 'storage', 2600, SOFT, [55, 45, 55], 'made', 'Two drawers in a soft, rounded case.', ''],

    ['vale-bed', 'Vale Bed', 'bedroom', 12600, SOFT, [180, 210, 95], 'made', 'A low upholstered bed with a rolled headboard. King size.', 'Bestseller'],
    ['luna-headboard-bed', 'Luna Headboard Bed', 'bedroom', 11900, SOFT_N, [180, 210, 100], 'made', 'A soft, rounded headboard on a deep base. King size.', ''],
    ['tomo-nightstand', 'Tomo Nightstand', 'bedroom', 2300, SOFT, [55, 42, 50], 'made', 'Two drawers on soft, rounded legs.', ''],
    ['stone-nightstand', 'Stone Nightstand', 'bedroom', 2400, ['travertine'], [45, 45, 55], 'made', 'A turned stone drum with a hidden drawer.', ''],
    ['curve-bedroom-bench', 'Curve Bedroom Bench', 'bedroom', 3200, SOFT, [120, 40, 45], 'made', 'Sized for the foot of the bed.', ''],
    ['dune-dresser', 'Dune Dresser', 'bedroom', 8400, ['travertine'], [150, 50, 80], 'made', 'Four deep drawers in a softened case.', ''],
    ['arco-mirror', 'Arco Floor Mirror', 'bedroom', 3800, ['travertine'], [70, 8, 160], 'made', 'An arched mirror in a thick stone frame. Leans against the wall.', ''],

    ['luna-table-lamp', 'Luna Table Lamp', 'lighting', 1650, ['travertine'], [45, 45, 52], 'stock', 'A stone dome over a stone base. The light falls down, never into your eyes.', 'Bestseller'],
    ['stone-table-lamp', 'Stone Table Lamp', 'lighting', 1450, ['travertine'], [40, 40, 55], 'stock', 'A linen shade on a rounded stone base.', ''],
    ['arc-floor-lamp', 'Arc Floor Lamp', 'lighting', 2900, ['travertine'], [140, 35, 190], 'stock', 'A bronze arc from a stone foot, to light a sofa from above.', ''],
    ['dune-pendant-light', 'Dune Pendant Light', 'lighting', 1850, ['travertine'], [50, 50, 30], 'stock', 'A deep stone dome for over a table.', ''],
    ['terra-pendant-light', 'Terra Pendant Light', 'lighting', 1700, ['travertine'], [60, 60, 20], 'stock', 'A wide, shallow dome with a soft spill of light.', 'New'],
    ['wall-sconce', 'Wall Sconce', 'lighting', 980, ['travertine'], [20, 15, 30], 'stock', 'Two stone forms and a glow between them.', ''],
    ['orbit-floor-lamp', 'Orbit Floor Lamp', 'lighting', 1600, [], [30, 30, 160], 'stock', 'An opal globe on a slim bronze stem.', ''],

    ['stone-vase', 'Stone Vase', 'decor', 420, ['travertine'], [28, 28, 40], 'stock', 'A full-bodied vase, turned and left matte.', ''],
    ['terra-bowl', 'Terra Bowl', 'decor', 280, ['travertine'], [30, 30, 12], 'stock', 'A wide stone bowl for fruit, keys or nothing at all.', ''],
    ['luna-planter', 'Luna Planter', 'decor', 540, ['travertine'], [32, 32, 30], 'stock', 'A round stone planter. Olive tree not included.', ''],
    ['arco-wall-mirror', 'Arco Wall Mirror', 'decor', 1900, ['travertine'], [60, 4, 80], 'stock', 'An oval mirror in a thick, rounded stone frame.', ''],
    ['textured-rug', 'Textured Rug', 'decor', 2400, [], [200, 300, 1], 'stock', 'Hand-tufted wool in a quiet, raised pattern.', ''],
    ['cushion-collection', 'Cushion Collection', 'decor', 390, ['terracotta', 'natural'], [50, 15, 50], 'stock', 'Two bouclé cushions, feather filled. Set of two.', ''],
    ['throw-blanket', 'Throw Blanket', 'decor', 450, [], [130, 180, 1], 'stock', 'Heavy knit wool with long fringes, in terracotta.', ''],
    ['wall-art', 'Wall Art', 'decor', 950, [], [60, 3, 80], 'stock', 'An original print in warm earth tones, framed in oak.', ''],
    ['decor-set', 'Decor Set', 'decor', 360, [], [30, 20, 25], 'stock', 'A stone arch and two linen-bound books.', '']
  ];

  const PRODUCTS = RAW.map(([slug, name, category, price, finishes, dims, lead, copy, tag], i) => ({
    slug, name, category, price, finishes, dims, lead, copy, tag, order: i,
    img: `assets/products/${slug}.jpg`, thumb: `assets/products/${slug}-sm.jpg`
  }));

  window.DECO_CATALOG = { CATEGORIES, FINISHES, PRODUCTS };
})();
