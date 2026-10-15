/* SPDX-License-Identifier: Apache-2.0 */
/**
 * maps-cad.js — map layers under CadCraft's model space (0.5 SG.3, suggestion #572). The shared maplayers.js (and crs.js,
 * basemap.js, proj4 behind it) loads on the first use: the MAPLAYERS command, or a browser that already has map layers.
 *
 *   MAPLAYERS (ML, GEOMAP)   the Map layers dialog: the drawing's coordinate system (an EPSG code, and where a drawing point
 *                            is on its grid when the drawing is not in the system's own coordinates), the internet switch,
 *                            layers (XYZ tiles, WMS, WMTS, ArcGIS, a picture + world file), their order and opacity
 *
 *   installMaps({ root, attrib, view, doc, say, busy, ask, refocus }) → { paint(ctx, T, view), ensure(), api() }
 *   Kept in localStorage "cadcraft.maps" { crs: { code, place }, layers, internet } — this browser, not the drawing.
 *   The drawing's units (Properties › Units) scale it onto the system (unitless: the system's units).
 */
import { t } from './i18n.js';
import { commandRegistry } from './commands.js';
import { mPerUnit } from './model3d.js';

const KEY = 'cadcraft.maps';
let current = null;   // the one install (cadcraft.js makes it)

commandRegistry.add('MAPLAYERS', ['ML', 'GEOMAP'], async (c) => {
  if (!current) { c.print(t('ml.nobrowser')); return; }
  const ml = await current.ensure();
  ml.openDialog();
}, { noRepeat: true, keepSelection: true, help: () => t('ml.cmd.help') });

export function installMaps({ root, attrib, view, doc, say, busy, ask, refocus }) {
  let ml = null, lib = null, crsLib = null, loading = null, crsCache = { key: '', crs: null };
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  let saved = read();
  const write = (patch) => { saved = { ...saved, ...patch }; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* private window */ } };
  /** The drawing's system: the saved EPSG code and placement, with the drawing's units → crs.js shape (local) or null. */
  function crs() {
    const c = saved.crs;
    if (!c || !crsLib?.catalogLoaded()) return null;
    const key = JSON.stringify(c) + '|' + (doc.meta.units || '');
    if (crsCache.key === key) return crsCache.crs;
    let out = null;
    try {
      const e = crsLib.byCode(c.code);
      if (e && !e.geographic) out = { ...crsLib.crsFromEntry(e), local: lib.drawingLocal(e, c.place, doc.meta.units ? mPerUnit(doc.meta.units) : null, crsLib.METRES_PER) };
    } catch { out = null; }
    crsCache = { key, crs: out };
    return out;
  }
  function ensure() {
    return (loading ||= (async () => {
      lib = await import('./maplayers.js');
      crsLib = await import('./crs.js');
      if (!crsLib.catalogLoaded()) await crsLib.loadCatalog();
      ml = lib.createMapLayers({
        root, attrib, load: () => saved, save: (s) => write(s), crs, canSetCrs: true,
        setCrs: (c) => { write({ crs: c }); crsCache.key = ''; },
        invalidate: () => view.invalidate(true), say, busy, ask, refocus, fit: (b) => view.fit(b),
      });
      view.invalidate(true);
      return ml;
    })().catch((e) => { loading = null; say(e.message); throw e; }));
  }
  const api = {
    ensure, api: () => ml, crs,
    paint(ctx, T, v) { if (ml && ml.has()) ml.paint(ctx, T, { w: v.w, h: v.h, dpr: v.dpr, ox: v.x0, oy: v.y0 }); },
    key: () => (ml ? ml.layers().map((m) => m.id + (m.visible ? 1 : 0) + m.opacity).join() : ''),
  };
  current = api;
  if (saved.layers?.length && saved.crs) ensure().catch(() => {});   // layers kept from an earlier visit: draw them
  return api;
}
