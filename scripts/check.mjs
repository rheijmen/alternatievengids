// npm run check  -> controls the built site in dist/ (run npm run build first).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

const ALLOWED_EXTERNAL = ['https://scripts.simpleanalyticscdn.com', 'https://queue.simpleanalyticscdn.com'];

export async function checkDir(dir, site) {
  const errors = [], warnings = [];
  const files = await walk(dir);
  const rel = f => '/' + path.relative(dir, f).split(path.sep).join('/');
  const exists = new Set(files.map(rel));
  const pageFor = p => { const x = decodeURIComponent(p); return exists.has(x) ? x : exists.has(x.replace(/\/?$/, '/') + 'index.html') ? x : null; };
  const htmlFiles = files.filter(f => f.endsWith('.html'));

  for (const f of htmlFiles) {
    const html = await fs.readFile(f, 'utf8');
    const where = rel(f);
    const err = m => errors.push(`${where}: ${m}`), warn = m => warnings.push(`${where}: ${m}`);
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    const desc = html.match(/<meta name="description" content="(.*?)"/s)?.[1];
    const robots = html.match(/<meta name="robots" content="(.*?)"/)?.[1] || '';
    if (!title) err('geen <title>'); else if (title.length > 75) warn(`titel lang (${title.length})`);
    if (!desc) err('geen meta description'); else if (desc.length > 175) warn(`description lang (${desc.length})`); else if (desc.length < 50) warn(`description kort (${desc.length})`);
    if (!/<link rel="canonical" href="https:\/\/[^"]+"/.test(html)) err('geen absolute canonical');
    if (!/<html lang="nl">/.test(html)) err('geen lang="nl"');
    const h1 = (html.match(/<h1[ >]/g) || []).length;
    if (h1 !== 1) err(`${h1} h1-koppen`);
    for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
      try { JSON.parse(m[1].replace(/\\u003c/g, '<')); } catch { err('JSON-LD is geen geldige JSON'); }
    }
    // Links and resources
    for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const u = m[1];
      if (u.startsWith('mailto:') || u.startsWith('#') || u.startsWith('data:')) continue;
      if (/^https?:\/\//.test(u)) {
        const tagStart = html.lastIndexOf('<', m.index);
        const tag = html.slice(tagStart, html.indexOf('>', m.index));
        const loads = /^<(script|img|link|iframe|source)\b/.test(tag) && !(/^<link\b/.test(tag) && /rel="(canonical|alternate)"/.test(tag));
        if (loads && !ALLOWED_EXTERNAL.some(a => u.startsWith(a)) && !u.startsWith(site.siteUrl)) err(`laadt extern: ${u}`);
        continue;
      }
      if (!u.startsWith('/')) { err(`relatieve link: ${u}`); continue; }
      const p = u.split('#')[0].split('?')[0].replace(/\?.*$/, '');
      if (p && !pageFor(p)) err(`kapotte link: ${u}`);
    }
    if (/<[^>]+\sstyle="/.test(html)) err('inline style-attribuut (CSP staat dat niet toe)');
    // Newground rule: never the browser's own validation (English messages, "Please enter a URL"). Fields are plain
    // text fields with inputmode; the page script validates and speaks Dutch.
    if (/<input[^>]*\stype="(url|email|number|tel|date)"/.test(html)) err('veld met type url, email, number, tel of date: de browser toont dan eigen (Engelse) meldingen');
    if (/<(input|select|textarea)[^>]*\srequired[\s>=]/.test(html)) err('required-attribuut: gebruik eigen Nederlandse meldingen');
    if (/<form[^>]*data-submit-form(?![^>]*novalidate)/.test(html)) err('formulier zonder novalidate');
    if (/<script(?![^>]*\b(src|type)=)[^>]*>/.test(html)) err('inline script (CSP staat dat niet toe)');
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    if (/[—–]/.test(text)) err('gedachtestreep of halve streep in tekst');
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text.replace(/[→↗×−…·]/g, ''))) err('emoji in tekst');
    if (where.startsWith('/alternatieven/') && where !== '/alternatieven/index.html' && /badge-unrated/.test(html) && !site.indexUnrated && !/noindex/.test(robots)) {
      // unrated pages must be noindex unless the Filter approved them (decision 9 in OVERDRACHT.md)
      if (!/<article class="product" data-basis="filter">/.test(html)) err('niet-beoordeeld product is indexeerbaar');
    }
    if (where.startsWith('/vergelijk/') && where !== '/vergelijk/index.html') {
      if (!/<table class="compare">/.test(html)) err('vergelijking zonder tabel');
      if ((html.match(/href="\/alternatieven\/[^"]+\/"/g) || []).length < 2) err('vergelijking linkt niet naar beide producten');
    }
    if (/sponsor-banner/.test(html) && !/rel="sponsored noopener"/.test(html)) err('sponsorbanner zonder rel="sponsored"');
    if (where !== '/404.html' && !/class="slots"/.test(html)) err('geen sponsorvakken in de voet');
    if (where !== '/404.html' && (html.match(/class="slot slot-/g) || []).length !== 3) err('verwacht precies 3 sponsorvakken');
    if (/Newground adviseert/.test(html) && /noindex/.test(robots) && where.startsWith('/alternatief-voor/')) err('alternatief-voor-pagina is noindex');
  }

  // Sitemap
  const sm = await fs.readFile(path.join(dir, 'sitemap.xml'), 'utf8').catch(() => '');
  if (!sm) errors.push('sitemap.xml ontbreekt');
  for (const m of sm.matchAll(/<loc>(.*?)<\/loc>/g)) {
    const p = m[1].replace(site.siteUrl, '');
    if (!pageFor(p)) errors.push(`sitemap verwijst naar ontbrekende pagina: ${p}`);
    const f = pageFor(p) && (p.endsWith('/') ? path.join(dir, p, 'index.html') : path.join(dir, p));
    if (f && /noindex/.test(await fs.readFile(f, 'utf8').catch(() => ''))) errors.push(`noindex-pagina staat in de sitemap: ${p}`);
  }
  for (const f of ['robots.txt', 'llms.txt', 'llms-full.txt', 'zoek.json']) if (!exists.has('/' + f)) errors.push(`${f} ontbreekt`);
  return { errors, warnings, pages: htmlFiles.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const site = JSON.parse(await fs.readFile(path.join(ROOT, 'data/site.json'), 'utf8'));
  const { errors, warnings, pages } = await checkDir(path.join(ROOT, 'dist'), site);
  warnings.slice(0, 15).forEach(w => console.log('let op:', w));
  if (warnings.length > 15) console.log(`let op: nog ${warnings.length - 15} waarschuwingen`);
  errors.slice(0, 40).forEach(e => console.log('FOUT:', e));
  if (errors.length > 40) console.log(`FOUT: nog ${errors.length - 40} fouten`);
  console.log(`${pages} pagina's gecontroleerd: ${errors.length} fouten, ${warnings.length} waarschuwingen`);
  process.exit(errors.length ? 1 : 0);
}
