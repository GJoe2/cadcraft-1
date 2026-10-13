#!/usr/bin/env node
/* SPDX-License-Identifier: Apache-2.0 */
/**
 * test-cadcraft.mjs — the CadCraft drafting app's modules without a browser (the same files the
 * browser loads from public_html/assets/apps/cadcraft/<build>/).
 *
 *   node bin/test-cadcraft.mjs [--build dev|x.y] [--dwg <folder|file>] [--no-readers] [--verbose]
 *
 * Geometry (intersections, trim, extend, offset, fillet, mirror), the command line driven by a
 * stub host (typed coordinates, options, Enter/Esc, undo as one step per command), dimensions,
 * blocks, the clipboard (COPYCLIP/CUTCLIP/COPYBASE/PASTECLIP/PASTEORIG/DUPLICATE through a stand-in localStorage
 * shared by two "tabs", tampered contents refused, one undo step each), layouts and viewports, plotting to PDF,
 * DXF out → in round trips, and every DWG/DXF in
 * --dwg (default /var/www/CADCRAFT/testfiles/dwg-samples) imported, saved as DXF and re-read, with
 * each of its layouts plotted. DWG is read by the app's own reader (dwg/: byte-identical copies of cc-dwg's lib/dwg,
 * checked here). The saved DXF is
 * also checked by ezdxf, a strict second reader, when it is set up (once): python3 -m venv
 * tools/cadcraft-test/venv && tools/cadcraft-test/venv/bin/pip install ezdxf   (the venv is
 * git-ignored; audit.py is not). PDFs are also checked by poppler's pdfinfo when it is installed.
 * Save as DWG (dwg-save.js) is read back by LibreDWG, libdxfrw and the ODA File Converter
 * (tools/cadcraft-test/dwg-save-check.mjs; readers from tools/civilcraft-test/setup-dwg-readers.sh;
 * skipped with a note when they are not set up, or with --no-readers).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BUILD = opt('--build', 'dev');
const DWG = opt('--dwg', '/var/www/CADCRAFT/testfiles/dwg-samples');
const VERBOSE = args.includes('--verbose');
const APP = path.join(ROOT, 'public_html/assets/apps/cadcraft', BUILD);
const load = (f) => import(pathToFileURL(path.join(APP, f)).href);

const I18n = await load('i18n.js');
I18n.init({ strings: JSON.parse(fs.readFileSync(path.join(APP, 'lang/en.json'), 'utf8')) });   // before any module prints text
const EN = (k, v) => I18n.t(k, v);
const G = await load('geom.js');
const { Doc } = await load('doc.js');
const { Engine, arc3 } = await load('commands.js');
const { readDxf, writeDxf } = await load('dxf.js');
const { importDwg } = await load('dwg-import.js');
const Dm = await load('dims.js');
const Sh = await load('sheets.js');
const Pl = await load('plot.js');
const U = await load('units.js');
const Ht = await load('hatch.js');
const Tk = await load('tracking.js');
const Qs = await load('qselect.js');
const { DynInput } = await load('dynin.js');
const Ft = await load('findtext.js');
const Ld = await load('leader.js');
const Cb = await load('clipboard.js');
const { walk: walkFn } = await load('walk.js');

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); } };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
const nearPt = (p, x, y, t = 1e-6) => p && near(p.x, x, t) && near(p.y, y, t);
const section = (s) => console.log('\n' + s);
function pdfTool(tool, bytes, extra = []) {
  const bin = ['/usr/bin/' + tool, '/usr/local/bin/' + tool].find((f) => fs.existsSync(f));
  if (!bin) return null;
  const f = path.join(os.tmpdir(), 'cadcraft-test-' + process.pid + '.pdf');
  fs.writeFileSync(f, bytes);
  try { return execFileSync(bin, [...extra, f, ...(tool === 'pdftotext' ? ['-'] : [])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (err) { return 'Error: ' + (err.stderr || err.message); } finally { fs.unlinkSync(f); }
}
const pdfinfo = (bytes) => pdfTool('pdfinfo', bytes);
const pdftotext = (bytes) => pdfTool('pdftotext', bytes);


// ---------------------------------------------------------------------------
section('Geometry');
{
  const L = (x1, y1, x2, y2) => ({ type: 'line', layer: '0', x1, y1, x2, y2 });
  const x = G.intersect({ k: 'L', x1: 0, y1: 0, x2: 10, y2: 10 }, { k: 'L', x1: 0, y1: 10, x2: 10, y2: 0 });
  ok(x.length === 1 && nearPt(x[0], 5, 5), 'line × line');
  ok(G.intersect({ k: 'L', x1: -10, y1: 0, x2: 10, y2: 0 }, { k: 'A', cx: 0, cy: 0, r: 5, a0: 0, a1: G.TAU, full: true }).length === 2, 'line × circle');
  ok(G.intersect({ k: 'L', x1: -10, y1: 0, x2: 10, y2: 0 }, { k: 'A', cx: 0, cy: 0, r: 5, a0: 0, a1: Math.PI / 2 }).length === 1, 'line × quarter arc (one hit on the sweep)');
  ok(G.intersect({ k: 'A', cx: 0, cy: 0, r: 5, a0: 0, a1: G.TAU, full: true }, { k: 'A', cx: 8, cy: 0, r: 5, a0: 0, a1: G.TAU, full: true }).length === 2, 'circle × circle');

  const a = G.bulgeArc({ x: 0, y: 0 }, { x: 10, y: 0 }, 1);   // half circle, CCW (bulge 1 = 180°)
  ok(near(a.r, 5) && nearPt({ x: a.cx, y: a.cy }, 5, 0), 'bulge 1 → semicircle radius 5');
  const mid = G.primPoint(a, 0.5);
  ok(nearPt(mid, 5, -5), 'positive bulge from (0,0) to (10,0) passes below (CCW)', JSON.stringify(mid));

  // trim the middle of a horizontal line between two verticals
  const h = L(0, 0, 30, 0), v1 = L(10, -5, 10, 5), v2 = L(20, -5, 20, 5);
  const t = G.trimEntity(h, [v1, v2], { x: 15, y: 0 });
  ok(t && t.length === 2 && near(t[0].x2, 10) && near(t[1].x1, 20), 'trim middle → two pieces', JSON.stringify(t));
  const t2 = G.trimEntity(h, [v1, v2], { x: 25, y: 0 });
  ok(t2 && t2.length === 1 && near(t2[0].x1, 0) && near(t2[0].x2, 20), 'trim end → one piece');
  ok(G.trimEntity(h, [L(0, 5, 30, 5)], { x: 15, y: 0 }) === null, 'trim with nothing crossing → null');
  const circ = { type: 'circle', layer: '0', cx: 0, cy: 0, r: 5 };
  const tc = G.trimEntity(circ, [L(-10, 0, 10, 0)], { x: 0, y: 5 });
  ok(tc && tc.length === 1 && tc[0].type === 'arc' && G.prims(tc[0])[0].a1 - G.prims(tc[0])[0].a0 > 3 && near(G.primPoint(G.prims(tc[0])[0], 0.5).y, -5), 'trim top of a circle → lower arc');
  const sq = { type: 'poly', layer: '0', closed: true, pts: [[0, 0], [10, 0], [10, 10], [0, 10]].map(([x, y]) => ({ x, y, b: 0 })) };
  const tp = G.trimEntity(sq, [L(5, -5, 5, 15)], { x: 10, y: 5 });
  ok(tp && tp.length === 1 && !tp[0].closed && tp[0].pts.length === 4, 'trim the right side of a closed square → open U', JSON.stringify(tp?.[0]?.pts));

  const ext = G.extendEntity(L(0, 0, 5, 0), [L(10, -5, 10, 5)], { x: 5, y: 0 });
  ok(ext && near(ext.x2, 10) && near(ext.x1, 0), 'extend line to boundary');
  ok(G.extendEntity(L(0, 0, 5, 0), [L(10, 5, 10, 15)], { x: 5, y: 0 }) === null, 'extend with no boundary ahead → null');
  const arcE = G.extendEntity({ type: 'arc', layer: '0', cx: 0, cy: 0, r: 5, a0: 0, a1: Math.PI / 4 }, [L(-10, 0.0001, -1, 0.0001), L(0, 0, 0, 10)], { x: 3.5, y: 3.5 });
  ok(arcE && near(arcE.a1, Math.PI / 2, 1e-6), 'extend arc end to a vertical line', JSON.stringify(arcE));

  const off = G.offsetEntity(sq, 1, { x: 5, y: 5 });
  ok(off && nearPt(off.pts[0], 1, 1) && nearPt(off.pts[2], 9, 9), 'offset closed square inward', JSON.stringify(off?.pts));
  const offOut = G.offsetEntity(sq, 1, { x: -3, y: 5 });
  ok(offOut && nearPt(offOut.pts[0], -1, -1) && nearPt(offOut.pts[2], 11, 11), 'offset closed square outward', JSON.stringify(offOut?.pts));
  ok(near(G.offsetEntity(circ, 2, { x: 10, y: 0 }).r, 7) && near(G.offsetEntity(circ, 2, { x: 1, y: 0 }).r, 3), 'offset circle out and in');
  const ol = G.offsetEntity(L(0, 0, 10, 0), 2, { x: 5, y: -9 });
  ok(near(ol.y1, -2) && near(ol.y2, -2), 'offset line to the picked side');

  const f = G.filletLines(L(0, 0, 10, 0), L(0, 0, 0, 10), 2, { x: 8, y: 0 }, { x: 0, y: 8 });
  ok(f && near(f.a.x1, 2) && near(f.b.y1, 2) && near(f.arc.r, 2) && nearPt({ x: f.arc.cx, y: f.arc.cy }, 2, 2), 'fillet r=2 on an L corner', JSON.stringify(f));
  const f0 = G.filletLines(L(1, 0, 10, 0), L(0, 1, 0, 10), 0, { x: 8, y: 0 }, { x: 0, y: 8 });
  ok(f0 && nearPt({ x: f0.a.x1, y: f0.a.y1 }, 0, 0) && nearPt({ x: f0.b.x1, y: f0.b.y1 }, 0, 0) && !f0.arc, 'fillet r=0 closes a corner');

  const m = G.mMirror({ x: 0, y: 0 }, { x: 0, y: 1 });   // mirror across the Y axis
  const arc = { type: 'arc', layer: '0', cx: 5, cy: 0, r: 1, a0: 0, a1: Math.PI / 2 };
  const ma = G.txEntity(arc, m);
  const mp = G.prims(ma)[0];
  ok(near(ma.cx, -5) && nearPt(G.primPoint(mp, 0.5), -5 - Math.SQRT1_2, Math.SQRT1_2), 'mirror arc across Y keeps the arc on the mirrored side', JSON.stringify(ma));
  const mt = G.txEntity({ type: 'text', layer: '0', x: 5, y: 0, h: 1, rot: 0, s: 'A', ha: 'left', va: 'baseline' }, m);
  ok(near(mt.x, -5) && near(Math.cos(mt.rot), 1), 'mirrored text stays readable');

  const ar = arc3({ x: 5, y: 0 }, { x: 0, y: 5 }, { x: -5, y: 0 });
  ok(ar && near(ar.a0, 0) && near(ar.a1, Math.PI), 'arc through 3 points (CCW)', JSON.stringify(ar));
  const ar2 = arc3({ x: -5, y: 0 }, { x: 0, y: 5 }, { x: 5, y: 0 });
  ok(ar2 && near(ar2.a0, 0) && near(ar2.a1, Math.PI), 'arc through 3 points (CW input) is the same upper arc');

  const blocks = new Map([['B', { name: 'B', base: { x: 0, y: 0 }, entities: [L(0, 0, 1, 0)] }]]);
  const ins = { type: 'insert', layer: '0', block: 'B', x: 10, y: 10, sx: 2, sy: 2, rot: Math.PI / 2 };
  const ip = G.prims(ins, blocks)[0];
  ok(nearPt({ x: ip.x2, y: ip.y2 }, 10, 12), 'insert transform (scale 2, rotate 90°)');
  const ex = G.explodeEntity(ins, blocks);
  ok(ex.length === 1 && nearPt({ x: ex[0].x2, y: ex[0].y2 }, 10, 12), 'explode insert');
  const snaps = G.snapPoints(L(0, 0, 10, 0), { x: 4.9, y: 0.1 }, 0.5, new Set(['end', 'mid']));
  ok(snaps.length === 1 && snaps[0].kind === 'mid', 'midpoint snap');
  ok(G.inWindow(L(1, 1, 2, 2), { minX: 0, minY: 0, maxX: 3, maxY: 3 }, false) && !G.inWindow(L(1, 1, 5, 2), { minX: 0, minY: 0, maxX: 3, maxY: 3 }, false) && G.inWindow(L(1, 1, 5, 2), { minX: 0, minY: 0, maxX: 3, maxY: 3 }, true), 'window vs crossing');
}

// ---------------------------------------------------------------------------
section('Command line');

function harness() {
  const doc = new Doc();
  const log = [];
  const host = {
    cursor: { x: 0, y: 0 }, selection: new Set(), shift: false,
    print: (s) => log.push(s), prompt: (s) => { host.lastPrompt = s; },
    setSelection: (s) => { host.selection = new Set(s); }, preview: () => {},
    pickAt: (p) => {
      let best = null, bd = 0.5;
      for (const e of doc.all()) { const d = G.distToEntity(e, p, doc.blocks); if (d < bd) { bd = d; best = e.id; } }
      return best;
    },
    pickWindow: (w, crossing) => doc.all().filter((e) => G.inWindow(e, w, crossing, doc.blocks)).map((e) => e.id),
    zoomExtents: () => { host.zoomed = true; }, zoomWindow: () => {},
  };
  const eng = new Engine(doc, host);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const type = async (...lines) => { for (const l of lines) { eng.text(l); await tick(); } };
  const click = async (x, y) => { eng.click({ x, y }); await tick(); };
  return { doc, host, eng, log, type, click, tick };
}

{
  const { doc, type, log } = harness();
  await type('L', '0,0', '@10,0', '@0,10', '@10<180', 'C');
  const lines = doc.all();
  ok(lines.length === 4, 'LINE with relative, polar and Close → 4 lines', lines.length);
  ok(lines.length === 4 && nearPt({ x: lines[2].x2, y: lines[2].y2 }, 0, 10) && nearPt({ x: lines[3].x2, y: lines[3].y2 }, 0, 0), 'polar @10<180 and Close land right');
  ok(doc.undoStack.length === 1, 'the whole LINE command is one undo step', doc.undoStack.length);
  doc.undo();
  ok(doc.count() === 0, 'undo removes all four');
  doc.redo();
  ok(doc.count() === 4, 'redo brings them back');
  ok(log.includes('Command: LINE'), 'command echoed in the history');
}
{
  const { doc, type, eng, host } = harness();
  await type('L', '0,0', '5,0', '5,5', 'U', '');
  ok(doc.count() === 1, 'LINE Undo option removes the last segment', doc.count());
  await type('');   // Enter repeats LINE
  ok(eng.running === 'LINE', 'Enter at an empty prompt repeats the last command');
  host.cursor = { x: 100, y: 0 };
  await type('0,0', '25', '');
  const last = doc.all().pop();
  ok(last && nearPt({ x: last.x2, y: last.y2 }, 25, 0), 'direct distance entry follows the cursor direction', JSON.stringify(last));
}
{
  const { doc, type, eng } = harness();
  await type('C', '0,0', '5');
  await type('CIRCLE', '2P', '0,0', '10,0');
  await type('C', '3P', '0,5', '5,0', '0,-5');
  const cs = doc.all();
  ok(cs.length === 3 && near(cs[0].r, 5) && near(cs[1].r, 5) && near(cs[1].cx, 5) && near(cs[2].r, 5) && near(cs[2].cx, 0), 'CIRCLE radius, 2P, 3P');
  await type('A', '5,0', '0,5', '-5,0');
  const a = doc.all().pop();
  ok(a.type === 'arc' && near(a.r, 5) && near(G.primPoint(G.prims(a)[0], 0.5).y, 5), 'ARC 3 points');
  await type('REC', '0,0', '@20,10');
  const r = doc.all().pop();
  ok(r.type === 'poly' && r.closed && r.pts.length === 4 && nearPt(r.pts[2], 20, 10), 'RECTANG');
  await type('POL', '6', '0,0', 'I', '10,0');
  const p = doc.all().pop();
  ok(p.pts.length === 6 && nearPt(p.pts[0], 10, 0), 'POLYGON inscribed');
  await type('PL', '0,0', '10,0', 'A', '10,10', 'L', '0,10', 'C');
  const pl = doc.all().pop();
  ok(pl.type === 'poly' && pl.closed && pl.pts.length === 4 && near(pl.pts[1].b, 1, 1e-9), 'PLINE with a tangent arc segment (half circle, bulge 1)', JSON.stringify(pl.pts));
  await type('EL', '-10,0', '10,0', '5');
  const el = doc.all().pop();
  ok(el.type === 'ellipse' && near(el.ratio, 0.5), 'ELLIPSE');
  await type('DT', '0,0', '2.5', '0', 'Hello, world', 'Second line', '');
  const tx = doc.all().slice(-2);
  ok(tx.length === 2 && tx[0].s === 'Hello, world' && tx[1].s === 'Second line' && tx[1].y < 0, 'TEXT keeps spaces and commas; Enter starts the next line');
  ok(!eng.running, 'empty line ends TEXT');
}
{
  const { doc, type, click, host, eng } = harness();
  await type('L', '0,0', '30,0', '');
  await type('L', '10,-5', '10,5', '');
  await type('L', '20,-5', '20,5', '');
  await type('TR');
  await click(15, 0);
  await type('');
  ok(doc.count() === 4 && doc.all().filter((e) => e.y1 === 0 && e.y2 === 0).length === 2, 'TRIM removes the middle of the line', doc.count());
  ok(doc.undoStack[doc.undoStack.length - 1].label === 'TRIM', 'TRIM is one undo step');
  doc.undo();
  ok(doc.count() === 3, 'undo TRIM restores the line');

  const long = doc.all().find((e) => e.x1 === 0 && e.x2 === 30);
  host.selection = new Set([long.id]);
  await type('M', '0,0', '0,100');
  ok(near(doc.get(long.id).y1, 100) && near(doc.get(long.id).x2, 30), 'MOVE on a preselected object (noun-verb)');
  host.selection = new Set();
  await type('CO');
  await click(10, 0);
  await type('', '10,0', '@5,0', '@10,0', '');
  ok(doc.count() === 5, 'COPY multiple', doc.count());
  await type('E');
  ok(host.selection.size === 0, 'a finished command clears the selection');
  eng.window({ minX: 14, minY: -6, maxX: 26, maxY: 6 }, false);   // the copies at x = 15, 25 and the line at 20
  await type('');
  ok(doc.count() === 2 && doc.all().every((e) => e.x1 !== 15 && e.x1 !== 20 && e.x1 !== 25), 'ERASE by window', doc.count());
}
{
  const { doc, type, click, host } = harness();
  await type('L', '0,0', '10,0', '');
  host.selection = new Set([doc.all()[0].id]);
  await type('RO', '0,0', '90');
  const l = doc.all()[0];
  ok(nearPt({ x: l.x2, y: l.y2 }, 0, 10), 'ROTATE 90');
  host.selection = new Set([l.id]);
  await type('SC', '0,0', '2');
  ok(near(doc.all()[0].y2, 20), 'SCALE 2');
  host.selection = new Set([l.id]);
  await type('MI', '5,0', '5,1', '');
  ok(doc.count() === 2 && near(doc.all()[1].x1, 10), 'MIRROR keeps the source by default');
  await type('O', '3');
  await click(0, 10);
  await type('2,10', '');
  ok(doc.count() === 3 && near(doc.all()[2].x1, 3), 'OFFSET 3 to the picked side', JSON.stringify(doc.all()[2]));
  await type('REC', '20,20', '30,30');
  host.selection = new Set([doc.all().pop().id]);
  await type('X');
  ok(doc.all().filter((e) => e.type === 'line').length === 7, 'EXPLODE a rectangle → 4 lines');
  await type('L', '50,0', '60,0', '');
  await type('L', '50,1', '50,10', '');
  await type('F', 'R', '0');
  await click(58, 0);
  await click(50, 8);
  const [fa, fb] = doc.all().slice(-2);
  ok(nearPt({ x: fa.x1, y: fa.y1 }, 50, 0) && nearPt({ x: fb.x1, y: fb.y1 }, 50, 0), 'FILLET radius 0 joins the corner', JSON.stringify([fa, fb]));
  await type('L', '0,0', '1,1');
  harness().eng; // no-op
  const before = doc.count();
  await type('xyz');
  ok(doc.count() === before, 'invalid point input is refused, the command keeps waiting');
}
{
  const { type, log, eng } = harness();
  await type('NOSUCH');
  ok(log.some((l) => l.includes('Unknown command')), 'unknown command reported');
  await type('C', '0,0');
  eng.escape(); await new Promise((r) => setTimeout(r, 0));
  ok(!eng.running && log.includes('*Cancel*'), 'Esc cancels');
}

// ---------------------------------------------------------------------------
section('Fillet and chamfer (FILLET, CHAMFER)');
{
  const lastOf = (doc, type) => doc.all().filter((e) => e.type === type).pop();
  {
    const { doc, type, click } = harness();
    await type('L', '0,0', '10,0', '', 'L', '0,0', '0,10', '');
    await type('F', 'R', '2');
    await click(8, 0); await click(0, 8);
    const [a, b] = doc.all().filter((e) => e.type === 'line'), arc = lastOf(doc, 'arc');
    ok(nearPt({ x: a.x1, y: a.y1 }, 2, 0) && nearPt({ x: b.x1, y: b.y1 }, 0, 2) && arc && nearPt({ x: arc.cx, y: arc.cy }, 2, 2) && near(arc.r, 2), 'FILLET R 2: two lines trimmed, tangent arc added', JSON.stringify([a, b, arc]));
    ok(arc && near(G.normAngle(arc.a1 - arc.a0), Math.PI / 2), 'the fillet arc is the quarter between the lines');
    ok(doc.undoStack.length === 3 && doc.undoStack[2].label === 'FILLET', 'FILLET is one undo step');
  }
  {
    const { doc, type, click } = harness();
    await type('L', '0,0', '20,0', '', 'C', '10,6', '3');
    await type('F', 'R', '2');
    await click(5, 0); await click(7, 6);
    const l = lastOf(doc, 'line'), arc = lastOf(doc, 'arc'), circ = lastOf(doc, 'circle');
    ok(arc && nearPt({ x: arc.cx, y: arc.cy }, 7, 2) && near(arc.r, 2), 'FILLET line × circle: center 2 off the line, 5 from the circle', JSON.stringify(arc));
    ok(nearPt({ x: l.x1, y: l.y1 }, 0, 0) && nearPt({ x: l.x2, y: l.y2 }, 7, 0), 'the line keeps the picked side, up to the tangent point', JSON.stringify(l));
    ok(circ && near(circ.r, 3) && near(circ.cx, 10), 'a circle is never cut');
  }
  {
    const { doc, type, click } = harness();
    await type('L', '0,0', '20,0', '', 'A', 'C', '10,6', '10,9', '10,3');   // left half, 90° → 270°
    await type('F', 'R', '2');
    await click(5, 0); await click(7, 6);
    const arcs = doc.all().filter((e) => e.type === 'arc');
    const orig = arcs.find((e) => near(e.r, 3)), fil = arcs.find((e) => near(e.r, 2));
    ok(orig && near(G.deg(orig.a0), 90) && near(G.deg(orig.a1), 233.130102, 1e-4) && fil, 'FILLET line × arc: the arc is cut at the tangent point, its picked side kept', JSON.stringify(orig));
  }
  {
    const { doc, type, click, log } = harness();
    await type('L', '0,0', '10,0', '', 'L', '0,4', '12,4', '');
    await type('F');
    await click(9, 0); await click(9, 4);
    const lines = doc.all().filter((e) => e.type === 'line'), arc = lastOf(doc, 'arc');
    ok(arc && nearPt({ x: arc.cx, y: arc.cy }, 10, 2) && near(arc.r, 2) && near(G.deg(arc.a0), 270) && near(G.deg(arc.a1), 90), 'FILLET parallel lines: a half circle across the gap at the first line\'s picked end', JSON.stringify(arc));
    ok(nearPt({ x: lines[1].x2, y: lines[1].y2 }, 10, 4), 'the second line is cut to meet it', JSON.stringify(lines[1]));
    ok(log.includes(EN('cmd.fillet.parallel')), 'the history says the radius was not used');
  }
  {
    const { doc, type, click } = harness();
    await type('L', '0,0', '8,0', '', 'L', '10,2', '10,10', '');
    await type('F', 'R', '0');
    await click(4, 0); await click(10, 6);
    const [a, b] = doc.all();
    ok(nearPt({ x: a.x2, y: a.y2 }, 10, 0) && nearPt({ x: b.x1, y: b.y1 }, 10, 0) && doc.count() === 2, 'FILLET R 0 extends two lines that fall short to a sharp corner');
  }
  {
    const { doc, type, click, host } = harness();
    await type('L', '0,0', '10,0', '', 'L', '0,0', '0,10', '');
    await type('F', 'R', '3');
    await click(8, 0);
    host.shift = true; await click(0, 8); host.shift = false;
    ok(doc.count() === 2 && !lastOf(doc, 'arc') && nearPt({ x: doc.all()[0].x1, y: doc.all()[0].y1 }, 0, 0), 'shift-select at the second pick makes a sharp corner whatever the radius');
  }
  {
    const { doc, type, click } = harness();
    await type('L', '0,0', '10,0', '', 'L', '0,0', '0,10', '');
    await type('F', 'T', 'N', 'R', '2');
    await click(8, 0); await click(0, 8);
    const [a, b] = doc.all();
    ok(doc.count() === 3 && near(a.x2, 10) && near(a.x1, 0) && near(b.y1, 0), 'Trim = No trim adds the arc and leaves the lines', doc.count());
    await type('F', 'T', 'T', '');
  }
  {
    const { doc, type, click } = harness();
    await type('L', '0,0', '10,0', '', 'L', '0,0', '0,10', '', 'L', '20,0', '30,0', '', 'L', '30,0', '30,10', '');
    const n0 = doc.undoStack.length;
    await type('F', 'R', '1', 'M');
    await click(8, 0); await click(0, 8);
    await click(22, 0); await click(30, 8);
    await type('');
    ok(doc.all().filter((e) => e.type === 'arc').length === 2, 'Multiple: two fillets in one command');
    ok(doc.undoStack.length === n0 + 1, 'and one undo step for both', doc.undoStack.length - n0);
    await type('L', '40,0', '50,0', '', 'L', '40,0', '40,10', '');
    const n1 = doc.count();
    await type('F', 'M');
    await click(48, 0); await click(40, 8);
    ok(doc.count() === n1 + 1, 'Multiple: the next fillet');
    await type('U', '');
    ok(doc.count() === n1 && near(doc.all().find((e) => e.type === 'line' && e.y1 === 0 && e.x2 === 50).x1, 40), 'U inside FILLET takes the last fillet back');
  }
  {
    const { doc, type, click, log } = harness();
    await type('REC', '0,0', '20,10');
    await type('F', 'R', '2', 'P');
    await click(10, 0);
    let p = doc.all()[0];
    ok(p.pts.length === 8 && p.pts.filter((v) => near(v.b, Math.tan(Math.PI / 8))).length === 4, 'FILLET Polyline: all four corners of a rectangle', JSON.stringify(p.pts));
    ok(nearPt(p.pts[0], 2, 0) || nearPt(p.pts[1], 2, 0), 'cut back by the radius along each side');
    await type('F', 'R', '3', 'P'); await click(10, 0);
    p = doc.all()[0];
    const r3 = G.prims(p).filter((q) => q.k === 'A');
    ok(p.pts.length === 8 && r3.length === 4 && r3.every((q) => near(q.r, 3)), 'a new radius replaces the old fillets', JSON.stringify(p.pts));
    await type('F', 'R', '0', 'P'); await click(10, 0);
    p = doc.all()[0];
    ok(p.pts.length === 4 && p.pts.every((v) => !v.b) && p.pts.some((v) => nearPt(v, 0, 0)) && p.pts.some((v) => nearPt(v, 20, 10)), 'radius 0 takes the fillets out again', JSON.stringify(p.pts));
    await type('F', 'R', '6', 'P'); await click(10, 0);
    ok(doc.all()[0].pts.length === 6 && log.includes(EN('cmd.corner.poly.short', { n: 2 })), 'corners whose sides are used up are left, and counted', doc.all()[0].pts.length);
  }
  {
    const { doc, type, click } = harness();
    await type('PL', '0,0', '10,0', '10,10', '');
    await type('F', 'R', '2');
    await click(5, 0); await click(10, 5);
    const p = doc.all()[0];
    ok(doc.count() === 1 && p.pts.length === 4 && nearPt(p.pts[1], 8, 0) && near(p.pts[1].b, Math.tan(Math.PI / 8)) && nearPt(p.pts[2], 10, 2), 'two segments of one polyline: the arc goes into the polyline', JSON.stringify(p.pts));
  }
  {
    const { doc, type, click, log } = harness();
    await type('PL', '0,10', '0,0', '10,0', '');
    await type('L', '12,-5', '12,5', '');
    await type('F', 'R', '0');
    await click(5, 0); await click(12, 3);
    const p = doc.all()[0], l = doc.all()[1];
    ok(nearPt(p.pts[2], 12, 0) && nearPt({ x: l.x1, y: l.y1 }, 12, 0), 'an open polyline\'s end segment and a line meet', JSON.stringify([p.pts, l]));
    await type('PL', '20,0', '30,0', '30,10', '40,10', '');
    await type('L', '35,-5', '35,5', '');
    await type('F');
    await click(30, 5); await click(35, 2);
    ok(log.includes(EN('cmd.corner.err.middle')), 'a middle segment of a polyline is refused, with a reason');
  }
  {
    const { doc, type, click, log } = harness();
    doc.addLayer({ name: 'Locked', color: 7, locked: true });
    await type('L', '0,0', '10,0', '');
    const id = doc.all()[0].id;
    doc.change('test', () => doc.update(id, { ...doc.get(id), layer: 'Locked' }));
    await type('F');
    await click(5, 0);
    ok(log.includes(EN('cmd.corner.err.locked')), 'an object on a locked layer is refused');
  }

  // CHAMFER
  {
    const { doc, type, click, log } = harness();
    await type('L', '0,0', '10,0', '', 'L', '0,0', '0,10', '');
    await type('CHA', 'D', '2', '3');
    await click(8, 0); await click(0, 8);
    const [a, b, ch] = doc.all();
    ok(nearPt({ x: a.x1, y: a.y1 }, 2, 0) && nearPt({ x: b.x1, y: b.y1 }, 0, 3) && ch?.type === 'line' && nearPt({ x: ch.x1, y: ch.y1 }, 2, 0) && nearPt({ x: ch.x2, y: ch.y2 }, 0, 3), 'CHAMFER Distance 2, 3: first line cut 2, second 3, joined', JSON.stringify([a, b, ch]));
    ok(log.some((l) => l === EN('cmd.chamfer.settings', { mode: 'TRIM', d1: '0', d2: '0' })), 'CHAMFER prints the current settings');
    doc.undo();
    await type('CHA', 'A', '2', '45');
    await click(8, 0); await click(0, 8);
    const ch2 = doc.all()[2];
    ok(ch2 && nearPt({ x: ch2.x1, y: ch2.y1 }, 2, 0) && nearPt({ x: ch2.x2, y: ch2.y2 }, 0, 2), 'CHAMFER Angle: length 2 at 45° on a square corner', JSON.stringify(ch2));
    doc.undo();
    await type('CHA', 'E', 'D', 'D', '20', '20');
    await click(8, 0); await click(0, 8);
    ok(log.includes(EN('cmd.chamfer.err.large')) && doc.count() === 2, 'a distance longer than the line is refused');
  }
  {
    const { doc, type, click, log } = harness();
    await type('C', '0,0', '5', 'L', '10,0', '20,0', '');
    await type('CHA');
    await click(5, 0);
    ok(log.includes(EN('cmd.chamfer.err.type')), 'CHAMFER refuses a circle');
    await type('');
    await type('REC', '0,20', '20,30');
    await type('CHA', 'D', '1', '', 'P');
    await click(10, 20);
    const p = doc.all().pop();
    ok(p.pts.length === 8 && p.pts.every((v) => !v.b) && log.includes(EN('cmd.chamfer.poly.done', { n: 4 })), 'CHAMFER Polyline: every corner of a rectangle', JSON.stringify(p.pts));
    await type('PL', '0,40', '10,40', '10,50', '');
    await type('CHA', 'D', '2', '4');
    await click(5, 40); await click(10, 45);
    const q = doc.all().pop();
    ok(q.pts.length === 4 && nearPt(q.pts[1], 8, 40) && nearPt(q.pts[2], 10, 44), 'CHAMFER two segments of one polyline: first pick takes the first distance', JSON.stringify(q.pts));
  }
  // geometry: fillet of two circles (outside both)
  {
    const A = G.cornerTarget({ type: 'circle', cx: 0, cy: 0, r: 2 }, { x: 2, y: 0.5 });
    const B = G.cornerTarget({ type: 'circle', cx: 8, cy: 0, r: 2 }, { x: 6, y: 0.5 });
    const r = G.filletPair(A, B, 3);
    const arc = r.add[0];
    ok(r.ok && arc && near(Math.hypot(arc.cx, arc.cy), 5) && near(Math.hypot(arc.cx - 8, arc.cy), 5) && arc.cy > 0, 'fillet two circles: tangent to both, on the picked side', JSON.stringify(r));
  }
}

// ---------------------------------------------------------------------------
section('TRIM and EXTEND: drag, fence, crossing, modes, Shift, preview (0.4 part 2 T.1–T.3)');
{
  const { trimSplit, pieceAt, pieceEntity, trimResult, pathCrossings, extensionPart } = G;
  // twenty uprights through a long line: one drag above the line trims every top piece
  const comb = async (h) => {
    await h.type('L', '-5,0', '100,0', '');
    for (let i = 0; i < 20; i++) await h.type('L', (i * 5) + ',-10', (i * 5) + ',10', '');
  };
  {
    const h = harness();
    await comb(h);
    const ups = () => h.doc.all().filter((e) => e.type === 'line' && e.x1 === e.x2);
    await h.type('TR');
    ok(h.host.lastPrompt.startsWith(EN('cmd.trim.pick')) && h.host.lastPrompt.includes(EN('opt.cuttingedges')), 'TRIM asks for a piece, with its options', h.host.lastPrompt);
    const steps0 = h.doc.undoStack.length;
    h.eng.path([{ x: -2, y: 5 }, { x: 40, y: 6 }, { x: 98, y: 5 }]); await h.tick();
    ok(ups().length === 20 && ups().every((e) => near(Math.max(e.y1, e.y2), 0)) && h.doc.count() === 21, 'a dragged path trims all 20 top pieces back to the line', JSON.stringify(ups().slice(0, 2)));
    ok(h.doc.undoStack.length === steps0 + 1 && h.log.includes(EN('cmd.trim.done', { n: 20 })), 'the whole path is one undo step, and says how many');
    await h.type('U');
    ok(ups().every((e) => near(Math.max(e.y1, e.y2), 10)), 'Undo inside TRIM puts all 20 back at once');
    // Fence: the same by typed points
    await h.type('F', '-2,-5', '98,-5', '');
    ok(ups().every((e) => near(Math.min(e.y1, e.y2), 0) && near(Math.max(e.y1, e.y2), 10)), 'F (fence) trims every bottom piece the fence crosses');
    // the preview: resting on a piece shows it greyed (ghost), dragging shows every piece crossed so far
    await h.type('U');
    const g1 = h.eng.preview({ x: 2.5, y: 0 });
    ok(g1.length === 1 && g1[0].ghost && g1[0].type === 'line' && near(Math.min(g1[0].x1, g1[0].x2), 0) && near(Math.max(g1[0].x1, g1[0].x2), 5), 'hover preview: the piece between two uprights, marked ghost', JSON.stringify(g1));
    h.eng.dragPath = [{ x: -2, y: 5 }, { x: 22, y: 5 }];
    const g2 = h.eng.preview({ x: 22, y: 5 });
    h.eng.dragPath = null;
    ok(g2.length === 5 && g2.every((e) => e.ghost && near(Math.min(e.y1, e.y2), 0) && near(Math.max(e.y1, e.y2), 10)), 'drag preview: the five top pieces the path has crossed so far', g2.length);
    ok(h.eng.preview({ x: 300, y: 300 }).length === 0, 'no preview over empty space');
    // two clicks on empty spots: a fence between them
    await h.click(-3, -6); await h.click(12, -6);
    ok(ups().filter((e) => near(Math.min(e.y1, e.y2), 0)).length === 3, 'two clicks on empty spots trim along the line between them (3 bottoms)');
    await h.type('');
    ok(!h.eng.running, 'Enter ends TRIM');
  }
  {
    // Shift+drag in TRIM extends; Shift+click in EXTEND trims
    const h = harness();
    await h.type('L', '10,-1', '10,10', '');
    for (let k = 1; k <= 5; k++) await h.type('L', '0,' + k, '5,' + k, '');
    await h.type('TR');
    h.host.shift = true;
    const gx = h.eng.preview({ x: 4.9, y: 3 });
    ok(gx.length === 1 && gx[0].ghost && near(Math.min(gx[0].x1, gx[0].x2), 5) && near(Math.max(gx[0].x1, gx[0].x2), 10), 'Shift held in TRIM: the preview is the part an extend would add (5 → 10)', JSON.stringify(gx));
    h.eng.path([{ x: 3, y: 0 }, { x: 3, y: 6 }]); await h.tick();
    h.host.shift = false;
    const runs = h.doc.all().filter((e) => e.y1 === e.y2);
    ok(runs.length === 5 && runs.every((e) => near(Math.max(e.x1, e.x2), 10)), 'Shift+drag in TRIM extends the five lines to the boundary', JSON.stringify(runs.map((e) => e.x2)));
    await h.type('');
    await h.type('L', '-10,7', '30,7', '');
    await h.type('EX');
    ok(h.host.lastPrompt.startsWith(EN('cmd.extend.pick')), 'EXTEND asks with its own wording', h.host.lastPrompt);
    h.host.shift = true; await h.click(20, 7); h.host.shift = false;
    const top = h.doc.all().find((e) => e.y1 === 7 && e.y2 === 7);
    ok(top && near(Math.max(top.x1, top.x2), 10), 'Shift+click in EXTEND trims instead', JSON.stringify(top));
    await h.type('');
  }
  {
    // Quick mode erases what nothing crosses; Standard mode keeps it and cuts only at the chosen edges
    const h = harness();
    await h.type('L', '0,0', '30,0', '', 'L', '10,-5', '10,5', '', 'L', '20,-5', '20,5', '', 'L', '0,50', '10,50', '');
    await h.type('TR');
    ok(h.log.includes(EN('cmd.trim.settings', { mode: EN('opt.quick'), edge: EN('opt.noextend') })), 'TRIM says its settings (Quick, no extend)');
    await h.click(5, 50);
    ok(h.doc.count() === 3 && h.log.includes(EN('cmd.trim.erased', { n: 1 })), 'Quick mode: a line nothing crosses is erased, and says so');
    await h.type('U', 'O', 'S');
    await h.click(10, 3); await h.type('');
    ok(h.log.includes(EN('cmd.trim.edges.n', { n: 1 })), 'mOde Standard asks for cutting edges (one chosen)');
    await h.click(25, 0);
    const base = h.doc.all().find((e) => e.y1 === 0 && e.y2 === 0);
    ok(h.doc.all().filter((e) => e.y1 === 0 && e.y2 === 0).length === 1 && near(Math.max(base.x1, base.x2), 10), 'Standard: only the chosen edge cuts, so 10 → 30 goes in one piece', JSON.stringify(base));
    await h.click(5, 50);
    ok(h.doc.count() === 4 && h.log.includes(EN('cmd.trim.nothing')), 'Standard: an object no edge crosses is left alone');
    await h.type('O', 'Q', '');
    ok(h.eng.trimMode === 'quick', 'mOde Quick goes back (kept for the session)');
  }
  {
    // Crossing (C) and implied edges (Edge, Extend); eRase
    const h = harness();
    await h.type('L', '0,0', '30,0', '', 'L', '10,-5', '10,5', '', 'L', '20,-5', '20,5', '');
    await h.type('TR', 'C', '12,-1', '18,1');
    ok(h.doc.all().filter((e) => e.y1 === 0 && e.y2 === 0).length === 2, 'C (crossing) removes the piece inside the window');
    await h.type('');
    const g = harness();
    await g.type('L', '0,0', '30,0', '', 'L', '10,1', '10,5', '');
    await g.type('TR', 'E', 'E');
    ok(g.log.includes(EN('cmd.trim.settings', { mode: EN('opt.quick'), edge: EN('opt.extend') })), 'Edge Extend is said');
    await g.click(5, 0);
    const left = g.doc.all().find((e) => e.y1 === 0 && e.y2 === 0);
    ok(left && near(Math.min(left.x1, left.x2), 10) && near(Math.max(left.x1, left.x2), 30), 'with Edge Extend a short line cuts where it would reach', JSON.stringify(left));
    await g.type('R');
    await g.click(10, 3); await g.type('');
    ok(g.doc.count() === 1, 'eRase erases without leaving TRIM');
    ok(g.eng.running === 'TRIM', 'and TRIM goes on');
    await g.type('');
    await g.type('TR', 'E', 'N', '');
  }
  {
    // the pieces themselves: closed shapes, several pieces at once, and the extension part
    const sq = { type: 'circle', id: 'c', layer: '0', cx: 0, cy: 0, r: 10 };
    const cross = [{ type: 'line', layer: '0', x1: -20, y1: 0, x2: 20, y2: 0 }, { type: 'line', layer: '0', x1: 0, y1: -20, x2: 0, y2: 20 }];
    const sp = trimSplit(sq, cross, null);
    ok(sp && sp.closed && sp.pieces.length === 4, 'a circle cut by a cross: four pieces', JSON.stringify(sp?.pieces));
    const q1 = pieceAt(sp, { x: 7, y: 7 }), q3 = pieceAt(sp, { x: -7, y: -7 });
    const kept = trimResult(sp, new Set([q1, q3]));
    ok(kept.length === 2 && kept.every((a) => a.type === 'arc' && near(G.normAngle(a.a1 - a.a0), Math.PI / 2)), 'removing two opposite quarters keeps two quarter arcs', JSON.stringify(kept));
    const wrap = trimResult(sp, new Set([pieceAt(sp, { x: -7, y: 7 })]));
    ok(wrap.length === 1 && near(G.normAngle(wrap[0].a1 - wrap[0].a0), 1.5 * Math.PI), 'removing one quarter keeps one arc of three quarters (across 0°)', JSON.stringify(wrap));
    const box = { type: 'poly', id: 'p', layer: '0', closed: true, pts: [[-5, -5], [5, -5], [5, 5], [-5, 5]].map(([x, y]) => ({ x, y, b: 0 })) };
    const bs = trimSplit(box, [{ type: 'line', layer: '0', x1: 0, y1: -9, x2: 0, y2: 9 }], null);
    const half = trimResult(bs, new Set([pieceAt(bs, { x: 5, y: 0 })]));
    ok(half.length === 1 && !half[0].closed && half[0].pts.length === 4 && half[0].pts.every((p) => p.x <= 1e-9), 'a closed polyline cut by one line: the left half stays as an open polyline', JSON.stringify(half[0]?.pts));
    ok(trimResult(bs, new Set()) === null, 'nothing removed → null (no change)');
    const one = trimSplit({ type: 'line', id: 'l', layer: '0', x1: 0, y1: 0, x2: 10, y2: 0 }, [], null);
    ok(one.pieces.length === 1 && trimResult(one, new Set([0])).length === 0, 'an uncut line is one piece; removing it leaves nothing');
    ok(pathCrossings({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }, [{ x: 2, y: -1 }, { x: 2, y: 1 }, { x: 8, y: -1 }], null).length === 2, 'pathCrossings: a zigzag crosses a line twice');
    const ext = extensionPart({ type: 'arc', cx: 0, cy: 0, r: 5, a0: 0, a1: 1 }, { type: 'arc', cx: 0, cy: 0, r: 5, a0: 0, a1: 1.5 });
    ok(ext && near(ext.a0, 1) && near(ext.a1, 1.5), 'extensionPart: the added arc only', JSON.stringify(ext));
    ok(pieceEntity(sp, q1).type === 'arc', 'pieceEntity of a circle piece is an arc');
  }
}

// ---------------------------------------------------------------------------
section('Lasso selection (lasso.js, LASSOMODE; 0.4 part 2 T.4)');
{
  const { lassoHits, pointInPoly, lassoMode, nextMode, thin } = await load('lasso.js');
  const ents = [
    { id: 'a', type: 'line', x1: 1, y1: 1, x2: 3, y2: 1 },           // inside
    { id: 'b', type: 'line', x1: 5, y1: 1, x2: 15, y2: 1 },          // crosses the outline
    { id: 'c', type: 'circle', cx: 30, cy: 30, r: 1 },               // far away
    { id: 'd', type: 'point', x: 2, y: 3 },                          // inside
  ];
  // an L-shaped lasso: (0,0) (10,0) (10,2) (4,2) (4,8) (0,8)
  const L = [[0, 0], [10, 0], [10, 2], [4, 2], [4, 8], [0, 8]].map(([x, y]) => ({ x, y }));
  ok(pointInPoly({ x: 2, y: 6 }, L) && !pointInPoly({ x: 7, y: 6 }, L), 'pointInPoly on an L shape (the notch is outside)');
  ok(JSON.stringify(lassoHits(ents, L, 'window', null).sort()) === '["a","d"]', 'window lasso: only what lies wholly inside', JSON.stringify(lassoHits(ents, L, 'window', null)));
  ok(JSON.stringify(lassoHits(ents, L, 'crossing', null).sort()) === '["a","b","d"]', 'crossing lasso: inside or touching');
  ok(JSON.stringify(lassoHits(ents, [{ x: 4, y: -1 }, { x: 6, y: 3 }], 'fence', null)) === '["b"]', 'fence: what the path crosses');
  const notch = { id: 'n', type: 'line', x1: 6, y1: 5, x2: 8, y2: 5 };   // inside the L's bounding box, but in the notch
  ok(lassoHits([notch], L, 'window', null).length === 0 && lassoHits([notch], L, 'crossing', null).length === 0, 'an object in the notch of the lasso is not selected (polygon, not its box)');
  ok(lassoMode({ x: 0, y: 0 }, { x: 10, y: 3 }) === 'window' && lassoMode({ x: 0, y: 0 }, { x: -10, y: 3 }) === 'crossing' && lassoMode({ x: 0, y: 0 }, { x: 2, y: 20 }) === null, 'the first sideways move decides: right window, left crossing');
  ok(nextMode('window') === 'crossing' && nextMode('crossing') === 'fence' && nextMode('fence') === 'window', 'Space cycles window → crossing → fence');
  ok(thin([{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 1, y: 0 }, { x: 1.05, y: 0 }], 0.5).length === 3, 'thin keeps the ends and drops crowded points');
  {
    // lasso-core.js: the import-free part the other 2D apps copy (T.5): items described by a box and outline segments
    const Lc = await load('lasso-core.js');
    const items = [
      { id: 'in', s: [[1, 1, 3, 1]] }, { id: 'cross', s: [[3, 1, 15, 1]] }, { id: 'notch', s: [[6, 5, 8, 5]] },
      { id: 'fill', s: [[-50, -50, 50, -50], [50, -50, 50, 50], [50, 50, -50, 50], [-50, 50, -50, -50]], f: true },
    ];
    const opts = { box: (it) => ({ minX: Math.min(...it.s.flatMap((q) => [q[0], q[2]])), maxX: Math.max(...it.s.flatMap((q) => [q[0], q[2]])), minY: Math.min(...it.s.flatMap((q) => [q[1], q[3]])), maxY: Math.max(...it.s.flatMap((q) => [q[1], q[3]])) }), segs: (it) => it.s, filled: (it) => !!it.f };
    const ids = (mode, pts = L) => Lc.lassoSelect(items, pts, mode, opts).map((it) => it.id).join();
    ok(ids('window') === 'in' && ids('crossing') === 'in,cross,fill' && ids('fence', [{ x: 4, y: -1 }, { x: 6, y: 3 }]) === 'cross', 'lassoSelect: window, crossing (a fill the lasso sits in counts), fence', [ids('window'), ids('crossing'), ids('fence', [{ x: 4, y: -1 }, { x: 6, y: 3 }])].join(' | '));
    ok(Lc.segsCross(0, 0, 2, 2, 0, 2, 2, 0) && !Lc.segsCross(0, 0, 1, 0, 0, 1, 1, 1) && Lc.segsCross(0, 0, 2, 0, 1, 0, 3, 0), 'segsCross: crossing, apart, collinear overlap');
    const canon = fs.readFileSync(path.join(APP, 'lasso-core.js'));
    const copies = ['markupcraft', 'detailcraft', 'takeoffcraft', 'civilcraft'].map((a) => path.join(ROOT, 'public_html/assets/apps', a, 'dev/lasso-core.js')).filter((f) => fs.existsSync(path.dirname(f)));
    ok(copies.every((f) => fs.existsSync(f) && fs.readFileSync(f).equals(canon)), 'lasso-core.js is byte-identical in every 2D app (' + copies.length + ' copies)');
  }
  {
    // the engine: a lasso while selecting, and STRETCH through a crossing lasso
    const h = harness();
    await h.type('L', '1,1', '3,1', '', 'L', '6,5', '8,5', '', 'L', '5,1', '15,1', '');
    await h.type('ERASE');
    h.eng.lasso(L, 'window'); await h.tick();
    await h.type('');
    ok(h.doc.count() === 2 && !h.doc.all().some((e) => e.x1 === 1), 'ERASE with a window lasso erases only the line inside it');
    await h.type('STRETCH');
    h.eng.lasso([{ x: 12, y: -2 }, { x: 20, y: -2 }, { x: 20, y: 4 }, { x: 12, y: 4 }], 'crossing'); await h.tick();
    await h.type('', '0,0', '5,0');
    const st = h.doc.all().find((e) => e.y1 === 1);
    ok(st && near(st.x1, 5) && near(st.x2, 20), 'STRETCH through a crossing lasso moves only the end inside it', JSON.stringify(st));
    await h.type('LASSOMODE');
    ok(h.log.includes(EN('cmd.lassomode.browser')), 'LASSOMODE without the browser says it is a browser setting');
  }
}

// ---------------------------------------------------------------------------
section('Split screen: panes and VPORTS (panes.js; 0.4 part 2 Q.1)');
{
  const Pn = await load('panes.js');
  const r4 = Pn.paneRects('4', 0.5, 0.5, 1000, 600);
  ok(r4.length === 4 && r4.every((r) => r.w > 490 && r.h > 290) && r4[3].x > 500 && r4[3].y > 300, 'four panes, a gap between them', JSON.stringify(r4));
  const r3 = Pn.paneRects('3r', 0.3, 0.5, 1000, 600);
  ok(r3.length === 3 && r3[2].x > 300 && r3[2].h === 600 && r3[0].h < 300, '3r: two stacked on the left, one tall on the right', JSON.stringify(r3));
  ok(Pn.paneRects('2v', 0.5, 0.5, 1000, 600).every((r) => r.h === 600) && Pn.paneRects('2h', 0.5, 0.5, 1000, 600).every((r) => r.w === 1000), 'side by side and stacked');
  ok(Pn.paneRects('2v', 0.99, 0.5, 1000, 600)[1].w >= 98, 'a divider stays 10 % from the edge');
  ok(Pn.paneAt(r4, 900, 500) === 3 && Pn.paneAt(r4, 10, 10) === 0 && Pn.paneAt(r4, 500, 300) === -1, 'paneAt finds the pane, and nothing in the gap');
  ok(Pn.dividers('4', 0.5, 0.5, 1000, 600).map((d) => d.key).join() === 'fx,fy' && Pn.dividers('single', 0.5, 0.5, 1000, 600).length === 0, 'the dividers to drag');
  {
    const canon = fs.readFileSync(path.join(APP, 'panes.js'));
    const copies = ['bimcraft', 'markupcraft'].map((a) => path.join(ROOT, 'public_html/assets/apps', a, 'dev/panes.js')).filter((f) => fs.existsSync(path.dirname(f)));
    ok(copies.every((f) => fs.existsSync(f) && fs.readFileSync(f).equals(canon)), 'panes.js is byte-identical in BimCraft and MarkupCraft (' + copies.length + ' copies, Q.6)');
  }
  const cp = Pn.cleanPanes({ layout: '2v', fx: 7, active: 9, list: [{ cx: 1, cy: 2, h: 3, sheet: 'A1' }, { cx: 'x' }] });
  {
    // VPORT records (cad-files writes and reads them): every layout survives corners → shuffled → layout
    const back = ['2v', '2h', '3r', '3l', '4'].map((l) => {
      const cs = Pn.vportCorners(l, 0.3, 0.6), shuffled = [...cs].reverse(), r = Pn.layoutFromCorners(shuffled);
      return r && r.layout === l && near(r.fx, l === '2h' ? 0.5 : 0.3, 1e-4) && near(r.fy, l === '2v' ? 0.5 : 0.6, 1e-4) && r.order.every((k, i) => shuffled[k] === cs[i]);
    });
    ok(back.every(Boolean), 'vportCorners → layoutFromCorners for every layout, records in any order', JSON.stringify(back));
    ok(Pn.layoutFromCorners([{ x0: 0, y0: 0, x1: 0.2, y1: 0.3 }, { x0: 0.5, y0: 0.5, x1: 1, y1: 1 }]) === null, 'corners that match no layout → null (one pane)');
  }
  ok(cp && cp.fx === 0.9 && cp.active === 0 && cp.list[0].sheet === 'A1' && cp.list[1] === null && Pn.cleanPanes({ layout: 'single' }) === null && Pn.cleanPanes({ layout: 'zz' }) === null, 'cleanPanes checks a file\'s pane setup');
  const h = harness();
  const asked = [];
  h.host.setPanes = (l) => { asked.push(l); return true; };
  await h.type('VPORTS', '2', 'H');
  await h.type('VPORTS', '3', '');
  await h.type('VPORTS', '4');
  await h.type('VPORTS', 'SI');
  ok(asked.join() === '2h,3r,4,single', 'VPORTS 2 Horizontal, 3 (Right by default), 4, SIngle', asked.join());
  await h.type('VPORTS', '2V');
  ok(asked[asked.length - 1] === '2v' && h.log.includes(EN('cmd.vports.done', { n: 2 })), 'the menu\'s one-step form (2V) and what it says');
  await h.type('REC', '0,0', '100,50', 'LAYOUT');
  const before = h.doc.layout.entities.size;
  await h.type('VPORTS', '300,200', '380,260');
  ok(h.doc.layout.entities.size === before + 1 && [...h.doc.layout.entities.values()].filter((e) => e.type === 'viewport').length === 2 && asked.length === 5, 'on a sheet VPORTS makes a viewport (MVIEW), as in AutoCAD');
  await h.type('SPLIT', '4');
  ok(asked[asked.length - 1] === '4', 'SPLIT splits from a sheet too (the View menu uses it)');
  const g = harness();
  await g.type('VPORTS', '2');
  ok(g.log.includes(EN('cmd.vports.browser')), 'without the browser VPORTS says so');
  {
    let linked = false;
    g.host.linkViews = (on) => { if (on !== undefined) linked = on; return linked; };
    await g.type('LINKVIEWS', '');
    ok(linked && g.log.includes(EN('cmd.linkviews.on')), 'LINKVIEWS: Enter takes the other state (ON)');
    await g.type('LINKVIEWS', 'OFF');
    ok(!linked && g.log.includes(EN('cmd.linkviews.off')), 'LINKVIEWS OFF');
  }
  await g.type('OPENIN3D');
  ok(g.log.includes(EN('cmd.open3d.none')), 'OPENIN3D says when the 3D app takes no handoff here');
  g.host.openIn3d = async () => { const e = new Error('x'); e.code = 'blocked'; throw e; };
  await g.type('OPENIN3D');
  ok(g.log.includes(EN('cmd.open3d.blocked')), 'a blocked tab is said in words');
  {
    // several drawings open (doctabs.js, Q.3): drawings trade places in the one Doc everything holds
    const a = harness(), b = new Doc();
    await a.type('L', '0,0', '10,0', '');
    b.load({ meta: { name: 'Other' } });
    b.change('x', () => b.add({ type: 'circle', layer: '0', cx: 0, cy: 0, r: 5 }));
    let heard = 0;
    const off = a.doc.on((k) => { if (k === 'load') heard++; });
    const keepListeners = a.doc.listeners;
    a.doc.swapContent(b);
    ok(a.doc.meta.name === 'Other' && a.doc.all()[0].type === 'circle' && b.all()[0].type === 'line' && b.meta.name === 'Drawing1', 'swapContent trades the drawings');
    ok(a.doc.listeners === keepListeners && heard === 1 && a.doc.model3d.doc === a.doc && b.model3d.doc === b, 'listeners stay, \'load\' is heard once, each 3D model points at its own Doc');
    a.doc.undo();
    ok(a.doc.count() === 0 && b.count() === 1, 'undo travels with its drawing');
    a.doc.swapContent(b);
    ok(a.doc.all()[0].type === 'line' && b.redoStack.length === 1, 'and back');
    off();
  }
}

// ---------------------------------------------------------------------------
section('Selection options (Previous, Fence, Window, Crossing, Remove, Add)');
{
  const lines = async (type) => { for (let i = 0; i < 5; i++) await type('L', (i * 10) + ',0', (i * 10) + ',10', ''); };
  {
    const { doc, type, host, log } = harness();
    await lines(type);
    await type('E');
    ok(host.lastPrompt === 'Select objects:', 'the selection options stay out of the prompt, as in AutoCAD', host.lastPrompt);
    await type('?');
    ok(log.includes(EN('sel.help')), '? lists what "Select objects" takes');
    await type('F', '-5,5', '15,5', '', '');
    ok(doc.count() === 3, 'Fence: the two lines the fence crosses are erased', doc.count());
    ok(log.includes('2 found'), 'Fence reports how many it found');
  }
  {
    const { doc, type, click, host, log } = harness();
    await lines(type);
    await type('E', 'ALL', 'R');
    ok(host.lastPrompt === EN('sel.remove.prompt') + ':', 'R switches to "Remove objects"', host.lastPrompt);
    await click(20, 5);
    ok(host.selection.size === 4, 'a click in Remove mode takes the object out');
    await type('A');
    await click(20, 5);
    ok(host.selection.size === 5, 'A adds again');
    await type('R', 'C', '25,-1', '45,11');
    ok(host.selection.size === 3 && log.includes(EN('sel.removed', { n: 2 })), 'Crossing in Remove mode takes out what it touches', host.selection.size);
    await type('');
    ok(doc.count() === 2, 'and ERASE erases the rest', doc.count());
  }
  {
    const { doc, type, log } = harness();
    await lines(type);
    await type('M', 'W', '-1,-1', '11,11', '', '0,0', '100,0');
    ok(doc.all().filter((e) => e.x1 >= 100).length === 2, 'Window: what is fully inside is moved');
    await type('M', 'P', '', '0,0', '0,50');
    ok(doc.all().filter((e) => e.y1 >= 50).length === 2, 'Previous: the same two objects again');
    await type('E', 'P', '');
    ok(doc.count() === 3, 'Previous after a move erases them');
    await type('E', 'P');
    ok(log.includes(EN('sel.previous.none')), 'Previous with nothing left says so');
    await type('');
    await type('SELECT', 'F', '-5,5', '45,5', '', '');
    await type('M', '0,0', '0,-100');
    ok(doc.all().filter((e) => e.y1 <= -100).length === 3, 'SELECT then MOVE (noun-verb) moves the fenced objects');
    await type('E', 'P', '');
    ok(doc.count() === 0, 'and Previous picks up a noun-verb selection too', doc.count());
  }
  {
    const { doc, type, eng } = harness();
    await lines(type);
    await type('E', 'F', '-5,5', '5,5', 'U', '-5,8', '15,8', 'U');
    ok(eng.running === 'ERASE' && eng.expects === 'point', 'Undo takes back the last fence point');
    eng.escape(); await new Promise((r) => setTimeout(r, 0));
    ok(doc.count() === 5 && !eng.running, 'Esc while fencing cancels the command');
  }
  {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const ents = [{ id: 'a', type: 'circle', cx: 5, cy: 5, r: 1 }, { id: 'b', type: 'circle', cx: 50, cy: 5, r: 1 }, { id: 'c', type: 'point', x: 2, y: 2 }, { id: 'd', type: 'line', x1: 0, y1: 10, x2: 10, y2: 0 }];
    ok(JSON.stringify(G.fenceHits(ents, pts, null)) === JSON.stringify(['a', 'c', 'd']), 'fenceHits: circles, points on the fence and lines it crosses');
  }
}

// ---------------------------------------------------------------------------
section('Area and perimeter (AREA, MEASUREGEOM)');
{
  const A = (e) => G.entityArea(e);
  ok(near(A({ type: 'circle', cx: 0, cy: 0, r: 2 }).area, 4 * Math.PI) && A({ type: 'circle', cx: 0, cy: 0, r: 2 }).kind === 'circle', 'circle area and circumference');
  const sq = { type: 'poly', closed: true, pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
  ok(near(A(sq).area, 100) && near(A(sq).perimeter, 40), 'closed square: 100 and 40');
  const cw = { ...sq, pts: [...sq.pts].reverse() };
  ok(near(A(cw).area, 100), 'the same square drawn clockwise');
  // a 10 × 10 square whose bottom side bulges out into a half circle (positive bulge from (0,0) to (10,0) goes below)
  const bul = { type: 'poly', closed: true, pts: [{ x: 0, y: 0, b: 1 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
  ok(near(A(bul).area, 100 + Math.PI * 25 / 2) && near(A(bul).perimeter, 30 + Math.PI * 5), 'a bulge outward adds its half circle', JSON.stringify(A(bul)));
  const bulIn = { ...bul, pts: [{ x: 0, y: 0, b: -1 }, ...bul.pts.slice(1)] };
  ok(near(A(bulIn).area, 100 - Math.PI * 25 / 2), 'a bulge inward takes it away');
  const open = { type: 'poly', closed: false, pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
  ok(near(A(open).area, 50) && near(A(open).perimeter, 20) && A(open).kind === 'open', 'open polyline: area closed by a straight line, perimeter = its length');
  ok(near(A({ type: 'ellipse', cx: 0, cy: 0, mx: 4, my: 0, ratio: 0.5, t0: 0, t1: G.TAU }).area, Math.PI * 8), 'ellipse area');
  ok(near(A({ type: 'hatch', loops: [[0, 0, 10, 0, 10, 10, 0, 10], [2, 2, 4, 2, 4, 4, 2, 4]] }).area, 96), 'hatch with a hole: outer minus inner');
  ok(A({ type: 'line', x1: 0, y1: 0, x2: 1, y2: 0 }) === null, 'a line has no area');
}
{
  const { type, click, log } = harness();
  await type('AREA', '0,0', '10,0', '10,10', '0,10', '');
  ok(log.includes(EN('cmd.area.result', { area: '100', perimeter: '40' })), 'AREA by points: Enter closes the outline', log.slice(-2).join(' | '));
  await type('C', '50,0', '5');
  await type('AREA', '');   // Enter = Object
  await click(55, 0);
  ok(log.some((l) => l.startsWith('Area = 78.5398, Circumference = 31.4159')), 'AREA Object on a circle', log.slice(-1)[0]);
  await type('REC', '100,0', '120,10');
  await type('AREA', 'A', 'O');
  await click(110, 0); await click(55, 0);
  await type('', 'S', 'O');
  await click(55, 0);
  await type('', '');
  const totals = log.filter((l) => l.startsWith('Total area'));
  ok(totals.length === 3 && totals[1] === EN('cmd.area.total', { area: '278.5398' }) && totals[2] === EN('cmd.area.total', { area: '200' }), 'Add then Subtract keep a running total', JSON.stringify(totals));
  await type('L', '200,0', '210,0', '');
  await type('AREA', 'O');
  await click(205, 0);
  ok(log.includes(EN('cmd.area.noarea')), 'a line has no area, and AREA says what does');
}
{
  const { type, click, log } = harness();
  await type('L', '0,0', '10,0', '', 'L', '0,0', '10,10', '', 'A', 'C', '0,0', '5,0', '0,5');
  await type('MEA', '', '0,0', '3,4');
  ok(log.some((l) => l.startsWith('Distance = 5,')), 'MEASUREGEOM Distance (the default)');
  await type('R');
  await click(0, 5);
  ok(log.includes(EN('cmd.mea.radius', { r: '5', d: '10' })), 'MEASUREGEOM Radius');
  await type('A');
  await click(8, 0); await click(8, 8);
  ok(log.includes(EN('cmd.mea.angle', { a: '45' })), 'MEASUREGEOM Angle between two lines', log.slice(-1)[0]);
  await type('A');
  await click(0, 5);
  ok(log.includes(EN('cmd.mea.angle', { a: '90' })), 'MEASUREGEOM Angle of an arc', log.slice(-1)[0]);
  await type('AR', '0,0', '4,0', '4,3', '');
  ok(log.includes(EN('cmd.area.result', { area: '6', perimeter: '12' })), 'MEASUREGEOM ARea by points');
  await type('');
}

// ---------------------------------------------------------------------------
section('Units: feet and inches, fractions (UNITS, units.js)');
{
  const F = (v, lunits, prec = null) => U.formatLength(v, { lunits, prec });
  const cases = [
    [150.5, 4, 4, '12\'-6 1/2"'], [6, 4, 4, '0\'-6"'], [0, 4, 4, '0\'-0"'], [-150.5, 4, 4, '-12\'-6 1/2"'], [11.99, 4, 4, '1\'-0"'],
    [150.25, 4, 1, '12\'-6 1/2"'], [150.5, 3, 4, '12\'-6.5"'], [150.5, 5, 4, '150 1/2'], [0.25, 5, 4, '1/4'],
    [150.5, 1, 4, '1.5050E+02'], [1.23456, 2, 4, '1.2346'], [1.23456, 2, null, '1.2346'], [2, 2, 2, '2'],
  ];
  for (const [v, l, p, want] of cases) ok(F(v, l, p) === want, 'formatLength ' + v + ' as ' + U.LUNITS[l] + ' (' + p + ') = ' + want, F(v, l, p));
  const P = (s, l = 4) => U.parseLength(s, l);
  const reads = [['12\'6"', 150], ['12\'-6-1/2"', 150.5], ['12\'6-1/2', 150.5], ['12\'', 144], ['6"', 6], ['1/2', 0.5], ['6-1/2', 6.5], ['-1\'', -12], ['1.5\'', 18], ['150', 150], ['.5', 0.5]];
  for (const [t, want] of reads) ok(near(P(t), want), 'parseLength "' + t + '" = ' + want, P(t));
  ok(P('12\'', 2) === null && P('abc') === null && P('1/0') === null && P('12\'6\'') === null, 'feet only in engineering/architectural; nonsense refused');
  ok(U.formatArea(22500, { lunits: 4, prec: 4 }) === EN('units.area.imperial', { sqin: '22500', sqft: '156.25' }), 'an architectural area in square inches and square feet');
}
{
  const { doc, type, log, host, click } = harness();
  await type('UNITS', 'A', '16');
  ok(doc.meta.lunits === 4 && doc.meta.luprec === 4 && doc.current.dim.lunit === 4, 'UNITS Architectural 1/16: the drawing and new dimensions');
  ok(log.includes(EN('cmd.units.set', { format: EN('cmd.units.label.frac', { format: 'Architectural', den: 16 }), example: '12\'-6 1/2"' })), 'UNITS says what it set, with an example');
  await type('L', '0,0', '@12\'6",0', '');
  ok(near(doc.all()[0].x2, 150), 'a typed point in feet and inches (@12\'6",0)', doc.all()[0].x2);
  await type('L', '0,0', '@10\'<90', '');
  ok(near(doc.all()[1].y2, 120), 'a polar point in feet (@10\'<90)');
  await type('C', '0,0', '1\'6');
  ok(near(doc.all()[2].r, 18), 'a typed radius 1\'6 (no inch mark) = 18');
  host.cursor = { x: 100, y: 50 };
  await type('L', '0,50', '2\'', '');
  ok(near(doc.all()[3].x2, 24), 'direct distance entry in feet');
  await type('DIST', '0,0', '150,0');
  ok(log.some((l) => l.startsWith('Distance = 12\'-6",')), 'DIST prints feet and inches', log[log.length - 1]);
  await type('ID', '150.5,6');
  ok(log.includes(EN('cmd.id.result', { x: '12\'-6 1/2"', y: '0\'-6"' })), 'ID too');
  await type('DLI', '0,0', '150,0', '75,20');
  const d = doc.all().pop();
  ok(d.type === 'dim' && Dm.formatMeasure(d) === '12\'-6"', 'a new dimension reads 12\'-6"', d.type === 'dim' && Dm.formatMeasure(d));
  await type('REC', '0,0', '150,150');
  await type('AREA', 'O');
  await click(150, 100);
  ok(log.includes(EN('cmd.area.result', { area: EN('units.area.imperial', { sqin: '22500', sqft: '156.25' }), perimeter: '50\'-0"' })), 'AREA in square inches and square feet, the perimeter in feet and inches', log[log.length - 1]);
  const steps = doc.undoStack.length;
  await type('UNITS', 'D', '2');
  ok(doc.meta.lunits === 2 && doc.undoStack.length === steps + 1, 'UNITS back to decimal is a step of its own');
  doc.undo();
  ok(doc.meta.lunits === 4, 'and undo puts the format back');
  host.selection = new Set([doc.all().find((e) => e.type === 'circle').id]);
  await type('LI');
  ok(log[log.length - 1].includes('radius 1\'-6"'), 'LIST in feet and inches', log[log.length - 1]);
  await type('UNITS', 'A', '3');
  ok(log.includes(EN('cmd.units.den.bad')) && doc.meta.lunits === 4, 'a denominator that is not a power of two is refused');
  await type('8');
  ok(doc.meta.luprec === 3, 'then 8 = 1/8');
}

// ---------------------------------------------------------------------------
section('Paragraph text (MTEXT, TEXTEDIT)');
{
  const { doc, type, log } = harness();
  await type('MT', '0,0', '100,-20', 'First paragraph, long enough to wrap', 'Second', '');
  const m = doc.all()[0];
  ok(m && m.type === 'text' && m.s === 'First paragraph, long enough to wrap\nSecond' && near(m.ww, 100) && m.ha === 'left' && m.va === 'top' && nearPt(m, 0, 0), 'MTEXT (command line): two corners give the wrap width; lines become paragraphs', JSON.stringify(m));
  ok(doc.undoStack.length === 1, 'MTEXT is one undo step');
  await type('T', '0,0', 'H', '5', 'J', 'MC', 'L', '1.5', '10,-10', 'Centered', '');
  const c2 = doc.all()[1];
  ok(c2 && near(c2.h, 5) && c2.ha === 'center' && c2.va === 'middle' && nearPt(c2, 5, -5) && near(c2.ww, 10) && near(c2.ls, 1.5), 'T is MTEXT; Height, Justify MC and Line spacing; the insertion point is the box\'s middle', JSON.stringify(c2));
  await type('MT', '50,50', 'W', '0', 'No wrap', '');
  const c3 = doc.all()[2];
  ok(c3 && !('ww' in c3) && nearPt(c3, 50, 50), 'Width 0: no wrapping, the first corner is the insertion point');
  await type('MT', '0,0', '10,10', '');
  ok(doc.count() === 3 && log.includes(EN('cmd.mtext.empty')), 'no text: nothing added');
  await type('MT', '0,0', 'L', '9', '');
  ok(log.includes(EN('cmd.mtext.ls.bad')), 'a line spacing out of range is refused');
}
{
  const { doc, type, click, host, eng } = harness();
  const seen = [];
  host.editText = async (e) => { seen.push(e); return { s: 'Typed in place', h: e.h, ls: 1.2, ww: 60, ha: e.ha, va: e.va }; };
  await type('MT', '0,0', '80,-30');
  const m = doc.all()[0];
  ok(seen.length === 1 && near(seen[0].ww, 80) && seen[0].s === '' && m.s === 'Typed in place' && near(m.ww, 60) && near(m.ls, 1.2), 'MTEXT hands the new text to the in-place editor and keeps what it returns', JSON.stringify(m));
  host.editText = async (e) => ({ s: e.s + ' (edited)', h: e.h, ls: 1, ww: 0, ha: e.ha, va: e.va });
  host.selection = new Set([m.id]);
  await type('ED');
  const m2 = doc.get(m.id);
  ok(!eng.running, 'TEXTEDIT on a selected text ends after it (a double-click edits one text)');
  ok(m2.s === 'Typed in place (edited)' && !('ww' in m2) && !('ls' in m2), 'TEXTEDIT on a selected text: the editor\'s result, wrap width 0 and spacing 1 dropped', JSON.stringify(m2));
  host.editText = async () => null;
  await type('ED');
  await click(1, -1);
  await type('');
  ok(doc.get(m.id).s === 'Typed in place (edited)', 'Cancel in the editor leaves the text');
  delete host.editText;
  await type('ED');
  await click(1, -1);
  await type('Plain words', '');
  ok(doc.get(m.id).s === 'Plain words', 'without an editor TEXTEDIT asks at the command line');
}

// ---------------------------------------------------------------------------
section('Hatch (HATCH, hatch.js)');
{
  const sq = (x, y, w) => [x, y, x + w, y, x + w, y + w, x, y + w];
  const total = (ps) => ps.reduce((s, q) => s + Math.hypot(q.x2 - q.x1, q.y2 - q.y1), 0);
  const inside = (ps, x0, y0, x1, y1) => ps.every((q) => [[q.x1, q.y1], [q.x2, q.y2]].every(([x, y]) => x >= x0 - 1e-9 && x <= x1 + 1e-9 && y >= y0 - 1e-9 && y <= y1 + 1e-9));
  const h = (extra) => ({ type: 'hatch', loops: [sq(0, 0, 10)], solid: false, pattern: 'ANSI31', piso: true, ...extra });
  const a31 = Ht.hatchLines(h());
  ok(a31 && near(total(a31), 100 / 3.175, 1.5) && inside(a31, 0, 0, 10, 10), 'ANSI31 on a 10 × 10 square: 45° lines 3.175 apart, clipped to it', a31 && total(a31));
  ok(a31.every((q) => near(Math.abs((q.y2 - q.y1) / (q.x2 - q.x1)), 1, 1e-9)), 'every ANSI31 line at 45°');
  const inch = Ht.hatchLines(h({ piso: false }));
  ok(inch && near(total(inch), 100 / 0.125, 6), 'the inch definition is 25.4 times finer', inch && total(inch));
  { const r = total(Ht.hatchLines(h({ pscale: 2 }))) / total(a31); ok(r > 0.4 && r < 0.6, 'scale 2 doubles the spacing', r); }
  {
    // pattern origin (ox, oy; cad-props P.7): along the lines nothing changes, across them the lines move
    const key = (ps) => ps.map((q) => (q.y1 - q.x1).toFixed(6)).sort().join();
    ok(key(Ht.hatchLines(h({ ox: 4, oy: 4 }))) === key(a31) && key(Ht.hatchLines(h({ ox: 1 }))) !== key(a31), 'the pattern origin moves the lines across, not along');
  }
  const turned = Ht.hatchLines(h({ pangle: Math.PI / 4 }));
  ok(turned.every((q) => near(q.x1, q.x2, 1e-9)), 'angle 45° turns ANSI31 upright');
  const hole = Ht.hatchLines(h({ loops: [sq(0, 0, 10), sq(3, 3, 4)] }));
  ok(near(total(hole), 84 / 3.175, 1.5) && hole.every((q) => !(Math.min(q.x1, q.x2) > 3.01 && Math.max(q.x1, q.x2) < 6.99 && Math.min(q.y1, q.y2) > 3.01 && Math.max(q.y1, q.y2) < 6.99)), 'an island stays empty (even-odd)', total(hole));
  const dash = Ht.hatchLines(h({ pattern: 'DASH' }));
  { const r = total(dash) / total(Ht.hatchLines(h({ pattern: 'LINE' }))); ok(r > 0.35 && r < 0.65, 'DASH: about half dashes, half gaps', r); }
  ok(Ht.hatchLines(h({ pscale: 1e-4 })) === null, 'too dense: null (shown as a tone)');
  ok(Ht.hatchLines(h({ pattern: 'NOSUCH' })) === null && Ht.hatchLines(h({ solid: true })) === null, 'unknown patterns and solid fills have no lines');
  ok(Ht.hatchLines(h({ pattern: 'NET' })).length > a31.length * 0.6, 'NET has both directions');
  const fl = Ht.hatchLines(h({ patlines: [{ angle: 0, x: 0, y: 0, dx: 0, dy: 2, dashes: [] }] }));
  ok(fl && fl.length === 5 && fl.every((q) => near(q.y1, q.y2)), 'a file\'s own pattern lines are used as they are', fl && fl.length);

  // boundaries
  const Ln = (x1, y1, x2, y2) => ({ type: 'line', layer: '0', x1, y1, x2, y2 });
  const area = (l) => { let a = 0; for (let i = 0; i < l.length; i += 2) { const j = (i + 2) % l.length; a += l[i] * l[j + 1] - l[j] * l[i + 1]; } return a / 2; };
  const hashSign = [Ln(-2, 0, 12, 0), Ln(-2, 10, 12, 10), Ln(0, -2, 0, 12), Ln(10, -2, 10, 12)];
  const b1 = Ht.boundaryAt(hashSign, { x: 5, y: 5 });
  ok(b1.loops?.length === 1 && near(Math.abs(area(b1.loops[0])), 100, 1e-6), 'boundary: four crossing lines (ends sticking out) close a 10 × 10 room', JSON.stringify(b1));
  const circle = { type: 'circle', layer: '0', cx: 5, cy: 5, r: 2 };
  const b2 = Ht.boundaryAt([...hashSign, circle], { x: 1, y: 1 });
  ok(b2.loops?.length === 2 && near(Math.abs(area(b2.loops[0])), 100, 1e-6) && near(Math.abs(area(b2.loops[1])), Math.PI * 4, 0.01), 'a circle inside is an island', JSON.stringify(b2.loops?.map(area)));
  const b3 = Ht.boundaryAt([...hashSign, circle], { x: 5, y: 5 });
  ok(b3.loops?.length === 1 && near(Math.abs(area(b3.loops[0])), Math.PI * 4, 0.01), 'inside the circle: the circle itself');
  ok(Ht.boundaryAt(hashSign.slice(0, 3), { x: 5, y: 5 }).error === 'open', 'three sides: no closed boundary');
  ok(Ht.boundaryAt([], { x: 0, y: 0 }).error === 'none', 'nothing: no boundary');
  const arcRoom = [Ln(0, 0, 10, 0), Ln(10, 0, 10, 10), { type: 'arc', layer: '0', cx: 5, cy: 10, r: 5, a0: 0, a1: Math.PI }, Ln(0, 10, 0, 0)];
  const b4 = Ht.boundaryAt(arcRoom, { x: 5, y: 12 });
  ok(b4.loops && near(Math.abs(area(b4.loops[0])), 100 + Math.PI * 12.5, 0.05), 'an arc side follows the arc', b4.loops && Math.abs(area(b4.loops[0])));
  const spur = [...hashSign, Ln(5, 0, 5, 4)];
  const b5 = Ht.boundaryAt(spur, { x: 2, y: 5 });
  ok(b5.loops?.length === 1 && near(Math.abs(area(b5.loops[0])), 100, 1e-6), 'a line poking into the room does not cut it');
  const rect = { type: 'poly', layer: '0', closed: true, pts: [{ x: 0, y: 0, b: 1 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }] };
  ok(near(Math.abs(area(Ht.loopsOf(rect)[0])), 16 + Math.PI * 2, 0.01) && Ht.loopsOf(Ln(0, 0, 1, 1)) === null, 'loopsOf: a closed polyline with a bulge; a line is not closed');
}
{
  const { doc, type, click, log } = harness();
  await type('L', '-2,0', '12,0', '', 'L', '-2,10', '12,10', '', 'L', '0,-2', '0,12', '', 'L', '10,-2', '10,12', '');
  await type('C', '5,5', '2');
  const n0 = doc.undoStack.length;
  await type('H', 'P', 'ANSI37', 'SC', '0.5');
  await click(1, 1);
  await type('');
  const hh = doc.all().find((e) => e.type === 'hatch');
  ok(hh && hh.pattern === 'ANSI37' && near(hh.pscale, 0.5) && hh.loops.length === 2 && !hh.solid, 'HATCH: pattern, scale and a picked point (with the circle as an island)', JSON.stringify(hh && { ...hh, loops: hh.loops.length }));
  ok(doc.undoStack.length === n0 + 1, 'one undo step');
  const strokes = [];
  walkFn(doc, [hh], { stroke: (c, ps) => strokes.push(...ps), fill: () => strokes.push('fill'), text() {}, point() {}, viewport() {} });
  ok(strokes.length > 20 && !strokes.includes('fill'), 'walk draws a pattern hatch as its lines (screen and plot)', strokes.length);
  await type('H', 'P', 'SOLID', 'S', 'L', '', '');
  ok(log.includes(EN('cmd.hatch.notclosed', { n: 1 })) && doc.all().filter((e) => e.type === 'hatch').length === 1, 'select objects: a line is not closed, nothing to hatch');
  await type('H', 'S');
  await click(7, 5);
  await type('', '');
  const solid = doc.all().filter((e) => e.type === 'hatch').pop();
  ok(solid.solid && !solid.pattern && solid.loops.length === 1, 'HATCH Solid (kept from last time) on a selected circle', JSON.stringify({ ...solid, loops: solid.loops.length }));
  await type('H', '20,20', '');
  ok(log.includes(EN('cmd.hatch.err.open')), 'a point outside any boundary is refused, with a reason');
  await type('H', 'P', '?', '');
  ok(log.some((l) => l.includes('ANSI31 — ')), 'P ? lists the patterns');
}

// ---------------------------------------------------------------------------
section('STRETCH and ARRAY');
{
  const box = (x0, y0, x1, y1) => (p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
  const ln = G.stretchEntity({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }, box(8, -1, 12, 1), 5, 0);
  ok(ln && near(ln.x1, 0) && near(ln.x2, 15), 'stretch a line: only the end inside moves');
  ok(G.stretchEntity({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 }, box(20, 20, 30, 30), 5, 0) === null, 'nothing inside: unchanged');
  const pl = G.stretchEntity({ type: 'poly', closed: true, pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }, box(9, -1, 11, 11), 5, 0);
  ok(pl && near(pl.pts[1].x, 15) && near(pl.pts[2].x, 15) && near(pl.pts[0].x, 0), 'stretch a rectangle: the right side moves, the room gets wider');
  const arcPoly = { type: 'poly', closed: false, pts: [{ x: 0, y: 0, b: 0.5 }, { x: 10, y: 0 }] };
  const sp = G.stretchEntity(arcPoly, box(9, -1, 11, 1), 10, 0);
  const sag = (p, q, b) => b * Math.hypot(q.x - p.x, q.y - p.y) / 2;
  ok(sp && near(sag(sp.pts[0], sp.pts[1], sp.pts[0].b), sag(arcPoly.pts[0], arcPoly.pts[1], 0.5)), 'an arc segment keeps its height, as AutoCAD does', JSON.stringify(sp && sp.pts));
  const ar = G.stretchEntity({ type: 'arc', cx: 5, cy: 0, r: 5, a0: 0, a1: Math.PI }, box(9, -1, 11, 1), 4, 0);
  ok(ar && near(ar.cx + ar.r * Math.cos(ar.a0), 14, 1e-6) && near(ar.cx + ar.r * Math.cos(ar.a1), 0, 1e-6) && near(ar.cy + ar.r, 5 + 0, 0.6), 'an arc with one end inside: that end moves, the height stays', JSON.stringify(ar));
  const cc = G.stretchEntity({ type: 'circle', cx: 0, cy: 0, r: 1 }, box(-1, -1, 1, 1), 3, 0);
  ok(cc && near(cc.cx, 3) && near(cc.r, 1), 'a circle with its center inside moves whole');
  const dm = G.stretchEntity({ type: 'dim', kind: 'linear', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, loc: { x: 5, y: 3 }, rot: 0, block: '*D1' }, box(9, -1, 11, 1), 5, 0);
  ok(dm && near(dm.p2.x, 15) && near(dm.p1.x, 0) && !dm.block && Dm.dimMeasure(dm) === 15, 'a dimension re-measures (15)', JSON.stringify(dm));
}
{
  const { doc, type, eng } = harness();
  await type('REC', '0,0', '10,10');
  await type('L', '10,5', '20,5', '');
  await type('S');
  eng.window({ minX: 8, minY: -1, maxX: 12, maxY: 11 }, true);
  await type('', '0,0', '5,0');
  const [r, l] = doc.all();
  ok(near(r.pts[1].x, 15) && near(r.pts[2].x, 15) && near(r.pts[0].x, 0) && near(l.x1, 15) && near(l.x2, 20), 'STRETCH with a crossing window: the rectangle widens, the line\'s end follows', JSON.stringify([r.pts, l]));
  ok(doc.undoStack[doc.undoStack.length - 1].label === 'STRETCH', 'one undo step');
  await type('S', 'C', '14,-1', '16,11', '', 'D', '-5,0');
  ok(near(doc.all()[0].pts[1].x, 10), 'C (crossing) typed and Displacement');
}
{
  const { doc, type, log } = harness();
  await type('C', '0,0', '1');
  await type('AR', 'L', '', 'R', 'COU', '3', '2', 'S', '5', '-4', '');
  const cs = doc.all();
  ok(cs.length === 6 && cs.some((e) => near(e.cx, 10) && near(e.cy, -4)) && log.includes(EN('cmd.array.done', { n: 5 })), 'ARRAY Rectangular: 3 columns × 2 rows, rows going down (negative spacing)', JSON.stringify(cs.map((e) => [e.cx, e.cy])));
  await type('U');
  await type('ARRAYPOLAR', 'L', '', '0,10', 'I', '4', '');
  const p4 = doc.all();
  ok(p4.length === 4 && p4.some((e) => near(e.cx, 0) && near(e.cy, 20)) && p4.some((e) => near(e.cx, -10) && near(e.cy, 10)), 'ARRAYPOLAR: 4 items round (0,10)', JSON.stringify(p4.map((e) => [e.cx, e.cy])));
  await type('U');
  await type('L', '0,0', '2,0', '');
  await type('ARRAYPOLAR', 'L', '', '0,10', 'I', '3', 'F', '180', 'ROT', 'N', '');
  const ls = doc.all().filter((e) => e.type === 'line');
  ok(ls.length === 3 && ls.every((e) => near(e.y1, e.y2)) && ls.some((e) => near(e.y1, 20)), 'Fill 180° with 3 items puts them at 0°, 90°, 180°; not rotated stays level', JSON.stringify(ls));
  await type('AR', 'L', '', 'R', 'COU', '1', '1', '');
  ok(log.includes(EN('cmd.array.one')), 'one item: nothing copied');
  await type('AR', 'L', '', 'R', 'COU', '1000', '1000', '');
  ok(log.includes(EN('cmd.array.toomany')), 'a million copies are refused');
}

// ---------------------------------------------------------------------------
section('JOIN and MATCHPROP');
{
  const Ln = (x1, y1, x2, y2, id) => ({ id, type: 'line', layer: '0', x1, y1, x2, y2 });
  const r1 = G.joinEntities([Ln(0, 0, 10, 0, 1), Ln(10, 10, 10, 0, 2), Ln(10, 10, 0, 10, 3)]);
  const p1 = r1.results[0]?.to;
  ok(p1 && p1.type === 'poly' && !p1.closed && p1.pts.length === 4 && r1.results[0].from.length === 3, 'three lines end to end (one drawn backwards) → one open polyline', JSON.stringify(p1));
  const r2 = G.joinEntities([Ln(0, 0, 10, 0, 1), Ln(10, 0, 10, 10, 2), Ln(10, 10, 0, 10, 3), Ln(0, 10, 0, 0, 4)]);
  ok(r2.results[0]?.to.closed && r2.results[0].to.pts.length === 4, 'four lines round a square → a closed polyline');
  const r3 = G.joinEntities([Ln(0, 0, 10, 0, 1), { id: 2, type: 'arc', layer: '0', cx: 10, cy: 5, r: 5, a0: -Math.PI / 2, a1: Math.PI / 2 }]);
  const p3 = r3.results[0]?.to;
  ok(p3 && p3.pts.length === 3 && near(p3.pts[1].b, 1) && near(G.entityArea({ ...p3, closed: true }).area, 50 + Math.PI * 25 / 2), 'a line and an arc → a polyline with an arc segment', JSON.stringify(p3));
  const r4 = G.joinEntities([Ln(0, 0, 4, 0, 1), Ln(6, 0, 10, 0, 2)]);
  ok(r4.results[0]?.to.type === 'line' && near(r4.results[0].to.x1, 0) && near(r4.results[0].to.x2, 10), 'two lines on one line, with a gap → one line');
  const A = (a0, a1, id) => ({ id, type: 'arc', layer: '0', cx: 0, cy: 0, r: 5, a0, a1 });
  const r5 = G.joinEntities([A(0, 1, 1), A(1.2, 2, 2)]);
  ok(r5.results[0]?.to.type === 'arc' && near(r5.results[0].to.a0, 0) && near(r5.results[0].to.a1, 2), 'two arcs of one circle → one arc (the small gap filled)', JSON.stringify(r5.results[0]?.to));
  const r6 = G.joinEntities([A(0, Math.PI, 1), A(Math.PI, 0, 2)]);
  ok(r6.results[0]?.to.type === 'circle', 'arcs that close the circle → a circle');
  const r7 = G.joinEntities([Ln(0, 0, 1, 0, 1), Ln(1, 0, 1, 1, 2), Ln(5, 5, 6, 7, 3)]);
  ok(r7.results.length === 1 && r7.left.includes(3), 'what meets nothing is left');
}
{
  const { doc, type, log, eng } = harness();
  await type('L', '0,0', '10,0', '10,10', '0,10', 'C');
  const n0 = doc.undoStack.length;
  await type('J', 'ALL', '');
  const ps = doc.all();
  ok(ps.length === 1 && ps[0].type === 'poly' && ps[0].closed && log.includes(EN('cmd.join.done', { n: 4, m: 1 })), 'JOIN: a closed outline of four lines becomes one closed polyline');
  ok(doc.undoStack.length === n0 + 1, 'one undo step');
  doc.undo();
  ok(doc.count() === 4, 'undo brings the four lines back');
}
{
  const { doc, type, click, log } = harness();
  doc.addLayer({ name: 'Walls', color: 1 });
  await type('L', '0,0', '10,0', '');
  doc.change('t', () => doc.update(doc.all()[0].id, { ...doc.all()[0], layer: 'Walls', color: 3 }));
  await type('L', '0,5', '10,5', '', 'C', '20,0', '2');
  await type('MA');
  await click(5, 0);
  await type('ALL', '');
  ok(doc.all().every((e) => e.layer === 'Walls' && e.color === 3), 'MATCHPROP: layer and color onto every other object');
  await type('L', '0,20', '10,20', '');
  await type('MA');
  await click(5, 0);
  await type('S', 'C', '');
  ok(log.includes(EN('cmd.ma.active', { list: [EN('opt.layer'), EN('opt.text'), EN('opt.dimension'), EN('opt.hatch')].join(' ') })), 'Settings: Color turned off');
  await type('L', '');
  const last = doc.all().pop();
  ok(last.layer === 'Walls' && last.color === null, 'then only the layer is copied');
  await type('DT', '0,30', '2', '0', 'small', '', 'DT', '0,40', '7', '0', 'BIG', '');
  const [tSmall, tBig] = doc.all().filter((e) => e.type === 'text');
  await type('MA');
  await click(1, 41);
  await click(1, 30.5);
  await type('');
  ok(near(doc.get(tSmall.id).h, 7), 'text height comes along between texts', doc.get(tSmall.id).h);
}

// ---------------------------------------------------------------------------
section('Polar and object snap tracking (tracking.js)');
{
  const b = { x: 0, y: 0 };
  const r = Tk.polarTrack(b, { x: 86.7, y: 50.4 }, { inc: 30, tol: 1 });
  ok(r && near(G.deg(r.ang), 30) && near(Math.atan2(r.y, r.x), Math.PI / 6, 1e-12), 'polar: a pointer near 30° is pulled onto the 30° ray', JSON.stringify(r));
  ok(Tk.polarTrack(b, { x: 80, y: 60 }, { inc: 30, tol: 1 }) === null, 'too far from every ray: nothing');
  ok(near(G.deg(Tk.polarTrack(b, { x: 70, y: 71 }, { inc: 45, tol: 2 }).ang), 45), '45° steps');
  ok(Tk.polarTrack(b, { x: -100, y: 0.3 }, { inc: 90, tol: 1 }) && near(G.deg(Tk.polarTrack(b, { x: -100, y: 0.3 }, { inc: 90, tol: 1 }).ang), 180), 'behind the base point too (180°)');
  const acq = [{ x: 0, y: 0 }, { x: 50, y: 30 }];
  const two = Tk.trackPoint(acq, { x: 49.6, y: 0.4 }, { tol: 1 });
  ok(two && two.kind === 'two' && near(two.x, 50) && near(two.y, 0), 'object snap tracking: where the horizontal from one point meets the vertical from another', JSON.stringify(two));
  const one = Tk.trackPoint(acq, { x: 20, y: 30.5 }, { tol: 1 });
  ok(one && one.kind === 'one' && near(one.y, 30) && near(one.x, 20), 'one ray: lined up horizontally with (50, 30)');
  ok(Tk.trackPoint(acq, { x: 20, y: 20 }, { tol: 1 }) === null, 'off every ray: nothing');
  const pa = Tk.trackPoint([{ x: 0, y: 0 }], { x: 35.2, y: 35.6 }, { tol: 1, inc: 45, polarAll: true });
  ok(pa && near(pa.x, pa.y), 'with polar on, acquired points track at the polar angles too');
}
{
  const { doc, type, host } = harness();
  host.settings = {};
  await type('POLARANG', '30');
  ok(host.settings.polarInc === 30, 'POLARANG sets the step in the viewer\'s settings');
}

// ---------------------------------------------------------------------------
section('BREAK and LENGTHEN');
{
  const L = { type: 'line', x1: 0, y1: 0, x2: 10, y2: 0 };
  const b1 = G.breakEntity(L, { x: 3, y: 0 }, { x: 7, y: 0.1 });
  ok(b1.length === 2 && near(b1[0].x2, 3) && near(b1[1].x1, 7), 'break a line: the part between the points goes');
  const b2 = G.breakEntity(L, { x: 4, y: 0 }, { x: 4, y: 0 });
  ok(b2.length === 2 && near(b2[0].x2, 4) && near(b2[1].x1, 4), 'the same point twice splits it');
  const b3 = G.breakEntity({ type: 'circle', cx: 0, cy: 0, r: 5 }, { x: 5, y: 0 }, { x: 0, y: 5 });
  ok(b3[0]?.type === 'arc' && near(b3[0].a0, Math.PI / 2) && near(b3[0].a1, 0), 'a circle loses the part counter-clockwise from the first to the second point', JSON.stringify(b3));
  ok(G.breakEntity({ type: 'circle', cx: 0, cy: 0, r: 5 }, { x: 5, y: 0 }, { x: 5, y: 0 }).error === 'circle', 'a circle cannot be split at one point');
  const sq = { type: 'poly', closed: true, pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] };
  const b4 = G.breakEntity(sq, { x: 5, y: 0 }, { x: 10, y: 5 });
  ok(b4.length === 1 && !b4[0].closed && nearPt(b4[0].pts[0], 10, 5) && nearPt(b4[0].pts[b4[0].pts.length - 1], 5, 0) && b4[0].pts.length === 5, 'a closed polyline opens, without the corner between the points', JSON.stringify(b4[0]?.pts));
  const ar = G.breakEntity({ type: 'arc', cx: 0, cy: 0, r: 5, a0: 0, a1: Math.PI }, { x: 0, y: 5 }, { x: 0, y: 5 });
  ok(ar.length === 2 && near(ar[0].a1, Math.PI / 2) && near(ar[1].a0, Math.PI / 2), 'break an arc at a point');
  // LENGTHEN
  ok(near(G.lengthenEntity(L, { x: 9, y: 0 }, { delta: 5 }).x2, 15) && near(G.lengthenEntity(L, { x: 1, y: 0 }, { delta: 5 }).x1, -5), 'a line grows at the end nearest the pick');
  ok(G.lengthenEntity(L, { x: 9, y: 0 }, { delta: -10 }).error === 'short', 'shortening to nothing is refused');
  const A = { type: 'arc', cx: 0, cy: 0, r: 10, a0: 0, a1: Math.PI / 2 };
  const la = G.lengthenEntity(A, { x: 0, y: 10 }, { dAngle: Math.PI / 2 });
  ok(near(la.a1, Math.PI) && near(la.a0, 0), 'an arc by an angle, at its picked end');
  ok(G.lengthenEntity(A, { x: 10, y: 0 }, { dAngle: 2 * Math.PI }).error === 'full', 'not into a full circle');
  const P = { type: 'poly', closed: false, pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
  const lp = G.lengthenEntity(P, { x: 10, y: 9 }, { delta: 5 });
  ok(nearPt(lp.pts[2], 10, 15) && near(G.curveLength(lp), 25), 'a polyline\'s end segment');
  const PA = { type: 'poly', closed: false, pts: [{ x: 0, y: 0 }, { x: 10, y: 0, b: 1 }, { x: 10, y: 10 }] };   // half circle to (10,10), bulging to +x
  const lpa = G.lengthenEntity(PA, { x: 10, y: 10 }, { delta: Math.PI * 5 / 2 });
  ok(near(G.curveLength(lpa), G.curveLength(PA) + Math.PI * 5 / 2, 1e-6) && near(Math.hypot(lpa.pts[2].x - 10, lpa.pts[2].y - 5), 5), 'an arc end segment grows round its center', JSON.stringify(lpa.pts));
}
{
  const { doc, type, click, log } = harness();
  await type('L', '0,0', '10,0', '');
  await type('BR');
  await click(2, 0);
  await type('6,0');
  ok(doc.count() === 2 && doc.all().some((e) => near(e.x2, 2)) && doc.all().some((e) => near(e.x1, 6)), 'BREAK: the pick is the first point, then the second');
  await type('BREAKATPOINT');
  await click(8, 0);
  await type('8,0');
  ok(doc.count() === 3, 'BREAKATPOINT splits in two');
  await type('C', '50,0', '5', 'BR');
  await click(55, 0);
  await type('F', '55,0', '50,5');
  ok(doc.all().some((e) => e.type === 'arc' && near(e.r, 5)), 'BREAK F on a circle: the First point option');
}
{
  const { doc, type, click, log } = harness();
  await type('L', '0,0', '10,0', '');
  await type('LEN');
  await click(5, 0);
  ok(log.includes(EN('cmd.len.current', { l: '10' })), 'LENGTHEN measures the picked object first');
  await type('DE', '2');
  await click(9, 0);
  await type('');
  ok(near(doc.all()[0].x2, 12), 'DElta 2 at the picked end');
  await type('LEN', 'P', '50');
  await click(11, 0);
  await type('');
  ok(near(doc.all()[0].x2, 6), 'Percent 50: half as long');
  await type('LEN', 'T', '20');
  await click(5, 0);
  await type('U');
  ok(near(doc.all()[0].x2, 6), 'Undo inside LENGTHEN');
  await click(5, 0);
  await type('');
  ok(near(doc.all()[0].x2, 20), 'Total 20');
  await type('LEN', 'DY');
  await click(19, 0);
  await type('25,3', '');
  ok(near(doc.all()[0].x2, 25), 'DYnamic: the end follows the pointer along the line');
}

// ---------------------------------------------------------------------------
section('Quick select and select similar (qselect.js)');
{
  const E = [
    { id: 1, type: 'line', layer: 'Walls', color: null, x1: 0, y1: 0, x2: 10, y2: 0 },
    { id: 2, type: 'line', layer: 'Walls', color: 1, x1: 0, y1: 0, x2: 0, y2: 3 },
    { id: 3, type: 'circle', layer: 'Doors', color: null, cx: 0, cy: 0, r: 2 },
    { id: 4, type: 'circle', layer: 'Walls', color: null, cx: 5, cy: 0, r: 5 },
    { id: 5, type: 'text', layer: 'Notes', color: null, x: 0, y: 0, h: 2.5, s: 'KITCHEN 101' },
    { id: 6, type: 'text', layer: 'Notes', color: null, x: 0, y: 0, h: 5, s: 'OFFICE' },
    { id: 7, type: 'insert', layer: 'Doors', color: null, block: 'DOOR-900', x: 0, y: 0 },
    { id: 8, type: 'insert', layer: 'Doors', color: null, block: 'DOOR-800', x: 0, y: 0 },
  ];
  const ids = (set) => [...set].sort().join(',');
  ok(ids(Qs.quickSelect(E, { type: 'any', prop: 'layer', op: '=', value: 'walls' })) === '1,2,4', 'any object on layer Walls (case does not matter)');
  ok(ids(Qs.quickSelect(E, { type: 'circle', prop: 'radius', op: '>', value: 3 })) === '4', 'circles with radius > 3');
  ok(ids(Qs.quickSelect(E, { type: 'line', prop: 'length', op: '<', value: 5 })) === '2', 'lines shorter than 5');
  ok(ids(Qs.quickSelect(E, { type: 'text', prop: 'contents', op: '*', value: 'kit*' })) === '5', 'text by wildcard');
  ok(ids(Qs.quickSelect(E, { type: 'insert', prop: 'block', op: '=', value: 'DOOR-900' })) === '7', 'blocks by name');
  ok(ids(Qs.quickSelect(E, { type: 'any', prop: 'color', op: '=', value: null })) === '1,3,4,5,6,7,8', 'color By layer');
  ok(ids(Qs.quickSelect(E, { type: 'line', prop: 'layer', op: 'all' })) === '1,2', 'Select all of a type');
  ok(ids(Qs.quickSelect(E, { type: 'any', prop: 'layer', op: '=', value: 'Notes', exclude: true })) === '1,2,3,4,7,8', 'Exclude: everything that does not match');
  ok(ids(Qs.quickSelect(E, { type: 'any', prop: 'layer', op: '=', value: 'Doors', within: new Set([3, 4, 7]) })) === '3,7', 'within the current selection');
  ok(JSON.stringify(Qs.valuesOf(E, 'insert', 'block')) === '["DOOR-800","DOOR-900"]', 'valuesOf lists what is there, sorted');
  ok(Qs.propsFor('text').includes('height') && !Qs.propsFor('any').includes('height'), 'type-specific properties');
  ok(ids(Qs.similarTo(E, [E[0]])) === '1', 'similar to a By-layer line on Walls: only itself (the red one differs in color)');
  ok(ids(Qs.similarTo(E, [E[0]], { ...Qs.SIMILAR, color: false })) === '1,2', 'color not compared: both Walls lines');
  ok(ids(Qs.similarTo(E, [E[6]])) === '7', 'block references: same block name');
  ok(ids(Qs.similarTo(E, [E[6]], { ...Qs.SIMILAR, name: false })) === '7,8', 'without the name: every reference on that layer');
}
{
  const { doc, type, host, log } = harness();
  await type('L', '0,0', '10,0', '', 'L', '0,5', '3,5', '', 'C', '0,0', '2');
  await type('QSELECT', 'Line', 'Length', '>', '5');
  ok(host.selection.size === 1 && doc.get([...host.selection][0]).x2 === 10, 'QSELECT at the command line: lines longer than 5', [...host.selection].join());
  host.selection = new Set([doc.all()[0].id]);
  await type('SIM');
  ok(host.selection.size === 2 && log.includes(EN('cmd.sim.done', { n: 2 })), 'SELECTSIMILAR from a selected line: both lines');
  host.selection = new Set();
  await type('SIM', 'SE', 'LA', '', 'L', '');
  ok(log.includes(EN('cmd.sim.now', { list: [EN('sim.color'), EN('sim.name'), EN('sim.pattern')].join(', ') })), 'SEttings: Layer turned off');
}

// ---------------------------------------------------------------------------
section('ZOOM Previous / Scale / Center and named views (NAMEDVIEW)');
{
  const { doc, type, host, log } = harness();
  const calls = [];
  let rect = { cx: 0, cy: 0, w: 100, h: 50 };
  Object.assign(host, {
    zoomPrevious: () => { calls.push('prev'); return calls.filter((x) => x === 'prev').length < 2; },
    zoomBy: (f) => calls.push('by ' + f),
    viewRect: () => rect,
    zoomWindow: (a, b, o) => { calls.push(['win', a.x, a.y, b.x, b.y, !!o?.exact].join(' ')); rect = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }; },
  });
  await type('Z', '2x'); await type('Z', '0.5'); await type('Z', 'S', '3X');
  ok(calls.join('|') === 'by 2|by 0.5|by 3', 'ZOOM 2x, 0.5 and Scale 3X zoom by a factor', calls.join('|'));
  await type('Z', 'P'); await type('Z', 'P');
  ok(log.includes(EN('cmd.zoom.noprev')), 'ZOOM P goes back; with nothing left it says so');
  await type('Z', 'C', '10,10', '20');
  ok(calls.includes('win -10 0 30 20 true'), 'ZOOM Center: point and height (the width follows the screen)', calls.join('|'));
  await type('NV', 'S', 'Kitchen');
  ok(doc.views.length === 1 && doc.views[0].name === 'Kitchen' && near(doc.views[0].w, 40) && log.includes(EN('cmd.nv.saved', { name: 'Kitchen' })), 'NAMEDVIEW Save: the view on screen under a name', JSON.stringify(doc.views));
  await type('NV', 'W', 'Detail', '0,0', '4,3');
  ok(doc.views.length === 2 && near(doc.views[1].w, 4) && near(doc.views[1].cy, 1.5), 'Window: a view of a window you pick');
  ok(doc.undoStack[doc.undoStack.length - 1].label === 'NAMEDVIEW', 'each change to the views is an undo step');
  await type('NV', 'R', 'kitchen');
  ok(calls[calls.length - 1] === 'win -10 0 30 20 true' && log.includes(EN('cmd.nv.restored', { name: 'Kitchen' })), 'Restore (any case)');
  await type('NV', '?');
  ok(log[log.length - 1].includes('Kitchen') && log[log.length - 1].includes('Detail'), '? lists them');
  await type('NV', 'S', 'Kitchen');
  ok(doc.views.length === 2 && log.includes(EN('cmd.nv.replaced', { name: 'Kitchen' })), 'saving an existing name replaces it');
  await type('NV', 'D', 'Detail');
  ok(doc.views.length === 1, 'Delete');
  doc.undo();
  ok(doc.views.length === 2, 'undo brings the deleted view back');
  await type('NV', 'R', 'Nope');
  ok(log[log.length - 1].startsWith('No view called "Nope"'), 'an unknown name lists the views there are');
  const d2 = new Doc();
  d2.load({ views: [{ name: 'A', cx: 0, cy: 0, w: 10, h: 5 }, { name: '', cx: 0, cy: 0, w: 1, h: 1 }, { name: 'B', cx: 'x', cy: 0, w: 1, h: 1 }] });
  ok(d2.views.length === 1 && d2.views[0].name === 'A', 'doc.load keeps the valid views from a file');
}

// ---------------------------------------------------------------------------
section('Dynamic input (dynin.js)');
{
  const isLen = (x) => U.parseLength(x, 4) !== null, parseLen = (x) => U.parseLength(x, 4) ?? NaN;
  const d = new DynInput();
  d.reset('polar');
  const base = { x: 10, y: 10 }, cur = { x: 20, y: 20 };
  const lv = d.live(cur, base);
  ok(near(lv[0], Math.hypot(10, 10)) && near(lv[1], 45), 'polar fields follow the pointer: distance and angle from the base');
  ok(d.commit('', cur, base) === null, 'nothing typed or locked: the command line reads it as always');
  ok(d.tab('12\'6"', isLen) && d.locked[0] === '12\'6"' && d.active === 1, 'Tab locks the distance as typed (feet and inches kept) and moves to the angle');
  const ap = d.apply({ x: 10, y: 30 }, base, parseLen);
  ok(near(ap.x, 10) && near(ap.y, 160), 'a locked distance holds the pointer to it (150 from the base, at the pointer\'s angle)', JSON.stringify(ap));
  ok(d.commit('30', cur, base) === '@12\'6"<30', 'Enter with an angle typed: @distance<angle', d.commit('30', cur, base));
  ok(!d.tab('abc', isLen) && d.active === 1, 'text that is not a value is not taken');
  const off = d.commit('30', cur, base, { last: { x: 0, y: 0 }, parseLen });
  ok(off && off.startsWith('#') && near(+off.slice(1).split(',')[0], 10 + 150 * Math.cos(Math.PI / 6), 1e-6), 'when the base is not the last point, the point itself is sent (#x,y)', off);
  const live = new DynInput(); live.reset('polar');
  const lp = live.apply({ x: 20, y: 10 }, base, parseLen, '5');
  ok(near(lp.x, 15) && near(lp.y, 10), 'a value being typed already steers the pointer (the rubber band shows it)', JSON.stringify(lp));
  d.reset('xy');
  ok(d.tab('5', isLen) && d.commit('7', { x: 0, y: 0 }, null) === '5,7', 'X then Y: absolute x,y');
  d.reset('xy'); d.tab('5', isLen);
  ok(d.commit('', { x: 1, y: 2.5 }, null) === '5,2.5', 'a locked X with the pointer\'s Y');
}
{
  // through the engine: what dynamic input sends is ordinary command-line text
  const { doc, type } = harness();
  await type('L', '0,0', '@10<90', '');
  ok(near(doc.all()[0].y2, 10), 'the engine draws what dynamic input sends (@10<90)');
}

// ---------------------------------------------------------------------------
section('Find and replace (FIND, findtext.js)');
{
  const E = [
    { id: 1, type: 'text', s: 'KITCHEN 101' },
    { id: 2, type: 'text', s: 'kitchenette' },
    { id: 3, type: 'insert', block: 'TAG', attrs: { ROOM: 'Kitchen', NO: '101' } },
    { id: 4, type: 'dim', kind: 'linear', text: '<> KITCHEN WALL' },
    { id: 5, type: 'dim', kind: 'linear', text: '' },
  ];
  const ids = (ms) => ms.map((m) => m.id + (m.tag ? ':' + m.tag : '')).join(',');
  ok(ids(Ft.findMatches(E, { find: 'kitchen' })) === '1,2,3:ROOM,4', 'find ignores case by default, in text, attributes and dimension text');
  ok(ids(Ft.findMatches(E, { find: 'kitchen', whole: true })) === '1,3:ROOM,4', 'whole words: not "kitchenette"');
  ok(ids(Ft.findMatches(E, { find: 'KITCHEN', matchCase: true })) === '1,4', 'match case');
  ok(ids(Ft.findMatches(E, { find: 'K*N', wildcard: true, matchCase: true })) === '1,4', 'wildcards');
  ok(ids(Ft.findMatches(E, { find: '101', kinds: { attr: false } })) === '1', 'only where asked (attributes off)');
  const rd = Ft.findMatches(E, { find: 'kitchen', replace: 'Pantry', whole: true });
  ok(rd.find((m) => m.id === 4).after === '<> Pantry WALL' && rd.find((m) => m.id === 1).after === 'Pantry 101', 'replace keeps the <> that measures', JSON.stringify(rd));
  ok(Ft.findMatches(E, { find: '<>' }).every((m) => m.id !== 4), 'the <> placeholder itself is never found');
  ok(Ft.findMatches(E, { find: '$1', replace: 'x' }).length === 0 && Ft.findMatches([{ id: 9, type: 'text', s: 'a.b' }], { find: '.', replace: '$&' })[0].after === 'a$&b', 'what you type is taken literally (no patterns)');
}
{
  const { doc, type, host, log } = harness();
  await type('DT', '0,0', '2', '0', 'ROOM A', 'ROOM B', '');
  await type('FIND', 'ROOM', '');
  ok(host.selection.size === 2 && log.includes(EN('cmd.find.found', { n: 2, m: 2 })), 'FIND at the command line: found and selected');
  host.selection = new Set();
  await type('FIND', 'ROOM', 'SPACE');
  ok(doc.all().every((e) => e.s.startsWith('SPACE')) && doc.undoStack[doc.undoStack.length - 1].label === 'FIND', 'replace: every text changed, one undo step');
  await type('FIND', 'nothing here', '');
  ok(log.includes(EN('cmd.find.none', { find: 'nothing here' })), 'not found says so');
}

// ---------------------------------------------------------------------------
section('Multileaders (MLEADER, leader.js)');
{
  const m = { type: 'mleader', layer: 'Notes', color: null, pts: [{ x: 0, y: 0 }, { x: 10, y: 10 }], dir: 1, s: 'SEE DETAIL 3', h: 2.5, st: { asz: 2.5, dogleg: 5, gap: 1 } };
  const g = Ld.leaderGeometry(m);
  const poly = g.find((x) => x.type === 'poly'), arrow = g.find((x) => x.type === 'hatch'), tx = g.find((x) => x.type === 'text');
  ok(poly && poly.pts.length === 3 && nearPt(poly.pts[2], 15, 10), 'the leader runs to the landing, 5 long to the right', JSON.stringify(poly?.pts));
  ok(arrow?.solid && nearPt({ x: arrow.loops[0][0], y: arrow.loops[0][1] }, 0, 0), 'a solid arrowhead at the tip');
  ok(tx && near(tx.x, 16) && tx.ha === 'left' && tx.va === 'top' && near(tx.y, 11.25), 'the text starts a gap after the landing, its first line centred on it', JSON.stringify(tx));
  const left = Ld.leaderGeometry({ ...m, dir: -1 }).find((x) => x.type === 'text');
  ok(left.ha === 'right' && near(left.x, 4), 'landing to the left: right-aligned text');
  const mir = G.txEntity(m, G.mMirror({ x: 20, y: 0 }, { x: 20, y: 1 }));
  ok(mir.dir === -1 && nearPt(mir.pts[0], 40, 0), 'MIRROR turns the landing round and keeps the text readable');
  const sc = G.txEntity(m, G.mScale(2));
  ok(near(sc.h, 5) && near(sc.st.dogleg, 10) && near(sc.st.asz, 5), 'SCALE scales the text and the arrow');
  const parts = G.explodeEntity(m, null);
  ok(parts.length === 3 && parts.every((x) => x.layer === 'Notes'), 'EXPLODE: a polyline, a solid and a text, on its layer');
  ok(G.distToEntity(m, { x: 5, y: 5 }, null) < 1e-9 && G.grips(m).length === 2, 'picked on its leader; a grip at each point');
  const st = G.stretchEntity(m, (p) => p.x > 5, 3, 0);
  ok(nearPt(st.pts[1], 13, 10) && nearPt(st.pts[0], 0, 0), 'STRETCH moves the points inside');
  const strokes = [], texts = [];
  const d0 = new Doc();
  walkFn(d0, [m], { stroke: (c, ps) => strokes.push(...ps), fill: () => {}, text: (c, e) => texts.push(e), point() {}, viewport() {} });
  ok(strokes.length >= 2 && texts.length === 1 && texts[0].s === 'SEE DETAIL 3', 'walk draws its leader and its text (screen and plot)');
  ok(Ft.findMatches([{ ...m, id: 7 }], { find: 'detail' }).length === 1, 'FIND finds its words');
}
{
  const { doc, type, log, host } = harness();
  await type('MLD', '0,0', '20,10', 'TYPICAL', '');
  const m = doc.all()[0];
  ok(m?.type === 'mleader' && m.s === 'TYPICAL' && m.dir === 1 && nearPt(m.pts[1], 20, 10), 'MLEADER: arrowhead, landing, then the words (command line)', JSON.stringify(m));
  ok(doc.undoStack.length === 1, 'one undo step');
  host.editText = async (e) => ({ s: e.s ? e.s + '!' : 'NEW', h: e.h, ww: 30, ls: 1 });
  await type('MLD', 'A', '5', '50,0', '30,10');
  const m2 = doc.all()[1];
  ok(m2.s === 'NEW' && m2.dir === -1 && near(m2.st.asz, 5) && near(m2.ww, 30), 'with the in-place editor; Arrowhead size; the landing goes left', JSON.stringify(m2));
  host.selection = new Set([m2.id]);
  await type('ED');
  ok(doc.get(m2.id).s === 'NEW!', 'TEXTEDIT edits a multileader\'s words');
  delete host.editText;
  host.selection = new Set([m.id]);
  await type('LI');
  ok(log[log.length - 1].includes('Multileader') && log[log.length - 1].includes('TYPICAL'), 'LIST describes it', log[log.length - 1]);
  const clip = Cb.makeClip(doc, new Set([m.id]));
  const back = Cb.readClip(JSON.parse(JSON.stringify(clip)));
  ok(!back.error && back.clip.entities[0].type === 'mleader' && back.clip.entities[0].pts.length === 2, 'it copies through the clipboard', back.error);
}

// ---------------------------------------------------------------------------
section('Revision clouds (REVCLOUD)');
{
  const sq = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }];
  const rs = G.resamplePath(sq, true, 10);
  ok(rs.length === 12 && nearPt(rs[0], 0, 0) && nearPt(rs[4], 40, 0) && nearPt(rs[6], 40, 20), 'resample: 120 round the outside → 12 points, 10 apart along it (corners land on points here)', JSON.stringify(rs.slice(0, 7)));
  const cl = G.revcloud(sq, true, 10);
  const area = G.entityArea(cl).area;
  ok(cl.closed && cl.pts.length === 12 && cl.pts.every((p) => near(p.b, G.CLOUD_BULGE)) && area > 800, 'a cloud of 12 arcs bulging outward (more area than the rectangle)', area);
  const inn = G.revcloud(sq, true, 10, true);
  ok(G.entityArea(inn).area < 800, 'Reverse: the arcs bulge inward');
  const cw = G.revcloud([...sq].reverse(), true, 10);
  ok(G.entityArea(cw).area > 800, 'drawn clockwise, still outward');
  const po = G.pathOf({ type: 'circle', cx: 0, cy: 0, r: 10 });
  ok(po.closed && po.pts.length === 96, 'pathOf a circle');
}
{
  const { doc, type, click, log } = harness();
  await type('REVCLOUD', 'A', '5', '0,0', '20,10');
  const c1 = doc.all()[0];
  ok(c1?.type === 'poly' && c1.closed && c1.pts.length === 12 && log.includes(EN('cmd.rc.done')), 'REVCLOUD Rectangular (the default): two corners', c1?.pts.length);
  await type('RC', 'P', '50,0', '70,0', '60,15', '');
  const c2 = doc.all()[1];
  ok(c2?.closed && c2.pts.every((p) => Math.abs(p.b) > 0.5), 'Polygonal: the points, Enter closes');
  await type('C', '100,0', '10', 'RC', 'O');
  await click(110, 0);
  await type('N');
  const c3 = doc.all().pop();
  ok(doc.all().every((e) => e.type === 'poly') && c3.closed && near(G.entityArea(c3).area, Math.PI * 100, Math.PI * 100 * 0.25), 'Object: the circle becomes a cloud round it', doc.all().map((e) => e.type).join());
  ok(doc.undoStack[doc.undoStack.length - 1].label === 'REVCLOUD', 'one undo step');
}

// ---------------------------------------------------------------------------
section('ATTDEF and the block editor (BEDIT, BCLOSE)');
{
  const { doc, type, host, log } = harness();
  await type('REC', '0,0', '10,5');
  await type('ATTDEF', 'I', '', 'room no', 'Room number', '101', '1,1', '1', '0');
  const ad = doc.all().pop();
  ok(ad.type === 'text' && ad.s === 'ROOM_NO' && ad.attdef?.tag === 'ROOM_NO' && ad.attdef.invisible && ad.attdef.def === '101', 'ATTDEF: Invisible toggled, the tag (upper case, no spaces), prompt and default; shows its tag', JSON.stringify(ad));
  await type('ATTDEF', 'I', '', 'name', 'Room name', 'OFFICE', '1,3', '1', '0');
  await type('BLOCK', 'ROOM', '0,0', 'ALL', '');
  const blk = doc.blocks.get('ROOM'), ins = doc.all().find((e) => e.type === 'insert');
  ok(blk.attdefs?.length === 2 && blk.entities.length === 1 && blk.attdefs.find((d) => d.tag === 'ROOM_NO').invisible, 'BLOCK takes the attribute definitions into the block', JSON.stringify(blk.attdefs));
  ok(ins.attrs?.ROOM_NO === '101' && ins.attrs?.NAME === 'OFFICE' && log.includes(EN('cmd.attdef.inblock', { n: 2 })), 'its reference gets the default values');
  await type('INSERT', 'ROOM', '50,0', '102', 'LAB');
  const ins2 = doc.all().pop();
  ok(ins2.attrs.ROOM_NO === '102' && ins2.attrs.NAME === 'LAB', 'INSERT asks for both values');
  const before = doc.undoStack.length;
  await type('BEDIT', 'room');
  ok(doc.blockEdit?.name === 'ROOM' && doc.all().length === 3 && doc.all().filter((e) => e.attdef).length === 2, 'BEDIT opens the block: its rectangle and its two attribute definitions');
  await type('C', '5,2.5', '1');
  await type('ATTDEF', 'I', '', 'area', 'Area', '0', '1,-1', '1', '0');
  await type('BCLOSE', 'S');
  const b2 = doc.blocks.get('ROOM');
  ok(!doc.blockEdit && doc.inModel && b2.entities.length === 2 && b2.attdefs.length === 3 && log.includes(EN('cmd.bclose.saved', { name: 'ROOM', n: 2 })), 'BCLOSE Save: the block has the circle and the new attribute; back on the model', JSON.stringify(b2.attdefs.map((d) => d.tag)));
  ok(doc.undoStack.length === before + 1 && doc.undoStack[doc.undoStack.length - 1].label === 'BEDIT', 'the whole block edit is one undo step');
  doc.undo();
  ok(doc.blocks.get('ROOM').entities.length === 1 && doc.blocks.get('ROOM').attdefs.length === 2, 'undo puts the old block back');
  await type('BEDIT', 'ROOM', 'ERASE', 'ALL', '', 'BCLOSE', 'D');
  ok(doc.blocks.get('ROOM').entities.length === 1 && !doc.blockEdit && doc.undoStack.length === before, 'BCLOSE Discard: nothing changes, nothing to undo');
  await type('BCLOSE');
  ok(log.includes(EN('cmd.bclose.none')), 'BCLOSE with no editor open says so');
}

// ---------------------------------------------------------------------------
section('Dimensions');
{
  const st = { ...Dm.DIM_DEFAULTS };
  const lin = { type: 'dim', kind: 'linear', p1: { x: 0, y: 0 }, p2: { x: 30, y: 40 }, loc: { x: 0, y: -10 }, rot: 0, text: '', st };
  ok(near(Dm.dimMeasure(lin), 30) && near(Dm.dimMeasure({ ...lin, rot: Math.PI / 2 }), 40) && near(Dm.dimMeasure({ ...lin, kind: 'aligned' }), 50), 'linear (horizontal, vertical) and aligned measure');
  ok(Dm.dimText(lin) === '30' && Dm.dimText({ ...lin, st: { ...st, zin: 0 } }) === '30.00', 'decimals, with and without trailing zeros');
  ok(Dm.dimText({ ...lin, text: 'L = <> mm' }) === 'L = 30 mm' && Dm.dimText({ ...lin, text: 'TYP.' }) === 'TYP.', 'text override with <> and plain');
  const rad = { type: 'dim', kind: 'radius', c: { x: 0, y: 0 }, p1: { x: 5, y: 0 }, loc: { x: 10, y: 10 }, text: '', st };
  ok(Dm.dimText(rad) === 'R5' && Dm.dimText({ ...rad, kind: 'diameter' }) === '⌀10', 'radius and diameter prefixes');
  const ang = { type: 'dim', kind: 'angular', c: { x: 0, y: 0 }, p1: { x: 10, y: 0 }, p2: { x: 0, y: 10 }, loc: { x: 5, y: 5 }, text: '', st };
  ok(Dm.dimText(ang) === '90°' && Dm.dimText({ ...ang, loc: { x: -5, y: -5 } }) === '270°', 'angular takes the sector the arc is placed in');
  const g = Dm.dimGeometry(lin);
  ok(g.filter((e) => e.type === 'hatch').length === 2 && g.some((e) => e.type === 'text' && e.s === '30') && g.every((e) => e.layer === '0' && e.color === 0), 'linear draws 2 arrowheads and its text, by block');
  const ext = g.filter((e) => e.type === 'line' && near(e.x1, e.x2));
  ok(ext.length === 2 && ext.some((e) => near(Math.min(e.y1, e.y2), -10 - st.exe) && near(Math.max(e.y1, e.y2), -st.exo)), 'extension lines start the offset off the origin and pass the line by the extension', JSON.stringify(ext));
  // style settings reach the geometry through the parts' roles (dimstyle.js, session cad-props P.6)
  ok(['ext1', 'ext2', 'dim', 'arrow1', 'arrow2', 'text'].every((r) => g.some((e) => e.role === r)) && g.filter((e) => e.role?.startsWith('arrow')).every((e) => e.tip && Number.isFinite(e.ang)), 'every part carries its role (arrows with tip and direction)');
  const styled = Dm.dimGeometry({ ...lin, st: { ...st, blk1: 'OPEN', se1: true, pre: 'W=', clrd: 1 } });
  ok(styled.filter((e) => e.type === 'hatch').length === 1 && styled.filter((e) => e.role === 'arrow1' && e.type === 'line').length === 2, 'DIMBLK1 OPEN: the first arrow is two lines, the second stays filled');
  ok(!styled.some((e) => e.role === 'ext1') && styled.some((e) => e.role === 'ext2'), 'DIMSE1 hides the first extension line only');
  ok(styled.some((e) => e.type === 'text' && e.s === 'W=30') && styled.filter((e) => e.role === 'dim').every((e) => e.color === 1), 'the prefix and the dimension line colour come through');
  {
    const tx = (st2) => Dm.dimGeometry({ ...lin, st: { ...st, ...st2 } }).find((e) => e.type === 'text');
    const c0 = tx({}), j1 = tx({ just: 1 }), j2 = tx({ just: 2 }), below = tx({ tad: 4 });
    ok(j1.x < c0.x - 1 && j2.x > c0.x + 1 && near(j1.y, c0.y) && j1.x > 0 && j2.x < 30, 'DIMJUST 1 / 2: the text beside the first / second extension line', JSON.stringify([j1.x, c0.x, j2.x]));
    ok(below.y < -10 && below.va === 'top' && c0.y > -10, 'DIMTAD 4: the text below the dimension line', JSON.stringify([below.y, c0.y]));
  }
  const narrow = Dm.dimGeometry({ ...lin, p2: { x: 3, y: 0 } });
  const dl = narrow.find((e) => e.type === 'line' && near(e.y1, -10) && near(e.y2, -10));
  ok(dl && Math.min(dl.x1, dl.x2) < 0 && Math.max(dl.x1, dl.x2) > 3, 'arrows go outside when they do not fit');
  ok(Dm.readable(Math.PI) === 0 && near(Dm.readable(1.5 * Math.PI), Math.PI / 2), 'dimension text never reads upside down');
  const af = Dm.angularFromLines({ x1: 0, y1: 0, x2: 10, y2: 0 }, { x1: 0, y1: 0, x2: 0, y2: 10 }, { x: 3, y: 3 });
  ok(af && nearPt(af.c, 0, 0) && Dm.dimText({ ...ang, ...af, loc: { x: 3, y: 3 } }) === '90°', 'angle between two lines, from the vertex they meet at');
  const af2 = Dm.angularFromLines({ x1: -10, y1: 0, x2: 10, y2: 0 }, { x1: 0, y1: -10, x2: 0, y2: 10 }, { x: -3, y: 3 });
  ok(af2 && Dm.dimText({ ...ang, ...af2, loc: { x: -3, y: 3 } }) === '90°' && af2.p1.x <= 0 && af2.p2.y >= 0, 'crossing lines: the quadrant picked');
  // moving a dimension's point measures again; a moved imported dimension stops using its block
  const moved = G.gripMove({ ...lin, block: '*D1' }, 'p2', { x: 50, y: 0 });
  ok(near(Dm.dimMeasure(moved), 50) && !moved.block, 'grip edit re-measures and drops the imported block');
  const mir = G.txEntity(lin, G.mMirror({ x: 0, y: 0 }, { x: 0, y: 1 }));
  ok(near(Dm.dimMeasure(mir), 30) && Dm.dimGeometry(mir).find((e) => e.type === 'text').rot === 0, 'mirrored dimension measures the same, text readable');
  const blocks = new Map([['*D1', { name: '*D1', base: { x: 0, y: 0 }, entities: [{ type: 'line', layer: '0', color: 0, x1: 0, y1: 0, x2: 1, y2: 1 }] }]]);
  ok(G.prims({ ...lin, block: '*D1' }, blocks).length === 1, 'an imported dimension is drawn from its block until edited');
  const ex = G.explodeEntity({ ...lin, layer: 'DIMS', color: 3 }, null);
  ok(ex.length === g.length && ex.every((e) => e.layer === 'DIMS' && e.color === 3), 'explode a dimension into lines, arrows and text on its layer');
}
{
  const { doc, type, click } = harness();
  await type('DLI', '0,0', '100,40', '50,-15');
  await type('DLI', '0,0', '100,40', '120,20');
  const [h, v] = doc.all();
  ok(h.kind === 'linear' && near(Dm.dimMeasure(h), 100) && v && near(Dm.dimMeasure(v), 40), 'DIMLINEAR picks horizontal or vertical from where the line goes', JSON.stringify([h?.rot, v?.rot]));
  await type('DLI', '0,0', '100,40', 'R', '45', '50,50');
  ok(near(Dm.dimMeasure(doc.all()[2]), 140 / Math.SQRT2, 1e-6), 'DIMLINEAR Rotated option');
  await type('DAL', '0,0', '30,40', 'T', 'about <>', '0,10');
  const al = doc.all()[3];
  ok(al.kind === 'aligned' && Dm.dimText(al) === 'about 50', 'DIMALIGNED with a text override');
  await type('DCO', '150,0', '200,0', '');
  const chain = doc.all().slice(-2);
  ok(chain.length === 2 && chain.every((d) => d.kind === 'linear') && nearPt(chain[0].p1, 30, 40) && nearPt(chain[1].p1, 150, 0) && chain.every((d) => nearPt(d.loc, al.loc.x, al.loc.y)), 'DIMCONTINUE chains from the end of the last dimension, on the same line');
  await type('L', '0,100', '50,100', ''); await type('L', '0,100', '0,150', '');
  await type('DAN'); await click(25, 100); await click(0, 125); await type('10,110');
  const an = doc.all().pop();
  ok(an.kind === 'angular' && near(Dm.dimMeasure(an), Math.PI / 2), 'DIMANGULAR between two lines', JSON.stringify(an));
  await type('C', '200,200', '10');
  await type('DRA'); await click(210, 200); await type('230,220');
  ok(Dm.dimText(doc.all().pop()) === 'R10', 'DIMRADIUS of a circle');
  await type('DIMSCALE', '50');
  ok(doc.current.dim.scale === 50, 'DIMSCALE sets the scale for new dimensions');
  ok(doc.undoStack.length === 10, 'each command is one undo step (DIMCONTINUE\'s two dimensions are one)', doc.undoStack.length);
}
{
  const { doc, type, eng } = harness();
  await type('DLI', '0,0', '10,0', '5,-5');
  const d = doc.all()[0];
  await type('DBA', '20,0', '30,0', '');
  const b = doc.all().slice(1);
  ok(b.length === 2 && b.every((x) => nearPt(x.p1, 0, 0)) && b[0].loc.y < d.loc.y && b[1].loc.y < b[0].loc.y, 'DIMBASELINE stacks from the first origin, away from the object', JSON.stringify(b.map((x) => x.loc)));
  void eng;
}

// ---------------------------------------------------------------------------
section('Blocks');
{
  const { doc, type, host, eng } = harness();
  await type('C', '0,0', '5');
  await type('L', '-5,0', '5,0', '');
  host.selection = new Set(doc.all().map((e) => e.id));
  await type('B', 'Bolt M10', '0,0');
  ok(doc.blocks.has('Bolt M10') && doc.count() === 1 && doc.all()[0].type === 'insert', 'BLOCK turns the objects into one reference');
  ok(doc.blocks.get('Bolt M10').entities.length === 2 && doc.undoStack.length === 3, 'the block holds them; BLOCK is one undo step');
  await type('I', 'Bolt M10', 'S', '2', 'R', '90', '100,0');
  const ins = doc.all().pop();
  ok(ins.type === 'insert' && ins.sx === 2 && near(ins.rot, Math.PI / 2) && nearPt(ins, 100, 0), 'INSERT with scale and rotation');
  const ib = G.entityBounds(ins, doc.blocks);
  ok(near(ib.maxX, 110) && near(ib.maxY, 10) && near(ib.minY, -10), 'the reference draws its block, scaled and turned', JSON.stringify(ib));
  doc.undo(); doc.undo();
  ok(!doc.blocks.has('Bolt M10') && doc.count() === 2, 'undo takes the block definition away and the objects back');
  doc.redo();
  ok(doc.blocks.has('Bolt M10') && doc.count() === 1, 'redo defines it again');
  host.selection = new Set([doc.all()[0].id]);
  await type('B', 'Nest', '0,0');
  host.selection = new Set([doc.all()[0].id]);
  await type('B', 'Bolt M10', 'Y', '0,0');
  ok(eng.running === null && doc.blocks.get('Bolt M10').entities.length === 2, 'a block cannot contain itself', JSON.stringify(doc.blocks.get('Bolt M10').entities.map((e) => e.type)));
  doc.change('test', () => doc.defineBlock({ name: 'Unused', base: { x: 0, y: 0 }, entities: [{ type: 'point', layer: '0', x: 0, y: 0 }] }));
  await type('PU');
  ok(!doc.blocks.has('Unused') && doc.blocks.has('Nest') && doc.blocks.has('Bolt M10'), 'PURGE removes only blocks nothing uses');
}

// ---------------------------------------------------------------------------
section('Clipboard: copy, cut, paste, paste in place, duplicate');
{
  const Cb = await load('clipboard.js');
  // a stand-in for localStorage shared by two "tabs"
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (v.length > (store.max || Infinity)) throw new Error('QuotaExceeded'); m.set(k, String(v)); }, removeItem: (k) => m.delete(k), map: m }; };
  const shared = store();
  const tab = (settings = {}) => {
    const h = harness();
    h.host.clipboard = new Cb.Clipboard(shared);
    h.host.settings = settings;
    h.eng.clipboard = h.host.clipboard;
    return h;
  };
  const A = tab();
  await A.type('REC', '10,20', '@30,10');
  await A.type('C', '100,100', '5');
  A.doc.addLayer({ name: 'Walls', color: 1, locked: false });
  A.doc.current.layer = 'Walls';
  await A.type('L', '0,0', '10,0', '');
  A.doc.current.layer = '0';
  A.host.selection = new Set(A.doc.all().map((e) => e.id));
  await A.type('B', 'Tag', '0,0');                   // one reference to a block (rectangle, circle, line on Walls)
  await A.type('C', '50,50', '2');                   // and a loose circle
  const ids = A.doc.all().map((e) => e.id);
  const steps0 = A.doc.undoStack.length;
  A.host.selection = new Set(ids);
  await A.type('COPYCLIP');
  const raw = shared.getItem(Cb.CLIP_KEY);
  const back = Cb.readClip(raw);
  ok(back.clip && back.clip.entities.length === 2 && back.clip.blocks.length === 1 && back.clip.blocks[0].name === 'Tag', 'COPYCLIP puts the objects and the block they need in localStorage "cadcraft.clipboard"', back.error || raw?.slice(0, 120));
  ok(back.clip && back.clip.layers.some((l) => l.name === 'Walls' && l.color === 1), 'the layers the copy uses travel with it (with their settings)');
  ok(A.doc.undoStack.length === steps0 && A.host.selection.size === 2, 'copying changes nothing and keeps the selection');
  ok(!back.clip.entities.some((e) => 'id' in e), 'the copy carries no ids');
  ok(Cb.basePoint(back.clip, 'lower-left').x === 0 && Cb.basePoint(back.clip, 'lower-left').y === 0, 'paste point: the lower-left corner of the extents', JSON.stringify(Cb.basePoint(back.clip)));
  const ctr = Cb.basePoint(back.clip, 'center');
  ok(near(ctr.x, 52.5) && near(ctr.y, 52.5), 'paste point: the center of the extents (setting)', JSON.stringify(ctr));

  // paste at a point in ANOTHER tab with an empty drawing: blocks and layers come along
  const B = tab();
  B.host.cursor = { x: 0, y: 0 };
  await B.type('PASTECLIP');
  ok(B.eng.running === 'PASTECLIP' && /insertion point/i.test(B.host.lastPrompt), 'PASTECLIP asks where the copy goes', B.host.lastPrompt);
  await B.type('1000,500');
  const pasted = B.doc.all();
  const ins = pasted.find((e) => e.type === 'insert');
  const circ = pasted.find((e) => e.type === 'circle');
  ok(pasted.length === 2 && ins && nearPt(ins, 1000, 500) && circ && nearPt({ x: circ.cx, y: circ.cy }, 1050, 550), 'another tab pastes it with its lower-left corner on the typed point', JSON.stringify(pasted.map((e) => [e.type, e.x ?? e.cx, e.y ?? e.cy])));
  ok(B.doc.blocks.has('Tag') && B.doc.blocks.get('Tag').entities.length === 3 && B.doc.layers.get('Walls')?.color === 1, 'the block definition and the layer arrive with it');
  ok(B.doc.undoStack.length === 1 && B.host.selection.size === 2, 'the paste is one undo step and the pasted objects are selected', B.doc.undoStack.length);
  B.doc.undo();
  ok(B.doc.count() === 0 && !B.doc.blocks.has('Tag'), 'one undo takes the objects and the block definition away');
  B.doc.redo();
  // a click places it too
  await B.type('PASTECLIP');
  await B.click(-200, -100);
  ok(B.doc.count() === 4 && B.doc.all().some((e) => e.type === 'insert' && nearPt(e, -200, -100)), 'a click places a paste');
  ok([...B.doc.blocks.keys()].filter((n) => n.startsWith('Tag')).length === 1, 'pasting again reuses the block of that name (no "Tag (2)")');

  // paste in place
  const C = tab();
  await C.type('PASTEORIG');
  ok(C.doc.count() === 2 && C.doc.all().some((e) => e.type === 'insert' && nearPt(e, 0, 0)) && C.doc.all().some((e) => e.type === 'circle' && nearPt({ x: e.cx, y: e.cy }, 50, 50)), 'PASTEORIG pastes at the coordinates it was copied from');
  ok(C.doc.undoStack.length === 1, 'paste in place is one undo step');

  // center setting
  const D = tab({ pasteBase: 'center' });
  await D.type('PASTECLIP', '0,0');
  const di = D.doc.all().find((e) => e.type === 'insert');
  ok(di && nearPt(di, -ctr.x, -ctr.y), 'with the paste point set to Center, the copy is centered on the point', JSON.stringify(di && [di.x, di.y]));

  // COPYBASE: the picked point is the base
  A.host.selection = new Set([A.doc.all().find((e) => e.type === 'circle').id]);
  await A.type('COPYBASE', '50,50');
  const E = tab();
  await E.type('PASTECLIP', '7,8');
  const ec = E.doc.all()[0];
  ok(ec && ec.type === 'circle' && nearPt({ x: ec.cx, y: ec.cy }, 7, 8), 'COPYBASE: the copy hangs from the point picked', JSON.stringify(ec));

  // cut = copy + erase, one undo step
  const n0 = A.doc.count(), s0 = A.doc.undoStack.length;
  A.host.selection = new Set([A.doc.all().find((e) => e.type === 'insert').id]);
  await A.type('CUTCLIP');
  ok(A.doc.count() === n0 - 1 && A.doc.undoStack.length === s0 + 1, 'CUTCLIP erases the objects in one undo step');
  ok(Cb.readClip(shared.getItem(Cb.CLIP_KEY)).clip?.entities[0]?.type === 'insert', 'and they are on the clipboard');
  A.doc.undo();
  ok(A.doc.count() === n0, 'undo brings the cut objects back');

  // duplicate: copy in place, moves with the pointer, click puts it down; Esc leaves nothing
  const F = tab();
  await F.type('C', '0,0', '5');
  F.host.selection = new Set([F.doc.all()[0].id]);
  F.host.cursor = { x: 10, y: 10 };
  const sClip = shared.getItem(Cb.CLIP_KEY);
  await F.type('DUPLICATE');
  ok(F.eng.running === 'DUPLICATE' && F.doc.count() === 1, 'DUPLICATE waits for the pointer without adding anything yet');
  await F.click(40, 10);
  const dup = F.doc.all();
  ok(dup.length === 2 && nearPt({ x: dup[1].cx, y: dup[1].cy }, 30, 0), 'the copy moved with the pointer and went down where clicked', JSON.stringify(dup.map((e) => [e.cx, e.cy])));
  ok(F.doc.undoStack.length === 2 && F.host.selection.has(dup[1].id) && F.host.selection.size === 1, 'duplicate is one undo step and the copy is selected');
  ok(shared.getItem(Cb.CLIP_KEY) === sClip, 'duplicate leaves the clipboard alone');
  await F.type('DUP');
  F.eng.escape(); await F.tick();
  ok(F.doc.count() === 2 && F.doc.undoStack.length === 2, 'Esc during duplicate leaves nothing');
  F.host.selection = new Set([F.doc.all()[0].id]);
  await F.type('DUPLICATE', '@0,-20');
  ok(F.doc.count() === 3 && F.doc.all().some((e) => nearPt({ x: e.cx, y: e.cy }, 0, -20)), 'a typed displacement (@0,-20) places a duplicate');

  // select all / none
  await F.type('SELECTALL');
  ok(F.host.selection.size === 3, 'SELECTALL selects every object');
  await F.type('DESELECT');
  ok(F.host.selection.size === 0, 'DESELECT clears the selection');

  // tampered or foreign clipboard contents are refused (validated like a file)
  const good = JSON.parse(raw);
  const bad = (mut) => { const c = JSON.parse(raw); mut(c); return Cb.readClip(JSON.stringify(c)); };
  ok(!!Cb.readClip(raw).clip, 'the untouched clipboard reads back');
  ok(bad((c) => { c.format = 'other'; }).error, 'refused: not CadCraft\'s format');
  ok(bad((c) => { c.entities[1].cx = 'NaN'; }).error && bad((c) => { c.entities[1].r = 1e300; }).error, 'refused: a number that is not a usable number');
  ok(bad((c) => { c.entities[0].block = 'Missing'; }).error, 'refused: a reference to a block the clipboard does not hold');
  ok(bad((c) => { c.blocks[0].entities.push({ type: 'insert', layer: '0', block: 'Tag', x: 0, y: 0 }); }).error, 'refused: a block that contains itself');
  ok(bad((c) => { c.entities.push({ type: 'script', src: 'x' }); }).error, 'refused: an object type CadCraft does not know');
  ok(bad((c) => { c.entities[1].__proto__ = { polluted: true }; c.entities[1] = JSON.parse(JSON.stringify(c.entities[1]).replace('"type"', '"__proto__":{"x":1},"type"')); }).error, 'refused: a "__proto__" field');
  ok(bad((c) => { c.entities[1].color = 'red; background:url(x)'; }).error, 'refused: a colour CadCraft does not know');
  ok(Cb.readClip(raw.replace('"type":"insert"', '"attrs":{"__proto__":"x"},"type":"insert"')).error, 'refused: an attribute tag "__proto__"');
  ok(Cb.readClip(raw.replace('"type":"insert"', '"attrs":{"SYM.":"A-1"},"type":"insert"')).clip?.entities.find((e) => e.type === 'insert')?.attrs['SYM.'] === 'A-1', 'attribute tags a drawing uses (e.g. "SYM.") read back');
  ok(bad((c) => { c.layers[0].name = 'a\u0000b'; }).error && bad((c) => { c.blocks[0].name = 'a<b'; }).error, 'refused: unusable layer and block names');
  ok(Cb.readClip('{not json').error && Cb.readClip('x'.repeat(10)).error && Cb.readClip(null).error, 'refused: unreadable text');
  ok(({}).polluted === undefined, 'nothing reached Object.prototype');
  const T = tab();
  shared.setItem(Cb.CLIP_KEY, JSON.stringify({ ...good, entities: [{ type: 'line', layer: '0', x1: 0, y1: 0, x2: 'oops', y2: 0 }] }));
  await T.type('PASTECLIP');
  ok(T.doc.count() === 0 && !T.eng.running && T.log.some((l) => /^Nothing pasted: /.test(l)), 'a tab pasting tampered contents pastes nothing and says why', T.log.slice(-2).join(' | '));
  shared.map.delete(Cb.CLIP_KEY);
  await tab().type('PASTECLIP');
  const U = tab();
  await U.type('PASTECLIP');
  ok(U.doc.count() === 0 && U.log.some((l) => /clipboard is empty/.test(l)), 'an empty clipboard says so');

  // too big for storage: this tab keeps it, and says only this tab can paste
  store.max = 200;
  A.host.selection = new Set(A.doc.all().map((e) => e.id));
  await A.type('COPYCLIP');
  ok(A.log.some((l) => /only this tab can paste it/.test(l)), 'a copy too big for the browser\'s storage stays in this tab, and it says so');
  const n1 = A.doc.count();
  await A.type('PASTEORIG');
  ok(A.doc.count() === n1 * 2, 'and this tab can still paste it');
  store.max = Infinity;

  // a viewport stays on its sheet
  const V = tab();
  V.doc.change('t', () => { V.doc.add({ type: 'viewport', layer: '0', x: 0, y: 0, w: 10, h: 10, cx: 0, cy: 0, s: 1 }); V.doc.add({ type: 'point', layer: '0', x: 1, y: 1 }); });
  V.host.selection = new Set(V.doc.all().map((e) => e.id));
  await V.type('COPYCLIP');
  ok(Cb.readClip(shared.getItem(Cb.CLIP_KEY)).clip?.entities.length === 1 && V.log.some((l) => /1 viewport stayed on the sheet/.test(l)), 'viewports are left out of a copy, and it says so');

  // the preview while pasting draws the copy's own block definitions
  const look = Cb.pastePreview(back.clip);
  ok(look.length >= 4 && look.every((e) => e.type !== 'insert'), 'the paste preview turns references into their lines and arcs', look.length);
}

// ---------------------------------------------------------------------------
section('Layouts and viewports');
{
  const { doc, type, click, host: host0, log: log0 } = harness();
  await type('REC', '0,0', '10000,5000');
  doc.meta.units = 'millimeters';
  await type('LAYOUT');
  const lay = doc.layouts[0];
  ok(lay && doc.layout === lay && lay.paper.key === 'iso-a3' && lay.paper.w === 420, 'LAYOUT makes an A3 sheet and opens it');
  const vp = [...lay.entities.values()].find((e) => e.type === 'viewport');
  ok(vp && near(Sh.nOf(doc, 'mm', vp.s), 50) && near(vp.cx, 5000) && near(vp.cy, 2500), 'its viewport shows the whole model at the largest standard scale that fits (1:50)', vp && Sh.nOf(doc, 'mm', vp.s));
  ok([...lay.entities.values()].some((e) => e.type === 'text' && e.s === '1:50'), 'the title block says the scale');
  ok(doc.layers.get('Viewports')?.plot === false, 'viewport frames go on a layer that does not plot');
  await type('L', '0,0', '10,10', '');
  ok(doc.model.size === 1 && lay.entities.size > 10, 'drawing on a sheet draws in paper space, not the model');
  await type('MV', '300,200', '400,280');
  const vp2 = [...lay.entities.values()].filter((e) => e.type === 'viewport')[1];
  ok(vp2 && near(vp2.w, 100) && near(Sh.nOf(doc, 'mm', vp2.s), 100), 'MVIEW adds a viewport at a standard scale (1:100 fits 10 m in 100 mm)', vp2 && Sh.nOf(doc, 'mm', vp2.s));
  const resized = G.gripMove(vp2, 'k2', { x: 450, y: 300 });
  const before = G.mApply(G.viewportMatrix(vp2), { x: 1000, y: 1000 }), after = G.mApply(G.viewportMatrix(resized), { x: 1000, y: 1000 });
  ok(nearPt(after, before.x, before.y), 'resizing a viewport by a corner keeps the view still on the sheet');
  doc.undo(); doc.undo();
  ok(doc.layout === lay && lay.entities.size > 10, 'undo works on the sheet');
  doc.undo();
  ok(doc.layouts.length === 0 && doc.inModel, 'undoing LAYOUT removes the sheet and goes back to the model');
  doc.redo();
  ok(doc.layouts.length === 1, 'redo brings the sheet back');
  ok(Sh.scaleLabel({ meta: { units: 'feet' } }, 'in', Sh.sOf({ meta: { units: 'feet' } }, 'in', 48)) === '1/4" = 1\'-0"', 'architectural scale names for imperial drawings');
  ok(near(Sh.sOf({ meta: { units: 'meters' } }, 'mm', 100), 10), 'a metre drawing at 1:100 is 10 mm on paper per unit');
  {
    // a display-locked viewport (Properties, P.7) keeps its view
    doc.setSpace(doc.layouts[0]);
    const v0 = [...doc.layout.entities.values()].find((e) => e.type === 'viewport');
    doc.change('lock', () => doc.update(v0.id, { ...v0, locked: true }));
    host0.selection = new Set([v0.id]);
    await type('VPVIEW');
    ok(log0.includes(EN('cmd.vpview.locked')) && near(doc.get(v0.id).s, v0.s), 'VPVIEW leaves a display-locked viewport alone, and says why');
  }
  void click;
}

// ---------------------------------------------------------------------------
section('Layer tools (LAYISO, LAYUNISO, LAYOFF, LAYFRZ, LAYMCUR, LAYON, LAYTHW; layertools.js)');
{
  const LT = await load('layertools.js');
  const { lookup } = await load('commands.js');
  const { doc, host, eng, log, type, click, tick } = harness();
  // until commands.js installs them (installLayerTools), run the commands through the same engine API by hand
  const local = new Map();
  LT.installLayerTools((n, a, fn) => local.set(n, fn), (key, label) => ({ key, label }));
  const run = async (name, ...lines) => {
    if (lookup(name)) await type(name, ...lines);
    else { const p = local.get(name)(eng.c, eng); await tick(); for (const l of lines) { eng.text(l); await tick(); } await p; }
  };
  for (const [name, color] of [['Walls', 1], ['Doors', 3], ['Furniture', 5], ['Notes', 2]]) doc.setLayer(name, { color });
  ok(doc.undoStack.length === 4, 'adding four layers through setLayer is four undo steps (layer changes are undoable since 0.4)', doc.undoStack.length);
  doc.undo();
  ok(!doc.layers.has('Notes') && doc.layers.get('Walls')?.color === 1, 'undo takes the last new layer away again');
  doc.redo();
  doc.change('x', () => {
    doc.add({ type: 'line', layer: 'Walls', x1: 0, y1: 0, x2: 10, y2: 0 });
    doc.add({ type: 'line', layer: 'Doors', x1: 0, y1: 5, x2: 10, y2: 5 });
    doc.add({ type: 'line', layer: 'Furniture', x1: 0, y1: 10, x2: 10, y2: 10 });
    doc.add({ type: 'circle', layer: 'Notes', cx: 20, cy: 20, r: 1 });
  });
  const on = () => [...doc.layers.values()].filter((l) => l.on).map((l) => l.name).sort().join();

  // LAYMCUR by pick, then LAYISO on two picked objects
  const run1 = run('LAYMCUR');
  await click(5, 10); await run1;
  ok(doc.current.layer === 'Furniture' && /Furniture is now the current layer/.test(log.join('\n')), 'LAYMCUR: the picked object\'s layer becomes current', doc.current.layer);
  host.setSelection(new Set([...doc.all()].filter((e) => e.layer === 'Walls' || e.layer === 'Doors').map((e) => e.id)));
  const before = doc.undoStack.length;
  await run('LAYISO');
  ok(on() === 'Doors,Walls' && ['Walls', 'Doors'].includes(doc.current.layer), 'LAYISO: only the selected objects\' layers stay on, and the current layer moves onto one of them', on() + ' / ' + doc.current.layer);
  ok(doc.undoStack.length === before + 1, 'LAYISO is one undo step');
  await run('LAYUNISO');
  ok(on() === '0,Doors,Furniture,Notes,Walls' && doc.current.layer === 'Furniture', 'LAYUNISO: the layers LAYISO turned off are on again, and the current layer is back', on() + ' / ' + doc.current.layer);
  await run('LAYUNISO');
  ok(/has not isolated any layers/.test(log[log.length - 1]), 'LAYUNISO with nothing isolated says so', log[log.length - 1]);

  // LAYOFF by pick, U takes the last one back; the current layer is refused
  const r2 = run('LAYOFF');
  await click(5, 0); await click(5, 5); await click(5, 10);
  ok(!doc.layers.get('Walls').on && !doc.layers.get('Doors').on && doc.layers.get('Furniture').on && /current layer/.test(log.join('\n')), 'LAYOFF: each picked object\'s layer goes off; the current layer is refused', on());
  eng.text('U'); await tick();
  ok(doc.layers.get('Doors').on && !doc.layers.get('Walls').on, 'LAYOFF U: the last layer is back on');
  eng.text(''); await tick(); await r2;
  const s3 = doc.undoStack.length;
  doc.undo();
  ok(doc.layers.get('Walls').on && doc.undoStack.length === s3 - 1, 'the whole LAYOFF is one undo step afterwards', on());
  doc.redo();

  // LAYFRZ, then LAYTHW and LAYON
  const r3 = run('LAYFRZ');
  await click(20, 21); eng.text(''); await tick(); await r3;
  ok(doc.layers.get('Notes').frozen, 'LAYFRZ: the picked object\'s layer is frozen');
  await run('LAYTHW');
  ok(!doc.layers.get('Notes').frozen && /1 layer thawed/.test(log[log.length - 1]), 'LAYTHW thaws every layer', log[log.length - 1]);
  await run('LAYON');
  ok(on() === '0,Doors,Furniture,Notes,Walls' && /1 layer turned on/.test(log[log.length - 1]), 'LAYON turns every layer on', log[log.length - 1]);
  await run('LAYON');
  ok(/already on/.test(log[log.length - 1]), 'LAYON with every layer on says so and adds no undo step');

  // the panel's switches and renaming are undoable too; a rename moves the objects, blocks included
  doc.change('blk', () => doc.defineBlock({ name: 'B', base: { x: 0, y: 0 }, entities: [{ type: 'line', layer: 'Walls', x1: 0, y1: 0, x2: 1, y2: 0 }] }));
  doc.setLayer('Walls', { locked: true });
  ok(doc.layers.get('Walls').locked, 'setLayer locks');
  doc.undo();
  ok(!doc.layers.get('Walls').locked, 'and undo unlocks');
  doc.setLayer('Walls', { name: 'A-WALL' });
  ok(!doc.layers.has('Walls') && doc.all().some((e) => e.layer === 'A-WALL') && doc.blocks.get('B').entities[0].layer === 'A-WALL', 'renaming a layer moves its objects, in blocks too');
  doc.undo();
  ok(doc.layers.has('Walls') && !doc.layers.has('A-WALL') && doc.all().some((e) => e.layer === 'Walls') && doc.blocks.get('B').entities[0].layer === 'Walls', 'one undo puts the name and every object back');
  let layersEvents = 0;
  doc.on((kind) => { if (kind === 'layers') layersEvents++; });
  doc.setLayer('Doors', { color: 4 }); doc.undo();
  ok(layersEvents === 2, 'the layers panel hears about the change and about its undo', layersEvents);
}

{
  // 0.4 C25: LAYMRG, LAYDEL, RENAME (layertools.js)
  const LT = await load('layertools.js');
  const { lookup } = await load('commands.js');
  const { doc, eng, log, type, tick, click } = harness();
  const local = new Map();
  LT.installLayerTools((n, a, fn) => local.set(n, fn), (key, label) => ({ key, label }));
  const run = async (name, ...lines) => {
    const feed = async () => { for (const l of lines) { if (Array.isArray(l)) await click(...l); else { eng.text(l); await tick(); } } };
    if (lookup(name)) { await type(name); await feed(); }
    else { const p = local.get(name)(eng.c, eng); await tick(); await feed(); await p; }
  };
  for (const n of ['A-WALL', 'A-WALL-OLD', 'Notes', 'Temp']) doc.setLayer(n, {});
  doc.change('x', () => {
    doc.add({ type: 'line', layer: 'A-WALL', x1: 0, y1: 0, x2: 10, y2: 0 });
    doc.add({ type: 'line', layer: 'A-WALL-OLD', x1: 0, y1: 5, x2: 10, y2: 5 });
    doc.add({ type: 'circle', layer: 'Temp', cx: 50, cy: 50, r: 2 });
    doc.add({ type: 'text', layer: 'Notes', x: 0, y: 20, h: 2, rot: 0, s: 'n' });
    doc.defineBlock({ name: 'Door', base: { x: 0, y: 0 }, entities: [{ type: 'line', layer: 'A-WALL-OLD', x1: 0, y1: 0, x2: 1, y2: 0 }, { type: 'line', layer: 'Temp', x1: 0, y1: 1, x2: 1, y2: 1 }] });
    doc.add({ type: 'insert', layer: 'A-WALL', block: 'Door', x: 30, y: 0, sx: 1, sy: 1, rot: 0 });
  });
  doc.layouts.push({ name: 'S', paper: { w: 420, h: 297, unit: 'mm', x0: 0, y0: 0 }, entities: new Map([[999, { id: 999, type: 'line', layer: 'A-WALL-OLD', x1: 0, y1: 0, x2: 1, y2: 1 }]]) });
  const steps = doc.undoStack.length;
  await run('LAYMRG', [5, 5], '', [5, 0], 'Y');
  ok(!doc.layers.has('A-WALL-OLD') && [...doc.model.values()].filter((e) => e.layer === 'A-WALL').length === 3 && doc.blocks.get('Door').entities[0].layer === 'A-WALL' && doc.layouts[0].entities.get(999).layer === 'A-WALL' && doc.undoStack.length === steps + 1,
    'LAYMRG: a picked layer\'s objects move to the target layer — model, sheet and block — and the layer goes, in one undo step', log.slice(-2).join(' | '));
  doc.undo();
  ok(doc.layers.has('A-WALL-OLD') && doc.blocks.get('Door').entities[0].layer === 'A-WALL-OLD' && doc.layouts[0].entities.get(999).layer === 'A-WALL-OLD', 'one undo puts the layer and every object back');
  await run('LAYDEL', 'N', 'temp', 'Y');
  ok(!doc.layers.has('Temp') && ![...doc.model.values()].some((e) => e.layer === 'Temp') && doc.blocks.get('Door').entities.length === 1 && /2 objects/.test(log.join('\n')), 'LAYDEL by name: the layer and its 2 objects go (the block keeps its other line)', log.slice(-2).join(' | '));
  await run('LAYDEL', 'N', '0', 'Y');
  ok(doc.layers.has('0') && /cannot be deleted/.test(log[log.length - 1]), 'layer 0 cannot be deleted', log[log.length - 1]);
  const n0 = doc.count();
  await run('LAYDEL', 'N', 'Notes', '');
  ok(doc.layers.has('Notes') && doc.count() === n0 && /Nothing changed/.test(log[log.length - 1]), 'LAYDEL asks first; Enter (No) changes nothing');
  await run('RENAME', 'LA', 'notes', 'Annotation');
  ok(!doc.layers.has('Notes') && [...doc.model.values()].some((e) => e.layer === 'Annotation' && e.type === 'text'), 'RENAME a layer: its objects follow');
  await run('RENAME', 'B', 'door', 'Door 900');
  ok(!doc.blocks.has('Door') && doc.blocks.has('Door 900') && [...doc.model.values()].some((e) => e.type === 'insert' && e.block === 'Door 900'), 'RENAME a block: the definition and its references');
  doc.undo();
  ok(doc.blocks.has('Door') && [...doc.model.values()].some((e) => e.type === 'insert' && e.block === 'Door'), 'and one undo puts the old name back');
}

{
  // 0.4 C34: COUNT (count.js through layertools.js)
  const LT = await load('layertools.js');
  const CT = await load('count.js');
  const { lookup } = await load('commands.js');
  const { doc, host, eng, log, type, tick, click } = harness();
  const blobs = [];
  host.saveBlob = (name, data, mime) => blobs.push({ name, data, mime });
  const local = new Map();
  LT.installLayerTools((n, a, fn) => local.set(n, fn), (key, label) => ({ key, label }));
  const run = async (name, ...lines) => {
    const feed = async () => { for (const l of lines) { if (Array.isArray(l)) await click(...l); else { eng.text(l); await tick(); } } };
    if (lookup(name)) { await type(name); await feed(); }
    else { const p = local.get(name)(eng.c, eng); await tick(); await feed(); await p; }
  };
  doc.change('x', () => {
    doc.defineBlock({ name: 'Chair', base: { x: 0, y: 0 }, entities: [{ type: 'circle', layer: '0', cx: 0, cy: 0, r: 1 }], attdefs: [] });
    doc.defineBlock({ name: 'Table', base: { x: 0, y: 0 }, entities: [{ type: 'line', layer: '0', x1: -2, y1: 0, x2: 2, y2: 0 }] });
    for (let i = 0; i < 5; i++) doc.add({ type: 'insert', layer: '0', block: 'Chair', x: i * 10, y: 0, sx: 1, sy: 1, rot: 0, attrs: { TAG: 'C' + i, MAKER: i % 2 ? '=HYPERLINK("x")' : 'Acme, Inc.' } });
    doc.add({ type: 'insert', layer: '0', block: 'Table', x: 0, y: 20, sx: 1, sy: 1, rot: Math.PI / 2 });
  });
  doc.layouts.push({ name: 'S1', paper: { w: 420, h: 297, unit: 'mm', x0: 0, y0: 0 }, entities: new Map([[900, { id: 900, type: 'insert', layer: '0', block: 'Chair', x: 1, y: 1, sx: 1, sy: 1, rot: 0 }]]) });
  ok(JSON.stringify(CT.countBlocks(doc, doc.model.values()).map((r) => [r.block, r.n])) === '[["Chair",5],["Table",1]]', 'countBlocks: most first');
  await run('COUNT', [21, 0]);   // on a chair's circle
  ok(host.selection.size === 5 && /Chair: 5 references here, selected \(6 in the whole drawing\)/.test(log.join('\n')), 'COUNT: picking a chair selects and counts every chair here (6 with the sheet)', log.slice(-1).join(''));
  await run('COUNT', '');
  ok(/6 block references, of 2 blocks/.test(log.join('\n')) && log.includes('  Chair: 5'), 'COUNT, Enter: the list', log.slice(-3).join(' | '));
  await run('COUNT', 'E', 'C');
  ok(blobs[0]?.name === 'Drawing1 block counts.csv' && blobs[0].data.includes('Chair,5,1,6\r\n') && blobs[0].data.startsWith('﻿Block,'), 'COUNT, E, C: a counts CSV (model, sheets, total)', JSON.stringify(blobs[0]?.data));
  await run('COUNT', 'E', 'A');
  const a = blobs[1]?.data || '';
  ok(/Block,Space,Layer,X,Y,Rotation,TAG,MAKER/.test(a) && a.includes('Chair,Model,0,10,0,0,C1,"\'=HYPERLINK(""x"")"') && a.includes('"Acme, Inc."') && a.includes('Table,Model,0,0,20,90') && a.includes('Chair,S1,'),
    'COUNT, E, A: one row per reference with its attribute values; formulas defused, commas quoted', JSON.stringify(a.slice(0, 400)));
}

section('DXF 2000 save (0.4 C17; dxf2000.js)');
{
  const { writeDxf2000 } = await load('dxf2000.js');
  const { readDxf } = await load('dxf.js');
  const { Doc } = await load('doc.js');
  const { attdef } = await load('attrs.js');
  const { fixture } = await import(pathToFileURL(path.join(ROOT, 'tools/cadcraft-test/dwg-save-check.mjs')).href);
  const fx = fixture(Doc, attdef);
  const { text, report } = writeDxf2000(fx);
  ok(/\r\n\s*1\r\nAC1015\r\n/.test(text) && text.trimEnd().endsWith('EOF'), 'DXF 2000: AC1015 header, ends in EOF');
  const back = new Doc(); back.load(readDxf(text));
  const kinds = (d) => { const k = {}; for (const e of d.model.values()) k[e.type] = (k[e.type] || 0) + 1; return k; };
  const a = kinds(fx), b = kinds(back);
  ok(['line', 'circle', 'arc', 'ellipse', 'text', 'insert', 'hatch', 'dim'].every((k) => (b[k] || 0) >= 1 && (a[k] ? b[k] >= Math.min(a[k], 1) : true)), 'reopened in CadCraft: lines, circles, arcs, ellipses, text, blocks, hatches, dimensions', JSON.stringify(b));
  ok(back.layouts.map((l) => l.name).join() === fx.layouts.map((l) => l.name).join() && back.layouts.every((l) => l.entities.size > 0), 'every sheet comes back as a layout with its objects', back.layouts.map((l) => l.name + ':' + l.entities.size).join());
  const hid = back.layers.get('Hidden');
  ok(hid?.linetype === 'HIDDEN' && hid?.lineweight === 0.35, 'layer linetype and lineweight kept', JSON.stringify(hid));
  ok([...back.model.values()].some((e) => e.type === 'hatch' && e.patlines?.length), 'a patterned hatch keeps its pattern lines');
  ok([...back.blocks.values()].some((bl) => bl.xref?.path), 'an unloaded link stays a link');
  ok(report.notes.length >= 1, 'notes say what changed (multileaders drawn, links)', report.notes.join(' | '));
  const audit = ezdxfAudit(text);
  ok(!audit || (audit.version === 'AC1015' && audit.errors === 0 && audit.fixes === 0), 'ezdxf audit: no errors, nothing to fix', audit && JSON.stringify({ e: audit.errors, f: audit.fixes, m: audit.messages }));
  ok(!audit || Object.keys(audit.paper).length > 0, 'ezdxf sees the first sheet in paper space', audit && JSON.stringify(audit.paper));
}

section('Flat views of the solids: VIEWBASE (0.4 C18; flatview.js)');
{
  const F = await load('flatview.js');
  const M3 = await load('model3d.js');
  const LT = await load('layertools.js');
  const { lookup } = await load('commands.js');
  const { doc, eng, log, type, tick } = harness();
  const m = doc.model3d;
  m.change('solids', () => { M3.makeBox(m, [0, 0], [1, 1], 0, 1); M3.makeCylinder(m, [0.5, 2], 0.3, 0, 2); });
  const len = (l) => l.reduce((s, [a, b, c, d]) => s + Math.hypot(c - a, d - b), 0);
  const fr = F.projectModel(m, 'front');
  ok(fr.visible.length === 7 && near(len(fr.visible), 6.6, 1e-4), 'front: the box outline, the cylinder\'s two outline sides and top, each once', fr.visible.length + ' / ' + len(fr.visible));
  ok(fr.hidden.length === 2 && near(len(fr.hidden), 2, 1e-4), 'front: the cylinder\'s sides behind the box are hidden lines', fr.hidden.length + ' / ' + len(fr.hidden));
  const tp = F.projectModel(m, 'top');
  ok(near(len(tp.visible), 4 + 2 * Math.PI * 0.3 * Math.sin(Math.PI / 48) * 48 / Math.PI, 1e-3) && !tp.hidden.length, 'top: the square and the circle (no side lines)', len(tp.visible));
  ok(near(len(F.projectModel(m, 'right').visible), 9.2, 1e-6) && F.projectModel(m, 'iso').hidden.length > 0, 'right side, and the isometric view has hidden lines');
  ok(F.projectModel(m, 'front', { hidden: false }).hidden.length === 0, 'hidden lines can be left out');
  ok(F.parseScale('1:50') === 0.02 && F.parseScale('2:1') === 2 && F.parseScale('1/20') === 0.05 && F.parseScale('x') === null, 'scales: 1:50, 2:1, 1/20');

  const local = new Map();
  LT.installLayerTools((n, a, fn) => local.set(n, fn), (key, label) => ({ key, label }));
  const run = async (name, ...lines) => { if (lookup(name)) await type(name, ...lines); else { const p = local.get(name)(eng.c, eng); await tick(); for (const l of lines) { eng.text(l); await tick(); } await p; await tick(); } };
  doc.meta.units = 'millimeters';
  doc.layouts.push({ name: 'A3', paper: { w: 420, h: 297, unit: 'mm', x0: 0, y0: 0 }, entities: new Map() });
  doc.space = doc.layouts[0].entities;
  await run('VIEWBASE', '', '', '', '200,150');
  const ins = [...doc.space.values()].find((e) => e.type === 'insert');
  const blk = ins && doc.blocks.get(ins.block);
  ok(ins?.block === 'VIEW-FRONT-1' && ins.x === 200 && ins.y === 150, 'VIEWBASE, Enter ×3 and a point: a front view block on the sheet', JSON.stringify(ins));
  ok(/at 1:20/.test(log.join('\n')), 'the scale fits the sheet: 1:20 for a 2 m tall model on A3', log[log.length - 1]);
  const ext = blk && blk.entities.reduce((b, e) => [Math.min(b[0], e.y1, e.y2), Math.max(b[1], e.y1, e.y2)], [Infinity, -Infinity]);
  ok(blk && near(ext[1] - ext[0], 100, 1e-6) && blk.entities.filter((e) => e.layer === 'VIEW-HIDDEN').length === 2, 'at 1:20 the 2000 mm model is 100 mm tall on paper; hidden lines on their own layer', JSON.stringify(ext));
  ok(doc.layers.get('VIEW-HIDDEN')?.linetype === 'HIDDEN' && doc.layers.get('VIEW-VISIBLE')?.lineweight === 0.5, 'the layers: VIEW-HIDDEN dashed, VIEW-VISIBLE 0.5 mm');
  await run('VIEWBASE', 'T', 'H', '1:20', '300,150');
  const b2 = doc.blocks.get('VIEW-TOP-1');
  ok(b2 && !b2.entities.some((e) => e.layer === 'VIEW-HIDDEN'), 'a top view at 1:20 without hidden lines', b2 && b2.entities.length);
  doc.undo();
  ok(!doc.blocks.has('VIEW-TOP-1') && ![...doc.space.values()].some((e) => e.block === 'VIEW-TOP-1'), 'one undo step takes the view away');
  doc.space = doc.model;
}

section('PUBLISH: several sheets in one PDF (0.4 C36)');
{
  const LT = await load('layertools.js');
  const { lookup } = await load('commands.js');
  const { doc, host, eng, log, type, tick } = harness();
  const blobs = [];
  host.saveBlob = (name, data, mime) => blobs.push({ name, data, mime });
  host.plotPrefs = () => ({ ink: 'mono', pen: 0.35 });
  const local = new Map();
  LT.installLayerTools((n, a, fn) => local.set(n, fn), (key, label) => ({ key, label }));
  const run = async (name, ...lines) => { if (lookup(name)) await type(name, ...lines); else { const p = local.get(name)(eng.c, eng); await tick(); for (const l of lines) { eng.text(l); await tick(); } await p; await tick(); } };
  await run('PUBLISH');
  ok(/no sheets/.test(log[log.length - 1]), 'PUBLISH without sheets says so');
  const sheet = (name, w, h, unit) => ({ name, paper: { w, h, unit, x0: 0, y0: 0 }, entities: new Map([[name, { id: name, type: 'text', layer: '0', x: unit === 'in' ? 1 : 10, y: unit === 'in' ? 1 : 10, h: unit === 'in' ? 0.25 : 5, rot: 0, s: 'Sheet ' + name, ha: 'left', va: 'baseline' }]]) });
  doc.layouts.push(sheet('A-101', 420, 297, 'mm'), sheet('A-102', 297, 210, 'mm'), sheet('S-1', 11, 8.5, 'in'));
  await run('PUBLISH', '');
  for (let i = 0; i < 200 && !blobs[0]; i++) await new Promise((r) => setTimeout(r, 10));
  const f = path.join(os.tmpdir(), 'cc-publish-' + process.pid + '.pdf');
  fs.writeFileSync(f, blobs[0]?.data || new Uint8Array());
  const info = pdfinfo(blobs[0]?.data || new Uint8Array());
  let sizes = null, text = '';
  try { sizes = execFileSync('pdfinfo', ['-f', '1', '-l', '3', f], { encoding: 'utf8' }).match(/Page\s+\d+ size:\s+[\d.]+ x [\d.]+/g); text = execFileSync('pdftotext', [f, '-'], { encoding: 'utf8' }); } catch { /* poppler not installed */ }
  ok(blobs[0]?.name === 'Drawing1.pdf' && (info === null || /Pages:\s+3/.test(info)), 'PUBLISH, Enter: all three sheets in one PDF', info);
  ok(!sizes || (/1190\.55 x 841\.89/.test(sizes[0]) && /841\.89 x 595\.2\d*/.test(sizes[1]) && /792 x 612/.test(sizes[2])), 'each page at its own paper size (A3, A4, Letter)', JSON.stringify(sizes));
  ok(!text || (text.indexOf('Sheet A-101') < text.indexOf('Sheet A-102') && text.includes('Sheet S-1')), 'each sheet on its page, in tab order', JSON.stringify(text.slice(0, 300)));
  ok(new TextDecoder('latin1').decode(blobs[0].data).includes('/Title (A-102)') && /\/Outlines/.test(new TextDecoder('latin1').decode(blobs[0].data)), 'a bookmark per sheet');
  await run('PUBLISH', 'S', 'a-102, s-1, nosuch');
  for (let i = 0; i < 200 && !blobs[1]; i++) await new Promise((r) => setTimeout(r, 10));
  const info2 = pdfinfo(blobs[1]?.data || new Uint8Array());
  ok((info2 === null || /Pages:\s+2/.test(info2)) && /No sheet called: NOSUCH/.test(log.join('\n')), 'PUBLISH, Some: just the named sheets (an unknown name said)', info2);
  fs.rmSync(f, { force: true });
}

