import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../.claude/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../.claude/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "../.claude/skills/anatomy/scripts/inline-kit.mjs";
import { SWITCH, LEAF, forceAt, kneeAt } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// World units are millimetres: x along the row, y front (+) to back (-), z up.
// The keyboard is sawn through the key centres at y = 0 and the front half is gone.
const WIDTH = 600;
const HEIGHT = 420;
const U = 19.05;
const KEYS = [
  { x: -U, name: "J", code: "KeyJ" },
  { x: 0, name: "K", code: "KeyK" },
  { x: U, name: "L", code: "KeyL" },
];
const SUBJECT = 1;

const BENCH = { x: -33, y: -15.5, w: 80, d: 21.5, r: 3.5 };
const BENCH_H = 5;
const FOOT_H = 3;
const BACK = -12.5;
const KB = { x0: -30.5, x1: 44.5 };
const Z = {
  base0: 2, base1: 3.6,
  pcb0: 7.6, pcb1: 9.2,
  plate0: 12.7, plate1: 14.2,
  floor: 9.8, under: 19.2, top: 20.2,
  knee: 14.2,
};
const PLATE_X = 28.575;
const HOUSING = { inner: 6.0, lower: 7, shoulder: 7.8, crown: 6.4 };
// Stem, at rest (it moves down by the travel).
const STEM = {
  body: [-3.3, 3.3], depth: -3.3, bottom: 16.2,
  pocket: { r: 2.75, top: 18.4 },
  pole: { r: 1.3, bottom: 13.4 },
  arm: 2, armT: 0.65, rib: 0.585, ribL: 2, crossTop: 28.4,
  leg: { y: [-3.2, -2.0], profile: [[-3.3, 13.8], [-4.9, 13.8], [-5.4, 14.2], [-5.4, 15.0], [-4.3, 16.2], [-3.3, 16.2]], column: [-4.3, -3.3] },
};
const POST = { rIn: 1.5, rOut: 1.9, top: 11.4, bore: 9.3, below: 6.2 };
const SPRING = { r: 2.4, wire: 0.4, turns: 8, base: Z.floor };
const LEAF_Y = [-3.2, -0.4];
const LEAF_ROOT = [-5.6, Z.floor];
const LEAF_BEND = [-5.6, 11.0];
const LEAF_KNEE = [-5.4, Z.knee];
const LEAF_TIP = [-5.75, 15.1];
const FIXED = { x: [-4.4, -4.05], y: [-1.6, -0.4], top: 14.7 };
const CAP = { z0: 20.8, top: 29.7, under: 28.4, bottom: 9, crownX: 6.35, crownY: 6.75, wall: 1.3, socket: 2.75, socketBottom: 24.5 };
const MCU = { x: 34.8, y: -7.4, half: 3.5, lead: 1, h: 1.4 };

const P = k.fitProjection(
  [...k.boxCorners(BENCH, -BENCH_H - FOOT_H, 0), [-28, 0, CAP.top], [-28, -9, CAP.top], [KB.x1, 0, 12.4], [KB.x1, BACK, 12]],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 58 },
);

const V = G.viewOf(P);
const LIGHT = G.lightOf(P);
const at = (point) => k.iso(point, P);
const path = (points, closed = true) => k.pathOf(points.map(at), closed);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const DOTS = (points, style) => k.dotsSvg(points, style);
const seen = (n) => G.dot3(n, V) > 1e-6;
const band = (n) => G.bandOf(G.dot3(G.unit3(n), LIGHT));
const toneAttr = (n) => (band(n) === 4 ? `class="iso-top"` : `class="iso-shade" data-shade="${band(n)}"`);
const face = (points, n) => `<path ${toneAttr(n)} d="${path(points)}"/>`;
const fillOf = (d) => `<path class="iso-fill" d="${d}"/>`;
const shift = (points, dx) => points.map(([x, y, z]) => [x + dx, y, z]);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function newell(points) {
  const n = [0, 0, 0];
  points.forEach((a, index) => {
    const b = points[(index + 1) % points.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  });
  return G.unit3(n);
}
const centroid = (points) => G.mul3(points.reduce((sum, p) => G.add3(sum, p), [0, 0, 0]), 1 / points.length);

// A closed convex solid from its faces, shaded and outlined like the kit's prisms.
function convex(faces) {
  const all = faces.flat();
  const middle = centroid(all);
  const buckets = [[], [], [], [], []];
  const info = faces.map((points) => {
    let n = newell(points);
    if (G.dot3(n, G.sub3(centroid(points), middle)) < 0) n = G.mul3(n, -1);
    const visible = seen(n);
    if (visible) buckets[band(n)].push(path(points));
    return { points, n, visible };
  });
  const edges = new Map();
  const key = (p) => p.map((v) => v.toFixed(3)).join(",");
  info.forEach((entry, index) =>
    entry.points.forEach((p, j) => {
      const q = entry.points[(j + 1) % entry.points.length];
      const id = [key(p), key(q)].sort().join("|");
      if (!edges.has(id)) edges.set(id, []);
      edges.get(id).push({ index, p, q });
    }),
  );
  const crease = [];
  for (const list of edges.values()) {
    if (list.length !== 2) continue;
    const [a, b] = list.map(({ index }) => info[index]);
    if (a.visible && b.visible && G.dot3(a.n, b.n) < 0.985) crease.push(path([list[0].p, list[0].q], false));
  }
  const hull = k.pathOf(G.hullOf(all.map(at)), true);
  return { fill: hull, outline: hull, crease: crease.join(""), top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")) };
}

const boxFaces = (x0, x1, y0, y1, z0, z1) => {
  const c = (x, y, z) => [x, y, z];
  return [
    [c(x0, y0, z0), c(x1, y0, z0), c(x1, y1, z0), c(x0, y1, z0)],
    [c(x0, y0, z1), c(x1, y0, z1), c(x1, y1, z1), c(x0, y1, z1)],
    [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)],
    [c(x0, y1, z0), c(x1, y1, z0), c(x1, y1, z1), c(x0, y1, z1)],
    [c(x0, y0, z0), c(x0, y1, z0), c(x0, y1, z1), c(x0, y0, z1)],
    [c(x1, y0, z0), c(x1, y1, z0), c(x1, y1, z1), c(x1, y0, z1)],
  ];
};
const box = (x0, x1, y0, y1, z0, z1) => convex(boxFaces(x0, x1, y0, y1, z0, z1));

// The cut face: a polygon in the y = 0 plane, given as [x, z] points.
const cutPath = (rings) => rings.map((ring) => path(ring.map(([x, z]) => [x, 0, z]))).join("");
const cutSvg = (rings, tone = "mid") => `<path class="kb-cut" fill-rule="evenodd" d="${cutPath(rings)}"/>${L(cutPath(rings), { tone })}`;

// A part sawn at y = 0: a prism of any [x, z] profile running back to y = depth.
// Edges listed in `open` are where the part was hollow (a pocket), so they get no wall.
function prismY(profile, depth, { open = [], tone = "hi", lit = false, cutTone = tone, className } = {}) {
  let ring = profile.map(([x, z]) => [x, z]);
  let area = 0;
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    area += ax * bz - bx * az;
  });
  const flip = area < 0;
  if (flip) ring = [...ring].reverse();
  const count = ring.length;
  const openSet = new Set(open.map((index) => (flip ? (count - 2 - index + count) % count : index)));
  const P3 = ([x, z], y) => [x, y, z];
  const fills = [];
  const buckets = [[], [], [], [], []];
  const outline = [];
  const crease = [];
  const sideSeen = [];
  for (let index = 0; index < count; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % count];
    const n = G.unit3([b[1] - a[1], 0, -(b[0] - a[0])]);
    const visible = !openSet.has(index) && seen(n);
    sideSeen.push(visible);
    if (visible) {
      const quad = [P3(a, 0), P3(b, 0), P3(b, depth), P3(a, depth)];
      buckets[band(n)].push(path(quad));
      fills.push(path(quad));
      outline.push(path([P3(a, depth), P3(b, depth)], false));
      crease.push(path([P3(a, 0), P3(b, 0)], false));
    } else outline.push(path([P3(a, 0), P3(b, 0)], false));
  }
  for (let index = 0; index < count; index++) {
    const before = (index - 1 + count) % count;
    if (openSet.has(index) || openSet.has(before)) continue;
    if (sideSeen[before] !== sideSeen[index]) outline.push(path([P3(ring[index], 0), P3(ring[index], depth)], false));
    else if (sideSeen[before] && sideSeen[index]) crease.push(path([P3(ring[index], 0), P3(ring[index], depth)], false));
  }
  const cap = path(ring.map((p) => P3(p, 0)));
  fills.push(cap);
  return [
    `<g class="iso-solid${className ? ` ${className}` : ""}"${lit ? " data-lit" : ""}>`,
    fillOf(fills.join("")),
    ...buckets.slice(0, 4).map((list, shade) => (list.length ? `<path class="iso-shade" data-shade="${shade}" d="${list.join("")}"/>` : "")),
    buckets[4].length ? `<path class="iso-top" d="${buckets[4].join("")}"/>` : "",
    `<path class="kb-cut" d="${cap}"/>`,
    L(crease.join(""), { tone: "faint" }),
    `<path class="iso-line iso-edge" data-tone="${tone}" d="${outline.join("")}"/>`,
    cutTone !== tone ? L(cap, { tone: cutTone }) : "",
    `</g>`,
  ].join("");
}

