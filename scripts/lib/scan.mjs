// Loads the sources of the Soevereiniteitsscan, so this site uses the same list and the same rules.
//
// SCAN_DIR     a checkout of rheijmen/sovereignos (local work)
// SCAN_ORIGIN  otherwise the files are downloaded from the public scan (default https://scan.newground.nl)
//
// The scan's modules are plain ES modules without browser dependencies, so they are imported as they are.
// Nothing is copied into this repository: a change in the scan shows up here on the next build.

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = [
  'js/data/alternatives.js', 'js/data/catalog.js', 'js/data/tasks.js', 'js/config.js',
  'data/verdicts.json',
];

async function download(origin, cacheDir) {
  await fs.rm(cacheDir, { recursive: true, force: true });
  for (const file of FILES) {
    const res = await fetch(`${origin.replace(/\/$/, '')}/${file}`, { signal: AbortSignal.timeout(60000), headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) throw new Error(`Scan-bestand ${file} niet op te halen (${res.status}) van ${origin}`);
    const target = path.join(cacheDir, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(await res.arrayBuffer()));
  }
}

const need = (mod, names, file) => {
  for (const n of names) if (!(n in mod)) throw new Error(`De scan is veranderd: ${file} exporteert ${n} niet meer. Pas scripts/lib/scan.mjs en model.mjs aan.`);
};

export async function loadScan({ dir = process.env.SCAN_DIR, origin = process.env.SCAN_ORIGIN || 'https://scan.newground.nl', cache = '.cache/scan' } = {}) {
  let root;
  if (dir) root = path.resolve(dir);
  else { root = path.resolve(cache); await download(origin, root); }
  const load = file => import(pathToFileURL(path.join(root, file)).href);

  const alt = await load('js/data/alternatives.js');
  const cat = await load('js/data/catalog.js');
  const tasks = await load('js/data/tasks.js');
  const config = await load('js/config.js');
  need(alt, ['ALTERNATIVES', 'applyVerdicts', 'GUIDE_GOAL'], 'js/data/alternatives.js');
  need(cat, ['CATALOG', 'matchTech', 'tech'], 'js/data/catalog.js');
  need(tasks, ['SYSTEM_TASKS', 'OTHER_TASK', 'taskIds'], 'js/data/tasks.js');
  need(config, ['CONTACT', 'COMPANY', 'RELEASE'], 'js/config.js');

  const data = JSON.parse(await fs.readFile(path.join(root, 'data/verdicts.json'), 'utf8'));
  if (!Array.isArray(data.results) || !data.results.length) throw new Error('data/verdicts.json van de scan bevat geen rijen.');

  return {
    source: dir ? `map ${root}` : origin,
    release: config.RELEASE,
    contact: config.CONTACT,
    company: config.COMPANY,
    alt,
    catalog: cat.CATALOG,
    matchTech: cat.matchTech,
    tasks: { SYSTEM_TASKS: tasks.SYSTEM_TASKS, OTHER_TASK: tasks.OTHER_TASK, taskIds: tasks.taskIds },
    data,
  };
}