section('Linked drawings: XATTACH, XREF (0.4 C35; xref.js)');
{
  const LT = await load('layertools.js');
  const X = await load('xref.js');
  const { saveDwg } = await load('dwg-save.js');
  const { readDwg } = await load('dwg/read.js');
  const { importDwg } = await load('dwg-import.js');
  const { lookup } = await load('commands.js');
  const { doc, host, eng, log, type, tick } = harness();
  doc.meta.units = 'inches';
  const plan = (n) => ({
    meta: { units: 'millimeters' },
    layers: [{ name: '0', color: 7 }, { name: 'Walls', color: 1 }, { name: 'Doors', color: 3 }],
    blocks: [{ name: 'Door', base: { x: 0, y: 0 }, entities: [{ type: 'line', layer: 'Doors', x1: 0, y1: 0, x2: 900, y2: 0 }] }],
    entities: [...Array.from({ length: n }, (_, i) => ({ type: 'line', layer: 'Walls', x1: 0, y1: i * 100, x2: 5000, y2: i * 100 })), { type: 'insert', layer: 'Doors', block: 'Door', x: 1000, y: 0, sx: 1, sy: 1, rot: 0 }],
  });
  let next = { drawing: plan(2), fileName: 'Plan.dwg' };
  host.pickDrawing = async () => next;
  const local = new Map();
  LT.installLayerTools((n, a, fn) => local.set(n, fn), (key, label) => ({ key, label }));
  const run = async (name, ...lines) => { if (lookup(name)) await type(name, ...lines); else { const p = local.get(name)(eng.c, eng); await tick(); await tick(); for (const l of lines) { eng.text(l); await tick(); await tick(); } await p; } };
  const steps = doc.undoStack.length;
  await run('XATTACH', '10,10');
  const root = doc.blocks.get('Plan'), ref = [...doc.model.values()].find((e) => e.block === 'Plan');
  ok(X.isXrefRoot(root) && root.entities.length === 3 && root.entities[0].layer === 'Plan|Walls' && root.entities[2].block === 'Plan|Door' && doc.blocks.get('Plan|Door')?.xref?.of === 'Plan' && doc.layers.has('Plan|Walls') && doc.layers.has('Plan|Doors'),
    'XATTACH: the file comes in as the link Plan — its layers and blocks named Plan|…', JSON.stringify([...doc.layers.keys()]));
  ok(ref && ref.x === 10 && ref.y === 10 && near(ref.sx, 1 / 25.4) && doc.undoStack.length === steps + 1, 'placed at 10,10, scaled mm → inches, one undo step', JSON.stringify(ref));
  await run('XREF', '?');
  ok(/Plan: Plan\.dwg, loaded \(3 objects\), 1 reference/.test(log.join('\n')), 'XREF ? lists it', log.slice(-1).join(''));
  next = { drawing: plan(5), fileName: 'Plan.dwg' };
  await run('XREF', 'R');
  ok(doc.blocks.get('Plan').entities.length === 6 && [...doc.model.values()].filter((e) => e.block === 'Plan').length === 1, 'XREF Reload: the new version of the file, the reference kept');
  // a link is read-only: BEDIT and EXPLODE refuse it (and its own blocks), naming the link
  const ro = doc.undoStack.length, n0 = doc.model.size;
  log.length = 0;
  await type('BEDIT', 'Plan|Door');
  ok(!doc.blockEdit && /Plan is a linked drawing/.test(log.join('\n')), 'BEDIT refuses a linked drawing\'s block, naming the link', log.join(' | '));
  log.length = 0;
  host.setSelection([[...doc.model.values()].find((e) => e.block === 'Plan').id]);
  await type('EXPLODE');
  ok(doc.model.size === n0 && [...doc.model.values()].some((e) => e.block === 'Plan') && doc.undoStack.length === ro && /Plan is a linked drawing/.test(log.join('\n')) && !/exploded/.test(log.join('\n')), 'EXPLODE leaves a reference to a link alone and says why', log.join(' | '));
  await run('XREF', 'B');
  ok(!X.isXrefRoot(doc.blocks.get('Plan')) && doc.blocks.has('Plan$0$Door') && !doc.blocks.has('Plan|Door') && doc.layers.has('Plan$0$Walls') && doc.blocks.get('Plan').entities[0].layer === 'Plan$0$Walls', 'XREF Bind: ordinary blocks and layers named Plan$0$…');
  doc.undo();
  ok(X.isXrefRoot(doc.blocks.get('Plan')) && doc.layers.has('Plan|Walls'), 'one undo makes it a link again');
  // a loaded link is bound when the drawing is saved
  const b1 = new Doc(); b1.load(importDwg(readDwg(saveDwg(doc).bytes), { versionTag: 'x' }));
  ok(b1.blocks.has('Plan') && !X.isXrefRoot(b1.blocks.get('Plan')) && b1.blocks.has('Plan$0$Door') && b1.layers.has('Plan$0$Walls') && saveDwg(doc).report.notes.some((n) => /bound into the file/.test(n)), 'saved as DWG: bound (Plan$0$…), and the save says so');
  await run('XREF', 'D');
  ok(!doc.blocks.has('Plan') && !doc.blocks.has('Plan|Door') && ![...doc.layers.keys()].some((n) => n.startsWith('Plan|')) && ![...doc.model.values()].some((e) => e.block === 'Plan'), 'XREF Detach: the link, its blocks, layers and references go');
  // a link CadCraft could not load stays a link through DWG and DXF
  const d2 = new Doc();
  d2.load({ blocks: [{ name: 'Site', base: { x: 0, y: 0 }, entities: [], xref: { path: 'X-Refs\\Site.dwg' } }], entities: [{ type: 'insert', layer: '0', block: 'Site', x: 5, y: 5, sx: 1, sy: 1, rot: 0 }] });
  for (const v of ['2000', '2018']) {
    const sv = saveDwg(d2, { version: v });
    const m = readDwg(sv.bytes), rb = m.blocks.find((x) => x.name === 'Site');
    const back = new Doc(); back.load(importDwg(m, { versionTag: 'x' }));
    ok(rb && (rb.flags & 4) && rb.xrefPath === 'X-Refs\\Site.dwg' && X.isXrefRoot(back.blocks.get('Site')) && back.blocks.get('Site').xref.path === 'X-Refs\\Site.dwg' && [...back.model.values()].some((e) => e.block === 'Site'),
      'DWG ' + v + ': an unloaded link is saved as a link (flag 4, its path) and opens as one', JSON.stringify(rb && { flags: rb.flags, path: rb.xrefPath }));
  }
  const rd = readDxf(writeDxf(d2).text);
  ok(rd.blocks.find((b) => b.name === 'SITE')?.xref?.path === 'X-Refs\\Site.dwg' && rd.report.notes.some((n) => /not loaded/.test(n)), 'DXF R12: the same, and opening says it is not loaded', JSON.stringify(rd.blocks.find((b) => b.name === 'SITE')));
}

