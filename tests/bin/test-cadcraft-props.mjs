#!/usr/bin/env node
/* SPDX-License-Identifier: Apache-2.0 */
/**
 * test-cadcraft-props.mjs — the Properties panel's DOM-free modules (0.4 track P; session cad-props):
 *   propexpr.js   typed values, lengths with units, angles, expressions, refusals (P.4)
 *   propdefs.js   groups, Varies, one undo step for many objects, every type's fields, measured values (P.2, P.3, P.5, P.7, P.8)
 *   dimstyle.js   dimension text by style (units, zeros, alternate units, tolerances) and the styled parts (P.6)
 *   propcmds.js   the commands it installs
 * Usage: node bin/test-cadcraft-props.mjs [--build dev|x.y] [--verbose]
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BUILD = opt('--build', 'dev');
const VERBOSE = args.includes('--verbose');
const APP = path.join(ROOT, 'public_html/assets/apps/cadcraft', BUILD);
const load = (f) => import(pathToFileURL(path.join(APP, f)).href);

const I18n = await load('i18n.js');
I18n.init({ strings: JSON.parse(fs.readFileSync(path.join(APP, 'lang/en.json'), 'utf8')) });
const { Doc } = await load('doc.js');
const X = await load('propexpr.js');
const P = await load('propdefs.js');
const DS = await load('dimstyle.js');
const { installProps } = await load('propcmds.js');

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); } };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const section = (s) => console.log('\n' + s);

function drawing(list) {
  const doc = new Doc();
  let ids;
  doc.change('setup', () => { ids = list.map((e) => doc.add({ layer: '0', ...e }).id); });
  return [doc, ids];
}
const def = (key, ents, ctx = {}) => {
  const groupKey = new Set(ents.map((e) => e.type)).size === 1 ? ents[0].type : 'all';
  return P.defsFor(groupKey, ents, ctx).find((d) => d.key === key);
};
const val = (r) => (r.ok ? r.value : 'ERR ' + r.error);

// ---------------------------------------------------------------------------------------------------- P.4
section('propexpr.js — typed values and expressions (P.4)');
{
  const mm = { lunits: 2, units: 'millimeters' }, arch = { lunits: 4, units: 'inches' }, bare = { lunits: 2, units: '' }, archBare = { lunits: 4, units: '' };
  const L = (s, c) => X.readValue(s, 'len', c);
  ok(val(L('150', mm)) === 150, 'plain length');
  ok(val(L('-2.5', mm)) === -2.5, 'negative length');
  ok(val(L('1/4', mm)) === 0.25, 'fraction 1/4');
  ok(val(L('6-1/2', mm)) === 6.5, 'mixed number 6-1/2');
  ok(val(L("12'6\"", arch)) === 150, "12'6\" in an architectural drawing = 150 in");
  ok(val(L("12'-6 1/2\"", arch)) === 150.5, "12'-6 1/2\"");
  ok(near(val(L("3'6\"", mm)), 1066.8), "3'6\" in a millimeter drawing = 1066.8", String(val(L("3'6\"", mm))));
  ok(near(val(L('900mm', arch)), 900 / 25.4), '900mm in an inch drawing', String(val(L('900mm', arch))));
  ok(near(val(L('3.5m', mm)), 3500), '3.5m = 3500 mm');
  ok(near(val(L('2ft', archBare)), 24), 'unitless architectural drawing reads feet as inches');
  ok(!L("3'6\"", bare).ok && /no units/.test(L("3'6\"", bare).error), 'a unit in a unitless decimal drawing is refused, with the reason', L("3'6\"", bare).error);
  ok(val(L('=2*45', mm)) === 90, '=2*45');
  ok(val(L('2*45', mm)) === 90, '2*45 without "=" is read as an expression');
  ok(near(val(L("=3'6\"/2", arch)), 21), "=3'6\"/2 in inches = 21");
  ok(near(val(L('=sqrt(2)*100', mm)), 141.42135623730951), '=sqrt(2)*100');
  ok(near(val(L('=100mm + 5cm', mm)), 150), '=100mm + 5cm');
  ok(near(val(L("=3'-6\" + 6\"", arch)), 48), "=3'-6\" + 6\"");
  const A = (s) => X.readValue(s, 'ang', {});
  ok(val(A('45')) === 45, 'angle 45');
  ok(near(val(A("45d30'")), 45.5), "45d30'");
  ok(near(val(A("45°30'15\"")), 45 + 30 / 60 + 15 / 3600), "45°30'15\"");
  ok(near(val(A('0.5r')), 0.5 * 180 / Math.PI), '0.5r is radians');
  ok(near(val(A('100g')), 90), '100g is grads');
  ok(near(val(A('=atan(1)')), 45), '=atan(1)');
  ok(near(val(A("=45d30' * 2")), 91), "=45d30' * 2");
  ok(near(val(A('-15')), -15), 'negative angle');
  ok(val(X.readValue('3', 'int', {})) === 3 && !X.readValue('3.5', 'int', {}).ok, 'whole numbers only where asked');
  for (const bad of ['', 'abc', '=', '=1/0', '=foo+1', '12..5', '=constructor', '=__proto__']) {
    const r = X.readValue(bad, 'len', mm);
    ok(!r.ok && typeof r.error === 'string' && r.error.length > 3, 'refused: ' + JSON.stringify(bad), r.ok ? 'read as ' + r.value : '');
  }
  ok(!X.readValue('0', 'len', { ...mm, gt0: true }).ok, 'zero refused where the value must be above zero (never saved as 0)');
  ok(!X.readValue('-1', 'num', { min: 0 }).ok && !X.readValue('9', 'int', { max: 8 }).ok, 'min / max');
  ok(X.editText(150.5) === '150.5' && X.editText(1 / 3) === '0.333333333333' && X.editText(-0) === '0' && X.editText(1234567.891) === '1234567.891', 'full precision for editing', [X.editText(1 / 3), X.editText(1234567.891)].join(' '));
  ok(X.mmPerUnit({ units: 'feet' }) === 304.8 && X.mmPerUnit({ paper: 'in' }) === 25.4 && X.mmPerUnit(bare) === null, 'mmPerUnit');
  ok(val(L('25.4', { lunits: 2, paper: 'mm' })) === 25.4, 'on a sheet lengths read in paper units');
}

// ---------------------------------------------------------------------------------------------------- P.2
section('propdefs.js — groups, Varies, one undo step (P.2)');
{
  const lines = Array.from({ length: 8 }, (_, i) => ({ type: 'line', x1: i, y1: 0, x2: i, y2: 10 }));
  const dims = Array.from({ length: 40 }, (_, i) => ({ type: 'dim', kind: 'linear', p1: { x: 0, y: i * 10 }, p2: { x: 25.4 + i, y: i * 10 }, loc: { x: 0, y: i * 10 + 5 }, rot: 0, text: '', st: { dec: 2 } }));
  const [doc, ids] = drawing([...lines, ...dims, { type: 'circle', cx: 0, cy: 0, r: 5 }]);
  const all = ids.map((id) => doc.get(id));
  const groups = P.groupsOf(all);
  ok(groups.map((g) => g.key + ':' + g.n).join(' ') === 'all:49 line:8 dim:40 circle:1', 'groups All (49), Line (8), Dimension (40), Circle (1)', groups.map((g) => g.key + ':' + g.n).join(' '));
  ok(P.groupLabel(groups[0]) === 'All (49)' && P.groupLabel(groups[1]) === 'Line (8)', 'group labels', P.groupLabel(groups[1]));
  const allDefs = P.defsFor('all', all, { doc });
  ok(allDefs.every((d) => d.sec === 'general') && allDefs.some((d) => d.key === 'layer') && !allDefs.some((d) => d.key === 'th'), 'All shows General only, thickness only when every type has it');
  const dimEnts = all.filter((e) => e.type === 'dim');
  const dec = def('dim.dec', dimEnts, { doc });
  ok(dec && P.valueOf(dec, dimEnts) === 2, 'decimals shared by 40 dimensions');
  const undoBefore = doc.undoStack.length;
  const r = P.applyValue(doc, dec, dimEnts, 4, { doc });
  ok(r.ok && r.changed === 40, 'decimals = 4 on 40 dimensions', JSON.stringify(r));
  ok(doc.undoStack.length === undoBefore + 1, 'one undo step');
  ok(dimEnts.every((e) => doc.get(e.id).st.dec === 4), 'every dimension changed');
  doc.undo();
  ok(dimEnts.every((e) => doc.get(e.id).st.dec === 2), 'one undo puts all 40 back');
  const lineEnts = all.filter((e) => e.type === 'line');
  const sz = def('start.z', lineEnts);
  P.applyValue(doc, sz, lineEnts, 12.5, { doc });
  ok(lineEnts.every((e) => doc.get(e.id).z1 === 12.5), 'Start Z on every line');
  const cur = lineEnts.map((e) => doc.get(e.id));
  ok(P.valueOf(def('start.z', cur), cur) === 12.5 && P.valueOf(def('start.x', cur), cur) === P.VARIES, 'shared value shows, differing values are Varies');
  doc.setLayer('locked', { locked: true });
  doc.change('move', () => doc.update(cur[0].id, { ...doc.get(cur[0].id), layer: 'locked' }));
  const r2 = P.applyValue(doc, def('color', cur), cur.map((e) => doc.get(e.id)), 1, { doc });
  ok(r2.ok && r2.changed === 7 && r2.locked === 1, 'objects on a locked layer are left alone and counted', JSON.stringify(r2));
  const circ = [doc.get(ids[ids.length - 1])];
  const before = doc.undoStack.length;
  const r3 = P.applyValue(doc, def('r', circ), circ, -5, { doc });
  ok(doc.get(circ[0].id).r === -5 || doc.undoStack.length === before + 1, 'descriptors trust the reader; propexpr refuses <= 0 first (gt0 flag set)', String(def('r', circ).gt0));
  doc.undo();
  const mixed = [doc.get(ids[0]), doc.get(ids[ids.length - 1])];
  const throwDef = { key: 'boom', sec: 'general', kind: 'num', get: () => 0, set: (e) => { if (e.type === 'circle') throw new P.PropError('props.err.zero'); return { ...e, color: 3 }; } };
  const st = doc.undoStack.length;
  const r4 = P.applyValue(doc, throwDef, mixed, 1, { doc });
  ok(!r4.ok && /cannot be 0/.test(r4.error) && doc.undoStack.length === st && doc.get(ids[0]).color !== 3, 'a refused value rolls the whole change back', JSON.stringify(r4));
}

// ---------------------------------------------------------------------------------------------------- P.3, P.5, P.7, P.8
section('propdefs.js — every type (P.3, P.5, P.7, P.8)');
{
  const poly = { type: 'poly', closed: true, pts: Array.from({ length: 20 }, (_, i) => ({ x: 10 * Math.cos(i * Math.PI / 10), y: 10 * Math.sin(i * Math.PI / 10), b: 0 })) };
  const [doc, ids] = drawing([
    { type: 'line', x1: 0, y1: 0, x2: 3, y2: 4 },
    { type: 'circle', cx: 1, cy: 2, r: 5 },
    { type: 'arc', cx: 0, cy: 0, r: 10, a0: 0, a1: Math.PI / 2 },
    { type: 'ellipse', cx: 0, cy: 0, mx: 10, my: 0, ratio: 0.5, t0: 0, t1: 2 * Math.PI },
    poly,
    { type: 'text', x: 0, y: 0, h: 2.5, s: 'Hello', ha: 'left', va: 'baseline' },
    { type: 'insert', block: 'B', x: 0, y: 0, sx: 2, sy: 2, rot: 0 },
    { type: 'hatch', solid: false, pattern: 'ANSI31', pscale: 1, pangle: 0, loops: [[0, 0, 10, 0, 10, 10, 0, 10, 0, 0]] },
    { type: 'point', x: 1, y: 1 },
    { type: 'mleader', pts: [{ x: 0, y: 0 }, { x: 10, y: 10 }], dir: 1, s: 'Note', h: 2.5 },
  ]);
  doc.change('block', () => doc.defineBlock({ name: 'B', base: { x: 0, y: 0 }, entities: [] }));
  const one = (i) => [doc.get(ids[i])];
  const set = (i, key, v, ctx = {}) => { const e = one(i); const d = def(key, e, { doc, ...ctx }); if (!d) return 'no ' + key; const r = P.applyValue(doc, d, e, v, { doc, ...ctx }); return r.ok ? doc.get(ids[i]) : 'ERR ' + r.error; };
  const get = (i, key, ctx = {}) => { const e = one(i); const d = def(key, e, { doc, ...ctx }); return d ? P.valueOf(d, e, { doc, ...ctx }) : 'no ' + key; };
  // line
  ok(get(0, 'len') === 5 && near(get(0, 'ang'), 53.13010235415598) && get(0, 'dz') === 0, 'line: length, angle, delta Z');
  ok(set(0, 'end.z', 7).z2 === 7 && get(0, 'dz') === 7, 'line: End Z → Delta Z');
  ok(near(set(0, 'len', 10).x2, 6), 'line: length keeps the angle');
  const lineDefs = P.defsFor('line', one(0), { doc });
  ok(['start.x', 'start.y', 'start.z', 'end.x', 'end.y', 'end.z'].every((k) => lineDefs.find((d) => d.key === k)?.pt), 'line: X/Y/Z for both points, each with a pick');
  ok(['tr', 'th', 'mat', 'ps', 'url'].every((k) => lineDefs.some((d) => d.key === k)), 'General has transparency, thickness, material, plot style, hyperlink');
  ok(set(0, 'tr', 40).tr === 40 && set(0, 'tr', 'ByBlock').tr === 'ByBlock' && !('tr' in set(0, 'tr', null)), 'transparency 40% / ByBlock / ByLayer (field removed)');
  ok(set(0, 'mat', 'Global').mat === 'Global' && !('mat' in set(0, 'mat', null)), 'material');
  ok(set(0, 'url', ' https://example.com/a ').url === 'https://example.com/a' && !('url' in set(0, 'url', '')), 'hyperlink trimmed; empty removes it');
  ok(get(0, 'ps') === 'ByColor' && !def('ps', one(0)).set, 'plot style read-only ByColor');
  ok(set(0, 'th', 3).th === 3, 'thickness');
  // circle (P.8)
  ok(near(set(1, 'area', 100 * Math.PI).r, 10), 'circle: area sets the radius');
  ok(near(set(1, 'circ', 2 * Math.PI * 3).r, 3), 'circle: circumference sets the radius');
  ok(set(1, 'center.z', -2).z === -2, 'circle: center Z');
  // arc
  ok(near(get(2, 'sweep'), 90) && near(get(2, 'chord'), Math.SQRT2 * 10), 'arc: total angle and chord');
  ok(near(set(2, 'sweep', 180).a1, Math.PI), 'arc: total angle moves the end angle');
  ok(near(set(2, 'chord', 30).r, 15), 'arc: chord scales the radius (half circle: chord = 2r)');
  ok(typeof set(2, 'sweep', 360) === 'string', 'arc: 360° refused');
  // ellipse
  ok(near(set(3, 'major', 20).mx, 20) && near(doc.get(ids[3]).ratio, 0.5), 'ellipse: major radius keeps the ratio');
  ok(near(set(3, 'minor', 5).ratio, 0.25), 'ellipse: minor radius sets the ratio');
  ok(typeof set(3, 'minor', 50) === 'string', 'ellipse: minor above major refused');
  set(3, 'ea0', 30); set(3, 'ea1', 120);
  ok(near(get(3, 'ea0'), 30, 1e-9) && near(get(3, 'ea1'), 120, 1e-9), 'ellipse: start / end angle round-trip as true angles', get(3, 'ea0') + ' ' + get(3, 'ea1'));
  ok(near(set(3, 'axisang', 90).my, 20), 'ellipse: major axis angle');
  // polyline: vertex browser, no 12-vertex limit (P.7)
  ok(get(4, 'count') === '20', 'polyline: 20 vertices');
  ok(near(get(4, 'vertex.x', { vertex: 15 }), poly.pts[15].x), 'polyline: vertex 16 of 20 readable');
  ok(near(set(4, 'vertex.y', 99, { vertex: 15 }).pts[15].y, 99), 'polyline: vertex 16 editable');
  ok(set(4, 'vsw', 0.5, { vertex: 3 }).pts[3].sw === 0.5 && set(4, 'vb', 0.25, { vertex: 3 }).pts[3].b === 0.25, 'polyline: segment width and bulge');
  const gw = set(4, 'gw', 1);
  ok(gw.w === 1 && gw.pts.every((q) => q.sw === undefined), 'polyline: global width clears segment widths');
  ok(set(4, 'z', 4).z === 4, 'polyline: elevation');
  set(4, 'vb', 0, { vertex: 3 });
  set(4, 'vertex.y', poly.pts[15].y, { vertex: 15 });
  const a0 = get(4, 'area');
  const scaled = set(4, 'area', a0 * 4);
  ok(near(Math.abs(P.measure(scaled).area), a0 * 4, 1e-9), 'polyline: area scales about the centre', P.measure(scaled).area + ' vs ' + a0 * 4);
  ok(!P.defsFor('poly', [{ ...poly, closed: false }], { doc }).some((d) => d.key === 'area'), 'open polyline: no area field');
  // text
  ok(near(set(5, 'obl', 15).obl, 15 * Math.PI / 180) && set(5, 'wf', 0.8).wf === 0.8 && set(5, 'ann', true).ann === true && set(5, 'style', 'ROMANS').style === 'ROMANS', 'text: oblique, width factor, annotative, style');
  ok(set(5, 'just', 'center|middle').va === 'middle' && typeof set(5, 's', '   ') === 'string', 'text: justify; empty text refused');
  ok(set(5, 'pos.z', 2).z === 2, 'text: position Z');
  // insert
  ok(get(6, 'us') === P.VARIES || get(6, 'us') === 2, 'block: uniform scale shown', String(get(6, 'us')));
  ok(set(6, 'sz', 3).sz === 3 && get(6, 'us') === P.VARIES, 'block: Z scale; uniform scale Varies when they differ');
  const us = set(6, 'us', 4);
  ok(us.sx === 4 && us.sy === 4 && us.sz === 4, 'block: uniform scale sets X, Y and Z');
  ok(typeof set(6, 'sx', 0) === 'string', 'block: scale 0 refused');
  // hatch
  ok(set(7, 'origin.x', 5).ox === 5 && set(7, 'island', 'outer').island === 'outer' && set(7, 'assoc', true).assoc === true && set(7, 'bg', 3).bg === 3, 'hatch: origin, island style, associative, background');
  ok(!('bg' in set(7, 'bg', 'none')), 'hatch: background none');
  ok(set(7, 'pattern', 'SOLID').solid === true && !P.defsFor('hatch', one(7), { doc }).some((d) => d.key === 'pscale'), 'hatch: solid has no scale');
  // point, mleader
  ok(set(8, 'pos.z', 1).z === 1, 'point: Z');
  ok(set(9, 'dir', '-1').dir === -1 && set(9, 'arrow.x', 3).pts[0].x === 3, 'multileader: text side, arrowhead point');
  // viewport
  const [vdoc, vids] = drawing([]);
  vdoc.change('vp', () => vids.push(vdoc.add({ type: 'viewport', x: 100, y: 100, w: 50, h: 40, cx: 0, cy: 0, s: 1 }).id));
  const vp = [vdoc.get(vids[0])];
  const vset = (k, v) => { P.applyValue(vdoc, def(k, vp, { doc: vdoc }), vp, v, { doc: vdoc }); return vdoc.get(vids[0]); };
  ok(vset('on', false).on === false && !('on' in vset('on', true)) && vset('locked', true).locked === true, 'viewport: on / off, display locked');
  const vv = [vdoc.get(vids[0])];
  const rv = P.applyValue(vdoc, def('vview.x', vv, { doc: vdoc }), vv, 99, { doc: vdoc });
  ok(!rv.ok && /locked/.test(rv.error) && vdoc.get(vids[0]).cx === 0, 'viewport: a display-locked view refuses a new view center');
  // measure
  ok(near(P.measure({ type: 'circle', cx: 0, cy: 0, r: 1 }).area, Math.PI) && P.measure({ type: 'line', x1: 0, y1: 0, x2: 0, y2: 2 }).length === 2, 'measure()');
}

// ---------------------------------------------------------------------------------------------------- P.6
section('dimstyle.js — dimensions, everything (P.6)');
{
  const D = (st, kind = 'linear', text = '') => ({ type: 'dim', kind, text, st });
  const txt = (st, v, kind) => DS.dimStyleText(D(st, kind), v);
  ok(txt({ dec: 2, zin: 0 }, 3.6) === '3.60', 'decimals 2, trailing zeros kept', txt({ dec: 2, zin: 0 }, 3.6));
  ok(txt({ dec: 4, zin: 8 }, 3.6) === '3.6', 'trailing zeros suppressed (the "3.6000" question)');
  ok(txt({ dec: 2, zin: 4 }, 0.5) === '.50', 'leading zero suppressed');
  ok(txt({ dec: 1, rnd: 0.5 }, 3.3) === '3.5', 'round off 0.5', txt({ dec: 1, rnd: 0.5 }, 3.3));
  ok(txt({ dec: 0, lfac: 0.5 }, 100) === '50', 'measurement scale 0.5');
  ok(txt({ dec: 2, zin: 0, dsep: ',' }, 3.6) === '3,60', 'comma decimal separator');
  ok(txt({ dec: 0, pre: '~', suf: ' mm' }, 12) === '~12 mm' && DS.dimStyleText(D({ dec: 0 }, 'radius'), 5) === 'R5' && DS.dimStyleText(D({ dec: 0, pre: 'Rad ' }, 'radius'), 5) === 'Rad 5', 'prefix / suffix; a prefix replaces R');
  ok(txt({ dec: 2, zin: 8, alt: true, altf: 25.4, altd: 1, altu: 2 }, 2) === '2 [50.8]', 'alternate units after the value', txt({ dec: 2, zin: 8, alt: true, altf: 25.4, altd: 1 }, 2));
  ok(txt({ dec: 2, zin: 0, tol: 'sym', tp: 0.05, tdec: 2 }, 10) === '10.00±0.05', 'symmetrical tolerance');
  ok(txt({ dec: 2, zin: 0, tol: 'dev', tp: 0.1, tm: 0.05, tdec: 2 }, 10) === '10.00 +0.10/-0.05', 'deviation tolerance');
  ok(txt({ dec: 2, zin: 0, tol: 'lim', tp: 0.1, tm: 0.05, tdec: 2 }, 10) === '10.10/9.95', 'limits');
  ok(txt({ dec: 0, tol: 'basic' }, 10) === '[10]', 'basic dimension');
  ok(DS.dimStyleText(D({ adec: 0 }, 'angular'), Math.PI / 4) === '45°', 'angular decimal degrees');
  ok(DS.dimStyleText(D({ adec: 4, aunit: 1 }, 'angular'), (45.5125) * Math.PI / 180) === "45°30'45\"", 'angular degrees minutes seconds', DS.dimStyleText(D({ adec: 4, aunit: 1 }, 'angular'), (45.5125) * Math.PI / 180));
  ok(DS.dimStyleText(D({ adec: 0, aunit: 2 }, 'angular'), Math.PI / 2) === '100g' && DS.dimStyleText(D({ adec: 2, aunit: 3 }, 'angular'), 1) === '1.00r', 'grads, radians');
  ok(DS.dimStyleText({ ...D({ dec: 0 }), text: 'about <>' }, 12) === 'about 12', 'override with <>');
  // parts: a built dimension with roles, then styled
  const base = (role, extra) => ({ layer: '0', color: 0, role, ...extra });
  const parts = [
    base('ext1', { type: 'line', x1: 0, y1: 1, x2: 0, y2: 10 }), base('ext2', { type: 'line', x1: 20, y1: 1, x2: 20, y2: 10 }),
    base('dim', { type: 'line', x1: 0, y1: 9, x2: 20, y2: 9 }),
    base('arrow1', { type: 'hatch', solid: true, loops: [[0, 9, 2.5, 9.4, 2.5, 8.6, 0, 9]], tip: { x: 0, y: 9 }, ang: Math.PI }),
    base('arrow2', { type: 'hatch', solid: true, loops: [[20, 9, 17.5, 9.4, 17.5, 8.6, 20, 9]], tip: { x: 20, y: 9 }, ang: 0 }),
    base('text', { type: 'text', x: 10, y: 9.6, h: 2.5, rot: 0, s: '20', ha: 'center', va: 'bottom', measure: 20 }),
  ];
  const sty = (st, extra = {}) => DS.styleDimParts({ type: 'dim', kind: 'linear', text: '', st, ...extra }, parts);
  ok(DS.styleDimParts({ type: 'dim', kind: 'linear', st: { se1: true } }, parts.map(({ role, ...p }) => p)).length === parts.length, 'parts without roles are left as they are');
  ok(!sty({ se1: true }).some((p) => p.role === 'ext1') && sty({ se1: true }).some((p) => p.role === 'ext2'), 'hide extension line 1');
  ok(!sty({ sd2: true }).some((p) => p.role === 'arrow2'), 'hide dimension line 2 takes its arrow too');
  const ticks = sty({ blk1: 'ARCHTICK', blk2: 'DOT' });
  ok(ticks.filter((p) => p.role === 'arrow1').every((p) => p.type === 'line') && ticks.filter((p) => p.role === 'arrow2').every((p) => p.type === 'hatch'), 'arrowhead per end (tick, dot)');
  ok(sty({ tsz: 1 }).filter((p) => /arrow/.test(p.role)).every((p) => p.type === 'line'), 'tick size gives ticks at both ends');
  ok(DS.ARROWS.every((k) => Array.isArray(DS.arrowParts(k, { x: 0, y: 0 }, 0, 2.5))), 'every arrowhead kind draws');
  const col = sty({ clrd: 1, clre: 3, clrt: 5 });
  ok(col.find((p) => p.role === 'dim').color === 1 && col.find((p) => p.role === 'ext1').color === 3 && col.find((p) => p.role === 'text').color === 5, 'dimension line / extension line / text colors');
  const fill = sty({ tfill: 2, tfillclr: 2 });
  ok(fill.some((p) => p.role === 'fill' && p.color === 2 && p.solid) && fill.findIndex((p) => p.role === 'fill') < fill.findIndex((p) => p.role === 'text'), 'background fill behind the text');
  const dev = sty({ dec: 2, zin: 0, tol: 'dev', tp: 0.1, tm: 0.05, tfac: 0.7 });
  const tx = dev.filter((p) => p.role === 'text');
  ok(tx.length === 3 && tx[0].s === '20.00' && tx[1].s === '+0.10' && tx[2].s === '-0.05' && near(tx[1].h, 2.5 * 0.7), 'deviation: value + two stacked values at 0.7 height', tx.map((p) => p.s).join(' '));
  ok(tx[1].y > tx[2].y && tx[1].x > 10, 'stacked after the value, upper above lower');
  const basic = sty({ dec: 0, tol: 'basic' });
  ok(basic.filter((p) => p.role === 'box').length === 4, 'basic: a box round the text');
  ok(sty({}, { trot: Math.PI / 6 }).find((p) => p.role === 'text').rot === Math.PI / 6 && sty({ tih: true }).find((p) => p.role === 'text').rot === 0, 'text rotation, text always horizontal');
  // in the panel
  const [doc, ids] = drawing([{ type: 'dim', kind: 'linear', p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, loc: { x: 0, y: 5 }, rot: 0, text: '', block: '*D1' }]);
  const dd = [doc.get(ids[0])];
  const secs = new Set(P.defsFor('dim', dd, { doc }).map((d) => d.sec));
  ok(['general', 'geometry', 'lines', 'text', 'fit', 'units', 'alt', 'tol'].every((s) => secs.has(s)), 'dimension sections: Lines and arrows, Text, Fit, Primary units, Alternate units, Tolerances', [...secs].join(' '));
  const tol = def('dim.tol', dd, { doc });
  P.applyValue(doc, tol, dd, 'dev', { doc });
  const d2 = [doc.get(ids[0])];
  ok(d2[0].st.tol === 'dev' && !d2[0].block && P.defsFor('dim', d2, { doc }).some((d) => d.key === 'dim.tm'), 'setting a style value drops the imported drawing and shows the next fields');
  const zt = def('dim.ztrail', d2, { doc });
  P.applyValue(doc, zt, d2, false, { doc });
  ok((doc.get(ids[0]).st.zin & 8) === 0, 'suppress trailing zeros off clears DIMZIN bit 8');
  ok(P.dimStyleNames({ doc, ents: [{ dimstyle: 'ISO-25' }] }).join() === 'Standard,ISO-25', 'dimension style names');
}

// ---------------------------------------------------------------------------------------------------- P.13
section('propdefs.js — a section from an add-on (P.13)');
{
  const [doc, ids] = drawing([{ type: 'insert', block: 'B', x: 0, y: 0, sx: 1, sy: 1, rot: 0, attrs: { WIRE: 'W1' } }, { type: 'line', x1: 0, y1: 0, x2: 1, y2: 0 }]);
  doc.change('block', () => doc.defineBlock({ name: 'B', base: { x: 0, y: 0 }, entities: [] }));
  const off = P.addSection({ key: 'electrical', label: 'Electrical', types: ['insert'], defs: () => [
    { key: 'wire', kind: 'text', label: 'Wire number', get: (e) => e.attrs?.WIRE || '', set: (e, v) => ({ ...e, attrs: { ...(e.attrs || {}), WIRE: String(v) } }) },
    { key: 'bad', kind: 'nonsense', get: () => 1 },
  ] });
  const ins = [doc.get(ids[0])];
  const defs = P.defsFor('insert', ins, { doc });
  const w = defs.find((d) => d.key === 'electrical:wire');
  ok(w && w.sec === 'electrical' && P.sectionLabel('electrical') === 'Electrical' && !defs.some((d) => d.key === 'electrical:bad'), 'an add-on section shows for its type; a malformed field is skipped');
  ok(defs.indexOf(w) > defs.findIndex((d) => d.sec === 'misc' || d.sec === 'geometry'), 'added sections come after the built-in ones');
  ok(!P.defsFor('line', [doc.get(ids[1])], { doc }).some((d) => d.sec === 'electrical'), 'not for other types');
  P.applyValue(doc, w, ins, 'W42', { doc });
  ok(doc.get(ids[0]).attrs.WIRE === 'W42', 'its fields change the object like any other (one undo step)');
  let threw = false; try { P.addSection({ key: 'general', defs: () => [] }); } catch { threw = true; }
  ok(threw, 'a built-in section key is refused');
  off();
  ok(!P.defsFor('insert', ins, { doc }).some((d) => d.sec === 'electrical'), 'remove() takes it away');
}

// ---------------------------------------------------------------------------------------------------- P.14 files
section('What Properties sets, saved as DWG (cc-dwg) and DXF and read back (P.14)');
{
  const { saveDwg } = await load('dwg-save.js');
  const { importDwg } = await load('dwg-import.js');
  const { readDwg } = await load('dwg/read.js');
  const { writeDxf, readDxf } = await load('dxf.js');
  const [doc, ids] = drawing([
    { type: 'line', x1: 0, y1: 0, x2: 30, y2: 40 },
    { type: 'circle', cx: 50, cy: 0, r: 5 },
    { type: 'text', x: 0, y: 50, h: 2.5, s: 'Note', ha: 'left', va: 'baseline' },
    { type: 'dim', kind: 'linear', p1: { x: 0, y: 70 }, p2: { x: 36.6, y: 70 }, loc: { x: 0, y: 76 }, rot: 0, text: '', st: { dec: 4, zin: 0 } },
  ]);
  doc.setLayer('Walls', { color: 1 });
  const set = (i, key, v) => { const e = [doc.get(ids[i])]; const r = P.applyValue(doc, def(key, e, { doc }), e, v, { doc }); if (!r.ok) throw new Error(key + ': ' + r.error); };
  set(0, 'layer', 'Walls'); set(0, 'color', 3); set(0, 'lw', 0.5); set(0, 'len', 100);
  set(1, 'area', 100 * Math.PI);
  set(2, 'h', 5); set(2, 'rot', 30); set(2, 'wf', 0.8);
  set(3, 'dim.dec', 1); set(3, 'dim.txt', 3.5); set(3, 'dim.scale', 2);
  const check = (back, how) => {
    const by = (type) => back.all().find((e) => e.type === type);
    const L = by('line'), C = by('circle'), T = by('text'), D = by('dim');
    const r12 = how === 'DXF R12';   // R12: layer names upper case, no lineweights (help: files)
    ok(L && (r12 ? L.layer === 'WALLS' : L.layer === 'Walls') && L.color === 3 && (r12 || L.lw === 0.5) && near(Math.hypot(L.x2 - L.x1, L.y2 - L.y1), 100, 1e-6), how + ': line layer, color, ' + (r12 ? '' : 'lineweight, ') + 'length', JSON.stringify(L));
    ok(C && near(C.r, 10, 1e-9), how + ': circle radius from the area');
    ok(T && T.h === 5 && near(T.rot, 30 * Math.PI / 180, 1e-9), how + ': text height, rotation', JSON.stringify(T && { h: T.h, rot: T.rot, wf: T.wf }));
    ok(D && (D.st?.dec === 1) && near(D.st?.txt, 3.5) && near(D.st?.scale, 2), how + ': dimension decimals, text height, overall scale', JSON.stringify(D?.st));
    return { T };
  };
  for (const v of ['2000', '2018']) {
    const b = new Doc(); b.load(importDwg(readDwg(saveDwg(doc, { version: v }).bytes), { versionTag: 'x' }));
    const { T } = check(b, 'DWG ' + v);
    ok(T && T.wf === 0.8, 'DWG ' + v + ': text width factor', String(T?.wf));
  }
  const back = new Doc(); back.load(readDxf(writeDxf(doc).text ?? writeDxf(doc)));
  check(back, 'DXF R12');
}

// ---------------------------------------------------------------------------------------------------- commands
section('propcmds.js');
{
  const got = new Map();
  installProps((name, aliases, fn, extra) => got.set(name, { aliases, fn, extra }));
  ok(['PROPERTIES', 'PROPERTIESCLOSE', 'QPMODE', '_PROPPICK'].every((n) => got.has(n)), 'commands installed');
  ok(got.get('PROPERTIES').aliases.includes('PR') && got.get('PROPERTIES').aliases.includes('CH') && got.get('_PROPPICK').extra.hidden && Object.values(Object.fromEntries(got)).every((c) => c.extra.keepSelection), 'aliases, hidden pick, selection kept');
  let opened = 0, pickedAt = null;
  const host = { props: { open: () => opened++, picked: (p) => { pickedAt = p; }, pickLabel: () => 'Start point' } };
  await got.get('PROPERTIES').fn({ host });
  await got.get('_PROPPICK').fn({ host, point: async (prompt) => { ok(/Start point/.test(prompt), 'pick prompt names the point', prompt); return { x: 1, y: 2 }; } });
  ok(opened === 1 && pickedAt?.x === 1, 'PROPERTIES opens, _PROPPICK hands the point to the panel');
}

// missing language keys
const missing = I18n.missing();
ok(missing.length === 0, 'every string is in lang/en.json', missing.join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