// A plan with rounded back corners and a straight front at y = 0 (the saw cut).
function halfPlan(x0, x1, y0, r, steps = 6) {
  const out = [[x1, 0]];
  for (let s = 0; s <= steps; s++) {
    const a = (s / steps) * (Math.PI / 2);
    out.push([x1 - r + r * Math.cos(a), y0 + r - r * Math.sin(a)]);
  }
  for (let s = 0; s <= steps; s++) {
    const a = Math.PI / 2 + (s / steps) * (Math.PI / 2);
    out.push([x0 + r + r * Math.cos(a), y0 + r - r * Math.sin(a)]);
  }
  out.push([x0, 0]);
  return out;
}
const halfCircle = (cx, r, steps = 20) => Array.from({ length: steps + 1 }, (_, s) => {
  const a = Math.PI + (s / steps) * Math.PI;
  return [cx + r * Math.cos(a), r * Math.sin(a)];
});

// A slab cut at y = 0, standing on the floor plan from halfPlan.
function slabCut(x0, x1, y0, r, z, h, { tone = "mid", bevel = 0, notches = [] } = {}) {
  const ring = halfPlan(x0, x1, y0, r);
  const paths = k.extrude(ring, z, h, P, { convex: true, bevel });
  const outer = [[x0, z], [x1, z], [x1, z + h], [x0, z + h]];
  const holes = notches.map(([a, b]) => [[a, z], [b, z], [b, z + h], [a, z + h]]);
  return S(paths, { tone, inner: cutSvg([outer, ...holes], tone) });
}

// A vertical half cylinder (a post, pole or peg cut down its axis).
function halfCyl(cx, cy, r, z, h, { tone = "mid", lit = false, steps = 20 } = {}) {
  const ring = halfCircle(cx, r, steps).map(([x, y]) => [x, cy + y]);
  const paths = k.extrude(ring, z, h, P, { convex: true });
  return S(paths, { tone, lit, inner: cutSvg([[[cx - r, z], [cx + r, z], [cx + r, z + h], [cx - r, z + h]]], tone) });
}

// ---------------------------------------------------------------- bench