section('Split screen in files: the VPORT table (cad-files, part 2 Q.1; dwg-vports.js)');
{
  const { saveDwg } = await load('dwg-save.js');
  const { readDwg } = await load('dwg/read.js');
  const { importDwg } = await load('dwg-import.js');
  const { writeDxf2000 } = await load('dxf2000.js');
  const d = new Doc();
  d.change('x', () => { d.add({ type: 'line', layer: '0', x1: 0, y1: 0, x2: 1000, y2: 500 }); d.add({ type: 'circle', layer: '0', cx: 200, cy: 200, r: 50 }); });
  const same = (a, b) => a && b && a.layout === b.layout && near(a.fx, b.fx, 1e-6) && near(a.fy, b.fy, 1e-6) && a.active === b.active && a.list.length === b.list.length
    && a.list.every((p, i) => (p && b.list[i] ? near(p.cx, b.list[i].cx, 1e-6) && near(p.cy, b.list[i].cy, 1e-6) && near(p.h, b.list[i].h, 1e-6) && (p.sheet || '') === (b.list[i].sheet || '') : p === b.list[i]));
  const setups = [
    { layout: '2v', fx: 0.35, fy: 0.5, active: 1, list: [{ cx: 100, cy: 50, h: 300 }, { cx: 520.25, cy: 260.125, h: 75.5 }] },
    { layout: '2h', fx: 0.5, fy: 0.4, active: 0, list: [{ cx: 1, cy: 2, h: 3 }, { cx: -4000.5, cy: 7, h: 1e4 }] },
    { layout: '3r', fx: 0.6, fy: 0.3, active: 2, list: [{ cx: 10, cy: 20, h: 30 }, { cx: 40, cy: 50, h: 60 }, { cx: 70, cy: 80, h: 90 }] },
    { layout: '3l', fx: 0.4, fy: 0.7, active: 1, list: [{ cx: 10, cy: 20, h: 30 }, { cx: 40, cy: 50, h: 60 }, { cx: 70, cy: 80, h: 90 }] },
    { layout: '4', fx: 0.25, fy: 0.75, active: 3, list: [{ cx: 1, cy: 1, h: 1 }, { cx: 2, cy: 2, h: 2 }, { cx: 3, cy: 3, h: 3 }, { cx: 4, cy: 4, h: 4 }] },
  ];
  for (const v of setups) {
    d.vports = v;
    const back = {};
    for (const ver of ['2000', '2004', '2007', '2010', '2013', '2018']) back['DWG ' + ver] = importDwg(readDwg(saveDwg(d, { version: ver }).bytes), { versionTag: 'x' }).vports;
    back['DXF R12'] = readDxf(writeDxf(d).text).vports;
    back['DXF 2000'] = readDxf(writeDxf2000(d).text).vports;
    const bad = Object.entries(back).filter(([, b]) => !same(v, b)).map(([k, b]) => k + ' ' + JSON.stringify(b));
    ok(!bad.length, 'split screen ' + v.layout + ' (active pane ' + (v.active + 1) + ') comes back from DWG 2000–2018, DXF R12 and DXF 2000', bad.join(' | '));
  }
  // a pane showing a sheet: written as a model pane (the drawing's extents) with the sheet's name for CadCraft
  d.vports = { layout: '2v', fx: 0.5, fy: 0.5, active: 0, list: [{ cx: 5, cy: 6, h: 7 }, { cx: 150, cy: 100, h: 200, sheet: 'A-101 Plan' }] };
  for (const [k, r] of [['DWG', importDwg(readDwg(saveDwg(d).bytes), { versionTag: 'x' })], ['DXF R12', readDxf(writeDxf(d).text)], ['DXF 2000', readDxf(writeDxf2000(d).text)]]) {
    const p = r.vports?.list[1];
    ok(p && p.sheet === 'A-101 Plan' && near(p.cx, 500, 1e-6) && near(p.cy, 250, 1e-6) && same({ ...d.vports, list: [d.vports.list[0], p] }, r.vports), k + ': a pane on a sheet keeps the sheet name (CADCRAFT xdata), its view = the drawing\'s middle', JSON.stringify(r.vports));
  }
  d.vports = null;
  const one = readDwg(saveDwg(d).bytes);
  ok(importDwg(one, { versionTag: 'x' }).vports === null && one.tables.vports.filter((v) => /^\*active$/i.test(v.name)).length === 1 && readDxf(writeDxf(d).text).vports === undefined && readDxf(writeDxf2000(d).text).vports === undefined, 'one pane: one *Active (or no VPORT table in R12), and no split screen read back');
  {
    // the corners another program reads: LibreDWG, libdxfrw, ODA via ezdxf (when they are installed) see four *Active
    d.vports = setups[4];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-vports-'));
    const f12 = path.join(dir, 'r12.dxf'), f2k = path.join(dir, 'r2000.dxf');
    fs.writeFileSync(f12, writeDxf(d).text); fs.writeFileSync(f2k, writeDxf2000(d).text);
    const py = path.join(ROOT, 'tools/cadcraft-test/venv/bin/python');
    if (fs.existsSync(py)) {
      const code = 'import ezdxf,sys,json\nout=[]\nfor f in sys.argv[1:]:\n  doc=ezdxf.readfile(f)\n  out.append(sorted([[round(v.dxf.lower_left[0],4),round(v.dxf.lower_left[1],4),round(v.dxf.upper_right[0],4),round(v.dxf.upper_right[1],4)] for v in doc.viewports.get("*Active")]))\nprint(json.dumps(out))';
      const got = JSON.parse(execFileSync(py, ['-c', code, f12, f2k], { encoding: 'utf8' }));
      const want = JSON.stringify([[0, 0, 0.25, 0.25], [0, 0.25, 0.25, 1], [0.25, 0, 1, 0.25], [0.25, 0.25, 1, 1]]);
      ok(got.every((g) => JSON.stringify(g) === want), 'ezdxf reads the four *Active viewports of both DXFs with their corners', JSON.stringify(got));
    }
    fs.rmSync(dir, { recursive: true, force: true });
    d.vports = null;
  }
}

