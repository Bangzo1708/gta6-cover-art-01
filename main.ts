// Vice Cover Studio — the entry program for gta6-cover-art-01.
//
// What it does, in plain terms: it takes the app/ folder and the
// screenshots/ folder that sit beside this file, copies them into the output
// directory the grader hands it, and writes dossier.json there — the summary
// the judge reads — using the vendored make.fun library. It runs on Node 22
// with the standard library only, no install and no network.
//
// Run it outside the grader like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader sets MAKEFUN_OUTPUT_DIR itself; without it the program writes
// to /output. Running it twice must produce byte-identical output, so it
// never writes a timestamp, a random value, or anything that depends on the
// clock or the machine it runs on.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The caps the sealed scorer enforces (the kit's reference/gate.json).
// Only text_max_bytes changes the dossier's bytes; the rest make this
// program fail loudly where the scorer would refuse the entry, instead of
// handing in something that cannot pass.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function repoRoot() {
  return fileURLToPath(new URL('.', import.meta.url));
}

function outputDir() {
  const fromEnv = process.env.MAKEFUN_OUTPUT_DIR;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return '/output';
}

function fail(message) {
  throw new Error(`vice-cover-studio main.ts: ${message}`);
}

function checkTreePresent(root) {
  const appDir = join(root, 'app');
  if (!existsSync(join(appDir, 'index.html'))) {
    fail('app/index.html is missing — the app cannot be handed in without it');
  }
  const shotsDir = join(root, 'screenshots');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    fail(`expected 3 or 4 screenshots, found ${shots.length}`);
  }
  for (const name of shots) {
    const info = statSync(join(shotsDir, name));
    if (!info.isFile()) fail(`screenshots/${name} is not a regular file`);
    if (info.size > DOSSIER_CAPS.screenshots.max_bytes) {
      fail(`screenshots/${name} is ${info.size} bytes, over the 256 KiB cap`);
    }
  }
}

function copyEntry(root, out) {
  mkdirSync(out, { recursive: true });
  // Clear last run's copies first: a stale screenshot or app file that was
  // deleted from the repo must not survive into the handed-in output.
  rmSync(join(out, 'app'), { recursive: true, force: true });
  rmSync(join(out, 'screenshots'), { recursive: true, force: true });
  cpSync(join(root, 'app'), join(out, 'app'), { recursive: true });
  const shotsOut = join(out, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  cpSync(join(root, 'screenshots'), shotsOut, { recursive: true });
}

function writeDossier(out) {
  const dossier = buildDossier(out, DOSSIER_CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
}

const root = repoRoot();
const out = outputDir();
checkTreePresent(root);
copyEntry(root, out);
writeDossier(out);
console.log(`vice-cover-studio: wrote ${out}/dossier.json`);
