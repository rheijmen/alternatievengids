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

test('door het Filter goedgekeurde producten zijn indexeerbaar maar blijven als niet beoordeeld gelabeld', { skip }, async (t) => {
  const approved = result.ctx.model.products.filter(p => p.stage === 'unrated' && p.basis === 'filter');
  if (!approved.length) return t.skip('geen door het Filter goedgekeurde producten in de huidige data');
  const sitemap = await fs.readFile(path.join(out, 'sitemap.xml'), 'utf8');
  for (const p of approved) {
    const html = await fs.readFile(path.join(out, 'alternatieven', p.slug, 'index.html'), 'utf8');
    assert.match(html, /Nog niet beoordeeld/, p.slug);
    assert.match(html, /name="robots" content="index,follow/, p.slug);
    assert.match(html, /<article class="product" data-basis="filter">/, p.slug);
    assert.ok(sitemap.includes(`/alternatieven/${p.slug}/`), `${p.slug} in sitemap`);
  }
});

test('Eigendom verandert heeft in lijsten een uitleg die ook met toetsenbord en schermlezer werkt', { skip }, async (t) => {
  if (!result.ctx.model.products.some(x => x.review && x.index)) return t.skip('geen product met eigendomsalarm in de huidige data');
  const files = [];
  for (const dir of ['alternatieven', 'categorie', 'sector']) {
    const base = path.join(out, dir);
    for (const d of await fs.readdir(base).catch(() => [])) files.push(path.join(base, d, 'index.html'));
  }
  let found = 0;
  for (const f of files) {
    const html = await fs.readFile(f, 'utf8').catch(() => '');
    for (const m of html.matchAll(/<span class="badge badge-review has-tip" tabindex="0">Eigendom verandert<span class="tip">([^<]+)<\/span><\/span>/g)) {
      found++;
      assert.match(m[1], /overname of nieuwe eigenaar/);
    }
  }
  assert.ok(found > 0, 'tooltip komt voor in minstens een lijst');
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

test('modal met drie rollen en toestemmingsvakje', { skip }, async () => {
  const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  for (const r of ['gebruiker', 'producent', 'leverancier']) assert.match(html, new RegExp(`name="role" value="${r}"`));
  assert.match(html, /name="consent"/);
  assert.match(html, /name="trap"/);
});

test('formulieren: nooit de meldingen van de browser, altijd eigen Nederlandse meldingen', { skip }, async () => {
  for (const file of ['index.html', 'dien-in/index.html']) {
    const html = await fs.readFile(path.join(out, file), 'utf8');
    const form = html.match(/<form class="submit-form"[^>]*>[\s\S]*?<\/form>/)[0];
    assert.match(form, /\bnovalidate\b/, `${file}: novalidate`);
    assert.doesNotMatch(form, /\brequired\b/, `${file}: geen required`);
    assert.doesNotMatch(form, /type="(url|email|number|tel|date)"/, `${file}: geen speciale invoertypes`);
    assert.match(form, /name="website"[^>]*inputmode="url"/);
    assert.match(form, /name="email"[^>]*inputmode="email"/);
    for (const n of ['product', 'website', 'name', 'email', 'consent']) assert.match(form, new RegExp(`data-error-for="${n}"`), `${file}: foutplek ${n}`);
    assert.match(form, /role="alert"/);
    assert.ok(html.indexOf('/js/form-rules.js') > 0 && html.indexOf('/js/form-rules.js') < html.indexOf('/js/gids.js'), 'regels laden voor gids.js');
  }
  const page = await fs.readFile(path.join(out, 'dien-in/index.html'), 'utf8');
  assert.match(page, /<form[^>]*\bhidden\b/, 'formulier verborgen tot JavaScript het toont');
  assert.match(page, /<noscript>[\s\S]*mailto:/, 'zonder JavaScript: mail-terugval');
});

test('beta-label in kop en voet, en melding bij niets gevonden', { skip }, async () => {
  const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  assert.equal((html.match(/<span class="beta">beta<\/span>/g) || []).length, 2);
  assert.match(html, /class="search-empty"[^>]*role="status"[^>]*hidden/);
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

test('vergelijkpagina\'s: alleen beoordeelde producten, tabel, noindex bij Volgen, in sitemap alleen aanbevolen paren', { skip }, async () => {
  const { model } = result.ctx;
  assert.ok(model.comparisons.length > 10, 'er zijn vergelijkingen');
  const sitemap = await fs.readFile(path.join(out, 'sitemap.xml'), 'utf8');
  for (const c of model.comparisons) {
    assert.notEqual(c.a.stage, 'unrated'); assert.notEqual(c.b.stage, 'unrated');
    assert.ok(c.a.name.localeCompare(c.b.name, 'nl') <= 0, 'alfabetische volgorde');
    const html = await fs.readFile(path.join(out, 'vergelijk', c.slug, 'index.html'), 'utf8');
    assert.match(html, /<table class="compare">/);
    assert.ok(html.includes(`href="/alternatieven/${c.a.slug}/"`) && html.includes(`href="/alternatieven/${c.b.slug}/"`));
    assert.equal(sitemap.includes(`/vergelijk/${c.slug}/`), c.index, `sitemap volgt index voor ${c.slug}`);
    assert.equal(/name="robots" content="noindex/.test(html), !c.index);
  }
  assert.ok(model.comparisons.some(c => !c.index) && model.comparisons.some(c => c.index));
});

test('vergelijkingen zijn vindbaar: footer, startpagina, productpagina, doelpagina en llms.txt', { skip }, async () => {
  const c = result.ctx.model.comparisons.find(x => x.index);
  const read = (...p) => fs.readFile(path.join(out, ...p), 'utf8');
  assert.match(await read('index.html'), /href="\/vergelijk\/"/);
  assert.match(await read('alternatieven', c.a.slug, 'index.html'), new RegExp(`/vergelijk/${c.slug}/`));
  assert.match(await read('alternatief-voor', c.targets[0].slug, 'index.html'), /Vergelijk de beoordeelde alternatieven/);
  assert.match(await read('llms.txt'), new RegExp(`/vergelijk/${c.slug}/`));
  const faq = await read('vergelijk', c.slug, 'index.html');
  assert.ok(!/"text":"[^"]*&(quot|amp|#39);/.test(faq), 'geen HTML-tekens in FAQ-schema');
});