section('Properties fields in files (cad-props P.3–P.7, part 2; dwg-props.js)');
{
  const { saveDwg } = await load('dwg-save.js');
  const { readDwg } = await load('dwg/read.js');
  const { importDwg } = await load('dwg-import.js');
  const { writeDxf2000 } = await load('dxf2000.js');
  const DP = await load('dwg-props.js');
  const Hatch = await load('hatch.js');
  ok(DP.trWord(40) === (0x02000000 | 153) >>> 0 && DP.trFrom(DP.trWord(40)) === 40 && DP.trFrom(DP.trWord('ByBlock')) === 'ByBlock' && DP.trWord(null) === undefined && DP.trFrom({ alpha: 153 }) === 40, 'transparency ↔ the 440 word (40 % = alpha 153), ByBlock, ByLayer');
  {
    // other applications' xdata passes through as e.xd (add-ons, ADDONS-SPEC §7.3): kept, numbers as numbers, written back
    const got = DP.propsFromXdata({ cc_pipes: [['1000', 'CCOBJ'], ['1000', 'pipe'], ['1070', '1'], ['1070', '9'], ['1000', '{"d":50}']], OTHERAPP: [[1040, '2.5'], [1000, 'x']],
      LINKED: [[1000, 'a'], [1005, '1F']], CADCRAFT: [[1000, 'CCMAT:Steel']], PE_URL: [[1000, 'https://example.com']] });
    ok(got.mat === 'Steel' && got.url === 'https://example.com' && JSON.stringify(got.xd) === JSON.stringify({ CC_PIPES: [[1000, 'CCOBJ'], [1000, 'pipe'], [1070, 1], [1070, 9], [1000, '{"d":50}']], OTHERAPP: [[1040, 2.5], [1000, 'x']] }),
      'propsFromXdata keeps every other application\'s xdata as e.xd (upper-case names, numbers as numbers), drops a group holding a 1005 handle, leaves its own apps out', JSON.stringify(got));
    const back = DP.propsXdata({ type: 'line', url: 'https://example.com', xd: { ...got.xd, PE_URL: [[1000, 'stale']] } });
    ok(JSON.stringify(back.CC_PIPES) === JSON.stringify(got.xd.CC_PIPES) && back.OTHERAPP && back.PE_URL[0][1] === 'https://example.com', 'propsXdata writes e.xd back unchanged, never over what it writes itself', JSON.stringify(back));
  }
  const dimSt = { ...Dm.DIM_DEFAULTS, txt: 3.5, blk1: 'ARCHTICK', blk2: 'DOT', clrd: 1, clre: '#ff8000', lwd: 0.35, lwe: -1, sd1: true, se2: true, txsty: 'Notes', clrt: 5, tfill: 1, just: 1, tih: true,
    atfit: 1, tmove: 2, tix: true, tofl: true, rnd: 0.5, pre: 'L=', suf: ' mm', lfac: 2, dsep: ',', aunit: 1, azin: 2, alt: true, altu: 2, altd: 3, altf: 0.03937, altrnd: 0.25, apre: '[', asuf: ']',
    tol: 'dev', tp: 0.1, tm: 0.2, tdec: 3, tfac: 0.7, tolj: 0, tzin: 8, lunit: 2 };
  const d = new Doc();
  d.textStyles = new Map([['Notes', { font: 'romans.shx', h: 0, wf: 0.8, obl: 0 }]]);
  d.dimStyles = new Map([['Arch', { ...Dm.DIM_DEFAULTS, txt: 4, dec: 3, tih: true, blk1: 'ARCHTICK', blk2: 'ARCHTICK' }]]);
  d.change('x', () => {
    d.defineBlock({ name: 'B', base: { x: 0, y: 0 }, entities: [{ type: 'line', layer: '0', x1: 0, y1: 0, x2: 1, y2: 0 }] });
    d.add({ type: 'line', layer: '0', x1: 0, y1: 0, x2: 100, y2: 0, z1: 1.5, z2: 2.5, th: 3, tr: 40, mat: 'Steel', url: 'https://example.com/a' });
    d.add({ type: 'circle', layer: '0', cx: 10, cy: 10, r: 5, z: 4, th: 2, tr: 'ByBlock' });
    d.add({ type: 'arc', layer: '0', cx: 20, cy: 10, r: 5, a0: 0, a1: 1, z: -1 });
    d.add({ type: 'point', layer: '0', x: 30, y: 10, z: 7, th: 1 });
    d.add({ type: 'poly', layer: '0', closed: true, w: 2, z: 5, th: 1.5, pts: [{ x: 0, y: 20, b: 0 }, { x: 10, y: 20, b: 0 }, { x: 10, y: 30, b: 0 }] });
    d.add({ type: 'poly', layer: '0', closed: false, pts: [{ x: 0, y: 40, b: 0, sw: 1, ew: 3 }, { x: 10, y: 40, b: 0.5, sw: 0, ew: 0 }, { x: 20, y: 40, b: 0, sw: 0, ew: 0 }] });
    d.add({ type: 'text', layer: '0', x: 0, y: 60, h: 2.5, rot: 0, s: 'Slanted', ha: 'left', va: 'baseline', style: 'Notes', obl: Math.PI / 12, z: 2, ann: true });
    d.add({ type: 'text', layer: '0', x: 0, y: 70, h: 2.5, rot: 0, s: 'Two\nlines', ha: 'left', va: 'top', style: 'Notes', obl: Math.PI / 18 });
    d.add({ type: 'insert', layer: '0', block: 'B', x: 50, y: 50, sx: 1, sy: 1, sz: 3, rot: 0, z: 1 });
    d.add({ type: 'hatch', layer: '0', solid: false, pattern: 'ANSI31', pscale: 1, loops: [[0, 80, 20, 80, 20, 100, 0, 100, 0, 80]], ox: 5, oy: 7, island: 'outer', assoc: true, bg: 3, z: 2 });
    d.add({ type: 'dim', layer: '0', kind: 'linear', p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, loc: { x: 50, y: -20 }, rot: 0, text: '', st: dimSt, dimstyle: 'Arch', trot: Math.PI / 6 });
  });
  d.layouts.push({ name: 'Sheet', paper: { w: 420, h: 297, unit: 'mm', x0: 0, y0: 0, key: 'iso-a3' }, entities: new Map([
    ['v1', { id: 'v1', type: 'viewport', layer: '0', color: null, x: 200, y: 150, w: 200, h: 150, cx: 50, cy: 50, s: 1, on: false, locked: true }]]) });
  const fmts = [
    ['DWG 2000', () => importDwg(readDwg(saveDwg(d, { version: '2000' }).bytes), { versionTag: 'x' }), { tr: true }],
    ['DWG 2018', () => importDwg(readDwg(saveDwg(d, { version: '2018' }).bytes), { versionTag: 'x' }), { tr: true }],
    ['DXF 2000', () => readDxf(writeDxf2000(d).text), { tr: true }],
    ['DXF R12', () => readDxf(writeDxf(d).text), { r12: true }],
  ];
  const near6 = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < 1e-6;
  for (const [name, read, o] of fmts) {
    const r = read();
    const E = r.entities;
    const by = (t, f) => E.find((e) => e.type === t && f(e));
    const ln = by('line', (e) => near6(e.x2, 100) && near6(e.y1, 0));
    ok(ln && near6(ln.z1, 1.5) && near6(ln.z2, 2.5) && near6(ln.th, 3) && ln.tr === 40 && ln.mat === 'Steel' && ln.url === 'https://example.com/a', name + ': line Z, thickness, transparency, material, hyperlink', JSON.stringify(ln));
    const ci = by('circle', () => true), ar = by('arc', () => true), pt = by('point', () => true);
    ok(ci && near6(ci.z, 4) && near6(ci.th, 2) && ci.tr === 'ByBlock' && ar && near6(ar.z, -1) && pt && near6(pt.z, 7) && near6(pt.th, 1), name + ': circle / arc / point Z, thickness, ByBlock transparency', JSON.stringify([ci, ar, pt]));
    const p1 = by('poly', (e) => e.closed), p2 = by('poly', (e) => !e.closed && near6(e.pts[0].y, 40));
    ok(p1 && near6(p1.w, 2) && near6(p1.z, 5) && near6(p1.th, 1.5) && !p1.pts.some((q) => q.sw !== undefined), name + ': polyline global width, elevation, thickness', JSON.stringify(p1));
    ok(p2 && near6(p2.pts[0].sw, 1) && near6(p2.pts[0].ew, 3) && near6(p2.pts[1].sw, 0) && near6(p2.pts[1].b, 0.5) && p2.w === undefined, name + ': polyline segment widths', JSON.stringify(p2));
    const tx = by('text', (e) => e.s === 'Slanted');
    const sameName = (a, b) => (o.r12 ? String(a).toUpperCase() === b.toUpperCase() : a === b);   // R12 names are upper case
    ok(tx && sameName(tx.style, 'Notes') && near6(tx.obl, Math.PI / 12) && near6(tx.z, 2) && tx.ann === true, name + ': text style, oblique, Z, annotative', JSON.stringify(tx));
    const two = E.filter((e) => e.type === 'text' && /Two|lines/.test(e.s));
    ok(two.length && two.every((e) => sameName(e.style, 'Notes') && near6(e.obl, Math.PI / 18)), name + ': multi-line text keeps its style and oblique angle' + (o.r12 ? ' (one text per line in R12)' : ''), JSON.stringify(two));
    ok((r.textStyles || []).some(([n, v]) => /^notes$/i.test(n) && /romans/i.test(v.font) && near6(v.wf, 0.8)), name + ': the text style table (font, width factor)', JSON.stringify(r.textStyles));
    const ins = by('insert', (e) => /^b$/i.test(e.block));
    ok(ins && near6(ins.sz, 3) && near6(ins.z, 1), name + ': block reference Z scale and Z', JSON.stringify(ins));
    if (!o.r12) {
      const ht = by('hatch', (e) => !e.solid);
      const want = Hatch.hatchLines([...d.model.values()].find((e) => e.type === 'hatch'), d);
      const got = ht && Hatch.hatchLines(ht, d);
      ok(ht && ht.ox === 5 && ht.oy === 7 && ht.island === 'outer' && ht.assoc === true && ht.bg === 3 && near6(ht.z, 2) && want && got && want.length === got.length && want.every((q, i) => near6(q.x1, got[i].x1) && near6(q.y1, got[i].y1)),
        name + ': hatch origin (pattern lines in the same place), island detection, associative, background colour, elevation', JSON.stringify(ht && { ox: ht.ox, oy: ht.oy, island: ht.island, assoc: ht.assoc, bg: ht.bg, z: ht.z, n: [want?.length, got?.length] }));
    }
    const dm = by('dim', () => true);
    const DEF = { ...Dm.DIM_DEFAULTS, ...(await load('dimstyle.js')).DIM_EXTRA };
    const bad = dm ? Object.keys(dimSt).filter((k) => { const v = dm.st[k] ?? DEF[k]; return typeof dimSt[k] === 'number' ? !near6(v, dimSt[k]) : v !== dimSt[k]; }).filter((k) => !(k === 'txsty' && o.r12 && /^notes$/i.test(dm.st[k]))) : ['no dim'];
    ok(dm && !bad.length && sameName(dm.dimstyle, 'Arch') && near6(dm.trot, Math.PI / 6), name + ': dimension style name, text rotation and every style setting', bad.map((k) => k + ' want ' + JSON.stringify(dimSt[k]) + ' got ' + JSON.stringify(dm?.st[k])).join(', ') + ' ' + JSON.stringify([dm?.dimstyle, dm?.trot]));
    const ds = new Map(r.dimStyles || []);
    const arch = [...ds].find(([n]) => /^arch$/i.test(n))?.[1];
    ok(arch && near6(arch.txt, 4) && arch.dec === 3 && arch.tih === true && (o.r12 || arch.txsty === undefined || true), name + ': the named dimension style is in the table', JSON.stringify(arch));
    const vp = r.layouts[0]?.entities.find((e) => e.type === 'viewport');
    ok(vp && vp.on === false && vp.locked === true, name + ': viewport off and display locked', JSON.stringify(vp));
    const dd = new Doc(); dd.load(r);
    ok(dd.textStyles.has(r.textStyles?.[0]?.[0]) && [...dd.dimStyles.keys()].some((n) => /^arch$/i.test(n)), name + ': the drawing keeps its text and dimension styles (doc.textStyles / doc.dimStyles)');
  }
  // walk.js draws the new fields (the screen through view.js, paper through plot.js)
  const Wk = await load('walk.js');
  const got = [];
  Wk.walk(d, d.model.values(), { stroke: (c, ps, lw, o) => got.push(['s', o?.alpha]), fill: (c, l, solid, o) => got.push(['f', solid, o?.alpha, l.length]), text: (c, e, o) => got.push(['t', e.obl, o?.alpha]), point() {} });
  ok(got[0][0] === 's' && Math.abs(got[0][1] - 0.6) < 1e-9, 'walk: 40 % transparency → alpha 0.6 on its strokes', JSON.stringify(got[0]));
  ok(got.some((g) => g[0] === 'f' && g[1] === true && g[3] === 3), 'walk: a closed polyline 2 wide → three filled bands', JSON.stringify(got.filter((g) => g[0] === 'f')));
  ok(got.some((g) => g[0] === 't' && Math.abs(g[1] - Math.PI / 12) < 1e-12), 'walk: text passes its oblique angle on');
  ok(got.filter((g) => g[0] === 'f' && g[1] === true).length >= 3, 'walk: the hatch background is a solid fill under its pattern');
  const bands = Wk.polyBands({ type: 'poly', pts: [{ x: 0, y: 0, b: 0, sw: 2, ew: 2 }, { x: 10, y: 0, b: 0 }], closed: false });
  ok(bands.loops.length === 1 && Math.min(...bands.loops[0].filter((_, i) => i % 2)) === -1 && Math.max(...bands.loops[0].filter((_, i) => i % 2)) === 1, 'polyBands: a 2-wide segment is a band from y −1 to 1', JSON.stringify(bands));
  {
    const pd = new Doc();
    pd.change('x', () => { pd.add({ type: 'line', layer: '0', x1: 0, y1: 0, x2: 100, y2: 0, tr: 50 }); pd.add({ type: 'text', layer: '0', x: 0, y: 10, h: 5, rot: 0, s: 'Lean', ha: 'left', va: 'baseline', obl: 0.3 }); });
    const lst = Pl.displayList(pd, Pl.modelSheet(pd, { area: { minX: 0, minY: 0, maxX: 100, maxY: 20 } }));
    const pdf = await Pl.toPdf(lst);
    const txt = new TextDecoder('latin1').decode(pdf.bytes);
    ok(lst.views[0].strokes.some((x) => Math.abs(x.alpha - 0.5) < 1e-9) && /\/ExtGState << \/GA0 << \/Type \/ExtGState \/CA 0\.5 \/ca 0\.5/.test(txt), 'plot: 50 % transparency → an ExtGState alpha in the PDF', txt.match(/ExtGState[^>]*>/)?.[0]);
  }
  // other programs read them too: ezdxf on both DXFs (audit clean, thickness, transparency, widths, oblique, styles)
  const py = path.join(ROOT, 'tools/cadcraft-test/venv/bin/python');
  if (fs.existsSync(py)) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-props-'));
    const f12 = path.join(dir, 'r12.dxf'), f2k = path.join(dir, 'r2000.dxf');
    fs.writeFileSync(f12, writeDxf(d).text); fs.writeFileSync(f2k, writeDxf2000(d).text);
    const code = [
      'import ezdxf,sys,json,math', 'out=[]',
      'for f in sys.argv[1:]:',
      '  doc=ezdxf.readfile(f); a=doc.audit(); m=doc.modelspace()',
      '  ln=m.query("LINE")[0]; t=[x for x in m.query("TEXT") if x.dxf.text=="Slanted"][0]',
      '  pl=[p for p in m.query("LWPOLYLINE POLYLINE") if (p.closed if p.dxftype()=="LWPOLYLINE" else p.is_closed)][0]',
      '  w=pl.dxf.const_width if pl.dxftype()=="LWPOLYLINE" else pl.dxf.default_start_width',
      '  out.append({"errors":len(a.errors),"th":ln.dxf.thickness,"z":[ln.dxf.start.z,ln.dxf.end.z],"tr":ln.dxf.get("transparency"),"obl":round(t.dxf.oblique,6),"style":t.dxf.style,"w":w,"dimstyles":sorted(s.dxf.name for s in doc.dimstyles),"styles":sorted(s.dxf.name for s in doc.styles)})',
      'print(json.dumps(out))'].join('\n');
    const [r12, r2k] = JSON.parse(execFileSync(py, ['-c', code, f12, f2k], { encoding: 'utf8' }));
    ok(r12.errors === 0 && r12.th === 3 && r12.z.join() === '1.5,2.5' && r12.obl === 15 && /^notes$/i.test(r12.style) && r12.w === 2 && r12.dimstyles.some((n) => /^arch$/i.test(n)), 'ezdxf reads the R12 DXF: no audit errors, thickness, Z, oblique, text style, width, dimension style', JSON.stringify(r12));
    ok(r2k.errors === 0 && r2k.th === 3 && r2k.z.join() === '1.5,2.5' && r2k.tr === null && r2k.obl === 15 && r2k.style === 'Notes' && r2k.w === 2 && r2k.dimstyles.includes('Arch') && r2k.styles.includes('Notes'), 'ezdxf reads the DXF 2000: no audit errors, thickness, Z, oblique, text style, width, dimension style (R2000 has no transparency: CadCraft keeps it in its xdata)', JSON.stringify(r2k));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

section('Autosave and crash recovery (0.4 item 1.2; dwg-autosave.js on the shell\'s app-autosave.js)');
{
  const A = await load('app-autosave.js');
  const { wireAutosave } = await load('dwg-autosave.js');
  const { readDwg } = await load('dwg/read.js');
  const { importDwg } = await load('dwg-import.js');
  const store = A.memoryStore();
  const d = new Doc();
  d.load({ meta: { name: 'Plan', source: 'Plan.dxf', saveFormat: 'dxf' } }); d.markSaved();
  const tabs = { list: [{ id: 1 }], active: 1, docOf: () => d };
  const as1 = new A.Autosave({ app: 'cadcraft', store, locks: null, alive: async () => ['s1'], session: 's1' });
  const w1 = wireAutosave({ autosave: as1, doc: d, tabs, open: async () => {} });
  ok(!w1.handles.size, 'nothing is kept before the first edit');
  d.change('x', () => { d.add({ type: 'line', layer: '0', x1: 0, y1: 0, x2: 10, y2: 0 }); d.add({ type: 'circle', layer: '0', cx: 5, cy: 5, r: 2 }); });
  await as1.flush();
  let idx = await store.index('cadcraft');
  const bytes = idx.length === 1 ? await store.getData(idx[0].key) : null;
  const back = bytes ? importDwg(readDwg(bytes), { versionTag: 'x' }) : null;
  ok(idx.length === 1 && idx[0].name === 'Plan' && back && back.entities.length === 2 && idx[0].meta?.source === 'Plan.dxf' && idx[0].meta?.saveFormat === 'dxf', 'an edit writes a copy: the drawing as DWG, with its name, file and save format', JSON.stringify(idx[0]));
  d.markSaved(); w1.sweep(); await new Promise((r) => setTimeout(r, 20));
  ok((await store.index('cadcraft')).length === 0, 'saving the drawing removes its copy');
  d.change('y', () => d.add({ type: 'point', layer: '0', x: 1, y: 1 }));
  d.undo(); w1.sweep(); await new Promise((r) => setTimeout(r, 20));
  ok((await store.index('cadcraft')).length === 0, 'an edit undone back to the saved drawing leaves no copy');
  d.change('z', () => d.add({ type: 'point', layer: '0', x: 2, y: 2 }));
  await as1.flush();
  // the page stops; a new one finds the copy and recovers it
  const as2 = new A.Autosave({ app: 'cadcraft', store, locks: null, alive: async () => ['s2'], session: 's2' });
  const orph = await as2.orphans();
  const d2 = new Doc();
  let opened = null;
  const w2 = wireAutosave({ autosave: as2, doc: d2, tabs: { list: [{ id: 1 }], active: 1, docOf: () => d2 }, open: async (file, meta) => {
    const r = importDwg(readDwg(new Uint8Array(await file.arrayBuffer())), { versionTag: 'x' });
    d2.load({ ...r, meta: { ...r.meta, name: file.name.replace(/\.dwg$/, '') } });
    Object.assign(d2.meta, meta); d2.savedVersion = -1; d2.emit();
    opened = { name: file.name, meta };
  } });
  ok(orph.length === 1, 'a new page finds the copy the stopped one left', JSON.stringify(orph));
  await w2.recover(await as2.load(orph[0]));
  ok(opened && opened.name === 'Plan.dwg' && d2.meta.source === 'Plan.dxf' && d2.meta.saveFormat === 'dxf' && d2.count() === 3 && d2.dirty, 'Recover opens it unsaved, with its name, its file and its save format', JSON.stringify({ opened, n: d2.count(), dirty: d2.dirty }));
  ok(w2.handles.size === 1, 'the recovered drawing is kept again by the new page');
  await w2.recover({ data: new Uint8Array(0), meta: {} }).then(() => ok(false, 'an empty copy is refused'), () => ok(true, 'an empty copy is refused (the shell row says so)'));
  // closing the tab drops its copy
  await as2.flush();
  const before = (await store.index('cadcraft')).filter((r) => r.session === 's2').length;
  w2.sweep();
  const t2 = { list: [], active: 1, docOf: () => d2 };
  const w3 = wireAutosave({ autosave: as2, doc: d2, tabs: t2, open: async () => {} });
  w3.handles.set(1, w2.handles.get(1)); w3.sweep(); await new Promise((r) => setTimeout(r, 20));
  ok(before === 1 && (await store.index('cadcraft')).filter((r) => r.session === 's2').length === 0, 'closing the drawing\'s tab removes its copy');
  for (const w of [w1, w2, w3]) w.stop();
}

section('Sheet sets (track Z: sheetset.js, sheetset-io.js; fixture tools/cadcraft-test/fixtures/sheetset)');
{
  const SS = await load('sheetset.js');
  const IO = await load('sheetset-io.js');
  const { readDwg } = await load('dwg/read.js');
  const FX = path.join(ROOT, 'tools/cadcraft-test/fixtures/sheetset');
  const syncRead = async (bytes) => readDwg(bytes);
  /** A folder on disk, as the panel's browser folder or the desktop's real paths give it. */
  const diskFolder = (dir) => ({
    name: path.basename(dir),
    read: async (p) => { const f = path.join(dir, p); if (!f.startsWith(dir + path.sep)) throw new Error('outside'); return new Uint8Array(fs.readFileSync(f)); },
    write: async (p, data) => fs.writeFileSync(path.join(dir, p), typeof data === 'string' ? data : Buffer.from(data)),
  });
  // Z.1 — the format, read as untrusted
  const { set, notes } = SS.readSheetSet(fs.readFileSync(path.join(FX, 'Clinic.ccsheets'), 'utf8'));
  const all = SS.allSheets(set);
  ok(set.name === 'Riverside Clinic' && all.length === 6 && !notes.length && set.properties.PROJECTNUMBER === '2026-014' && all.map((x) => x.sheet.number).join() === 'A-101,A-102,A-201,A-301,A-501,S-101',
    'the fixture set: six sheets in set order, its project fields', JSON.stringify(all.map((x) => x.sheet.number)));
  ok(all[0].path.map((g) => g.name).join('/') === 'Architectural/Plans' && all[5].path.map((g) => g.name).join('/') === 'Structural', 'subsets nest (Architectural › Plans), every sheet knows its path');
  ok(SS.readSheetSet(SS.writeSheetSet(set)).set && SS.writeSheetSet(SS.readSheetSet(SS.writeSheetSet(set)).set) === SS.writeSheetSet(set), 'written and read again: the same text');
  const refuse = (txt, key) => { try { SS.readSheetSet(txt); return false; } catch (e) { return e instanceof SS.SheetSetError && e.message === EN(key, { v: 2 }); } };
  ok(refuse('{oops', 'sheetset.read.json') && refuse('{"format":"x","version":1}', 'sheetset.read.format') && refuse('{"format":"cadcraft-sheetset","version":2}', 'sheetset.read.newer'), 'not JSON, not a sheet set, a newer format: refused with a plain message');
  const dirty = SS.readSheetSet(JSON.stringify({ format: 'cadcraft-sheetset', version: 1, name: 'X\u0007Y\nZ', properties: { 'bad key!': 'v', ok: 'yes' }, sheets: [
    { id: 'a', file: '/etc/passwd', layout: 'L' }, { id: 'a', file: 'C:\\x\\y.dwg', layout: 'L' }, { id: 'a', file: 'sub\\one.dwg', layout: 'L1', number: 7 }, { id: 'a', file: './sub/two.dxf', layout: 'L2', evil: 'x' }, { file: 'x.dwg' }] }));
  const ds = SS.allSheets(dirty.set).map((x) => x.sheet);
  ok(dirty.set.name === 'XY Z' && ds.length === 2 && ds[0].file === 'sub/one.dwg' && ds[1].file === 'sub/two.dxf' && ds[0].number === '7' && ds[0].id !== ds[1].id && !('evil' in ds[1]) && dirty.set.properties.OK === 'yes' && dirty.set.properties.BAD_KEY_ === 'v'
    && dirty.notes.some((n) => n === EN('sheetset.read.dropped', { n: 3 })), 'untrusted input: control characters gone, absolute paths and drive letters dropped (said), backslashes read as /, ids made unique, unknown keys dropped', JSON.stringify([dirty.set.name, ds, dirty.notes, dirty.set.properties]));
  // edits (Z.2): add, move, remove, subsets, renumber (Z.5)
  let s2 = SS.addSheet(set, { file: 'details/Details.dwg', layout: 'S1', number: 'S-102', title: 'Framing' }, { subset: 'str' }).set;
  ok(SS.allSheets(s2).length === 7 && SS.allSheets(s2)[6].sheet.number === 'S-102' && SS.allSheets(set).length === 6, 'add a sheet to a subset (the old set is untouched: undo keeps it)');
  s2 = SS.moveSheet(s2, 'rf', { subset: null, at: 0 });
  ok(SS.allSheets(s2)[0].sheet.id === 'rf' && SS.allSheets(s2)[0].path.length === 0, 'drag a sheet out of its subset to the top');
  s2 = SS.removeSubset(s2, 'plans');
  ok(SS.findSubset(s2, 'plans') === null && SS.findSubset(s2, 'arch').sheets.length === 3 && SS.allSheets(s2).length === 7, 'remove a subset: its sheets move up to the subset it was in');
  s2 = SS.renumber(s2, null, { prefix: 'X-', start: 1, digits: 2 });
  ok(SS.allSheets(s2).map((x) => x.sheet.number).join() === 'X-01,X-02,X-03,X-04,X-05,X-06,X-07', 'renumber every sheet in set order', SS.allSheets(s2).map((x) => x.sheet.number).join());
  ok((() => { try { SS.addSheet(set, { file: '', layout: 'x' }); return false; } catch (e) { return e.message === EN('sheetset.err.sheet'); } })(), 'a sheet needs a file and a layout');
  ok(SS.layoutNameFor(set, all[0].sheet) === 'A-101 Level 1 floor plan' && SS.layoutNameFor({ ...set, layoutNames: 'number' }, all[0].sheet) === 'A-101' && SS.layoutNameFor({ ...set, layoutNames: 'keep' }, all[0].sheet) === 'Plan 1' && SS.sheetLabel(all[0].sheet) === 'A-101 — Level 1 floor plan',
    'layout names the set gives (number + title, number, title, keep) and the bookmark label');
  // fields (Z.3)
  ok(SS.fieldTag('sheet_no') === 'SHEETNUMBER' && SS.fieldTag('Title') === 'SHEETTITLE' && SS.fieldTag('PROJECT_NO') === 'PROJECTNUMBER' && SS.fieldTag('CLIENT') === 'CLIENT', 'title block tags: the field names and their common aliases');
  const fv = SS.fieldValues(set, all[1].sheet);
  ok(fv.SHEETNUMBER === 'A-102' && fv.SHEETTITLE === 'Level 2 floor plan' && fv.PROJECTNUMBER === '2026-014' && fv.CLIENT === 'Example Health Co.' && fv.SHEETINDEX === '2 of 6' && fv.SHEETCOUNT === '6', 'field values: sheet, set and project fields, "2 of 6"', JSON.stringify(fv));
  const opened = await IO.openDrawing(diskFolder(FX), 'details/Details.dwg', { readDwg: syncRead });
  const n = SS.fillTitleBlocks(opened.doc, 'D1', SS.fieldValues(set, all[4].sheet));
  const tb = [...opened.doc.layouts.find((l) => l.name === 'D1').entities.values()].find((e) => e.type === 'insert');
  ok(n === 3 && tb.attrs.SHEET_NO === 'A-501' && tb.attrs.TITLE === 'Wall details' && tb.attrs.PROJECT_NO === '2026-014' && opened.doc.undoStack.length === 1, 'a title block with alias tags is filled (SHEET_NO, TITLE, PROJECT_NO), one undo step', JSON.stringify(tb.attrs));
  ok(SS.fillTitleBlocks(opened.doc, 'D1', SS.fieldValues(set, all[4].sheet)) === 0, 'filling again changes nothing');
  ok((await IO.layoutsIn(diskFolder(FX), 'plans/Level 2.dxf', { readDwg: syncRead })).join() === 'Plan 2,Roof', 'a file\'s sheets are listed without opening it on screen (DXF 2000)');
  // publish (Z.4)
  const pub = await IO.publishSet(set, diskFolder(FX), { readDwg: syncRead });
  ok(pub.bytes && pub.report.pages === 6 && pub.report.names.join('|') === all.map((x) => SS.sheetLabel(x.sheet)).join('|') && !pub.report.missing.length, 'publish the set: one PDF, six pages in set order, a bookmark per sheet', JSON.stringify(pub.report));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-sheetset-'));
  try {
    const pdf = path.join(tmp, 'set.pdf');
    fs.writeFileSync(pdf, pub.bytes);
    try {
      const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
      const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
      const pages = text.split('\f');
      ok(/Pages:\s+6/.test(info) && /A-101/.test(pages[0]) && /Level 1 floor plan/.test(pages[0]) && /Riverside Clinic/.test(pages[0]) && /A-501/.test(pages[4]) && /2026-014/.test(pages[4]) && /S-101/.test(pages[5]),
        'the pages carry their title blocks filled from the set (pdftotext: A-101 Level 1 floor plan Riverside Clinic; the alias block A-501 2026-014)', pages.map((p) => p.replace(/\s+/g, ' ').trim().slice(0, 60)).join(' | '));
      const outl = new TextDecoder('latin1').decode(pub.bytes).match(/\/Title \(([^)]*)\) \/Parent 5 0 R/g) || [];
      ok(outl.length === 6 && /\(A-101 \\227 Level 1 floor plan\)/.test(outl[0]), 'bookmarks "A-101 — Level 1 floor plan" …', outl.slice(0, 2).join(' '));
    } catch (err) { if (err.code !== 'ENOENT') throw err; console.log('  (poppler not installed: PDF text not checked)'); }
    const sub = await IO.publishSet(set, diskFolder(FX), { subset: 'plans', readDwg: syncRead });
    ok(sub.report.pages === 4 && sub.report.names[0].startsWith('A-101') && sub.report.names[3].startsWith('A-301'), 'publish a subset: its four sheets');
    const miss = await IO.publishSet(SS.updateSheet(SS.updateSheet(set, 'd1', { layout: 'Nope' }), 's1', { file: 'gone.dwg' }), diskFolder(FX), { readDwg: syncRead });
    ok(miss.report.pages === 4 && miss.report.missing.length === 2 && miss.report.notes.some((t2) => /no layout named/.test(t2)) && miss.report.notes.some((t2) => /gone\.dwg could not be read/.test(t2)), 'a missing layout or file is left out and said', JSON.stringify(miss.report.notes));
    // write back (Z.3 fields in each drawing, Z.5 layout names follow) on a copy of the fixture
    const work = path.join(tmp, 'set');
    fs.cpSync(FX, work, { recursive: true });
    const up = await IO.updateDrawings(set, diskFolder(work), { readDwg: syncRead });
    const re = async (p) => (await IO.openDrawing(diskFolder(work), p, { readDwg: syncRead }));
    const l1 = await re('plans/Level 1.dwg'), l2 = await re('plans/Level 2.dxf'), dt = await re('details/Details.dwg');
    const attrsOf = (o, name) => [...(o.doc.layouts.find((l) => l.name === name)?.entities.values() || [])].find((e) => e.type === 'insert')?.attrs;
    ok(up.files.length === 3 && l1.doc.layouts.map((l) => l.name).join('|') === 'A-101 Level 1 floor plan|A-201 Level 1 reflected ceiling' && l2.doc.layouts.map((l) => l.name).join('|') === 'A-102 Level 2 floor plan|A-301 Roof plan',
      'Update drawings: every sheet\'s layout tab is renamed "number title" in its file', JSON.stringify([l1.doc.layouts.map((l) => l.name), l2.doc.layouts.map((l) => l.name), up.notes]));
    ok(attrsOf(l1, 'A-101 Level 1 floor plan')?.SHEETNUMBER === 'A-101' && attrsOf(l2, 'A-301 Roof plan')?.SHEETTITLE === 'Roof plan' && attrsOf(dt, 'S-101 Foundation plan')?.SHEET_NO === 'S-101' && attrsOf(dt, 'A-501 Wall details')?.PROJECT_NO === '2026-014',
      'and its title blocks hold the fields, saved in the file', JSON.stringify([attrsOf(l1, 'A-101 Level 1 floor plan'), attrsOf(dt, 'S-101 Foundation plan')]));
    ok(l1.version === '2018' && dt.version === '2000' && l2.format === 'dxf2000', 'each file keeps its own format and version (DWG 2018, DWG 2000, DXF 2000)');
    ok(SS.allSheets(up.set)[0].sheet.layout === 'A-101 Level 1 floor plan' && SS.allSheets(set)[0].sheet.layout === 'Plan 1', 'the set points at the new layout names');
    // renumber and run again: tabs, title blocks and the list follow (Z.5)
    const s3 = SS.renumber(up.set, ['p1', 'p2'], { prefix: 'A-1', start: 11 });
    const up2 = await IO.updateDrawings(s3, diskFolder(work), { readDwg: syncRead });
    const l1b = await re('plans/Level 1.dwg');
    ok(up2.files.length === 2 && l1b.doc.layouts[0].name === 'A-111 Level 1 floor plan' && attrsOf(l1b, 'A-111 Level 1 floor plan')?.SHEETNUMBER === 'A-111' && SS.allSheets(up2.set)[1].sheet.layout === 'A-112 Level 2 floor plan',
      'renumber A-101/A-102 → A-111/A-112: the tabs, the title blocks and the set follow; the untouched file is not rewritten', JSON.stringify([up2.files, l1b.doc.layouts.map((l) => l.name)]));
    const pub2 = await IO.publishSet(up2.set, diskFolder(work), { readDwg: syncRead });
    ok(pub2.report.pages === 6 && pub2.report.names[0] === 'A-111 — Level 1 floor plan' && !pub2.report.missing.length, 'and publishing the renumbered set finds every sheet');
    // Z.6: the sheet list table on the first sheet, kept current
    const cover = SS.allSheets(up2.set)[0].sheet;
    await IO.addSheetList(up2.set, diskFolder(work), cover, { readDwg: syncRead });
    const listTexts = async () => { const o = await re(cover.file); return (o.doc.blocks.get(SS.SHEET_LIST_BLOCK)?.entities || []).filter((e) => e.type === 'text').map((e) => e.s); };
    const lt = await listTexts();
    const c1 = await re(cover.file);
    ok(lt.includes('Riverside Clinic') && lt.includes('A-111') && lt.includes('Level 1 floor plan') && lt.includes('Plans') && lt.includes('Structural') && lt.includes('S-101')
      && [...c1.doc.layouts.find((l) => l.name === cover.layout).entities.values()].filter((e) => e.type === 'insert' && e.block === SS.SHEET_LIST_BLOCK).length === 1,
      'the sheet list table: one reference on the cover sheet, a row per subset and sheet', JSON.stringify(lt));
    const s4 = SS.updateSheet(up2.set, 's1', { number: 'S-201', title: 'Footings' });
    const up3 = await IO.updateDrawings(s4, diskFolder(work), { readDwg: syncRead });
    const lt2 = await listTexts();
    ok(lt2.includes('S-201') && lt2.includes('Footings') && !lt2.includes('S-101') && up3.files.some((f) => f.path === cover.file && f.list === 1), 'renaming a sheet and updating redraws the list in the cover drawing', JSON.stringify(up3.files));
    const pub3 = await IO.publishSet(up3.set, diskFolder(work), { readDwg: syncRead });
    fs.writeFileSync(path.join(tmp, 'p3.pdf'), pub3.bytes);
    try { ok(/S-201\s+Footings/.test(execFileSync('pdftotext', ['-layout', path.join(tmp, 'p3.pdf'), '-'], { encoding: 'utf8' }).split('\f')[0]), 'the published cover sheet shows the list'); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    // Z.7: archive — the set, its drawings, the drawings they link to, a transmittal note
    const AR = await load('sheetset-archive.js');
    const { readDxfModel } = await load('dxf-model.js');
    const listFolder = { ...diskFolder(FX), list: async () => { const out = []; const w = (d, pre) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) w(f, pre + n + '/'); else out.push(pre + n); } }; w(FX, ''); return out.sort(); } };
    const readModel = async (bytes, p) => (/\.dxf$/i.test(p) ? readDxfModel(new TextDecoder().decode(bytes)) : readDwg(bytes));
    ok(AR.resolveRef('..\\plans\\Level 1.dwg', 'details/Details.dwg', ['plans/Level 1.dwg', 'details/Details.dwg']) === 'plans/Level 1.dwg'
      && AR.resolveRef('C:\\Jobs\\Old\\Level 1.dwg', 'details/Details.dwg', ['plans/Level 1.dwg']) === 'plans/Level 1.dwg'
      && AR.resolveRef('../../outside.dwg', 'details/Details.dwg', ['outside.dwg']) === 'outside.dwg' && AR.resolveRef('nothing.png', 'a.dwg', ['b.png']) === null,
      'a link is found by its path from the drawing, else by its file name in the folder (an absolute path from another computer)');
    ok(JSON.stringify(AR.linksOf({ blocks: [{ name: 'X', flags: 4, xrefPath: 'x.dwg' }, { name: 'B', flags: 0 }], objects: [{ type: 'IMAGEDEF', fileName: 'logo.png' }] })) === '{"xrefs":["x.dwg"],"images":["logo.png"]}', 'a drawing\'s links: external references (block flag 4) and pictures (IMAGEDEF)');
    const onlyDetails = SS.removeSheet(SS.removeSheet(SS.removeSheet(SS.removeSheet(set, 'p1'), 'p2'), 'c1'), 'rf');
    const ar = await AR.archiveSet(onlyDetails, listFolder, { setFile: 'Clinic.ccsheets', setText: SS.writeSheetSet(onlyDetails), readModel });
    const unz = await AR.unzip(ar.bytes);
    const names = unz.map((e) => e.name);
    ok(names.includes('Clinic.ccsheets') && names.includes('details/Details.dwg') && names.includes('plans/Level 1.dwg') && !names.includes('plans/Level 2.dxf') && names.includes('Transmittal.txt') && !ar.missing.length,
      'archive a set of the details sheets: the set file, Details.dwg and the drawing it links (plans/Level 1.dwg), and the transmittal note — not the unused Level 2', JSON.stringify(names));
    ok(unz.every((e) => AR.crc32(e.data) === e.crc) && Buffer.from(unz.find((e) => e.name === 'details/Details.dwg').data).equals(fs.readFileSync(path.join(FX, 'details/Details.dwg'))), 'every entry unpacks to its exact bytes (CRC-32 checked)');
    const zf = path.join(tmp, 'a.zip');
    fs.writeFileSync(zf, ar.bytes);
    try { ok(/No errors detected/.test(execFileSync('unzip', ['-t', zf], { encoding: 'utf8' })), 'unzip -t: no errors'); } catch (err) { if (err.code !== 'ENOENT') ok(false, 'unzip -t: no errors', String(err.stdout || err.message)); }
    const gone = { ...listFolder, read: async (p) => { if (p === 'plans/Level 1.dwg') throw new Error('gone'); return listFolder.read(p); } };
    const ar2 = await AR.archiveSet(onlyDetails, gone, { setFile: 'Clinic.ccsheets', setText: '', readModel });
    const note = new TextDecoder().decode((await AR.unzip(ar2.bytes)).find((e) => e.name === 'Transmittal.txt').data);
    ok(ar2.missing.length === 1 && /could not be found/.test(note) && /Level 1\.dwg \(named in details\/Details\.dwg\)/.test(note), 'a link that cannot be read is listed in the transmittal note', note);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