function bench() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BENCH, -BENCH_H - FOOT_H, BENCH_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BENCH, 7))) {
    out.push(S(k.cylinder(x, y, 3.4, -BENCH_H - FOOT_H, 0.9, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 2.6, -BENCH_H - FOOT_H + 0.9, FOOT_H - 0.9, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BENCH, -BENCH_H, BENCH_H, P, 8, 0.6), { tone: "mid", inner: L(k.sideSeam(BENCH, -1.6, P, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BENCH, 2.2), 0, P), { tone: "lo" }));
  const screws = k.corners(BENCH, 4.6);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 1.1, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(DOTS(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a millimetre rule along the front, under the cut face
  const strip = { x: -29, y: 1.4, w: 54, d: 3.2, r: 0.5 };
  out.push(S(k.slabOf(strip, 0, 0.3, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 1, strip.x + strip.w - 1, 1, 5, strip.y + 0.15, 0.3, [0.8, 1.45], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  // the label plate
  const label = { x: 26.6, y: 0.9, w: 12.6, d: 4.2, r: 0.6 };
  out.push(S(k.slabOf(label, 0, 0.4, P, 3), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 0.6), 0.4, P, 3), { tone: "faint" }));
  out.push(L([[8, 0], [5.4, 1.2], [6.8, 2.4]].map(([w, row]) => k.lineOnTop([label.x + 1.6, label.y + 1.3 + row], [label.x + 1.6 + w, label.y + 1.3 + row], 0.4, P)).join(""), { tone: "lo", free: true }));
  out.push(DOTS([at([label.x + label.w - 1.6, label.y + 1.4, 0.4]), at([label.x + label.w - 1.6, label.y + label.d - 1.4, 0.4])], { size: 0.45 }));
  return out.join("");
}

// ---------------------------------------------------------------- keyboard frame

const BUMPERS = [[-27, -9.5], [41, -9.5], [-27, -2.6], [41, -2.6]];
const LOW_STANDOFFS = [[-27.5, -10], [29.9, -10.8], [42.2, -11]];
const PLATE_STANDOFFS = [[-27, -10.4], [27, -10.4]];
const HEX = (cx, cy, r) => Array.from({ length: 6 }, (_, s) => [cx + r * Math.cos((s / 6) * Math.PI * 2 + Math.PI / 6), cy + r * Math.sin((s / 6) * Math.PI * 2 + Math.PI / 6)]);

function underside() {
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: KB.x0 + 2, y: BACK + 1, w: KB.x1 - KB.x0 - 4, d: -BACK - 2, r: 3 }, 0, 3, P)}" style="opacity:.55"/>`];
  for (const [x, y] of byDepth(BUMPERS)) out.push(S(k.cylinder(x, y, 2.1, 0, Z.base0, P, 24), { tone: "lo" }));
  out.push(slabCut(KB.x0, KB.x1, BACK, 2.5, Z.base0, Z.base1 - Z.base0, { tone: "mid", bevel: 0.3 }));
  return out.join("");
}

function lowStandoffs() {
  return byDepth(LOW_STANDOFFS)
    .map(([x, y]) => S(k.extrude(HEX(x, y, 1.75), Z.base1, Z.pcb0 - Z.base1, P), { tone: "mid", inner: L(k.ringSeam(HEX(x, y, 1.75), Z.base1 + 1.2, P), { tone: "faint" }) }))
    .join("");
}

// ---------------------------------------------------------------- switch

const leafPins = (key) => [[key.x - 5.6, -1.0], [key.x - 4.22, -1.0]];

function underPcb(key) {
  const out = [];
  // pins through the board, with their solder fillets
  for (const [x, y] of byDepth(leafPins(key))) {
    const F = G.frameOf([x, y, Z.pcb0], [0, 0, -1], [1, 0, 0], [0, 1, 0]);
    out.push(S(G.solidOf([[0, 0.34], [2.1, 0.34]], F, P), { tone: "mid" }));
    out.push(S(G.lathe([[0, 0], [0, 1.0], [0.25, 0.62, 1], [0.6, 0.44, 1], [0.95, 0.36], [0.95, 0]], F, P), { tone: "hi" }));
  }
  return out.join("");
}

function belowHousing(key) {
  // the centre post and two plastic pegs come through the board
  return [halfCyl(key.x - 5.08, 0, 0.85, POST.below + 0.6, Z.pcb1 - POST.below - 0.6), halfCyl(key.x, 0, POST.rOut, POST.below, Z.pcb1 - POST.below), halfCyl(key.x + 5.08, 0, 0.85, POST.below + 0.6, Z.pcb1 - POST.below - 0.6)].join("");
}

function pcb() {
  const notches = KEYS.flatMap((key) => [[key.x - 5.08 - 0.9, key.x - 5.08 + 0.9], [key.x - 2, key.x + 2], [key.x + 5.08 - 0.9, key.x + 5.08 + 0.9]]);
  const out = [slabCut(KB.x0 + 1, KB.x1 - 1, BACK + 0.5, 1.5, Z.pcb0, Z.pcb1 - Z.pcb0, { tone: "mid", bevel: 0.25, notches })];
  return out.join("");
}

// copper on the top layer: the row, the diodes' pads, and the stubs from the column vias to the controller
const ROW_Y = -4.6;
const DIODE_X = (key) => key.x - 9.5;
const COL_VIA = (index) => [MCU.x - 2.8 + index * 0.8, -1.0];
const ROW_PIN_Y = MCU.y + 2.8;
const MCU_LEFT = MCU.x - MCU.half - MCU.lead;
function traces() {
  const z = Z.pcb1 + 0.02;
  const row = [[DIODE_X(KEYS[0]), ROW_Y], [MCU_LEFT, ROW_PIN_Y]];
  const out = [`<path class="iso-line kb-trace" data-part="row" d="${k.onTop(row, z, P)}"/>`];
  KEYS.forEach((key, index) => {
    const [vx, vy] = COL_VIA(index);
    out.push(`<path class="iso-line kb-trace" data-part="col-${index}" d="${k.onTop([[vx, vy], [vx, MCU.y + MCU.half + MCU.lead]], z, P)}"/>`);
    out.push(`<path class="iso-line kb-trace" data-part="anode-${index}" d="${k.onTop([[DIODE_X(key), -0.3], [key.x - 5.6, -0.3]], z, P)}"/>`);
  });
  out.push(L(KEYS.map((_, index) => k.ring(...COL_VIA(index), 0.45, z, P, 12)).join(""), { tone: "mid" }));
  out.push(DOTS(KEYS.map((_, index) => at([...COL_VIA(index), z])), { size: 0.5, tone: "mid" }));
  return out.join("");
}

function diode(key, index) {
  const x = DIODE_X(key);
  const zc = Z.pcb1 + 0.95;
  const F = G.frameOf([x, -0.8, zc], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
  const out = [];
  // the back lead, cathode end, goes down to the row
  out.push(`<path class="iso-line kb-lead" d="${path([[x, -3.8, zc], [x, -4.35, zc], [x, ROW_Y, zc - 0.25], [x, ROW_Y, Z.pcb1]], false)}"/>`);
  out.push(S(G.solidOf([[0, 0.78], [0.25, 0.95, 1], [2.75, 0.95, 1], [3.0, 0.78]], F, P), { tone: "hi" }));
  out.push(`<g class="kb-band">${S(G.disc(2.15, 2.6, 0.97, F, P), { tone: "mid" })}</g>`);
  out.push(`<path class="iso-line kb-lead" data-part="lead-${index}" d="${path([[x, -0.8, zc], [x, -0.45, zc], [x, -0.3, zc - 0.25], [x, -0.3, Z.pcb1]], false)}"/>`);
  out.push(DOTS([at([x, -0.3, Z.pcb1]), at([x, ROW_Y, Z.pcb1])], { size: 0.55, tone: "mid" }));
  return out.join("");
}

function plateStandoffs() {
  return byDepth(PLATE_STANDOFFS).map(([x, y]) => S(k.extrude(HEX(x, y, 1.6), Z.pcb1, Z.plate0 - Z.pcb1, P), { tone: "mid" })).join("");
}

// The plate is one sheet with 14 mm holes; drawn whole first, then each bridge
// between two switches is painted again over the switch on its left.
const BRIDGES = [[-PLATE_X, -26.05], [-12.05, -7], [7, 12.05], [26.05, PLATE_X]];
function plate() {
  const r = 1.5;
  const back = halfPlan(-PLATE_X, PLATE_X, BACK + 0.5, r).slice(1, -1);
  const comb = [[-PLATE_X, 0]];
  BRIDGES.forEach(([a, b], index) => {
    if (index > 0) comb.push([a, -7], [a, 0]);
    comb.push([b, 0]);
    if (index < BRIDGES.length - 1) comb.push([b, -7]);
  });
  const ring = [...comb, ...back];
  const paths = k.extrude(ring, Z.plate0, Z.plate1 - Z.plate0, P, { convex: false, bevel: 0.25 });
  const cuts = BRIDGES.map(([a, b]) => [[a, Z.plate0], [b, Z.plate0], [b, Z.plate1], [a, Z.plate1]]);
  const out = [S(paths, { tone: "mid", inner: cutSvg(cuts) })];
  out.push(L(PLATE_STANDOFFS.map(([x, y]) => k.ring(x, y, 1.15, Z.plate1, P, 16)).join(""), { tone: "lo" }));
  out.push(DOTS(PLATE_STANDOFFS.map(([x, y]) => at([x, y, Z.plate1])), { size: 0.5 }));
  return out.join("");
}
function bridgeAgain(index) {
  const [a, b] = BRIDGES[index];
  const z0 = Z.plate0;
  const z1 = Z.plate1;
  const topQuad = [[a, -7, z1], [b, -7, z1], [b, 0, z1], [a, 0, z1]];
  const cut = [[a, z0], [b, z0], [b, z1], [a, z1]];
  return [
    fillOf(path(topQuad) + cutPath([cut])),
    `<path class="iso-top" d="${path(topQuad)}"/>`,
    cutSvg([cut]),
    L(path([[a, -7, z1], [a, 0, z1]], false) + path([[b, 0, z1], [b, -7, z1]], false), { tone: "mid" }),
  ].join("");
}

// ---- switch internals (built at the key's x, stem at rest)

function cavity(key) {
  const x = key.x;
  const i = HOUSING.inner;
  const back = shift([[-i, -i, Z.floor], [i, -i, Z.floor], [i, -i, Z.under], [-i, -i, Z.under]], x);
  const left = shift([[-i, -i, Z.floor], [-i, 0, Z.floor], [-i, 0, Z.under], [-i, -i, Z.under]], x);
  const floor = shift([[-i, -i, Z.floor], [i, -i, Z.floor], [i, 0, Z.floor], [-i, 0, Z.floor]], x);
  const out = [`<g class="kb-cavity">`, fillOf(path(back) + path(left) + path(floor)), face(back, [0, 1, 0]), face(left, [1, 0, 0]), face(floor, [0, 0, 1])];
  out.push(L(path(shift([[-i, -i, Z.floor], [-i, -i, Z.under]], x), false) + path(shift([[-i, 0, Z.floor], [-i, -i, Z.floor], [i, -i, Z.floor]], x), false), { tone: "faint" }));
  // the two slots the contacts are held in, and a moulded rib on the back wall
  out.push(L(path(shift([[-i, -3.4, Z.floor], [-5.2, -3.4, Z.floor], [-5.2, -0.2, Z.floor], [-i, -0.2, Z.floor]], x)), { tone: "faint" }));
  out.push(L(path(shift([[3.6, -i, Z.floor], [3.6, -i, Z.under]], x), false) + path(shift([[4.4, -i, Z.floor], [4.4, -i, Z.under]], x), false), { tone: "faint" }));
  out.push(`</g>`);
  return out.join("");
}

function fixedContact(key) {
  const x = key.x;
  const b = convex(boxFaces(x + FIXED.x[0], x + FIXED.x[1], FIXED.y[0], FIXED.y[1], Z.floor, FIXED.top));
  const shut = leafGeometry(0, LEAF.shut)[2];
  const pad = G.sphereOf([x + FIXED.x[0] - 0.05, -1.0, shut[1]], 0.4, P, { steps: 24 });
  return `<g data-part="fixed-${KEYS.indexOf(key)}">${S(b, { tone: "hi" })}${S(pad, { tone: "hi" })}</g>`;
}

// The leaf spring is rebuilt every frame from the knee position, here and in the page.
function leafGeometry(ox, knee) {
  const R = Math.hypot(LEAF_KNEE[0] - LEAF_BEND[0], LEAF_KNEE[1] - LEAF_BEND[1]);
  const beta = Math.atan2(LEAF_KNEE[0] - LEAF_BEND[0], LEAF_KNEE[1] - LEAF_BEND[1]);
  const phi = Math.asin(Math.max(-1, Math.min(1, (knee - LEAF_BEND[0]) / R))) - beta;
  const turn = ([px, pz]) => {
    const dx = px - LEAF_BEND[0];
    const dz = pz - LEAF_BEND[1];
    return [LEAF_BEND[0] + dx * Math.cos(phi) + dz * Math.sin(phi), LEAF_BEND[1] - dx * Math.sin(phi) + dz * Math.cos(phi)];
  };
  return [LEAF_ROOT, LEAF_BEND, turn(LEAF_KNEE), turn(LEAF_TIP)].map(([px, pz]) => [px + ox, pz]);
}
function leafPaths(profile, view, light, toPoint, flat) {
  const [y0, y1] = LEAF_Y;
  const shades = [[], [], [], [], []];
  const outlinePoints = [];
  const faces = [];
  for (let index = 0; index < profile.length - 1; index++) {
    const [ax, az] = profile[index];
    const [bx, bz] = profile[index + 1];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let n = [(bz - az) / length, 0, -(bx - ax) / length];
    if (n[0] * view[0] + n[2] * view[2] < 0) n = [-n[0], 0, -n[2]];
    const score = n[0] * light[0] + n[2] * light[2];
    const tone = score >= 0.62 ? 4 : score >= 0.42 ? 3 : score >= 0.2 ? 2 : score >= 0 ? 1 : 0;
    const quad = flat([toPoint(ax, y1, az), toPoint(bx, y1, bz), toPoint(bx, y0, bz), toPoint(ax, y0, az)], true);
    shades[Math.min(3, tone)].push(quad);
    faces.push(quad);
  }
  const front = profile.map(([px, pz]) => toPoint(px, y1, pz));
  const back = profile.map(([px, pz]) => toPoint(px, y0, pz));
  const [tx, tz] = profile[profile.length - 1];
  const outline = flat(front, false) + flat(back, false) + flat([toPoint(tx, y1, tz), toPoint(tx, y0, tz)], false) + flat([toPoint(profile[0][0], y1, profile[0][1]), toPoint(profile[0][0], y0, profile[0][1])], false);
  const knee = profile[2];
  const pad = toPoint(knee[0] + 0.05, -1.0, knee[1]);
  return { fill: faces.join(""), shades: shades.map((list) => list.join("")), outline, pad };
}
const leafNode = (key, index, knee) => {
  const g = leafPaths(leafGeometry(key.x, knee), V, LIGHT, (px, py, pz) => [px, py, pz], (points, closed) => path(points, closed));
  return [
    `<g class="iso-solid kb-leaf" data-part="leaf-${index}">`,
    `<path class="iso-fill" data-leaf="fill" d="${g.fill}"/>`,
    ...g.shades.map((d, shade) => `<path class="iso-shade" data-shade="${shade}" data-leaf="shade-${shade}" d="${d}"/>`),
    `<path class="iso-line iso-edge" data-tone="hi" data-leaf="edge" d="${g.outline}"/>`,
    `<circle class="kb-pad" data-leaf="pad" cx="${at(g.pad)[0].toFixed(2)}" cy="${at(g.pad)[1].toFixed(2)}" r="1.15"/>`,
    `</g>`,
  ].join("");
};

// The spring's back half, cut at y = 0: the coil behind the cut, and the wire's cut ends.
function springPaths(ox, top, flat) {
  const { r, turns } = SPRING;
  const base = SPRING.base;
  const steps = Math.round(turns * 40);
  const runs = [];
  let run = [];
  const ends = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const angle = Math.PI + t * turns * Math.PI * 2;
    const y = r * Math.sin(angle);
    const z = base + SPRING.wire / 2 + t * (top - base - SPRING.wire);
    const point = [ox + r * Math.cos(angle), y, z];
    if (y <= 1e-6) run.push(point);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  for (let h = 0; h <= turns * 2; h++) {
    const t = h / (turns * 2);
    const z = base + SPRING.wire / 2 + t * (top - base - SPRING.wire);
    ends.push([ox + (h % 2 === 0 ? -r : r), 0, z]);
  }
  return { coil: runs.map((points) => flat(points, false)).join(""), ends };
}
const springNode = (key, index, top) => {
  const g = springPaths(key.x, top, (points, closed) => path(points, closed));
  return `<g data-part="spring-${index}"><path class="kb-wire" d="${g.coil}"/><path class="kb-wire-core" d="${g.coil}"/><g class="kb-ends">${g.ends.map((p) => `<circle cx="${at(p)[0].toFixed(2)}" cy="${at(p)[1].toFixed(2)}" r="1"/>`).join("")}</g></g>`;
};

function stemBack(key) {
  const x = key.x;
  const out = [];
  // the leg that holds the leaf open
  const leg = STEM.leg.profile.map(([px, pz]) => [px + x, pz]);
  const F = G.frameOf([0, STEM.leg.y[1], 0], [0, -1, 0], [1, 0, 0], [0, 0, 1]);
  out.push(S(G.prismOf(F, leg, 0, STEM.leg.y[1] - STEM.leg.y[0], P), { tone: "hi" }));
  const [c0, c1] = STEM.leg.column;
  out.push(S(G.prismOf(F, [[x + c0, STEM.bottom], [x + c1, STEM.bottom], [x + c1, Z.under], [x + c0, Z.under]], 0, STEM.leg.y[1] - STEM.leg.y[0], P), { tone: "hi" }));
  // the pocket the spring's top end sits in: its back wall, seen through the cut
  const r = STEM.pocket.r;
  const steps = 16;
  const facets = [];
  for (let s = 0; s < steps; s++) {
    const a0 = Math.PI + (s / steps) * Math.PI;
    const a1 = Math.PI + ((s + 1) / steps) * Math.PI;
    const n = [-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0];
    if (!seen(n)) continue;
    facets.push(face([[x + r * Math.cos(a0), r * Math.sin(a0), STEM.bottom], [x + r * Math.cos(a1), r * Math.sin(a1), STEM.bottom], [x + r * Math.cos(a1), r * Math.sin(a1), STEM.pocket.top], [x + r * Math.cos(a0), r * Math.sin(a0), STEM.pocket.top]], n));
  }
  out.push(`<g class="kb-pocket">${fillOf(path(halfCircle(x, r, 24).map(([px, py]) => [px, py, STEM.bottom])) + path([[x - r, 0, STEM.bottom], [x - r, 0, STEM.pocket.top], [x + r, 0, STEM.pocket.top], [x + r, 0, STEM.bottom]]))}${facets.join("")}</g>`);
  return out.join("");
}

function postBack(key) {
  const x = key.x;
  const out = [];
  const facets = [];
  const steps = 16;
  for (let s = 0; s < steps; s++) {
    const a0 = Math.PI + (s / steps) * Math.PI;
    const a1 = Math.PI + ((s + 1) / steps) * Math.PI;
    const n = [-Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0];
    if (!seen(n)) continue;
    const r = POST.rIn;
    facets.push(face([[x + r * Math.cos(a0), r * Math.sin(a0), POST.bore], [x + r * Math.cos(a1), r * Math.sin(a1), POST.bore], [x + r * Math.cos(a1), r * Math.sin(a1), POST.top], [x + r * Math.cos(a0), r * Math.sin(a0), POST.top]], n));
  }
  const annulus = [...halfCircle(x, POST.rOut, 20).map(([px, py]) => [px, py, POST.top]), ...halfCircle(x, POST.rIn, 20).reverse().map(([px, py]) => [px, py, POST.top])];
  out.push(fillOf(path(annulus)), ...facets, `<path class="iso-top" d="${path(annulus)}"/>`, L(path(halfCircle(x, POST.rIn, 20).map(([px, py]) => [px, py, POST.top]), false), { tone: "faint" }));
  return `<g class="iso-solid">${out.join("")}</g>`;
}

function postFront(key) {
  const x = key.x;
  const steps = 20;
  const facets = [];
  for (let s = 0; s < steps; s++) {
    const a0 = Math.PI + (s / steps) * Math.PI;
    const a1 = Math.PI + ((s + 1) / steps) * Math.PI;
    const n = [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0];
    if (!seen(n)) continue;
    const r = POST.rOut;
    facets.push([[x + r * Math.cos(a0), r * Math.sin(a0), Z.floor], [x + r * Math.cos(a1), r * Math.sin(a1), Z.floor], [x + r * Math.cos(a1), r * Math.sin(a1), POST.top], [x + r * Math.cos(a0), r * Math.sin(a0), POST.top]]);
  }
  const n = (pts) => newell(pts);
  const limb = path([facets[0][0], facets[0][3]], false);
  return `<g class="iso-solid">${fillOf(facets.map((f) => path(f)).join(""))}${facets.map((f) => face(f, n(f).map((v) => -v))).join("")}${L(limb + path([facets[0][3], ...facets.map((f) => f[2])], false), { tone: "mid" })}</g>`;
}

function pole(key) {
  return halfCyl(key.x, 0, STEM.pole.r, STEM.pole.bottom, STEM.pocket.top - STEM.pole.bottom, { tone: "hi" });
}

function stemFront(key, lit) {
  const x = key.x;
  const [b0, b1] = STEM.body;
  const r = STEM.pocket.r;
  const body = [[x + b0, STEM.bottom], [x - r, STEM.bottom], [x - r, STEM.pocket.top], [x + r, STEM.pocket.top], [x + r, STEM.bottom], [x + b1, STEM.bottom], [x + b1, Z.under], [x + b0, Z.under]];
  const out = [prismY(body, STEM.depth, { open: [1, 2, 3], tone: "hi", lit })];
  out.push(cross(key, lit));
  return out.join("");
}
function cross(key, lit) {
  const x = key.x;
  const rib = prismY([[x - STEM.rib, Z.under], [x + STEM.rib, Z.under], [x + STEM.rib, STEM.crossTop], [x - STEM.rib, STEM.crossTop]], -STEM.ribL, { tone: "hi", lit });
  const arm = prismY([[x - STEM.arm, Z.under], [x + STEM.arm, Z.under], [x + STEM.arm, STEM.crossTop], [x - STEM.arm, STEM.crossTop]], -STEM.armT, { tone: "hi", lit });
  return rib + arm;
}

function housingLower(key) {
  const x = key.x + HOUSING.lower;
  const quad = [[x, -HOUSING.lower, Z.pcb1], [x, 0, Z.pcb1], [x, 0, Z.plate0], [x, -HOUSING.lower, Z.plate0]];
  return `<g class="iso-solid">${fillOf(path(quad))}${face(quad, [1, 0, 0])}${L(path(quad), { tone: "mid" })}</g>`;
}

function housingUpper(key, tone) {
  const x = key.x;
  const s = HOUSING.shoulder;
  const c = HOUSING.crown;
  const right = [[x + s, -s, Z.plate1], [x + s, 0, Z.plate1], [x + c, 0, Z.top], [x + c, -c, Z.top]];
  const top = [[x - c, -c, Z.top], [x + c, -c, Z.top], [x + c, 0, Z.top], [x - c, 0, Z.top]];
  const back = [[x - s, -s, Z.plate1], [x + s, -s, Z.plate1], [x + c, -c, Z.top], [x - c, -c, Z.top]];
  const nRight = G.unit3([Z.top - Z.plate1, 0, s - c]);
  const out = [`<g class="iso-solid">`, fillOf(path(right) + path(top)), face(right, nRight), face(top, [0, 0, 1])];
  // the latch window where the top housing snaps over the bottom one
  const along = (t, depth) => [x + s + (c - s) * t, -depth, Z.plate1 + (Z.top - Z.plate1) * t];
  out.push(L(path([along(0.18, 2.2), along(0.18, s - 2.2), along(0.5, c - 2.2), along(0.5, 2.2)]), { tone: "faint" }));
  // the window a backlight shines through, and the stem's guide marks
  out.push(L(path([[x - 2.6, -c + 0.9, Z.top], [x + 2.6, -c + 0.9, Z.top], [x + 2.6, -c + 2.3, Z.top], [x - 2.6, -c + 2.3, Z.top]]), { tone: "faint" }));
  out.push(L(path(right) + path([[x - c, 0, Z.top], [x - c, -c, Z.top], [x + c, -c, Z.top]], false) + path([back[0], back[3]], false), { tone }));
  out.push(`</g>`);
  // the whole section of the housing: walls, floor, the centre post, and the top with the stem's hole
  const i = HOUSING.inner;
  const lo = HOUSING.lower;
  const section = [
    [-lo, Z.pcb1], [lo, Z.pcb1], [lo, Z.plate1], [s, Z.plate1], [c, Z.top], [STEM.arm + 0.15, Z.top], [STEM.arm + 0.15, Z.under],
    [i, Z.under], [i, Z.floor], [POST.rOut, Z.floor], [POST.rOut, POST.top], [POST.rIn, POST.top], [POST.rIn, POST.bore],
    [-POST.rIn, POST.bore], [-POST.rIn, POST.top], [-POST.rOut, POST.top], [-POST.rOut, Z.floor], [-i, Z.floor], [-i, Z.under],
    [-STEM.arm - 0.15, Z.under], [-STEM.arm - 0.15, Z.top], [-c, Z.top], [-s, Z.plate1], [-lo, Z.plate1],
  ].map(([px, pz]) => [px + x, pz]);
  out.push(cutSvg([section], tone));
  return out.join("");
}

// The keycap: a hollow shell sawn in half, with the stem socket under its top.
function capRing(z) {
  const t = (z - CAP.z0) / (CAP.top - CAP.z0);
  return { hx: CAP.bottom + (CAP.crownX - CAP.bottom) * t, hy: CAP.bottom + (CAP.crownY - CAP.bottom) * t };
}
function keycapInner(key) {
  const x = key.x;
  const w = CAP.wall;
  const a = capRing(CAP.z0);
  const b = capRing(CAP.under);
  const back = [[x - a.hx + w, -a.hy + w, CAP.z0], [x + a.hx - w, -a.hy + w, CAP.z0], [x + b.hx - w, -b.hy + w, CAP.under], [x - b.hx + w, -b.hy + w, CAP.under]];
  const left = [[x - a.hx + w, -a.hy + w, CAP.z0], [x - a.hx + w, 0, CAP.z0], [x - b.hx + w, 0, CAP.under], [x - b.hx + w, -b.hy + w, CAP.under]];
  return [
    `<g class="iso-solid kb-capin">`,
    fillOf(path(back) + path(left)),
    face(back, newell(back).map((v) => -v)[1] > 0 ? newell(back).map((v) => -v) : newell(back)),
    face(left, newell(left)[0] > 0 ? newell(left) : newell(left).map((v) => -v)),
    L(path([back[0], back[3]], false), { tone: "faint" }),
    `</g>`,
  ].join("");
}
function socket(key) {
  return halfCyl(key.x, 0, CAP.socket, CAP.socketBottom, CAP.under - CAP.socketBottom, { tone: "hi" });
}
function keycapOuter(key, tone) {
  const x = key.x;
  const w = CAP.wall;
  const a = capRing(CAP.z0);
  const b = capRing(CAP.top);
  const right = [[x + a.hx, -a.hy, CAP.z0], [x + a.hx, 0, CAP.z0], [x + b.hx, 0, CAP.top], [x + b.hx, -b.hy, CAP.top]];
  const top = [[x - b.hx, -b.hy, CAP.top], [x + b.hx, -b.hy, CAP.top], [x + b.hx, 0, CAP.top], [x - b.hx, 0, CAP.top]];
  const nRight = G.unit3([CAP.top - CAP.z0, 0, a.hx - b.hx]);
  const out = [`<g class="iso-solid">`, fillOf(path(right) + path(top)), face(right, nRight), face(top, [0, 0, 1])];
  // the cylindrical dish of the top, as faint contour lines
  const dish = [-0.42, 0.42].map((share) => path([[x + b.hx * 0.86 * share, -b.hy * 0.86, CAP.top], [x + b.hx * 0.86 * share, 0, CAP.top]], false));
  out.push(L(path([[x - b.hx * 0.86, 0, CAP.top], [x - b.hx * 0.86, -b.hy * 0.86, CAP.top], [x + b.hx * 0.86, -b.hy * 0.86, CAP.top], [x + b.hx * 0.86, 0, CAP.top]], false), { tone: "faint" }));
  out.push(L(dish.join(""), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([x - b.hx + 1.3, -b.hy + 3.2], CAP.top, P, "x"), key.name, { size: 2.9, tone: tone === "hi" ? "hi" : "mid" }));
  out.push(L(path(right) + path([[x - b.hx, 0, CAP.top], [x - b.hx, -b.hy, CAP.top], [x + b.hx, -b.hy, CAP.top]], false), { tone }));
  out.push(`</g>`);
  // the section: two walls and the top, with the socket hanging from it
  const inA = { hx: a.hx - w, hy: a.hy - w };
  const inB = capRing(CAP.under);
  const ib = { hx: inB.hx - w };
  const section = [
    [-a.hx, CAP.z0], [-inA.hx, CAP.z0], [-ib.hx, CAP.under], [-CAP.socket, CAP.under], [-CAP.socket, CAP.socketBottom], [-STEM.arm, CAP.socketBottom], [-STEM.arm, STEM.crossTop],
    [STEM.arm, STEM.crossTop], [STEM.arm, CAP.socketBottom], [CAP.socket, CAP.socketBottom], [CAP.socket, CAP.under], [ib.hx, CAP.under], [inA.hx, CAP.z0], [a.hx, CAP.z0], [b.hx, CAP.top], [-b.hx, CAP.top],
  ].map(([px, pz]) => [px + x, pz]);
  out.push(cutSvg([section], tone));
  return out.join("");
}

// screen offset of 1 mm of travel
const DOWN = k.axisVector(P, [0, 0, -1]);
const moved = (travel) => (travel ? `translate(${(DOWN[0] * travel).toFixed(3)} ${(DOWN[1] * travel).toFixed(3)})` : "");

// The stem's cross is drawn again after the housing top, clipped to the part above it.
function aboveClip(key, index) {
  const x = key.x;
  const footprint = [[x - STEM.arm, 0], [x + STEM.arm, 0], [x + STEM.arm, -STEM.armT], [x + STEM.rib, -STEM.armT], [x + STEM.rib, -STEM.ribL], [x - STEM.rib, -STEM.ribL], [x - STEM.rib, -STEM.armT], [x - STEM.arm, -STEM.armT]];
  const flat = footprint.map(([px, py]) => at([px, py, Z.top]));
  const up = flat.map(([sx, sy]) => [sx, sy - 400]);
  return `<clipPath id="kb-above-${index}"><path d="${k.pathOf(G.hullOf([...flat, ...up]), true)}"/></clipPath>`;
}

function keyNode(key, index) {
  const subject = index === SUBJECT;
  const tone = subject ? "hi" : "mid";
  const move = (inner, part) => `<g data-move="${index}"${part ? ` data-part="${part}"` : ""}>${inner}</g>`;
  return [
    move(keycapInner(key), `capin-${index}`),
    cavity(key),
    leafNode(key, index, LEAF.rest),
    move(stemBack(key)),
    fixedContact(key),
    springNode(key, index, STEM.pocket.top),
    postBack(key),
    move(pole(key)),
    postFront(key),
    move(stemFront(key, false)),
    housingLower(key),
    bridgeAgain(index + 1),
    housingUpper(key, tone),
    move(socket(key)),
    `<g clip-path="url(#kb-above-${index})">${move(cross(key, false))}</g>`,
    move(keycapOuter(key, tone), `cap-${index}`),
  ].join("");
}

// ---------------------------------------------------------------- controller

function controller() {
  const out = [];
  const { x, y, half, lead, h } = MCU;
  const z = Z.pcb1;
  // the gull-wing leads on all four sides, 8 a side at 0.8 mm
  const leads = (side) => Array.from({ length: 8 }, (_, s) => {
    const t = -2.8 + s * 0.8;
    if (side === "-x") return [[x - half, y + t, z + 0.7], [x - half - 0.35, y + t, z + 0.7], [x - half - 0.55, y + t, z + 0.05], [x - half - lead, y + t, z + 0.05]];
    if (side === "-y") return [[x + t, y - half, z + 0.7], [x + t, y - half - 0.35, z + 0.7], [x + t, y - half - 0.55, z + 0.05], [x + t, y - half - lead, z + 0.05]];
    if (side === "+x") return [[x + half, y + t, z + 0.1], [x + half + 0.3, y + t, z + 0.1], [x + half + 0.5, y + t, z + 0.05], [x + half + lead, y + t, z + 0.05]];
    return [[x + t, y + half, z + 0.1], [x + t, y + half + 0.3, z + 0.1], [x + t, y + half + 0.5, z + 0.05], [x + t, y + half + lead, z + 0.05]];
  });
  const pads = (side) => leads(side).map((points) => {
    const [px, py] = points[3];
    return side === "-x" || side === "+x" ? [[px - 0.5, py - 0.22], [px + 0.5, py - 0.22], [px + 0.5, py + 0.22], [px - 0.5, py + 0.22]] : [[px - 0.22, py - 0.5], [px + 0.22, py - 0.5], [px + 0.22, py + 0.5], [px - 0.22, py + 0.5]];
  });
  for (const side of ["-y", "-x"]) {
    out.push(L(pads(side).map((ring) => k.onTop(ring, z + 0.02, P, true)).join(""), { tone: "faint" }));
    out.push(`<path class="iso-line kb-pin" d="${leads(side).map((points) => path(points, false)).join("")}"/>`);
  }
  out.push(S(k.slabOf({ x: x - half, y: y - half, w: half * 2, d: half * 2, r: 0.3 }, z + 0.1, h, P, 2, 0.25), { tone: "hi" }));
  out.push(L(k.ring(x - half + 1.1, y + half - 1.1, 0.45, z + 0.1 + h, P, 12), { tone: "lo" }));
  out.push(L(k.planOutline({ x: x - half + 0.6, y: y - half + 0.6, w: half * 2 - 1.2, d: half * 2 - 1.2, r: 0.2 }, z + 0.1 + h, P, 2), { tone: "faint" }));
  out.push(L([[3.6, 0], [2.6, 1.1], [3.0, 2.2]].map(([w, row]) => k.lineOnTop([x - 1.6, y - 1.4 + row], [x - 1.6 + w, y - 1.4 + row], z + 0.1 + h, P)).join(""), { tone: "lo", free: true }));
  for (const side of ["+y", "+x"]) {
    out.push(L(pads(side).map((ring) => k.onTop(ring, z + 0.02, P, true)).join(""), { tone: "faint" }));
    out.push(`<path class="iso-line kb-pin" d="${leads(side).map((points) => path(points, false)).join("")}"/>`);
  }
  return out.join("");
}

function crystal() {
  const c = { x: 35.6, y: -2.6, w: 3.2, d: 2.3, r: 0.25 };
  const out = [S(k.slabOf(c, Z.pcb1, 0.35, P, 2), { tone: "lo" })];
  out.push(S(k.slabOf(k.insetPlan(c, 0.2), Z.pcb1 + 0.35, 0.45, P, 2, 0.15), { tone: "mid" }));
  const caps = [[30.2, -1.0], [30.2, -2.3], [31.2, -11.6]];
  for (const [cx, cy] of byDepth(caps)) {
    out.push(S(k.slabOf({ x: cx - 0.8, y: cy - 0.4, w: 0.45, d: 0.8, r: 0.05 }, Z.pcb1, 0.8, P, 1), { tone: "mid" }));
    out.push(S(k.slabOf({ x: cx - 0.35, y: cy - 0.4, w: 0.7, d: 0.8, r: 0.05 }, Z.pcb1, 0.75, P, 1), { tone: "lo" }));
    out.push(S(k.slabOf({ x: cx + 0.35, y: cy - 0.4, w: 0.45, d: 0.8, r: 0.05 }, Z.pcb1, 0.8, P, 1), { tone: "mid" }));
  }
  return out.join("");
}

function resetButton() {
  const b = { x: 45.2, y: -12, w: 3.6, d: 3, r: 0.3 };
  return [
    S(k.slabOf(b, Z.pcb1, 1.1, P, 2, 0.2), { tone: "mid" }),
    S(k.cylinder(b.x + 1.8, b.y + 1.5, 0.85, Z.pcb1 + 1.1, 0.5, P, 20), { tone: "hi" }),
  ].join("");
}

function usb() {
  const x0 = KB.x1 - 4.6;
  const x1 = KB.x1 + 0.6;
  const y = -6.2;
  const shell = { x: x0, y: y - 4.47, w: x1 - x0, d: 8.94, r: 1.4 };
  const out = [S(k.slabOf(shell, Z.pcb1, 3.2, P, 6, 0.3), { tone: "mid", inner: L(k.sideSeam(shell, Z.pcb1 + 1.6, P, 6), { tone: "faint" }) })];
  // the opening on its end face, with the tongue inside
  const M = k.sideMatrix([x1, 0], 0, P, "right");
  const slot = (y0, y1, z0, z1, r) => k.pathOf(k.roundedPlan({ x: y0, y: z0, w: y1 - y0, d: z1 - z0, r }, 6).map(([u, v]) => [-u, -v]), true);
  out.push(`<g transform="${M}"><path class="kb-hole" d="${slot(y - 4.1, y + 4.1, Z.pcb1 + 0.35, Z.pcb1 + 2.85, 1.2)}"/>${L(slot(y - 4.1, y + 4.1, Z.pcb1 + 0.35, Z.pcb1 + 2.85, 1.2), { tone: "mid" })}<path class="kb-tongue" d="${slot(y - 3.3, y + 3.3, Z.pcb1 + 1.35, Z.pcb1 + 1.95, 0.25)}"/>${L(slot(y - 3.3, y + 3.3, Z.pcb1 + 1.35, Z.pcb1 + 1.95, 0.25), { tone: "lo" })}</g>`);
  out.push(DOTS([at([x0 + 1.2, y - 4.6, Z.pcb1]), at([x0 + 1.2, y + 4.6, Z.pcb1])], { size: 0.5 }));
  return out.join("");
}

function ledNode() {
  const c = { x: 40.6, y: -12, w: 1.6, d: 0.8, r: 0.1 };
  return `<g data-part="led">${S(k.slabOf(c, Z.pcb1, 0.6, P, 1), { tone: "mid" })}</g>`;
}

// ---------------------------------------------------------------- assemble

const clips = KEYS.map(aboveClip).join("");
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A mechanical keyboard sawn in half along a row of three keys, on a bench plate. Each key is a keycap on the cross-shaped stem of a switch held in a steel plate over a circuit board. Inside the switch a coil spring holds the stem up, and a leg on the stem holds a leaf spring away from a fixed contact. Press a key 2 mm and the leaf touches the contact, closing the circuit through a diode to the row line that runs to the controller chip.",
  body: [
    `<defs>${clips}</defs>`,
    bench(),
    underside(),
    lowStandoffs(),
    ...KEYS.map(underPcb),
    pcb(),
    ...KEYS.map(belowHousing),
    traces(),
    plateStandoffs(),
    ...KEYS.map(diode),
    plate(),
    ...KEYS.map(keyNode),
    crystal(),
    ledNode(),
    controller(),
    usb(),
  ],
});


