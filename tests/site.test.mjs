import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { build } from '../scripts/lib/site.mjs';
import { checkDir } from '../scripts/check.mjs';
import { STAGE_RANK } from '../scripts/lib/model.mjs';

// These tests need the scan sources: SCAN_DIR=../sovereignos npm test (or network access to the public scan).
const scanDir = process.env.SCAN_DIR || (await fs.stat('../sovereignos/js/data/alternatives.js').then(() => '../sovereignos', () => null));
const skip = !scanDir && !process.env.SCAN_ORIGIN ? 'geen scan-bronnen (zet SCAN_DIR of SCAN_ORIGIN)' : false;

const out = await fs.mkdtemp(path.join(os.tmpdir(), 'gids-'));
let result;
test('bouwen uit de scan-bronnen', { skip }, async () => {
  result = await build({ outDir: out, scanOptions: { dir: scanDir || undefined } });
  assert.ok(result.pages.length > 50);
});

test('controlescript geeft geen fouten', { skip }, async () => {
  const { errors } = await checkDir(out, result.ctx.site);
  assert.deepEqual(errors, []);
});

test('niets wat niet publiek mag staat op de site', { skip }, async () => {
  const { model } = result.ctx;
  const names = new Set(model.products.map(p => p.name));
  for (const e of model.excluded) {
    if (e.why === 'dubbel') continue;
    assert.ok(!names.has(e.name), `${e.name} (${e.why}) mag niet gepubliceerd zijn`);
  }
  assert.ok(model.excluded.some(e => e.why === 'afgewezen'), 'testdata bevat afgewezen rijen');
});

test('niet-beoordeelde producten zijn zichtbaar gelabeld en noindex', { skip }, async () => {
  const unrated = result.ctx.model.products.find(p => p.stage === 'unrated' && !p.index);
  assert.ok(unrated);
  const html = await fs.readFile(path.join(out, 'alternatieven', unrated.slug, 'index.html'), 'utf8');
  assert.match(html, /Nog niet beoordeeld/);
  assert.match(html, /name="robots" content="noindex,follow"/);
  const sitemap = await fs.readFile(path.join(out, 'sitemap.xml'), 'utf8');
  assert.ok(!sitemap.includes(`/alternatieven/${unrated.slug}/`));
});

test('sponsor: banner is gemarkeerd, drie lege vakken met voorgevulde mail', { skip }, async () => {
  const html = await fs.readFile(path.join(out, 'alternatief-voor', 'slack', 'index.html'), 'utf8');
  assert.match(html, /class="sponsor-tag">Sponsor</);
  assert.match(html, /rel="sponsored noopener"/);
  const slots = html.match(/class="slot slot-empty" href="mailto:[^"]+subject=Sponsoring%20alternatievengids\.nl/g) || [];
  assert.equal(slots.length, 3);
});

test('analytics: Simple Analytics met noscript-pixel, en CSP die precies dat toestaat', { skip }, async () => {
  const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(html, /<script async src="https:\/\/scripts\.simpleanalyticscdn\.com\/latest\.js">/);
  assert.match(html, /<noscript><img src="https:\/\/queue\.simpleanalyticscdn\.com\/noscript\.gif"/);
  assert.match(html, /script-src &#39;self&#39; https:\/\/scripts\.simpleanalyticscdn\.com/);
});

test('modal met drie rollen en verplichte toestemming', { skip }, async () => {
  const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  for (const r of ['gebruiker', 'producent', 'leverancier']) assert.match(html, new RegExp(`name="role" value="${r}"`));
  assert.match(html, /name="consent" required/);
  assert.match(html, /name="trap"/);
});

test('GEO: kort antwoord, FAQ-schema, llms.txt en AI-crawlers toegestaan', { skip }, async () => {
  const html = await fs.readFile(path.join(out, 'alternatief-voor', 'microsoft-365', 'index.html'), 'utf8');
  assert.match(html, /<strong>Kort antwoord\.<\/strong>/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  const robots = await fs.readFile(path.join(out, 'robots.txt'), 'utf8');
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot']) assert.match(robots, new RegExp(`User-agent: ${bot}\\nAllow: /`));
  const llms = await fs.readFile(path.join(out, 'llms.txt'), 'utf8');
  assert.match(llms, /^# Alternatievengids/);
  assert.match(llms, /Europees alternatief voor Microsoft 365/);
});

test('rangschikking komt overeen met die van de scan (alternativesForTask)', { skip }, async () => {
  const { scan } = result.ctx;
  const { SYSTEM_TASKS } = scan.tasks;
  for (const task of SYSTEM_TASKS) {
    const ranks = scan.alt.alternativesForTask(task, { government: true, limit: 999 }).map(a => STAGE_RANK[a.verdict || 'unrated']);
    assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `volgorde bij ${task.id}`);
  }
});