section('Linetypes and lineweights (0.4 C8; linetypes.js)');
{
  const LT = await load('linetypes.js');
  const { walk } = await load('walk.js');
  const Pl = await load('plot.js');
  const { saveDwg } = await load('dwg-save.js');
  const { readDwg } = await load('dwg/read.js');
  const { importDwg } = await load('dwg-import.js');
  const len = (q) => (q.k === 'L' ? Math.hypot(q.x2 - q.x1, q.y2 - q.y1) : q.r * ((q.a1 - q.a0 + 4 * Math.PI) % (2 * Math.PI) || 2 * Math.PI));
  const d1 = LT.dashPrims([{ k: 'L', x1: 0, y1: 0, x2: 1, y2: 0 }], LT.STANDARD.HIDDEN, 1);
  ok(d1.length === 3 && near(d1[0].x2, 0.25) && near(d1[1].x1, 0.375) && near(d1[1].x2, 0.625) && near(d1[2].x1, 0.75) && near(d1[2].x2, 1), 'HIDDEN on a 1" line: dashes 0–0.25, 0.375–0.625, 0.75–1', JSON.stringify(d1.map((q) => [q.x1, q.x2])));
  const ring = G.prims({ type: 'circle', cx: 0, cy: 0, r: 10 }, null);
  const c1 = LT.dashPrims(ring, LT.STANDARD.CENTER, 1), total = 2 * Math.PI * 10;
  ok(Math.abs(c1.reduce((s, q) => s + len(q), 0) / total - 0.75) < 0.03, 'CENTER round a circle: three quarters of it is drawn (1.25 + 0.25 of every 2.0)', c1.reduce((s, q) => s + len(q), 0) / total);
  ok(LT.dashPrims([{ k: 'L', x1: 0, y1: 0, x2: 1, y2: 0 }], LT.STANDARD.DOT, 1).length === 4, 'DOT: a dot every 0.25');
  ok(LT.dashPrims([{ k: 'L', x1: 0, y1: 0, x2: 1e6, y2: 0 }], LT.STANDARD.HIDDEN, 1).length === 1, 'a pattern too fine to see draws the line continuous');
  const d = new Doc();
  d.meta.units = 'millimeters';
  ok(near(LT.patternOf(d, 'DASHED')[0], 12.7) && LT.patternOf(d, 'Continuous') === null && LT.patternOf(d, 'NOSUCH') === null, 'a metric drawing uses the ISO sizes (DASHED 12.7 mm dashes)');
  d.setLayer('Hidden', { linetype: 'HIDDEN', lineweight: 0.35 });
  d.change('x', () => {
    d.defineBlock({ name: 'B', base: { x: 0, y: 0 }, entities: [{ type: 'line', layer: '0', lt: 'ByBlock', lw: -2, x1: 0, y1: 0, x2: 100, y2: 0 }] });
    d.add({ type: 'line', layer: 'Hidden', x1: 0, y1: 0, x2: 100, y2: 0 });
    d.add({ type: 'insert', layer: '0', block: 'B', lt: 'DASHED', lw: 0.7, x: 0, y: 50, sx: 1, sy: 1, rot: 0 });
    d.add({ type: 'line', layer: '0', lt: 'DASHED', lw: 0.5, lts: 2, x1: 0, y1: 20, x2: 100, y2: 20 });
  });
  const got = [];
  walk(d, d.model.values(), { stroke: (c, ps, lw) => got.push({ n: ps.length, lw }), fill() {}, text() {}, point() {} });
  ok(got[0].n === 11 && got[0].lw === 0.35, 'by layer: the layer\'s HIDDEN and 0.35 mm', JSON.stringify(got[0]));
  ok(got[1].n === 6 && got[1].lw === 0.7, 'by block inside a reference: the reference\'s DASHED and 0.7 mm', JSON.stringify(got[1]));
  ok(got[2].n === 3 && got[2].lw === 0.5, 'its own linetype scale: DASHED × 2 (3 dashes) and its own 0.5 mm', JSON.stringify(got[2]));
  const list = Pl.displayList(d, Pl.modelSheet(d, { area: { minX: 0, minY: 0, maxX: 100, maxY: 60 } }));
  ok(list.views[0].strokes.map((s) => s.lw).sort().join() === '0.35,0.5,0.7', 'plotting keeps each lineweight (mm on paper)', JSON.stringify(list.views[0].strokes.map((s) => s.lw)));
  for (const v of ['2000', '2018']) {
    const b = new Doc(); b.load(importDwg(readDwg(saveDwg(d, { version: v }).bytes), { versionTag: 'x' }));
    const ln = [...b.model.values()];
    ok(b.layers.get('Hidden').linetype === 'HIDDEN' && b.layers.get('Hidden').lineweight === 0.35 && ln[2].lt === 'DASHED' && ln[2].lw === 0.5 && ln[2].lts === 2 && b.blocks.get('B').entities[0].lt === 'ByBlock' && b.blocks.get('B').entities[0].lw === -2 && near(b.linetypes.get('DASHED')?.pattern[0], 12.7),
      'DWG ' + v + ': layer and object linetypes, lineweights, scales and the patterns come back', JSON.stringify([b.layers.get('Hidden'), ln[2], [...b.linetypes.keys()]]));
  }
  const r = readDxf(writeDxf(d).text);
  ok(r.layers.find((l) => l.name === 'HIDDEN')?.linetype === 'HIDDEN' && r.entities.some((e) => e.lt === 'DASHED') && r.linetypes.some((l) => l.name === 'DASHED' && near(l.pattern[0], 12.7)), 'DXF R12: linetypes come back (lineweights are not in R12, and the save says so)');
  // the commands (through the engine API until commands.js installs them, as the layer tools above)
  const { lookup } = await load('commands.js');
  const LTools = await load('layertools.js');
  const { doc: d2, eng, log, type, tick } = harness();
  const local = new Map();
  LTools.installLayerTools((n, a, fn) => local.set(n, fn), (key, label) => ({ key, label }));
  const run = async (name, ...lines) => { if (lookup(name)) await type(name, ...lines); else { const p = local.get(name)(eng.c, eng); await tick(); for (const l of lines) { eng.text(l); await tick(); } await p; } };
  await run('LINETYPE', 'center');
  await run('LWEIGHT', '0.3');
  await run('LTSCALE', '4');
  ok(d2.current.linetype === 'CENTER' && d2.current.lineweight === 0.3 && d2.meta.ltscale === 4 && JSON.stringify(d2.currentStyle()) === '{"lt":"CENTER","lw":0.3}', 'LINETYPE, LWEIGHT and LTSCALE set what new objects get and the drawing\'s scale', JSON.stringify([d2.current, d2.meta.ltscale]));
  d2.undo();
  ok(!(d2.meta.ltscale > 1), 'LTSCALE is undoable');
  const style = JSON.stringify(d2.currentStyle());
  await type('L', '0,0', '100,0', '');
  const nl = [...d2.model.values()].find((e) => e.type === 'line');
  ok(nl && JSON.stringify({ lt: nl.lt, lw: nl.lw }) === style && style !== '{}', 'a new LINE takes the current linetype and lineweight (commands.js ent)', JSON.stringify([style, nl]));
}

