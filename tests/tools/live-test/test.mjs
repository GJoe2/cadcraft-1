#!/usr/bin/env node
/* SPDX-License-Identifier: Apache-2.0 */
/**
 * test.mjs — every Studio Live test of session live-core, in order (LV.14).
 *
 *   node tools/live-test/test.mjs [--quick] [--browser]
 *
 * 1. cargo test in tools/live-test/server: the session core (scenarios, handshake, rejoin, snapshots, flood, handoff…),
 *    the shared vectors, the file server, and live-relay's crypto tests (builds the server first).
 * 2. test-vectors.mjs: the JS side of the shared vectors.
 * 3. test-client.mjs: live-client.js against the real server.
 * 4. test-scenarios.mjs: the shared scenarios over sockets.
 * 5. test-frames.mjs: replayed / reordered / tampered frames, approval, wrong codes (encryption on).
 * 6. test-relay.mjs: hosting through the relay (live/relay.rs) with live-relay's daemon and a stand-in site.
 *    test-handoff.mjs: signed-in names (signIn → hello.assertion, join.aud) and host handoff (LV.17) between two servers.
 *    test-assistant.mjs: an assistant as its own session client (LV.18): approval, viewers, own undo, cleanup, keys.
 * 7. test-converge.mjs: 10 clients, random overlapping edits, drops; identical models (--quick: 1 run).
 * --browser (root): browser-lan.mjs (the apps from a LAN address; a browser joins with a code) and a short spike.
 * Budgets (spike.mjs, bench-join.mjs) are run by hand; results are in docs/0.5-sessions/live-core.md.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const steps = [
  ['cargo test', 'cargo', ['test', '--release', '-q'], path.join(here, 'server')],
  ['vectors (JS)', process.execPath, [path.join(here, 'test-vectors.mjs')]],
  ['client', process.execPath, [path.join(here, 'test-client.mjs')]],
  ['scenarios over sockets', process.execPath, [path.join(here, 'test-scenarios.mjs')]],
  ['frames and approval', process.execPath, [path.join(here, 'test-frames.mjs')]],
  ['relay (host side, real relay daemon, stand-in site)', process.execPath, [path.join(here, 'test-relay.mjs')]],
  ['signed-in names and host handoff', process.execPath, [path.join(here, 'test-handoff.mjs')]],
  ['assistants as their own clients (LV.18)', process.execPath, [path.join(here, 'test-assistant.mjs')]],
  ['convergence', process.execPath, [path.join(here, 'test-converge.mjs'), ...(quick ? ['--runs', '1'] : [])]],
];
if (args.includes('--browser')) {
  steps.push(['browser on the LAN', process.execPath, [path.join(here, 'browser-lan.mjs')]]);
  steps.push(['spike (short)', process.execPath, [path.join(here, 'spike.mjs'), '--profile', 'wifi', '--clients', '9', '--browsers', '1', '--seconds', '8', '--out', 'tmp/live-spike/test']]);
}
let bad = 0;
for (const [name, cmd, argv, cwd] of steps) {
  const t0 = Date.now();
  const r = spawnSync(cmd, argv, { cwd: cwd || path.resolve(here, '../..'), encoding: 'utf8', timeout: 20 * 60_000 });
  const out = ((r.stdout || '') + (r.stderr || '')).trim().split('\n');
  const tail = out.filter((l) => /passed|failed|converged|test result/.test(l)).slice(-3).join(' · ') || out.slice(-1)[0];
  console.log(`${r.status === 0 ? 'ok  ' : 'FAIL'} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s): ${tail}`);
  if (r.status !== 0) { bad++; console.log(out.filter((l) => /FAIL|panicked|Error/.test(l)).slice(0, 8).join('\n')); }
}
console.log(bad ? `${bad} step(s) failed` : 'all live-core tests passed');
process.exit(bad ? 1 : 0);