// ---------------------------------------------------------------- live

const DATA = {
  P, DOWN, V, LIGHT, SWITCH, LEAF, SUBJECT,
  keys: KEYS.map(({ x, name, code }) => ({ x, name, code })),
  LEAF_ROOT, LEAF_BEND, LEAF_KNEE, LEAF_TIP, LEAF_Y, SPRING, POCKET_TOP: STEM.pocket.top,
};
const fn = (f) => f.toString();
const LIVE = `
const D = ${JSON.stringify(DATA)};
const { P, DOWN, V, LIGHT, SWITCH, LEAF, SUBJECT, LEAF_ROOT, LEAF_BEND, LEAF_KNEE, LEAF_TIP, LEAF_Y, SPRING } = D;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const forceAt = ${fn(forceAt)};
const kneeAt = ${fn(kneeAt)};
const leafGeometry = ${fn(leafGeometry)};
const leafPaths = ${fn(leafPaths)};
const springPaths = ${fn(springPaths)};
const at = (p) => iso(p, P);
const flat = (points, closed) => pathOf(points.map(at), closed);
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const row = svg.querySelector('[data-part="row"]');
const keys = D.keys.map((key, i) => ({
  ...key, i, at: 0, v: 0, target: 0, held: false, closedFor: -1, sent: false, drawn: -1,
  moves: [...svg.querySelectorAll('[data-move="' + i + '"]')],
  leaf: svg.querySelector('[data-part="leaf-' + i + '"]'),
  spring: svg.querySelector('[data-part="spring-' + i + '"]'),
  lit: ['col-' + i, 'anode-' + i, 'lead-' + i].map((name) => svg.querySelector('[data-part="' + name + '"]')).filter(Boolean),
}));
for (const key of keys) {
  key.leafParts = {};
  key.leaf.querySelectorAll("[data-leaf]").forEach((node) => (key.leafParts[node.dataset.leaf] = node));
  key.coil = key.spring.querySelectorAll("path");
  key.ends = [...key.spring.querySelectorAll("circle")];
}
let focus = keys[SUBJECT];
let frame = 0, last = 0, visible = false, touring = !still.matches, idleTimer = 0, clock = 0, phase = "";

function draw(key) {
  const d = key.at;
  if (Math.abs(d - key.drawn) < 1e-4) return;
  key.drawn = d;
  const offset = d > 1e-4 ? "translate(" + (DOWN[0] * d).toFixed(3) + " " + (DOWN[1] * d).toFixed(3) + ")" : "";
  for (const node of key.moves) offset ? node.setAttribute("transform", offset) : node.removeAttribute("transform");
  const g = leafPaths(leafGeometry(key.x, kneeAt(d)), V, LIGHT, (x, y, z) => [x, y, z], flat);
  const parts = key.leafParts;
  parts.fill.setAttribute("d", g.fill);
  for (let s = 0; s < 4; s++) parts["shade-" + s].setAttribute("d", g.shades[s]);
  parts.edge.setAttribute("d", g.outline);
  const [px, py] = at(g.pad);
  parts.pad.setAttribute("cx", px.toFixed(2));
  parts.pad.setAttribute("cy", py.toFixed(2));
  const spring = springPaths(key.x, D.POCKET_TOP - d, flat);
  key.coil.forEach((node) => node.setAttribute("d", spring.coil));
  spring.ends.forEach((p, n) => {
    const [cx, cy] = at(p);
    key.ends[n].setAttribute("cx", cx.toFixed(2));
    key.ends[n].setAttribute("cy", cy.toFixed(2));
  });
}

function closedNow(key) { return key.at >= SWITCH.actuation - 1e-6; }

function light() {
  let any = false;
  for (const key of keys) {
    const on = closedNow(key);
    any = any || on;
    key.leaf.toggleAttribute("data-on", on);
    key.lit.forEach((node) => node.toggleAttribute("data-on", on));
  }
  row.toggleAttribute("data-on", any);
}

function say() {
  const key = focus;
  const state = !closedNow(key) ? "open" : key.sent ? "sent" : "closed";
  const text = key.name + " · " + key.at.toFixed(1) + " mm · " + forceAt(key.at).toFixed(0) + " cN · " + state;
  if (readout.textContent !== text) readout.textContent = text;
  const words = key.name + " key " + (key.at < 0.05 ? "up" : key.at > SWITCH.travel - 0.05 ? "bottomed out" : "down " + key.at.toFixed(1) + " millimetres") + ", contact " + (closedNow(key) ? "closed" : "open");
  const next = state + key.name + (key.at < 0.05 ? "up" : key.at > SWITCH.travel - 0.05 ? "bottom" : "mid");
  if (next !== phase) {
    phase = next;
    stage.setAttribute("aria-valuenow", key.at.toFixed(1));
    stage.setAttribute("aria-valuetext", words);
    if (key.sent && state === "sent") status.textContent = "Sent " + key.name + ".";
  }
}

// The tour: one slow press of K to show the contact closing at 2 mm, then a few quick keystrokes.
const TOUR = [
  ["slow", 1, 4, 2.6], ["wait", 0.7], ["slow", 1, 0, 1.9], ["wait", 0.9],
  ["tap", 0], ["wait", 0.2], ["tap", 1], ["wait", 0.2], ["tap", 2], ["wait", 0.35], ["tap", 1], ["wait", 0.2], ["tap", 0], ["wait", 1.4],
];
let step = 0, stepAge = 0, slow = null;
function tourTick(dt) {
  const [kind, a, b, c] = TOUR[step];
  stepAge += dt;
  let done = false;
  if (kind === "wait") done = stepAge >= a;
  else if (kind === "tap") { if (stepAge === dt) press(keys[a], 0.11); done = true; }
  else if (kind === "slow") {
    const key = keys[a];
    if (!slow) slow = { key, from: key.at, to: b, time: c };
    const t = Math.min(1, stepAge / slow.time);
    const e = t * t * (3 - 2 * t);
    key.target = slow.from + (slow.to - slow.from) * e;
    key.slowed = true;
    focus = key;
    if (t >= 1) { done = true; slow = null; key.slowed = false; }
  }
  if (done) { step = (step + 1) % TOUR.length; stepAge = 0; }
}

function press(key, hold) {
  key.held = true;
  key.target = SWITCH.travel;
  key.release = hold ? clock + hold : Infinity;
  focus = key;
  run();
}
function release(key) { key.held = false; key.target = 0; key.release = Infinity; run(); }

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) tourTick(dt);
  let busy = touring;
  for (const key of keys) {
    if (key.held && clock >= key.release) { key.held = false; key.target = 0; }
    // a finger takes about 30 ms to push a key home; the spring returns it a little slower
    const tau = key.slowed ? 0.02 : key.target > key.at ? 0.028 : 0.045;
    if (calm) { key.at = key.target; key.v = 0; }
    else {
      const w = 1 / tau;
      for (let s = 0; s < 4; s++) {
        key.v += (w * w * (key.target - key.at) - 2 * w * key.v) * (dt / 4);
        key.at += key.v * (dt / 4);
      }
      if (Math.abs(key.target - key.at) < 1e-4 && Math.abs(key.v) < 1e-3) { key.at = key.target; key.v = 0; }
    }
    key.at = clamp(key.at, 0, SWITCH.travel);
    if (closedNow(key)) {
      key.closedFor = key.closedFor < 0 ? 0 : key.closedFor + dt;
      if (key.closedFor >= SWITCH.debounce) key.sent = true;
    } else { key.closedFor = -1; key.sent = false; }
    draw(key);
    if (key.at !== key.target || key.held || (closedNow(key) && !key.sent)) busy = true;
  }
  light();
  say();
  frame = visible && busy ? requestAnimationFrame(tick) : 0;
}
function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }
function takeOver() {
  if (touring) {
    touring = false;
    slow = null;
    step = 0; stepAge = 0;
    for (const key of keys) { key.slowed = false; if (!key.held) key.target = 0; }
  }
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (still.matches) return; if (keys.some((key) => key.held)) return; touring = true; step = 0; stepAge = 0; run(); }, 3600);
}
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;

const byCode = (event) => keys.find((key) => key.code === event.code || key.name.toLowerCase() === (event.key || "").toLowerCase());
stage.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = byCode(event);
  if (key) { event.preventDefault(); takeOver(); if (!event.repeat) press(key, 0); return; }
  const k = keys[SUBJECT];
  let to = null;
  const big = event.shiftKey ? 1 : 0.25;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") to = k.target + big;
  if (event.key === "ArrowUp" || event.key === "ArrowLeft") to = k.target - big;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = SWITCH.travel;
  if (event.key === " ") { event.preventDefault(); takeOver(); k.held ? release(k) : press(k, 0); return; }
  if (event.key === "Escape") { takeOver(); keys.forEach(release); return; }
  if (to === null) return;
  event.preventDefault();
  takeOver();
  if (touring === false) k.target = clamp(Math.round((touring ? k.at : to) * 4) / 4, 0, SWITCH.travel);
  k.held = false; k.release = Infinity; k.slowed = true; focus = k;
  run();
});
stage.addEventListener("keyup", (event) => {
  const key = byCode(event);
  if (key) { takeOver(); release(key); }
});
const keyAt = (event) => {
  const hit = event.target.closest && event.target.closest("[data-move]");
  if (hit) return keys[Number(hit.dataset.move)];
  const box = svg.getBoundingClientRect();
  const sx = ((event.clientX - box.left) / box.width) * ${WIDTH};
  let best = null, gap = Infinity;
  for (const key of keys) {
    const [cx] = at([key.x, -4, 24]);
    if (Math.abs(sx - cx) < gap) { gap = Math.abs(sx - cx); best = key; }
  }
  return gap < 46 ? best : null;
};
let pressed = null;
stage.addEventListener("pointerdown", (event) => {
  const key = keyAt(event);
  if (!key) return;
  takeOver();
  pressed = key;
  key.slowed = false;
  press(key, 0);
  stage.focus({ preventScroll: true });
});
const lift = () => { if (pressed) { takeOver(); release(pressed); pressed = null; } };
stage.addEventListener("pointerup", lift);
stage.addEventListener("pointercancel", lift);
stage.addEventListener("pointerleave", lift);
stage.addEventListener("focus", () => { status.textContent = stage.getAttribute("aria-valuetext"); });
light();
say();
`;