section('Lineweight display: LWT, LWDISPLAY (lwdisplay.js)');
{
  const { lwPixels, MAX_PX } = await load('lwdisplay.js');
  ok(lwPixels(0) === 1 && lwPixels(0.13) === 1 && lwPixels(0.25) === 1 && lwPixels(-3) === 1 && lwPixels(undefined) === 1, 'on screen: 0.25 mm or less, and the default weight, are 1 px');
  ok(lwPixels(0.5) === 2 && lwPixels(0.7) === 2.8 && lwPixels(2.11) === 8.44, 'above 0.25 mm in proportion: 0.5 mm = 2 px, 2.11 mm = 8.44 px');
  ok(lwPixels(50) === MAX_PX, 'never wider than ' + MAX_PX + ' px on screen');
  ok(near(lwPixels(0.5, 10), 5) && lwPixels(0.5, 1) === 2 && lwPixels(0.13, 0.5) === 1, 'on a sheet: the true paper width (0.5 mm at 10 px/mm = 5 px), never thinner than the screen weight');
  const { lookup } = await load('commands.js');
  ok(lookup('LWDISPLAY')?.name === 'LWDISPLAY' && lookup('LWT')?.name === 'LWDISPLAY', 'LWDISPLAY (alias LWT) is a command');
  const { host, type, log } = harness();
  await type('LWDISPLAY');
  ok(log.some((s) => /setting of the app in the browser/.test(s)), 'without the browser\'s settings it says so and changes nothing');
  const sets = [];
  host.settings = { lwt: false };
  host.setToggle = (name, on) => { sets.push([name, on]); host.settings[name] = on; };
  await type('LWDISPLAY', 'ON');
  await type('LWT', '');
  await type('LWDISPLAY', 'OFF');
  ok(JSON.stringify(sets) === '[["lwt",true],["lwt",true],["lwt",false]]', 'ON / Enter keeps the current state / OFF go to the status bar toggle', JSON.stringify(sets));
}

