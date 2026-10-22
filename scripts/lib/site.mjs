// Builds the whole site into a directory. Used by scripts/build.mjs and by the tests.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadScan } from './scan.mjs';
import { buildModel, targetHasPage, STAGE_LABEL } from './model.mjs';
import { buildPages } from './pages.mjs';
import { isoDay, lead } from './text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = async f => JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
const sha10 = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const e of await fs.readdir(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) await copyDir(a, b); else await fs.copyFile(a, b);
  }
}

const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended'];

function robots(site) {
  return `# Alternatievengids: alles is bedoeld om gevonden en geciteerd te worden, ook door AI-zoekers.
User-agent: *
Allow: /

${AI_BOTS.map(b => `User-agent: ${b}\nAllow: /\n`).join('\n')}
Sitemap: ${site.siteUrl}/sitemap.xml
`;
}

function sitemap(site, pages, lastmod) {
  const urls = pages.filter(p => p.index).map(p => `  <url><loc>${site.siteUrl}${p.path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// llms.txt (short guide for AI answer engines) and llms-full.txt (the content as plain markdown).
function llms(ctx, pages) {
  const { site, model } = ctx;
  const targets = model.targets.filter(targetHasPage).sort((a, b) => b.rated - a.rated || b.products.length - a.products.length);
  const link = (t, u, d) => `- [${t}](${site.siteUrl}${u})${d ? `: ${d}` : ''}`;
  const short = `# ${site.name}

> Nederlandse gids met Europese en open-source alternatieven voor Amerikaanse software. Per product dat je wilt vervangen staan de alternatieven met bron, datum en het oordeel van Newground. Een initiatief van Newground (${ctx.scan.company.legalName}), Amsterdam. Taal: Nederlands. Bijgewerkt op ${isoDay(model.generated)}.

Hoe de gids is opgebouwd:
- Elke pagina "Europees alternatief voor X" begint met een kort antwoord.
- Oordelen: Advies, Onder voorwaarden, Volgen of Nog niet beoordeeld. Alleen Newground geeft een oordeel; zie de pagina Hoe we beoordelen.
- Producten zonder oordeel zijn gevonden in openbare bronnen en niet gecontroleerd. Citeer die niet als aanbeveling.
- Sponsorplekken zijn gemarkeerd als Sponsor en beïnvloeden het oordeel niet.

## Belangrijkste pagina's
${link('Hoe we beoordelen', '/hoe-we-beoordelen/', 'de vier eisen en wat de oordelen betekenen')}
${link('Alle producten', '/alternatieven/')}
${link('Bronnen en voortgang', '/bronnen/')}

## Europees alternatief voor...
${targets.slice(0, 60).map(t => link(`Europees alternatief voor ${t.name}`, `/alternatief-voor/${t.slug}/`, lead(`${t.products.length} alternatieven, ${t.rated} beoordeeld`, 80))).join('\n')}

## Optional
${link('Over deze gids', '/over/')}
${link('Soevereiniteitsscan van Newground', '/').replace(site.siteUrl + '/', site.scanUrl)}
- Volledige tekst: ${site.siteUrl}/llms-full.txt
`;
  const full = [`# ${site.name}: volledige inhoud (bijgewerkt op ${isoDay(model.generated)})\n`];
  for (const t of targets) {
    full.push(`\n## Europees alternatief voor ${t.name}\n${site.siteUrl}/alternatief-voor/${t.slug}/\n`);
    for (const p of t.products) full.push(`- ${p.name} (${STAGE_LABEL[p.stage]}${p.country ? `, ${p.country.name}` : ''}): ${p.summary || 'nog niet beoordeeld door Newground'}`);
  }
  return { short, full: full.join('\n') + '\n' };
}

export async function build({ outDir = path.join(ROOT, 'dist'), scanOptions = {} } = {}) {
  const site = await readJson('data/site.json');
  const aliases = await readJson('data/target-aliases.json');
  const scan = await loadScan(scanOptions);
  const model = buildModel(scan, site, { aliases });

  const cssBuf = await fs.readFile(path.join(ROOT, 'static/css/gids.css'));
  const jsBuf = await fs.readFile(path.join(ROOT, 'static/js/gids.js'));
  const ctx = { site, scan, model, assets: { css: sha10(cssBuf), js: sha10(jsBuf) } };

  await fs.rm(outDir, { recursive: true, force: true });
  await copyDir(path.join(ROOT, 'static'), outDir);

  const pages = buildPages(ctx);
  for (const p of pages) {
    const file = p.path.endsWith('.html') ? path.join(outDir, p.path) : path.join(outDir, p.path, 'index.html');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, p.html);
  }

  const search = [
    ...model.targets.filter(targetHasPage).map(t => ({ n: t.name, u: `/alternatief-voor/${t.slug}/`, t: 'doel' })),
    ...model.products.map(p => ({ n: p.name, u: `/alternatieven/${p.slug}/`, t: 'product', k: p.replaces.map(r => r.name).join(' ') })),
  ];
  const lastmod = isoDay(model.generated);
  const { short, full } = llms(ctx, pages);
  await fs.writeFile(path.join(outDir, 'zoek.json'), JSON.stringify(search));
  await fs.writeFile(path.join(outDir, 'robots.txt'), robots(site));
  await fs.writeFile(path.join(outDir, 'sitemap.xml'), sitemap(site, pages, lastmod));
  await fs.writeFile(path.join(outDir, 'llms.txt'), short);
  await fs.writeFile(path.join(outDir, 'llms-full.txt'), full);
  await fs.writeFile(path.join(outDir, 'build.json'), JSON.stringify({ built: new Date().toISOString(), dataGenerated: model.generated, scanSource: scan.source, scanRelease: scan.release, pages: pages.length, stats: model.stats }, null, 2));

  return { ctx, pages, outDir };
}