const CSS = `<style>
.kb-cut{fill:var(--kb-cut);stroke:none}
.kb-wire{fill:none;stroke:var(--anatomy-hi);stroke-width:2.6px;stroke-linecap:round;stroke-linejoin:round}
.kb-wire-core{fill:none;stroke:var(--kb-wire);stroke-width:1.1px;stroke-linecap:round;stroke-linejoin:round}
.kb-ends circle{fill:var(--kb-cut);stroke:var(--anatomy-hi);stroke-width:.6px}
.kb-pad{fill:var(--anatomy-hi)}
.kb-trace{stroke:var(--anatomy-mid);stroke-width:1.2px;transition:stroke .12s}
.kb-trace[data-on]{stroke:var(--anatomy-lit);stroke-width:1.5px;stroke-dasharray:3 2.4;animation:kb-flow 700ms linear infinite}
.kb-lead[data-on]{stroke:var(--anatomy-lit)}
@keyframes kb-flow{to{stroke-dashoffset:-10.8}}
.kb-lead,.kb-pin{fill:none;stroke:var(--anatomy-mid);stroke-width:.9px;stroke-linecap:round;stroke-linejoin:round}
.kb-hole{fill:var(--anatomy-shade-0)}
.kb-tongue{fill:var(--anatomy-top)}
.kb-leaf[data-on] .iso-edge{stroke:var(--anatomy-lit)}
.kb-leaf[data-on] .iso-shade{fill:var(--anatomy-lit-shade)}
.iso{--kb-cut:#222222;--kb-move:#303030;--kb-wire:#8a8a8a}
[data-move] .kb-cut{fill:var(--kb-move)}
.iso[data-theme="light"]{--kb-cut:#cdcdc7;--kb-move:#ffffff;--kb-wire:#ffffff}
.iso-stage{touch-action:pan-y}
.iso-stage:focus{outline:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.kb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.kb-trace[data-on]{animation:none;stroke-dasharray:none}}
@media (max-width:560px){.iso-plate{overflow:hidden}.iso-stage .iso-svg{width:118%;margin:-6% -9% -3%}}
</style>`;