section('Multileaders, pictures and wipeouts from files (0.4 C6)');
{
  const { readDwg } = await load('dwg/read.js');
  const { importDwg } = await load('dwg-import.js');
  const FX = path.join(ROOT, 'fixtures/dwg');
  const open = (r) => { const d = new Doc(); d.load(r); return d; };
  const all = (d) => [...d.everyEntity()];
  for (const [label, r] of [['DWG', () => importDwg(readDwg(new Uint8Array(fs.readFileSync(path.join(FX, 'kitchen-equipment.dwg'))))), { versionTag: 'AC1032' }],
    ['DXF', () => readDxf(fs.readFileSync(path.join(FX, 'kitchen-equipment.dxf'), 'utf8'))]].map(([l, f]) => [l, f()])) {
    if (!r) continue;
    const d = open(r);
    const ml = all(d).filter((e) => e.type === 'mleader');
    ok(ml.length === 1 && ml[0].s === 'FLOOR DRAIN\nSEE PLUMBING' && ml[0].pts.length === 2 && ml[0].pts[0].x === 630 && ml[0].dir === 1 && ml[0].st.dogleg === 8 && ml[0].h === 4 && (label === 'DXF' || ml[0].st.gap === 2),
      label + ' (fixture): the multileader comes in as an editable CadCraft multileader (text, tip, landing, size; the DXF reader has no landing gap: default)', JSON.stringify(ml));
    const pic = all(d).find((e) => e.type === 'insert' && /^\*I/.test(e.block));
    const pb = pic && d.blocks.get(pic.block);
    ok(pb && pb.entities.some((e) => e.type === 'poly' && e.closed && e.pts.length === 4) && pb.entities.some((e) => e.type === 'text' && e.s === 'example-logo.png'),
      label + ' (fixture): the picture is a frame with its file name, as one unnamed block', JSON.stringify(pb?.entities.map((e) => e.type)));
    ok(!r.report.skipped.MULTILEADER && !r.report.skipped.IMAGE && r.report.notes.some((n) => /picture is shown as a frame/.test(n)), label + ' (fixture): nothing left out, and the report says pictures are frames', JSON.stringify(r.report.skipped));
  }
  const SAMPLES = '/var/www/CADCRAFT/testfiles/dwg-samples';
  const arch = path.join(SAMPLES, 'architectural_-_annotation_scaling_and_multileaders.dwg'), ex = path.join(SAMPLES, 'example_2018.dwg');
  if (fs.existsSync(arch) && fs.existsSync(ex)) {
    const r = importDwg(readDwg(new Uint8Array(fs.readFileSync(arch))), { versionTag: 'AC1021' });
    const d = open(r);
    const ml = all(d).filter((e) => e.type === 'mleader'), lb = all(d).filter((e) => e.type === 'insert' && /^\*L/.test(e.block));
    ok(ml.length === 33 && lb.length === 3 && ml.every((e) => e.s && e.pts.length >= 2 && e.st.asz > 0), 'Autodesk sample: 33 text multileaders become editable ones; the 3 with a block are drawn as they were (one block each)', ml.length + ' / ' + lb.length);
    const withBlock = lb.map((e) => d.blocks.get(e.block)).find((b) => b.entities.some((x) => x.type === 'insert'));
    ok(withBlock && withBlock.entities.some((x) => x.type === 'poly') && withBlock.entities.some((x) => x.type === 'hatch' && x.solid), 'a multileader with block content keeps its leader, arrowhead and block', JSON.stringify(withBlock?.entities.map((x) => x.type)));
    const r2 = importDwg(readDwg(new Uint8Array(fs.readFileSync(ex))), { versionTag: 'AC1032' });
    const wipe = r2.entities.filter((e) => e.type === 'poly' && e.closed && e.pts.length >= 4 && Math.abs(e.pts[0].x) > 1000);
    ok(!r2.report.skipped.WIPEOUT && r2.report.notes.some((n) => /2 wipeouts are drawn as their frames/.test(n)) && wipe.length >= 2, 'Autodesk sample: its 2 wipeouts are drawn as their frames (and said)', r2.report.notes.join(' | '));
  }
}

section('Plot to PDF');
async function pdfCheck(bytes, name) {
  const head = new TextDecoder().decode(bytes.subarray(0, 8));
  ok(head.startsWith('%PDF-1.4') && new TextDecoder().decode(bytes.subarray(bytes.length - 6)).includes('%%EOF'), name + ': a PDF file');
  const info = pdfinfo(bytes);
  if (info !== null) ok(/Pages:\s+1/.test(info) && !/Syntax Error|Error/i.test(info), name + ': poppler reads it', info.split('\n').filter((l) => /Pages|Page size|rror/.test(l)).join(' | '));
  return info;
}
{
  const doc = new Doc();
  doc.change('seed', () => {
    doc.add({ type: 'poly', closed: true, pts: [{ x: 0, y: 0, b: 0 }, { x: 200, y: 0, b: 0 }, { x: 200, y: 100, b: 0 }, { x: 0, y: 100, b: 0 }] });
    doc.add({ type: 'circle', cx: 100, cy: 50, r: 30, color: 1 });
    doc.add({ type: 'text', x: 10, y: 10, h: 5, rot: 0, s: 'Détail (A) ⌀20 — 中', ha: 'left', va: 'baseline' });
    doc.add({ type: 'hatch', solid: true, loops: [[0, 0, 10, 0, 10, 10, 0, 0]] });
    doc.add({ type: 'dim', kind: 'linear', p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 }, loc: { x: 100, y: -20 }, rot: 0, text: '', st: { ...Dm.DIM_DEFAULTS } });
  });
  doc.addLayer({ name: 'Hidden', color: 2, plot: false });
  doc.change('x', () => doc.add({ type: 'line', layer: 'Hidden', x1: 0, y1: 0, x2: 1, y2: 1 }));
  const sheet = Pl.modelSheet(doc, { area: Pl.extentsOf(doc), paper: 'iso-a4', n: 2 });
  ok(near(sheet.w, 297) && near(sheet.h, 210) && sheet.scale.label === '1:2' && sheet.scale.fits, 'model on A4 at 1:2', JSON.stringify(sheet.scale));
  const list = Pl.displayList(doc, sheet, { mono: true });
  const v = list.views[0];
  ok(v.strokes.every((s) => s.color === '#000000') && v.texts.some((t) => t.e.s.startsWith('Détail')), 'monochrome: everything in black');
  ok(!v.strokes.some((s) => s.prims.some((q) => q.k === 'L' && near(q.x2 - q.x1, 0.5, 1e-9))), 'layers set not to plot are left out');
  const { bytes, report } = await Pl.toPdf(list, { pen: 0.35, title: 'Test (1)' });
  ok(report.missing === 1, 'characters outside the PDF font are counted ("中")', report.missing);
  await pdfCheck(bytes, 'model plot');
  const txt = pdftotext(bytes);
  if (txt !== null) ok(txt.includes('Détail (A) Ø20') && txt.includes('200'), 'the PDF has real text (Ø for ⌀, accents kept, dimension text)', JSON.stringify(txt.slice(0, 120)));
  const fitted = Pl.modelSheet(doc, { area: Pl.extentsOf(doc), paper: 'letter', portrait: true, n: null });
  ok(near(fitted.w, 215.9) && fitted.scale.fits && fitted.scale.label.includes('fitted'), 'fit to Letter portrait');
  ok(!Pl.modelSheet(doc, { area: Pl.extentsOf(doc), paper: 'iso-a4', n: 0.5 }).scale.fits, 'a scale too large for the paper is reported');
  const bz = Pl.arcBeziers(0, 0, 10, 0, Math.PI);
  const mid = (c) => { const t = 0.5, u = 1 - t; return { x: u ** 3 * 10 + 3 * u * u * t * c[0] + 3 * u * t * t * c[2] + t ** 3 * c[4] }; };
  ok(bz.length === 2 && Math.abs(Math.hypot(bz[0][4], bz[0][5]) - 10) < 1e-9 && Math.abs(mid(bz[0]).x - 10 * Math.cos(Math.PI / 4)) < 0.01, 'arcs become Béziers that stay on the circle');
  const w = Pl.winAnsi('a(b)\\é€');
  ok(w.str === 'a\\(b\\)\\\\\\351\\200' && w.missing === 0, 'PDF strings escape ( ) \\ and write é € in Windows-1252', w.str);
  // a layout: viewport content clipped to the viewport, the frame left out (layer does not plot)
  const { doc: d2, type } = harness();
  await type('REC', '0,0', '1000,500');
  await type('LAYOUT');
  const lsheet = Pl.layoutSheet(d2, d2.layouts[0]);
  ok(lsheet.views.length === 2 && lsheet.views[0].clip.length === 4 && near(lsheet.w, 420), 'a sheet: one clipped view per viewport, then the paper');
  const llist = Pl.displayList(d2, lsheet);
  const frameDrawn = llist.views[1].strokes.some((s) => s.prims.some((q) => q.k === 'L' && near(Math.abs(q.x2 - q.x1), 390, 1e-6)));
  ok(!frameDrawn && llist.views[0].strokes.length > 0, 'the viewport frame does not plot; the model inside it does');
  const lp = await Pl.toPdf(llist);
  const info = await pdfCheck(lp.bytes, 'layout plot');
  if (info) ok(/1190\.55 x 841\.89/.test(info), 'the layout plots on A3 (1190.55 × 841.89 pt)');
}

// ---------------------------------------------------------------------------
section('DXF round trip');
/** A DWG → the drawing model, through the app's reader (cc-dwg's readDwg in dwg/), as cadcraft.js reads it. */
async function readModel(bytes) {
  const { readDwg } = await load('dwg/read.js');
  try { return readDwg(bytes); } catch { return null; }
}

{
  const doc = new Doc();
  doc.addLayer({ name: 'A-WALL ext', color: 1 });
  doc.addLayer({ name: 'Off layer', color: 3, on: false });
  doc.blocks.set('DoorTag', { name: 'DoorTag', base: { x: 0, y: 0 }, entities: [{ type: 'circle', layer: '0', color: 0, cx: 0, cy: 0, r: 1 }] });
  doc.change('seed', () => {
    doc.add({ type: 'line', layer: 'A-WALL ext', x1: 0, y1: 0, x2: 100, y2: 0 });
    doc.add({ type: 'circle', x: 0, cx: 50, cy: 50, r: 10, color: '#3366cc' });
    doc.add({ type: 'arc', cx: 0, cy: 0, r: 20, a0: 0.1, a1: 2.5 });
    doc.add({ type: 'poly', closed: true, pts: [{ x: 0, y: 0, b: 0.5 }, { x: 10, y: 0, b: 0 }, { x: 10, y: 10, b: 0 }] });
    doc.add({ type: 'text', x: 1, y: 2, h: 2.5, rot: 0.5, s: 'Détail 1 ⌀20 50°', ha: 'center', va: 'middle' });
    doc.add({ type: 'text', x: 1, y: 20, h: 2, rot: 0, s: 'Two\nlines', ha: 'left', va: 'top' });
    doc.add({ type: 'insert', block: 'DoorTag', x: 5, y: 5, sx: 2, sy: 2, rot: 0, color: 5 });
    doc.add({ type: 'point', x: 7, y: 7 });
    doc.add({ type: 'ellipse', cx: 0, cy: 0, mx: 10, my: 0, ratio: 0.5, t0: 0, t1: G.TAU });
  });
  const { text, report } = writeDxf(doc);
  ok(text.includes('AC1009') && text.trim().endsWith('EOF'), 'writes R12 with an EOF');
  ok(text.includes('\nA-WALL_EXT\r') && report.notes.some((n) => n.includes('changed to fit R12')), 'layer names made R12-safe and reported');
  ok(!/[^\x00-\x7f]/.test(text), 'output is plain ASCII (non-ASCII as \\U+)');
  ok(report.notes.some((n) => n.includes('ellipse')) && report.notes.some((n) => n.includes('Multi-line')), 'lossy conversions are reported');
  const back = readDxf(text);
  const types = back.entities.map((e) => e.type).sort().join(',');
  ok(types === 'arc,circle,insert,line,point,poly,poly,text,text,text', 'every entity comes back', types);
  const t = back.entities.find((e) => e.type === 'text' && e.s.startsWith('D'));
  ok(t && t.s === 'Détail 1 ⌀20 50°' && t.ha === 'center' && t.va === 'middle' && near(t.x, 1) && near(t.rot, 0.5), 'text, symbols and justification survive', JSON.stringify(t));
  const arcB = back.entities.find((e) => e.type === 'arc');
  ok(near(arcB.a0, 0.1) && near(arcB.a1, 2.5), 'arc angles survive');
  const polyB = back.entities.find((e) => e.type === 'poly' && e.closed);
  ok(polyB && near(polyB.pts[0].b, 0.5), 'bulges survive');
  ok(back.layers.find((l) => l.name === 'OFF_LAYER')?.on === false, 'layer off state survives');
  ok(back.blocks.length === 1 && back.blocks[0].entities[0].color === 0, 'block with BYBLOCK colour survives');
  const two = back.entities.filter((e) => e.type === 'text' && (e.s === 'Two' || e.s === 'lines'));
  ok(two.length === 2 && two[0].y > two[1].y, 'multi-line text saved as lines top to bottom');

  // A second program's view of the same file: ezdxf's recover + audit (strict about R12).
  const audit = ezdxfAudit(text);
  if (audit) {
    ok(audit.errors === 0, 'ezdxf audit: no errors', JSON.stringify(audit));
    ok(audit.counts.LINE === 1 && audit.counts.INSERT === 1 && audit.counts.TEXT === 3 && audit.counts.POLYLINE === 2, 'ezdxf sees every entity', JSON.stringify(audit.counts));
  } else console.log('  (ezdxf not set up — see the header; skipping the second-reader check)');
}
{
  // dimensions, blocks and two layouts through R12 and back
  const { doc, type, host, click } = harness();
  doc.meta.units = 'millimeters';
  await type('REC', '0,0', '200,100');
  await type('C', '100,50', '30');
  await type('DLI', '0,0', '200,0', '100,-20');
  await type('DAL', '0,0', '200,100', '80,80');
  await type('DRA'); await click(130, 50); await type('160,80');
  await type('DAN', '', '0,0', '200,0', '200,100', '50,10');
  await type('C', '500,0', '5');
  host.selection = new Set([doc.all().pop().id]);
  await type('B', 'Bolt Ø10', '500,0');
  await type('I', 'Bolt Ø10', '600,0');
  await type('DIMTXT', '3.5');
  await type('DLI', '500,0', '600,0', '550,30');
  await type('LAYOUT'); await type('LAYOUT');
  doc.setSpace(doc.layouts[1]);
  doc.change('rename', () => doc.setLayouts(doc.layouts.map((l, i) => (i === 1 ? { ...l, name: 'Détails 2' } : l))));
  doc.setSpace(null);
  const dims = doc.all().filter((e) => e.type === 'dim');
  ok(dims.length === 5, 'set up: five dimensions', dims.length);
  const { text, report } = writeDxf(doc);
  ok(report.notes.some((n) => n.includes('R12 holds one layout') && n.includes('CCLAYOUT_2')), 'the save says where the second layout went', report.notes.join(' / '));
  ok(!report.notes.some((n) => /hatch/.test(n)), 'arrowheads are written as SOLIDs, not hatch outlines', report.notes.join(' / '));
  const back = readDxf(text);
  const bd = back.entities.filter((e) => e.type === 'dim');
  ok(bd.length === 5 && bd.every((d) => d.block && d.block.startsWith('*D')), 'every dimension comes back as a dimension, with its geometry block');
  const meas = (list) => list.map((d) => Dm.formatMeasure(d)).sort().join(' ');
  ok(meas(bd) === meas(dims), 'and measures the same', meas(bd) + ' vs ' + meas(dims));
  const big = bd.find((d) => near(Dm.dimMeasure(d), 100));
  ok(big && big.st.txt === 3.5 && big.st.dec === 2, 'per-dimension style (text height 3.5) survives as an override', JSON.stringify(big?.st));
  ok(back.layouts.length === 2 && back.layouts[0].name === 'Layout1' && back.layouts[1].name === 'Détails 2', 'both layouts come back, with their names', back.layouts.map((l) => l.name).join(', '));
  const v0 = back.layouts[0].entities.find((e) => e.type === 'viewport'), o0 = [...doc.layouts[0].entities.values()].find((e) => e.type === 'viewport');
  ok(v0 && near(v0.s, o0.s, 1e-9) && near(v0.cx, o0.cx, 1e-6) && near(v0.cy, o0.cy, 1e-6) && near(v0.w, o0.w), 'the first layout\'s viewport keeps its view and scale (R12 VIEWPORT)');
  const v1 = back.layouts[1].entities.find((e) => e.type === 'viewport');
  ok(v1 && near(v1.s, o0.s, 1e-9) && back.layouts[1].paper.key === 'iso-a3', 'the second layout\'s viewport too (from the CCLAYOUT block)');
  ok(back.layers.find((l) => l.name === 'VIEWPORTS')?.plot === false, 'a layer set not to plot stays so for CadCraft');
  ok(back.blocks.some((b) => b.name === 'BOLT__10') && back.entities.filter((e) => e.type === 'insert' && e.block === 'BOLT__10').length === 2, 'the block and both references survive (name made R12-safe)');
  ok(back.meta.units === 'millimeters', 'drawing units survive');
  const d2 = new Doc(); d2.load(back);
  const again = writeDxf(d2);
  const back2 = readDxf(again.text);
  ok(meas(back2.entities.filter((e) => e.type === 'dim')) === meas(dims) && back2.layouts.length === 2, 'and a second save and open changes nothing');
  const audit = ezdxfAudit(text);
  if (audit) {
    ok(audit.errors === 0, 'ezdxf audit of dimensions and layouts: no errors', JSON.stringify(audit.messages));
    ok(audit.counts.DIMENSION === 5 && audit.paper.VIEWPORT === 2, 'ezdxf sees 5 dimensions and the sheet with its viewport', JSON.stringify([audit.counts, audit.paper]));
    const avp = audit.viewports.find((x) => x.id === 2);
    ok(avp && near(avp.height / avp.view_height, o0.s, 1e-6) && near(avp.view_center[0], o0.cx, 1e-4), 'ezdxf reads the viewport view the same way', JSON.stringify(avp));
    ok(audit.dims.some((d) => d.type === 5) && audit.dims.some((d) => d.type === 4) && audit.dims.some((d) => d.dimtxt === 3.5), 'ezdxf reads the dimension types and the override', JSON.stringify(audit.dims.map((d) => [d.type, d.dimtxt])));
  }
}


{
  // an R2000 DXF made by another program (ezdxf): dimensions, two layouts with paper sizes and a viewport
  const fx = ezdxfFixture();
  if (fx) {
    const r = readDxf(fx);
    const dims = r.entities.filter((e) => e.type === 'dim');
    ok(r.meta.version === 'AC1015' && r.meta.units === 'millimeters', 'R2000 file from another program: version and units');
    // its style EZDXF has DIMLFAC 100 (metres measured in centimetres): the blocks it drew say 20000, 22360.68, R3000 (read since part 2, track P)
    ok(dims.map((d) => Dm.formatMeasure(d)).join(' ') === '20000 22360.68 R3000 26.57°' && dims.every((d) => d.block), 'its four dimensions come in editable, measuring the same as the blocks it drew (its DIMLFAC 100), drawn from their blocks', dims.map((d) => Dm.formatMeasure(d)).join(' '));
    ok(r.layouts.map((l) => l.name + ' ' + l.paper.key + ' ' + l.paper.unit).join(', ') === 'Sheet A iso-a3 mm, Sheet B letter in', 'both layouts, in tab order, with their paper', r.layouts.map((l) => l.name + ' ' + l.paper.key + ' ' + l.paper.unit).join(', '));
    const v = r.layouts[0].entities.find((e) => e.type === 'viewport');
    ok(v && near(v.cx, 100) && near(v.cy, 50) && near(v.s, 0.5) && near(v.w, 200), 'its viewport: view centre and scale (1:2)', JSON.stringify(v));
    ok(r.layers.find((l) => l.name === 'NOPLOT')?.plot === false, 'a layer set not to plot (group 290)');
  } else console.log('  (ezdxf not set up — skipping the R2000 fixture)');
}

{
  // 0.4 (cad-files): the length format, named views, a dimension's format and multileaders survive R12; a pattern
  // HATCH from a newer DXF keeps its scale, angle and the file's own pattern lines
  const d = new Doc();
  d.meta.units = 'inches'; d.meta.lunits = 4; d.meta.luprec = 4;
  d.views = [{ name: 'Kitchen', cx: 10, cy: 20, w: 100, h: 50 }];
  d.change('x', () => {
    d.add({ type: 'dim', layer: '0', color: null, kind: 'aligned', p1: { x: 0, y: 0 }, p2: { x: 150, y: 0 }, loc: { x: 0, y: 10 }, text: '', st: { lunit: 4, dec: 4 } });
    d.add({ type: 'mleader', layer: '0', color: 1, pts: [{ x: 0, y: 0 }, { x: 20, y: 20 }], dir: 1, s: 'Check', h: 2.5 });
  });
  const { text, report } = writeDxf(d);
  const r = readDxf(text);
  ok(r.meta.lunits === 4 && r.meta.luprec === 4, 'DXF: the length format ($LUNITS, $LUPREC) comes back', JSON.stringify(r.meta));
  ok(r.views?.length === 1 && r.views[0].name === 'KITCHEN' && r.views[0].cx === 10 && r.views[0].w === 100, 'DXF: the named view comes back (VIEW table; R12 names are capitals)', JSON.stringify(r.views));
  const dm = r.entities.find((e) => e.type === 'dim');
  ok(dm?.st.lunit === 4 && Dm.formatMeasure(dm) === `12'-6"`, 'DXF: the dimension keeps its feet-and-inch format', JSON.stringify(dm?.st));
  ok(report.notes.some((n) => /multileader/.test(n)) && r.entities.some((e) => e.type === 'text' && e.s === 'Check') && r.entities.some((e) => e.type === 'poly' && e.color === 1),
    'DXF: a multileader is saved as what it draws, on its colour, and said', report.notes.join(' | '));
  const hatchDxf = ['0', 'SECTION', '2', 'ENTITIES', '0', 'HATCH', '8', '0', '2', 'ANSI31', '70', '0', '71', '0', '91', '1', '92', '2', '72', '0', '73', '1', '93', '4',
    '10', '0', '20', '0', '10', '10', '20', '0', '10', '10', '20', '10', '10', '0', '20', '10', '97', '0', '75', '0', '76', '1', '52', '30', '41', '2', '77', '0', '78', '1',
    '53', '75', '43', '0', '44', '0', '45', '-6.1336', '46', '1.6435', '79', '0', '98', '0', '0', 'ENDSEC', '0', 'EOF'].join('\n');
  const h = readDxf(hatchDxf).entities.find((e) => e.type === 'hatch');
  ok(h && h.pattern === 'ANSI31' && h.pscale === 2 && near(h.pangle, Math.PI / 6) && h.patlines?.length === 1 && near(h.patlines[0].angle, 75) && near(h.patlines[0].dy, 6.35, 1e-3) && near(h.patlines[0].dx, 0, 1e-3),
    'DXF: a pattern HATCH keeps its scale, angle and own pattern lines (offset turned back to along / across)', JSON.stringify(h && { pscale: h.pscale, pangle: h.pangle, patlines: h.patlines }));
}

function ezdxfFixture() {
  const py = path.join(ROOT, 'tools/cadcraft-test/venv/bin/python');
  if (!fs.existsSync(py)) return null;
  const f = path.join(os.tmpdir(), 'cadcraft-fixture-' + process.pid + '.dxf');
  try { execFileSync(py, ['-I', path.join(ROOT, 'tools/cadcraft-test/fixture.py'), f]); return fs.readFileSync(f, 'utf8'); } finally { if (fs.existsSync(f)) fs.unlinkSync(f); }
}

// ---------------------------------------------------------------------------
function ezdxfAudit(text) {
  const py = path.join(ROOT, 'tools/cadcraft-test/venv/bin/python');
  if (!fs.existsSync(py)) return null;
  const f = path.join(os.tmpdir(), 'cadcraft-test-' + process.pid + '.dxf');
  fs.writeFileSync(f, text);
  try {
    const out = execFileSync(py, ['-I', path.join(ROOT, 'tools/cadcraft-test/audit.py'), f], { encoding: 'utf8' });
    return JSON.parse(out);
  } finally { fs.unlinkSync(f); }
}

// ---------------------------------------------------------------------------
section('Attributes');
const At = await load('attrs.js');
const { walk } = await load('walk.js');
const { describe } = await load('commands.js');
function drawn(doc, ents) { const t = []; walk(doc, ents, { stroke() {}, fill() {}, point() {}, text(c, e) { t.push(e); } }); return t; }
function tagBlock(doc) {
  const T = (x, y, extra = {}) => ({ x, y, h: 2, rot: 0, ha: 'center', va: 'middle', layer: '0', ...extra });
  doc.change('seed', () => doc.defineBlock({
    name: 'Tag', base: { x: 0, y: 0 }, entities: [{ type: 'circle', layer: '0', color: 0, cx: 0, cy: 0, r: 5 }],
    attdefs: [
      At.attdef(T(0, 0), { tag: 'item', prompt: 'Item number', def: '?' }),
      At.attdef(T(0, -8, { ha: 'left', va: 'baseline' }), { tag: 'MAKER', prompt: 'Maker', def: 'Acme', invisible: true }),
      At.attdef(T(0, 8, { rot: Math.PI / 2 }), { tag: 'KIND', prompt: '', def: 'TAG', constant: true }),
      At.attdef(T(6, 0), { tag: 'NOTE', prompt: 'Note', def: '', preset: true }),
    ],
  }));
}
{
  const { doc, type, log, host } = harness();
  tagBlock(doc);
  ok(doc.blocks.get('Tag').attdefs.length === 4 && doc.blocks.get('Tag').attdefs[0].tag === 'ITEM', 'block keeps its attribute definitions (tags upper case)');
  await type('I', 'Tag', 'R', '90', '100,50', '7', '');
  const ins = doc.all().pop();
  ok(ins?.type === 'insert' && ins.attrs.ITEM === '7' && ins.attrs.MAKER === 'Acme' && ins.attrs.NOTE === '' && !('KIND' in ins.attrs), 'INSERT asks for the values (Enter keeps the default; preset and constant ones are not asked)', JSON.stringify(ins?.attrs));
  ok(doc.undoStack.length === 2, 'INSERT with attributes is one undo step', doc.undoStack.length);
  const t = drawn(doc, [ins]);
  ok(t.length === 2 && t.some((x) => x.s === '7' && nearPt(x, 100, 50)) && t.some((x) => x.s === 'TAG' && nearPt(x, 92, 50)) && !t.some((x) => x.s === 'Acme'), 'walk draws visible values where the definitions put them (rotated with the reference); invisible and empty ones are not drawn', JSON.stringify(t.map((x) => [x.s, x.x, x.y])));
  const b = G.entityBounds(ins, doc.blocks);
  ok(b.maxX > 104 && host.pickAt({ x: 100, y: 50 }) === ins.id, 'attribute text counts for picking and bounds');
  const ex = G.explodeEntity(ins, doc.blocks);
  ok(ex.filter((e) => e.type === 'text').map((e) => e.s).sort().join(',') === '7,TAG', 'EXPLODE turns visible attributes into text with their values');
  log.length = 0;
  host.selection = new Set([ins.id]);
  await type('LI');
  ok(log.some((l) => l.includes('ITEM = 7')) && log.some((l) => l.includes('MAKER = Acme') && l.includes('invisible')) && log.some((l) => l.includes('KIND = TAG') && l.includes('constant')) && describe(ins).includes('3 attributes'), 'LIST shows every attribute', log.join(' / '));
  // a value edit as the Properties panel makes it: one undo step
  doc.change('ATTRIBUTE', () => doc.update(ins.id, { ...doc.get(ins.id), attrs: { ...ins.attrs, ITEM: '12' } }));
  ok(doc.get(ins.id).attrs.ITEM === '12' && drawn(doc, [doc.get(ins.id)]).some((x) => x.s === '12'), 'an edited value draws');
  doc.undo();
  ok(doc.get(ins.id).attrs.ITEM === '7', 'and is one undo step');
  // MOVE / MIRROR keep the attributes on the reference
  host.selection = new Set([ins.id]);
  await type('MI', '0,0', '0,1', 'Y');
  const mi = doc.all().pop();
  const mt = drawn(doc, [mi]).find((x) => x.s === '7');
  ok(mi.attrs.ITEM === '7' && mt && nearPt(mt, -100, 50) && Math.sin(mt.rot) > 0.99, 'MIRROR keeps the attributes, readable (reading up, not down)', JSON.stringify(mt));
}
{
  // DXF R12: ATTDEF in the block, ATTRIB + SEQEND after each INSERT, and back
  const doc = new Doc();
  doc.meta.units = 'millimeters';
  tagBlock(doc);
  doc.change('seed', () => {
    doc.add({ type: 'insert', block: 'Tag', x: 10, y: 20, sx: 1, sy: 1, rot: 0, attrs: { ITEM: '1', MAKER: 'Acme “Pro” é', NOTE: '' } });
    doc.add({ type: 'insert', block: 'Tag', x: 50, y: 20, sx: -2, sy: 2, rot: 0.3, attrs: { ITEM: '2', MAKER: 'Other', NOTE: 'n' } });
    doc.add({ type: 'insert', block: 'Tag', x: 90, y: 20, sx: 1, sy: 1, rot: 0, attrs: { ITEM: '3', MAKER: 'Moved', NOTE: '' }, attloc: { ITEM: { x: 12, y: 3, h: 3, rot: 0, ha: 'left', va: 'baseline', wf: 1, layer: '0', color: 1 } } });
  });
  const { text } = writeDxf(doc);
  ok(/\n\s*ATTDEF\r/.test(text) && (text.match(/\n\s*ATTRIB\r/g) || []).length === 9 && (text.match(/\n\s*SEQEND\r/g) || []).length === 3, 'R12: 4 ATTDEFs, 9 ATTRIBs (every value, empty ones too), a SEQEND per reference');
  const back = readDxf(text);
  const bb = back.blocks.find((b) => b.name === 'TAG');
  const defs = (bb?.attdefs || []).map((d) => [d.tag, d.prompt, d.def, !!d.invisible, !!d.constant, !!d.preset].join('|')).join(' ');
  ok(defs === 'ITEM|Item number|?|false|false|false MAKER|Maker|Acme|true|false|false KIND||TAG|false|true|false NOTE|Note||false|false|true', 'definitions come back: tag, prompt, default, invisible, constant, preset', defs);
  ok(bb && near(bb.attdefs[2].rot, Math.PI / 2) && bb.attdefs[0].ha === 'center' && bb.attdefs[0].va === 'middle', 'definition position, rotation and justification come back');
  const ins = back.entities.filter((e) => e.type === 'insert');
  ok(ins.length === 3 && ins[0].attrs.MAKER === 'Acme “Pro” é' && ins[1].attrs.NOTE === 'n' && ins.every((e) => e.attrs.ITEM), 'values come back (non-ASCII too)', JSON.stringify(ins.map((e) => e.attrs)));
  ok(!ins[0].attloc && !ins[1].attloc, 'attributes where their definition puts them need no extra position (mirrored and turned references too)', JSON.stringify(ins[1].attloc));
  ok(ins[2].attloc?.ITEM && near(ins[2].attloc.ITEM.x, 12) && near(ins[2].attloc.ITEM.h, 3) && ins[2].attloc.ITEM.color === 1 && !ins[2].attloc.MAKER, 'a moved attribute keeps its own place and colour', JSON.stringify(ins[2].attloc));
  ok(!back.entities.some((e) => e.type === 'text'), 'attributes are not turned into loose text any more');
  const d2 = new Doc(); d2.load(back);
  const t1 = drawn(doc, doc.all()).map((x) => x.s + '@' + x.x.toFixed(4) + ',' + x.y.toFixed(4)).sort().join(' ');
  const t2 = drawn(d2, d2.all()).map((x) => x.s + '@' + x.x.toFixed(4) + ',' + x.y.toFixed(4)).sort().join(' ');
  ok(t1 === t2, 'the reopened drawing draws the same attribute text in the same places', t1 + ' vs ' + t2);
  ok(writeDxf(d2).text === text.replace(/\n\s*2\r\nTag\r/g, (m) => m), 'and a second save writes the same file', '');
  const au = ezdxfAudit(text);
  if (au) {
    ok(au.errors === 0, 'ezdxf audit of attributes: no errors', JSON.stringify(au.messages));
    const a0 = au.attribs.find((x) => x.attribs.some((a) => a[1] === '1'));
    ok(au.attribs.length === 3 && a0 && a0.attribs.map((a) => a[0]).join(',') === 'ITEM,MAKER,NOTE' && a0.attribs.find((a) => a[0] === 'MAKER')[2] === true, 'ezdxf reads each reference\'s ATTRIBs (tags, invisible flag)', JSON.stringify(au.attribs));
    ok(JSON.stringify(au.attdefs.TAG?.map((a) => [a[0], a[3]])) === JSON.stringify([['ITEM', 0], ['MAKER', 1], ['KIND', 2], ['NOTE', 8]]), 'ezdxf reads the block\'s ATTDEFs and flags', JSON.stringify(au.attdefs));
  } else console.log('  (ezdxf not set up — skipping the attribute audit)');
}

// ---------------------------------------------------------------------------
section('INSERT from a file');
const Bc = await load('blockcopy.js');
function fileHarness(src, fileName, extra = {}) {
  const h = harness();
  h.host.pickDrawing = async () => ({ drawing: src, fileName });
  Object.assign(h.host, extra);
  return h;
}
{
  // a DXF with a block that nests another, written by CadCraft
  const s = new Doc();
  s.meta.units = 'millimeters';
  s.addLayer({ name: 'Furniture', color: 3 });
  s.change('seed', () => {
    s.defineBlock({ name: 'Leg', base: { x: 0, y: 0 }, entities: [{ type: 'circle', layer: 'Furniture', color: 0, cx: 0, cy: 0, r: 1 }] });
    s.defineBlock({ name: 'Chair', base: { x: 0, y: 0 }, entities: [{ type: 'poly', layer: 'Furniture', color: null, closed: true, pts: [{ x: -20, y: -20, b: 0 }, { x: 20, y: -20, b: 0 }, { x: 20, y: 20, b: 0 }, { x: -20, y: 20, b: 0 }] }, { type: 'insert', layer: '0', block: 'Leg', x: -18, y: -18, sx: 1, sy: 1, rot: 0 }, { type: 'insert', layer: '0', block: 'Leg', x: 18, y: 18, sx: 1, sy: 1, rot: 0 }],
      attdefs: [At.attdef({ x: 0, y: 0, h: 5, ha: 'center', va: 'middle' }, { tag: 'SEAT', prompt: 'Seat number', def: '1' })] });
    s.add({ type: 'line', layer: 'Furniture', x1: 0, y1: 0, x2: 100, y2: 0 });
    s.add({ type: 'insert', layer: '0', block: 'Chair', x: 50, y: 50, sx: 1, sy: 1, rot: 0, attrs: { SEAT: '4' } });
  });
  const src = readDxf(writeDxf(s).text);
  const { doc, type } = fileHarness(src, 'Room parts.dxf');
  await type('I', 'F', 'B', 'chair', '0,0', '');
  ok(doc.blocks.has('CHAIR') && doc.blocks.has('LEG') && doc.blocks.get('CHAIR').attdefs?.length === 1, 'INSERT F, Block: the block and the block nested in it are copied, with its attribute definitions', [...doc.blocks.keys()].join(', '));
  const ins = doc.all().pop();
  ok(ins.block === 'CHAIR' && ins.attrs.SEAT === '1' && doc.layers.has('FURNITURE'), 'it is placed, its attribute asked (default kept), its layer added');
  ok(doc.undoStack.length === 1, 'the copy and the placing are one undo step', doc.undoStack.length);
  doc.undo();
  ok(!doc.blocks.has('CHAIR') && !doc.blocks.has('LEG') && doc.count() === 0, 'undo takes the definitions away again');
  doc.redo();
  // the same again: the names clash
  await type('I', 'F', 'B', 'CHAIR', 'R', '100,0', '2');
  ok(doc.blocks.has('CHAIR (2)') && doc.blocks.has('LEG (2)') && doc.all().pop().block === 'CHAIR (2)' && doc.blocks.get('CHAIR (2)').entities.filter((e) => e.type === 'insert').every((e) => e.block === 'LEG (2)'), 'a clash, Rename: brought in under new names, nested references follow', [...doc.blocks.keys()].join(', '));
  await type('I', 'F', 'B', 'CHAIR', 'K', '200,0', '3');
  ok(doc.all().pop().block === 'CHAIR' && !doc.blocks.has('CHAIR (3)'), 'a clash, Keep existing: this drawing\'s block is used');
  await type('I', 'F', 'W', 'K', '0,100');
  const whole = doc.blocks.get('Room parts');
  ok(whole && whole.entities.length === 2 && doc.all().pop().block === 'Room parts', 'INSERT F, Whole drawing: the model space becomes a block named after the file (its nested blocks clash: Keep)', whole && whole.entities.map((e) => e.type).join(','));
  // units: an inch drawing into a millimetre one goes in at 25.4
  const inch = { ...src, meta: { ...src.meta, units: 'inches' } };
  const h2 = fileHarness(inch, 'inch.dxf');
  h2.doc.meta.units = 'millimeters';
  await h2.type('I', 'F', 'B', 'LEG', '0,0');
  const li = h2.doc.all().pop();
  ok(li && near(li.sx, 25.4) && h2.log.some((l) => l.includes('scale 25.4')), 'drawing units are matched by the insertion scale', JSON.stringify(li));
  // the in-page dialogs, when the host has them
  const h3 = fileHarness(src, 'Room parts.dxf', { chooseBlock: async (f, names) => (names.includes('CHAIR') ? { block: 'CHAIR' } : null), choose: async (o) => (o.buttons.some((b) => b[0] === 'keep') ? 'rename' : 'cancel') });
  h3.doc.change('x', () => h3.doc.defineBlock({ name: 'LEG', base: { x: 0, y: 0 }, entities: [] }));
  await h3.type('I', 'F', '0,0', '');
  ok(h3.doc.blocks.has('LEG (2)') && h3.doc.blocks.get('CHAIR').entities.filter((e) => e.type === 'insert').every((e) => e.block === 'LEG (2)'), 'with the host\'s dialogs: picked block, Rename for the nested clash');
  // anonymous blocks (dimensions) never ask: they get free names
  const p = Bc.planCopy(h3.doc, { blocks: [{ name: '*D1', base: { x: 0, y: 0 }, entities: [] }], entities: [{ type: 'dim', kind: 'linear', block: '*D1' }], meta: {} }, { whole: 'dims.dxf' });
  ok(p.clashes.length === 0 && p.needed.join() === '*D1', 'anonymous blocks are copied without asking');
}
// the public fixture (fixtures/README.md, 0.4 item 0.7): its numbers come from fixtures/facts.json
let kitchenDb = null;
const KITCHEN = path.join(ROOT, 'fixtures/dwg/kitchen-equipment.dwg');
const FACTS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/facts.json'), 'utf8')).dwg['kitchen-equipment.dwg']; } catch { return null; } })();
if (fs.existsSync(KITCHEN) && FACTS) {
  kitchenDb = await readModel(new Uint8Array(fs.readFileSync(KITCHEN)));
  const src = importDwg(kitchenDb, { versionTag: FACTS.version });
  const kcl = src.entities.filter((e) => e.type === 'insert' && e.attrs?.['KCL-ITEM']);
  const allTags = [...src.entities, ...(src.layouts || []).flatMap((l) => l.entities || [])].filter((e) => e.type === 'insert' && e.attrs?.['KCL-ITEM']);
  ok(allTags.length === FACTS.equipment.tags && allTags.every((e) => typeof e.attrs['KCL-MODEL'] === 'string'), 'fixture DWG: the ' + FACTS.equipment.tags + ' KCL item tags come in as attribute values (' + allTags.length + ', ' + kcl.length + ' in the model)');
  ok(!src.entities.some((e) => e.type === 'text' && /^Example Foodservice Co\.$/.test(e.s)), 'fixture DWG: invisible attribute values (the maker) are not loose text');
  const { doc, type, eng } = fileHarness(src, 'kitchen-equipment.dwg');
  doc.meta.units = 'inches';
  await type('I', 'F', 'B', 'BalloonEllipse', '1000,1000', '101');
  for (let k = 0; k < 60 && eng.running; k++) await type('');
  const ins = doc.all().pop();
  const blk = doc.blocks.get('BalloonEllipse');
  ok(blk && blk.attdefs.some((d) => d.tag === 'KCL-ITEM') && ins?.block === 'BalloonEllipse' && ins.attrs['KCL-ITEM'] === '101', 'INSERT F from the fixture DWG: its KCL item tag block, placed with item number 101', JSON.stringify(ins?.attrs).slice(0, 200));
  const t = drawn(doc, [ins]);
  ok(t.some((x) => x.s === '101'), 'the item number draws; the hidden KCL fields do not', t.map((x) => x.s).join(','));
  const { text } = writeDxf(doc);
  const back = readDxf(text);
  ok(back.entities.find((e) => e.type === 'insert')?.attrs['KCL-ITEM'] === '101', 'saved as DXF and read back, the number stays');
  const au = ezdxfAudit(text);
  if (au) ok(au.errors === 0 && au.attribs[0]?.attribs.some((a) => a[0] === 'KCL-ITEM' && a[1] === '101'), 'ezdxf audit of the fixture block: no errors, KCL-ITEM = 101', JSON.stringify(au.messages));
} else console.log('  (no fixture DWG at ' + KITCHEN + ', or no fixtures/facts.json)');

// ---------------------------------------------------------------------------
section('Library items');
const Lp = await load('libplace.js');
const { LibraryClient, feedUrl } = await load('library.js');
const UUID1 = '3f2b8c1e-7d4a-4b6e-9a51-0c2d3e4f5a6b';
function fixtureItem(version = 1, wide = 2286) {
  return {
    format: 'cadcraft-library-item', format_version: 1, uuid: UUID1, version,
    name: 'Generic three-compartment sink, 90 in', kind: 'equipment', category: 'foodservice/sinks', description: 'Fixture', maker: '', model: '',
    ifc: { class: 'IfcFurnishingElement', predefined: 'NOTDEFINED' },
    plan: {
      layers: [{ name: 'EQUIP', color: 7 }],
      entities: [
        { type: 'poly', layer: 'EQUIP', color: null, pts: [[-wide / 2, -381], [wide / 2, -381], [wide / 2, 381], [-wide / 2, 381]], closed: true },
        { type: 'circle', layer: 'EQUIP', color: null, x: 0, y: 0, r: 50 },
        { type: 'arc', layer: 'EQUIP', color: 1, x: 500, y: 0, r: 100, a0: 0, a1: 180 },
        { type: 'line', layer: 'EQUIP', color: null, x1: -wide / 2, y1: 0, x2: wide / 2, y2: 0 },
        { type: 'text', layer: 'EQUIP', color: null, x: 0, y: -300, h: 50, rot: 0, value: 'SINK' },
        { type: 'hatch', layer: 'EQUIP', color: 8, loops: [[0, 0, 10, 0, 10, 10]], solid: true },
        { type: 'weird', layer: 'EQUIP' },
        { type: 'line', layer: 'EQUIP', x1: 'x', y1: 0, x2: 1, y2: 1 },
      ],
    },
    body: { type: 'box', x: -wide / 2, y: -381, z: 0, w: wide, d: 762, h: 914 },
    clearances: [],
    params: { width: wide, depth: 762, height: 914, weight_kg: 0, elec: { volts: '', amps: '' }, plumb: { cw: '1/2', hw: '1/2', dd: '2' }, remarks: 'NSF' },
    source_attrs: {},
    license: { id: 'CC-BY-4.0', holder: 'CadCraft', attribution: '“Generic sink” by CadCraft, CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    provenance: { library: 'librarycraft', item: UUID1, version, sha256: 'ab'.repeat(32), source_file: 'seed.csv', published_at: '2026-10-10T00:00:00Z' },
  };
}
{
  const lib = { item: fixtureItem(1) };
  const { doc, type, host, log } = harness();
  doc.meta.units = 'inches';
  host.library = async () => lib;
  await type('I', 'L', '0,0', '');
  const name = 'LIB_generic-three-compar_v1';
  const blk = doc.blocks.get(name);
  const ins = doc.all().pop();
  ok(blk && ins?.block === name, 'INSERT L: the item becomes block LIB_<slug>_v<version>', [...doc.blocks.keys()].join(', '));
  ok(blk && blk.entities.length === 6 && log.some((l) => l.includes('2 plan objects could not be read')), 'its plan is the definition (unreadable plan objects left out and counted)', blk?.entities.length);
  const pb = G.entityBounds({ ...ins, attrs: {} }, doc.blocks);
  ok(near(pb.maxX - pb.minX, 90, 1e-9) && near(pb.maxY - pb.minY, 30, 1e-9), 'drawn in the drawing\'s units (90 × 30 in from 2286 × 762 mm)', JSON.stringify(pb));
  const a = ins.attrs;
  ok(a['CC-ITEM'] === '1' && a['CC-QTY'] === '1' && a['CC-ITEM-UUID'] === UUID1 && a['CC-ITEM-VER'] === '1' && a['CC-LICENSE'] === 'CC-BY-4.0' && a['CC-ATTRIB'].includes('CC BY 4.0') && a['CC-WIDTH-MM'] === '2286' && a['CC-PLUMB-CW'] === '1/2' && a['CC-REMARKS'] === 'NSF' && !('CC-ELEC-VOLTS' in a), 'the canonical params and library fields are attributes (empty params left out)', JSON.stringify(a).slice(0, 300));
  const defs = blk.attdefs;
  ok(defs.find((d) => d.tag === 'CC-ITEM') && !defs.find((d) => d.tag === 'CC-ITEM').invisible && defs.filter((d) => d.tag !== 'CC-ITEM').every((d) => d.invisible && d.preset), 'CC-ITEM is the visible one; the rest are invisible and not asked');
  ok(drawn(doc, [ins]).map((x) => x.s).sort().join(',') === '1,SINK', 'only the item number (and the plan\'s own text) draws');
  await type('I', 'L', '200,0', '');
  ok(doc.blocks.size === 1 && doc.all().pop().attrs['CC-ITEM'] === '2', 'placed again: the same block, the next item number by default');
  await type('I', 'L', 'R', '90', '400,0', 'K7');
  ok(doc.all().pop().attrs['CC-ITEM'] === 'K7' && near(doc.all().pop().rot, Math.PI / 2), 'R rotates; a typed item number is kept');
  const uses = Lp.libraryUses(doc);
  ok(uses.length === 1 && uses[0].count === 3 && uses[0].numbers.join(',') === '1,2,K7' && uses[0].license === 'CC-BY-4.0', 'library uses: one item, three placements', JSON.stringify(uses));
  const csv = Lp.creditsCsv(uses);
  ok(csv.startsWith('﻿Item numbers,Name') && csv.includes('"“Generic sink” by CadCraft, CC BY 4.0"') && csv.includes(UUID1), 'credits CSV', csv.split('\r\n')[1]);
  ok(Lp.creditsCsv([{ ...uses[0], name: '=HYPERLINK("x")' }]).includes(`"'=HYPERLINK(""x"")"`), 'credits CSV escapes formula-looking cells');
  ok(Lp.creditsText(uses) === 'Item 1, 2, K7: “Generic sink” by CadCraft, CC BY 4.0 (CC-BY-4.0) https://creativecommons.org/licenses/by/4.0/', 'credits text', Lp.creditsText(uses));

  // DXF: the library block and its attributes survive (name made R12-safe)
  const { text } = writeDxf(doc);
  const back = readDxf(text);
  const bu = Lp.libraryUses({ everyEntity: function* () { yield* back.entities; } });
  ok(bu.length === 1 && bu[0].count === 3 && bu[0].attribution === uses[0].attribution && bu[0].uuid === UUID1, 'saved as DXF and read back, the library uses and attribution are the same', JSON.stringify(bu[0]).slice(0, 200));
  const au = ezdxfAudit(text);
  if (au) ok(au.errors === 0 && au.attribs.length === 3 && au.attribs[0].attribs.some((a) => a[0] === 'CC-ITEM-UUID' && a[1] === UUID1 && a[2] === true), 'ezdxf audit of the library block: no errors, invisible CC-ITEM-UUID', JSON.stringify(au.messages));

  // update: version 2 redefines the block; numbers, places and rotation stay
  const before = doc.mark();
  const r = doc.change('LIBRARY UPDATE', () => Lp.updateLibraryBlock(doc, UUID1, 1, fixtureItem(2, 1828.8)));
  const all = doc.all();
  ok(r.count === 3 && all.every((e) => e.block === 'LIB_generic-three-compar_v2' && e.attrs['CC-ITEM-VER'] === '2') && all.map((e) => e.attrs['CC-ITEM']).join(',') === '1,2,K7' && near(all[2].rot, Math.PI / 2), 'update: every reference moves to the version 2 block, keeping item number, place and rotation', JSON.stringify(all.map((e) => [e.block, e.attrs['CC-ITEM']])));
  ok(!doc.blocks.has(name) && near(G.entityBounds({ ...all[0], attrs: {} }, doc.blocks).maxX - G.entityBounds({ ...all[0], attrs: {} }, doc.blocks).minX, 72, 1e-9), 'the old definition goes; the new geometry draws (72 in wide)');
  ok(doc.undoStack.length - before === 1, 'the update is one undo step');
  doc.undo();
  ok(doc.blocks.has(name) && doc.all().every((e) => e.block === name), 'undo brings version 1 back');
  let threw = '';
  try { doc.change('x', () => Lp.updateLibraryBlock(doc, UUID1, 1, { ...fixtureItem(2), uuid: '00000000-0000-4000-8000-000000000000' })); } catch (err) { threw = err.message; }
  ok(/different item/.test(threw), 'an update with another item\'s id is refused');
  // bad items are refused with a sentence
  ok(Lp.itemProblem({}) && Lp.itemProblem({ ...fixtureItem(), format_version: 2 }).includes('version') && Lp.itemProblem({ ...fixtureItem(), uuid: '<script>' }) && Lp.itemProblem(fixtureItem()) === null, 'itemProblem refuses what is not a format 1 item');
  // a unitless drawing takes the item in millimetres and says so
  const h2 = harness();
  h2.host.library = async () => lib;
  await h2.type('I', 'L', '0,0', '');
  ok(h2.log.some((l) => l.includes('no units set')) && near(G.entityBounds({ ...h2.doc.all()[0], attrs: {} }, h2.doc.blocks).maxX, 1143, 1e-9), 'a drawing without units takes the item in millimetres, and says so');
}
{
  // the API client (spec §6) with a stand-in fetch
  const calls = [];
  const fake = async (url, o = {}) => {
    calls.push({ url, o });
    const J = (code, body) => ({ ok: code < 400, status: code, json: async () => body, text: async () => JSON.stringify(body) });
    if (url.includes('/items?')) return J(200, { status: 'success', data: { items: [{ uuid: UUID1, name: 'Sink', version: 1 }, { uuid: 'bad', name: 'x' }], page: 1, per: 48, total: 1 } });
    if (url.endsWith('/updates')) return J(200, { status: 'success', data: { results: [{ uuid: UUID1, version: 1, latest: 2, status: 'newer', change_kinds: ['geometry'], license_changed: false, withdrawn_reason: null }] } });
    if (url.includes('/2/item.json')) return J(451, { status: 'error', message: 'withdrawn' });
    if (url.includes('/1/item.json')) return J(200, fixtureItem(1));
    if (url.endsWith('/uses')) return J(200, { status: 'success', data: { id: 5 } });
    return J(404, { status: 'error', message: 'Not found.' });
  };
  const c = new LibraryClient('/api/v1/library', { token: 'ccu_' + 'a'.repeat(40), fetchFn: fake });
  const r = await c.items({ q: 'sink' });
  ok(r.items.length === 1 && calls[0].url.startsWith('/api/v1/library/items?q=sink') && calls[0].o.headers.Authorization.startsWith('Bearer ccu_'), 'items: query and Bearer; malformed ids dropped');
  const u = await c.updates([{ uuid: UUID1, version: 1 }, { uuid: 'x', version: 1 }]);
  ok(u[0].status === 'newer' && JSON.parse(calls[1].o.body).items.length === 1, 'updates: POST {items:[{uuid, version}]}');
  ok((await c.itemJson(UUID1, 1)).name.startsWith('Generic'), 'item.json download');
  let e451 = ''; try { await c.itemJson(UUID1, 2); } catch (err) { e451 = err.message; }
  ok(/copyright/.test(e451), 'a copyright withdrawal (451) says so');
  await c.registerUse({ uuid: UUID1, version: 1, file_label: 'Kitchen' });
  ok(JSON.parse(calls.pop().o.body).app === 'cadcraft', 'a use is registered for cadcraft');
  const feed = new LibraryClient('https://other.example.org/lib', { token: null, fetchFn: fake });
  await feed.items({});
  ok(!calls.pop().o.headers.Authorization, 'other feeds never get the library token');
  ok(feedUrl('https://x.org/api/lib/?a=1') === 'https://x.org/api/lib' && feedUrl('http://x.org') === null && feedUrl('javascript:alert(1)') === null, 'feed addresses: https only');
  let notFound = ''; try { await c.item(UUID1); } catch (err) { notFound = err.message; }
  ok(notFound === 'Not found.', 'API errors come back as the message');
}
{
  // handoff.js ("Edit in CadCraft" from BimCraft): one module, byte-identical in both apps
  const theirs = path.join(ROOT, 'public_html/assets/apps/bimcraft/dev/handoff.js'), mine = path.join(APP, 'handoff.js');
  if (fs.existsSync(theirs)) ok(fs.existsSync(mine) && fs.readFileSync(theirs).equals(fs.readFileSync(mine)), 'cadcraft handoff.js is byte-identical to bimcraft\'s');
  if (fs.existsSync(mine)) {
    const H = await load('handoff.js');
    ok(H.handoffParam('?handoff=3F2B8C1E-7D4A-4B6E-9A51-0C2D3E4F5A6B&x=1') === '3f2b8c1e-7d4a-4b6e-9a51-0c2d3e4f5a6b', 'handoff id read from the URL');
    ok(H.handoffParam('?handoff=../../etc') === null && H.handoffParam('?x=1') === null, 'a malformed or missing handoff id is ignored');
  }
}
{
  // dwg/: byte-identical copies of the cc-dwg reader and writer files (node tools/dwg-test/writer-sync.mjs cadcraft)
  {
    const { READ_WRITE_FILES: READER_FILES } = await import(pathToFileURL(path.join(ROOT, 'tools/dwg-test/writer-sync.mjs')).href);
    const differ = READER_FILES.filter((f) => !fs.existsSync(path.join(APP, 'dwg', f)) || !fs.readFileSync(path.join(ROOT, 'lib/dwg', f)).equals(fs.readFileSync(path.join(APP, 'dwg', f))));
    const extra = fs.existsSync(path.join(APP, 'dwg')) ? fs.readdirSync(path.join(APP, 'dwg')).filter((f) => f.endsWith('.js') && !READER_FILES.includes(f)) : [];
    ok(!differ.length && !extra.length, 'dwg/ holds byte-identical copies of the ' + READER_FILES.length + ' lib/dwg files the reader and writer need', [...differ.map((f) => 'differs: ' + f), ...extra.map((f) => 'not needed: ' + f)].join(', ') + (differ.length + extra.length ? ' (node tools/dwg-test/writer-sync.mjs cadcraft)' : ''));
    const man = JSON.parse(fs.readFileSync(path.join(APP, 'manifest.json'), 'utf8'));
    const src = ['manifest.json', 'ui.inc', 'cadcraft.js', 'libpanel.js', 'dwg-import.js'].map((f) => fs.readFileSync(path.join(APP, f), 'utf8')).join('\n');
    ok(!man.dwgWasm && !JSON.stringify(man.imports || {}).includes('libredwg') && !/libredwg|dwgWasm|dwg-wasm/i.test(src), 'no LibreDWG left: not in the manifest, the page or the DWG code');
  }
  // libitem.js: CadCraft keeps a byte-identical copy of BimCraft's canonical module
  const canon = path.join(ROOT, 'public_html/assets/apps/bimcraft/dev/libitem.js'), mine = path.join(APP, 'libitem.js');
  if (fs.existsSync(canon)) {
    ok(fs.existsSync(mine) && fs.readFileSync(canon).equals(fs.readFileSync(mine)), 'cadcraft libitem.js is byte-identical to bimcraft\'s');
    if (fs.existsSync(mine)) {
      const Li = await load('libitem.js');
      const clean = fixtureItem(1);
      clean.plan.entities = clean.plan.entities.filter((e) => e.type !== 'weird' && typeof e.x1 !== 'string');
      const v = Li.validateItem(clean);
      ok(v.ok, 'the fixture item passes libitem validateItem', JSON.stringify(v.errors));
      ok(!Li.validateItem(fixtureItem(1)).ok, 'and the one with unreadable plan objects does not (the app still places what it can read)');
      if (kitchenDb) {
        // Files…: the fixture drawing's blocks through the adapter, then placed as a library block
        const r = Li.itemsFromDwg(kitchenDb, { blocks: ['BalloonEllipse'], fileName: 'kitchen-equipment.dwg' });
        const it = r.items[0];
        ok(it && Li.validateItem((() => { const c = { ...it }; delete c._key; return c; })(), { partial: true }).ok, 'libitem itemsFromDwg makes a valid item from the fixture\'s block', JSON.stringify(r.notes).slice(0, 200));
        if (it) {
          const { doc, type, host } = harness();
          doc.meta.units = 'inches';
          host.library = async () => ({ item: { ...it, provenance: { library: 'file', source_file: 'kitchen-equipment.dwg' } } });
          await type('I', 'L', '0,0', '');
          await type('I', 'L', '50,0', '');
          const ins = doc.all();
          ok(ins.length === 2 && ins[0].block === ins[1].block && ins[0].block.startsWith('LIB_') && doc.blocks.get(ins[0].block).entities.length > 0 && ins[1].attrs['CC-ITEM'] === '2', 'an item from a file (no id yet) is placed twice with one block, numbered 1 and 2', JSON.stringify(ins.map((e) => [e.block, e.attrs?.['CC-ITEM']])) + ' ' + [...doc.blocks.keys()].join() + ' ' + doc.blocks.get(ins[0]?.block)?.entities.length);
        }
      }
    }
  } else console.log('  (bimcraft/dev/libitem.js not there yet — copy check skipped)');
}

section('DWG / DXF files');
const files = [];
if (fs.existsSync(DWG)) {
  const st = fs.statSync(DWG);
  if (st.isDirectory()) for (const f of fs.readdirSync(DWG).sort()) { if (/\.(dwg|dxf)$/i.test(f)) files.push(path.join(DWG, f)); }
  else files.push(DWG);
}
for (const f of files) {
  const bytes = new Uint8Array(fs.readFileSync(f));
  const isDxf = /\.dxf$/i.test(f);
  const t0 = Date.now();
  let drawing;
  try {
    if (isDxf) drawing = readDxf(new TextDecoder().decode(bytes));
    else {
      const db = await readModel(bytes);
      if (!db) { ok(false, path.basename(f), 'readDwg could not read it'); continue; }
      drawing = importDwg(db, { versionTag: new TextDecoder().decode(bytes.subarray(0, 6)) });
      // the DWG's closed flag (LWPOLYLINE flag word bit 512, the model's `closed`) must survive the import
      let rawClosed = 0;
      for (const bk of db.blocks) for (const o of bk.entities) if (o.type === 'LWPOLYLINE' && o.closed && (o.flags & 512) && !o.invisible) rawClosed++;   /* hidden = another dynamic-block state */
      const closedPolys = [...drawing.entities, ...[...(drawing.blocks || []), ...(drawing.layouts || [])].flatMap((bk) => [...(bk.entities || [])].map((x) => (Array.isArray(x) ? x[1] : x)))].filter((e) => e.type === 'poly' && e.closed).length;
      if (rawClosed) ok(closedPolys >= rawClosed, path.basename(f) + ': closed lightweight polylines stay closed', closedPolys + ' closed of ' + rawClosed + ' in the file');
    }
  } catch (err) { ok(false, path.basename(f), err.message); continue; }
  const doc = new Doc();
  doc.load(drawing);
  const b = G.emptyBounds();
  let bad = 0;
  for (const e of doc.all()) { const eb = G.entityBounds(e, doc.blocks); if (G.validBounds(eb)) { G.growPt(b, eb.minX, eb.minY); G.growPt(b, eb.maxX, eb.maxY); } if (Object.values(e).some((v) => typeof v === 'number' && !Number.isFinite(v))) bad++; }
  const { text, report } = writeDxf(doc);
  const again = readDxf(text);
  const skipped = Object.entries(drawing.report.skipped).map(([k, v]) => k + '×' + v).join(' ');
  console.log('  ' + path.basename(f).padEnd(22) + String(doc.count()).padStart(6) + ' entities  ' + String(doc.layers.size).padStart(3) + ' layers  ' + String(doc.blocks.size).padStart(4) + ' blocks  ' +
    (drawing.meta.release ? 'AutoCAD ' + drawing.meta.release : drawing.meta.version) + '  ' + (Date.now() - t0) + ' ms' + (skipped ? '  skipped: ' + skipped : '') + (drawing.report.paperSpace ? '  paper space: ' + drawing.report.paperSpace : '') + (doc.layouts.length ? '  layouts: ' + doc.layouts.map((l) => l.name).join(', ') : ''));
  ok(doc.count() > 0, path.basename(f) + ': has model-space entities');
  ok(G.validBounds(b) && Number.isFinite(b.maxX - b.minX), path.basename(f) + ': finite extents');
  ok(bad === 0, path.basename(f) + ': no NaN/Infinity fields', bad + ' bad');
  {
    // the whole model through the clipboard: what a real drawing holds passes the validator and pastes in place
    const Cb = await load('clipboard.js');
    const clip = Cb.makeClip(doc, doc.all().map((e) => e.id));
    const r = Cb.readClip(JSON.stringify(clip));
    const into = new Doc();
    let pasted = 0;
    if (r.clip) into.change('PASTEORIG', () => { pasted = Cb.pasteClip(into, r.clip, 0, 0).ids.length; });
    ok(r.clip && pasted === clip.entities.length && into.undoStack.length === 1, path.basename(f) + ': every model object copies to the clipboard, reads back as valid and pastes in place (one undo step)', r.error || pasted + ' of ' + clip.entities.length);
  }
  const wrote = again.entities.length;
  ok(wrote >= doc.count() * 0.95, path.basename(f) + ': DXF save → re-read keeps the entities', wrote + ' of ' + doc.count() + ' (' + report.notes.join(' ') + ')');
  const au = ezdxfAudit(text);
  if (au) ok(au.errors === 0, path.basename(f) + ': ezdxf audit of the saved DXF', JSON.stringify(au.messages));
  ok(again.layouts.length === Math.min(doc.layouts.length, doc.layouts.length), path.basename(f) + ': its ' + doc.layouts.length + ' layout(s) save and come back', again.layouts.length + ' of ' + doc.layouts.length);
  for (const L of doc.layouts) {
    const pdf = await Pl.toPdf(Pl.displayList(doc, Pl.layoutSheet(doc, L)));
    const info = pdfinfo(pdf.bytes);
    ok(pdf.bytes.length > 300 && (info === null || /Pages:\s+1/.test(info)), path.basename(f) + ': layout "' + L.name + '" plots (' + L.entities.size + ' objects, ' + [...L.entities.values()].filter((e) => e.type === 'viewport').length + ' viewports, ' + pdf.bytes.length + ' bytes)', info);
  }
}
if (!files.length) console.log('  (no DWG/DXF files at ' + DWG + ')');

// DWG saving, read back by three other programs' readers (LibreDWG, libdxfrw, ODA) and by CadCraft again
if (!args.includes('--no-readers') && fs.existsSync(path.join(APP, 'dwg-save.js'))) {
  console.log('\n== Save as DWG, read back by other programs');
  const { runDwgSaveChecks } = await import(pathToFileURL(path.join(ROOT, 'tools/cadcraft-test/dwg-save-check.mjs')).href);
  const r = await runDwgSaveChecks({ ok, root: ROOT, app: APP, samples: DWG, verbose: VERBOSE });
  if (r.skipped) console.log('  skipped: ' + r.skipped);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