const body =
  CSS +
  k.plateHtml({
    fig: "Fig 1",
    title: "Key switch, sawn open",
    hint: "Type J K L · ↑↓ steps K",
    readout: `K · 0.0 mm · ${forceAt(0).toFixed(0)} cN · open`,
    keys: [
      { mark: "lit", label: "The circuit, once the leaf touches the fixed contact" },
      { mark: "raised", label: "Stem and keycap: 4 mm of travel against the spring" },
      { mark: "edge", label: "Copper: the row line through each key's diode to the controller" },
    ],
    caption: `A keyboard row sawn through its key centres. Under each keycap an MX-style switch clips into the steel plate and is soldered to the circuit board. A coil spring holds the stem up with about ${SWITCH.preload} cN; a leg on the stem holds a leaf spring off the fixed contact. Push the key ${SWITCH.actuation.toFixed(1)} mm (${forceAt(SWITCH.actuation).toFixed(0)} cN) and the leaf rides down a ramp on the leg onto the contact, joining that key's column to the row through its diode. The controller drives the columns one at a time and reads the row, so it knows which key closed; it waits ${SWITCH.debounce * 1000} ms for the contacts to stop bouncing before it sends the key. The stem bottoms out at ${SWITCH.travel.toFixed(1)} mm, about ${forceAt(SWITCH.travel).toFixed(0)} cN.`,
    body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Keyboard switch. Type J, K or L to press those keys; arrow keys step the K key down and up." aria-valuemin="0" aria-valuemax="4" aria-valuenow="0" aria-valuetext="K key up, contact open">${svg}<span class="kb-sr" role="status" aria-live="polite" data-status></span></div>`,
  });

const name = theme === "light" ? "keyboard-light.html" : "keyboard.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Key switch", theme, body, script: kitScript() + LIVE }));
console.log("wrote", name, (body.length / 1024).toFixed(0) + " KB");
