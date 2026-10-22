// Turns the scan's alternatives (built-in entries plus the Baserow rows) into what the Gids publishes.
//
// Shared with the scan, on purpose: applyVerdicts() and fromBaserow() decide which rows become alternatives and
// which verdict they carry. This file only adds what the Gids needs on top: candidates with a label, "alternative
// for" targets, categories and sectors. Status rules follow docs/OVERDRACHT.md.

import { fold, slugify, lead } from './text.mjs';

export const STAGES = ['advise', 'conditional', 'watch', 'unrated'];
export const STAGE_LABEL = {
  advise: 'Advies', conditional: 'Onder voorwaarden', watch: 'Volgen', unrated: 'Nog niet beoordeeld',
};
// Same order as the scan's VERDICT_RANK (unrated sits between conditional and watch).
export const STAGE_RANK = { advise: 0, conditional: 1, unrated: 2, watch: 3 };

export const CATEGORY_LABEL = {
  productivity: 'Werkplek en kantoorsoftware', communication: 'Chat en samenwerken', video: 'Videovergaderen',
  storage: 'Bestanden en opslag', infrastructure: 'Hosting en cloud', identity: 'Inloggen en identiteit',
  security: 'Beveiliging', crm: 'Klantrelaties (CRM)', finance: 'Boekhouding en bedrijfssoftware',
  project: 'Projecten en planning', analytics: 'Websitestatistieken', marketing: 'E-mailmarketing en nieuwsbrieven',
  development: 'Softwareontwikkeling', ai: 'AI', passwords: 'Wachtwoorden', forms: 'Formulieren en enquêtes',
  network: 'Netwerk en CDN', backup: 'Back-up', data: 'Data en analyse', knowledge: 'Kennis en documentatie',
  design: 'Ontwerp en whiteboard', support: 'Klantenservice', automation: 'Automatisering', website: 'Websites',
  vertical: 'Vakspecifieke software', other: 'Overig',
};

// Baserow's free-text Category (English) to a catalog category. First match wins.
const CATEGORY_WORDS = [
  [/backup/i, 'backup'], [/cdn|ddos|network/i, 'network'], [/password/i, 'passwords'], [/identity|sso|access management/i, 'identity'],
  [/endpoint|security|firewall|antivirus|siem/i, 'security'], [/video|conferenc|webinar/i, 'video'],
  [/hospital|epd|ecd|client record|burgerzaken|civil|school|student|pharmac|cad\b|pim\b|wms\b|logistic|case management|zaaksysteem|legal/i, 'vertical'],
  [/analytics|statistic/i, 'analytics'], [/email marketing|newsletter|blogging|marketing|cms\b/i, 'marketing'],
  [/\bai\b|llm|translation|notetaker|machine learning|speech|transcri/i, 'ai'],
  [/storage|file sharing|file transfer|\bfiles?\b|drive/i, 'storage'],
  [/\bforms?\b|survey/i, 'forms'], [/project|time tracking|scheduling|booking|planning|task/i, 'project'],
  [/crm|sales|customer relationship/i, 'crm'], [/support|helpdesk|ticket/i, 'support'],
  [/erp|accounting|payroll|payment|invoice|finance|business software|bookkeeping/i, 'finance'],
  [/data platform|data warehouse|database|bi\b|business intelligence/i, 'data'],
  [/low-code|no-code|software development|developer|git\b|code hosting|ci\/cd|devops/i, 'development'],
  [/design|whiteboard|diagram/i, 'design'], [/automation|workflow|integration/i, 'automation'],
  [/knowledge|wiki|documentation|notes/i, 'knowledge'],
  [/messaging|chat|collaboration tool/i, 'communication'],
  [/hosting|data centre|data center|platform as a service|paas|iaas|cloud|operating system|server|vps/i, 'infrastructure'],
  [/office suite|productivity|email provider|mail|groupware|calendar|suite/i, 'productivity'],
  [/website|web builder|site builder/i, 'website'],
];

export const SECTORS = [
  'Overheid', 'Onderwijs', 'Zorg en welzijn', 'Cultuur, sport en goede doelen', 'Zakelijke dienstverlening',
  'Handel en logistiek', 'Industrie, bouw en installatie', 'ICT en media',
];

export const COUNTRY = {
  NL: 'Nederland', DE: 'Duitsland', FR: 'Frankrijk', BE: 'België', AT: 'Oostenrijk', CH: 'Zwitserland', UK: 'Verenigd Koninkrijk',
  GB: 'Verenigd Koninkrijk', NO: 'Noorwegen', LT: 'Litouwen', SE: 'Zweden', FI: 'Finland', DK: 'Denemarken', ES: 'Spanje',
  IT: 'Italië', PL: 'Polen', CZ: 'Tsjechië', IE: 'Ierland', LU: 'Luxemburg', EE: 'Estland', LV: 'Letland', PT: 'Portugal',
  SK: 'Slowakije', SI: 'Slovenië', HR: 'Kroatië', HU: 'Hongarije', RO: 'Roemenië', BG: 'Bulgarije', GR: 'Griekenland',
  CY: 'Cyprus', MT: 'Malta', IS: 'IJsland', CA: 'Canada', US: 'Verenigde Staten', IL: 'Israël', IN: 'India',
};
const EU_LIKE = new Set(['NL', 'DE', 'FR', 'BE', 'AT', 'LT', 'SE', 'FI', 'DK', 'ES', 'IT', 'PL', 'CZ', 'IE', 'LU', 'EE', 'LV', 'PT', 'SK', 'SI', 'HR', 'HU', 'RO', 'BG', 'GR', 'CY', 'MT']);

// ---- Baserow cells -------------------------------------------------------------------------------------------

export function cell(r, key) {
  const v = r?.[key];
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(x => x?.value ?? x).filter(Boolean).join('; ');
  if (typeof v === 'object') return String(v.value ?? '').trim();
  return String(v).trim();
}
const cellList = (r, key) => (Array.isArray(r?.[key]) ? r[key].map(x => x?.value ?? x) : cell(r, key).split(/\s*;\s*/)).filter(Boolean);
const verdictOf = r => ({ advise: 'advise', adviseren: 'advise', conditional: 'conditional', 'onder voorwaarden': 'conditional', watch: 'watch', volgen: 'watch' })[cell(r, 'Verdict').toLowerCase()] || '';

// Whether a row may appear on the Gids at all. Returns null when it may, otherwise the reason it may not.
// Handover rules: never Afgewezen, Sectorkennis or Gangbaar product as a recommendation, never Twijfel without a
// verdict, never anything that is not a product (implementation partners, government programmes).
export function excludeReason(r) {
  const status = cell(r, 'Gidsstatus'), type = cell(r, 'Type');
  if (type && type !== 'Vendor') return 'type';
  if (['Sectorkennis', 'Gangbaar product', 'Afgewezen'].includes(status)) return status.toLowerCase();
  if (status === 'Twijfel' && !verdictOf(r)) return 'twijfel';
  return null;
}

// ---- Categories ----------------------------------------------------------------------------------------------

export function categoryOf(text, taskCat) {
  const t = String(text ?? '');
  for (const [re, cat] of CATEGORY_WORDS) if (re.test(t)) return cat;
  return taskCat && CATEGORY_LABEL[taskCat] ? taskCat : 'other';
}

// ---- "Alternative for" targets -------------------------------------------------------------------------------

const JUNK = /\b(plus|direct|shared|various|others?|any|gateways?|layer|tooling|providers?|larger|style|etc)\b/i;

// Splits a Replaces cell ("Slack; Microsoft Teams (chat only); ChatGPT Team/Enterprise") into targets.
// A name the catalog knows becomes that catalog entry; other plausible names stay as free text.
export function parseReplaces(text, { matchTech, catalog, aliases = {} }) {
  const out = [];
  const add = (key, name, catalogId = null) => { if (!out.some(o => o.key === key)) out.push({ key, name, catalog: catalogId }); };
  const fromCatalog = id => add(id, catalog[id].name, id);
  for (const raw of String(text ?? '').split(/\s*;\s*/)) {
    const item = raw.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (!item) continue;
    const alias = aliases[fold(item)];
    if (alias) { catalog[alias] ? fromCatalog(alias) : add(slugify(alias), alias); continue; }
    const whole = matchTech(item);
    if (whole && catalog[whole]) { fromCatalog(whole); continue; }
    if (/[\/,]| en /i.test(item)) {
      for (const part of item.split(/\s*(?:\/|,| en )\s*/)) {
        const id = part.length > 2 ? matchTech(part) : null;
        if (id && catalog[id]) fromCatalog(id);
      }
      continue;
    }
    if (item.length > 40 || item.split(' ').length > 4 || JUNK.test(item) || item.length < 2) continue;
    add(slugify(item), item);
  }
  return out;
}

// ---- Products ------------------------------------------------------------------------------------------------

const countryOf = (iso, hqText) => {
  const code = iso || (String(hqText ?? '').match(/\(([A-Z]{2})\)(?!.*\([A-Z]{2}\))/)?.[1] ?? '');
  return code ? { code, name: COUNTRY[code] || code } : null;
};
const openSourceOf = (license, cellText) => {
  if (license) return license === 'open-source' ? 'yes' : license === 'open-core' ? 'core' : 'no';
  const t = String(cellText ?? '').toLowerCase();
  if (t.startsWith('open core')) return 'core';
  if (t.startsWith('yes')) return 'yes';
  if (t.startsWith('no')) return 'no';
  return null;
};
const httpUrl = v => (/^https?:\/\//i.test(String(v ?? '').trim()) ? String(v).trim() : '');
const sourcesOf = (r, extra = []) => [...new Set([...extra, ...cell(r, 'Source').split(/\s*;\s*/)].filter(httpUrl))];
const sectorsOf = r => cellList(r, 'Relevant voor Sectoren').filter(s => SECTORS.includes(s));

function fromScanAlt(a, row, ctx) {
  const stage = a.verdict || 'unrated';
  const status = cell(row, 'Gidsstatus');
  const nlText = a.assessment?.nl && a.assessment.nl !== a.assessment.en ? a.assessment.nl : '';
  const note = a.note?.nl || '';
  const replaces = [
    ...(a.replaces || []).filter(id => ctx.catalog[id]).map(id => ({ key: id, name: ctx.catalog[id].name, catalog: id })),
    ...parseReplaces(cell(row, 'Replaces'), ctx),
  ].filter((t, i, all) => all.findIndex(x => x.key === t.key) === i);
  const sectors = [...new Set([...sectorsOf(row), ...(a.publicOnly || a.gov?.length ? ['Overheid'] : [])])];
  return {
    scanId: a.id, baserowId: a.baserow ?? null, name: a.name, vendor: a.vendor || '', website: httpUrl(cell(row, 'Website')) || a.source?.find(httpUrl) || '',
    country: countryOf(a.country, cell(row, 'HQ / legal entity')), region: a.hq || 'EU',
    category: CATEGORY_LABEL[a.category] ? a.category : categoryOf(cell(row, 'Category')),
    stage, basis: stage !== 'unrated' ? 'newground' : status === 'Goedgekeurd door filter' ? 'filter' : 'unlisted',
    review: Boolean(a.review), publicOnly: Boolean(a.publicOnly),
    openSource: openSourceOf(a.license, cell(row, 'Open source')),
    delivery: a.delivery || [], replaces, sectors,
    assessment: nlText, note, summary: lead(nlText || note, 220),
    checked: a.checked || '', reevaluate: a.reevaluate || '', sources: sourcesOf(row, a.source || []),
    govUse: (a.gov || []).map(g => ({ who: g.who?.nl || '', what: g.what?.nl || '', url: g.url || '' })).filter(g => g.who),
    govSupplier: Boolean(a.govSupplier), smbFit: Boolean(a.smbFit), tier: a.tier || '',
    sealLevel: cell(row, 'SEAL-niveau'), bottleneck: cell(row, 'Knelpunt (Bottleneck)'),
    fromBaserowOnly: Boolean(a.fromBaserow),
  };
}

function fromCandidateRow(r, ctx) {
  const hqText = cell(r, 'HQ / legal entity');
  const task = ctx.tasks.taskIds(cell(r, 'Scanvraag'))[0];
  const taskCat = [...ctx.tasks.SYSTEM_TASKS, ctx.tasks.OTHER_TASK].find(t => t.id === task)?.cat;
  const entity = hqText.replace(/\s*\([A-Z]{2}\)\s*$/, '').replace(/\s*\(open source\)/i, '').trim();
  return {
    scanId: null, baserowId: r.id, name: cell(r, 'Name').slice(0, 80), vendor: entity.slice(0, 80), website: httpUrl(cell(r, 'Website')),
    country: countryOf('', hqText), region: null,
    category: categoryOf(cell(r, 'Category'), taskCat),
    stage: 'unrated', basis: 'candidate', review: false, publicOnly: false,
    openSource: openSourceOf('', cell(r, 'Open source')), delivery: [],
    replaces: parseReplaces(cell(r, 'Replaces'), ctx), sectors: sectorsOf(r),
    assessment: '', note: '', summary: '', checked: '', reevaluate: '', sources: [],
    govUse: [], govSupplier: false, smbFit: false, tier: '', sealLevel: '', bottleneck: '', fromBaserowOnly: true,
  };
}

// ---- The model -----------------------------------------------------------------------------------------------

export function buildModel(scan, site, { aliases = {} } = {}) {
  const { alt, catalog, matchTech } = scan;
  if (!scan.applied) { alt.applyVerdicts(scan.data); scan.applied = true; }
  const rows = scan.data.results.filter(r => r && typeof r === 'object');
  const byId = new Map(rows.map(r => [String(r.id), r]));
  const ctx = { catalog, matchTech, tasks: scan.tasks, aliases };

  const excluded = [];
  const products = [];
  const linked = new Set();

  for (const a of alt.ALTERNATIVES) {
    const row = a.baserow != null ? byId.get(String(a.baserow)) : null;
    if (a.baserow != null) linked.add(String(a.baserow));
    const why = row ? excludeReason(row) : null;
    if (why) { excluded.push({ name: a.name, why }); continue; }
    products.push(fromScanAlt(a, row, ctx));
  }

  const names = new Set(products.map(p => fold(p.name)));
  for (const r of rows) {
    if (linked.has(String(r.id))) continue;
    const name = cell(r, 'Name');
    if (!name || excludeReason(r)) { if (name) excluded.push({ name, why: excludeReason(r) || 'leeg' }); continue; }
    if (names.has(fold(name))) { excluded.push({ name, why: 'dubbel' }); continue; }
    if (verdictOf(r)) { excluded.push({ name, why: 'oordeel zonder scan-koppeling' }); continue; }
    names.add(fold(name));
    products.push(fromCandidateRow(r, ctx));
  }

  // Slugs, unique and stable.
  const taken = new Set();
  for (const p of products.sort((a, b) => a.name.localeCompare(b.name, 'nl'))) {
    let slug = slugify(p.name), n = 2;
    while (taken.has(slug)) slug = `${slugify(p.name)}-${n++}`;
    taken.add(slug); p.slug = slug;
    p.index = p.stage !== 'unrated' || site.indexUnrated === true || p.basis === 'filter';
    p.belang = site.belangen?.ids?.includes(p.scanId) || false;
  }

  const rank = (a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage] || a.name.localeCompare(b.name, 'nl');

  // Targets: what the products replace.
  const targets = new Map();
  for (const p of products) for (const t of p.replaces) {
    if (!targets.has(t.key)) {
      const c = t.catalog ? catalog[t.catalog] : null;
      const display = site.targetNames?.[t.key] || t.name;
      targets.set(t.key, { key: t.key, slug: slugify(display), name: display, vendor: c?.vendor || '', hq: c?.hq || null, category: c?.category || null, products: [] });
    }
    targets.get(t.key).products.push(p);
  }
  const usedSlugs = new Set();
  for (const t of [...targets.values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'))) {
    let slug = t.slug, n = 2;
    while (usedSlugs.has(slug)) slug = `${t.slug}-${n++}`;
    usedSlugs.add(slug); t.slug = slug;
    t.products.sort(rank);
    t.rated = t.products.filter(p => p.stage !== 'unrated').length;
  }
  for (const p of products) p.targets = p.replaces.map(r => targets.get(r.key)).filter(Boolean);

  // Categories.
  const categories = new Map();
  for (const p of products) {
    if (!categories.has(p.category)) categories.set(p.category, { id: p.category, label: CATEGORY_LABEL[p.category], slug: slugify(CATEGORY_LABEL[p.category]), products: [] });
    categories.get(p.category).products.push(p);
  }
  for (const c of categories.values()) c.products.sort(rank);

  // Sectors: only those with enough products to be useful.
  const sectors = SECTORS.map(name => ({ name, slug: slugify(name), products: products.filter(p => p.sectors.includes(name)).sort(rank) }))
    .filter(s => s.products.length >= (site.minSectorPage ?? 3));

  const count = stage => products.filter(p => p.stage === stage).length;
  const stats = {
    products: products.length, rated: products.length - count('unrated'),
    advise: count('advise'), conditional: count('conditional'), watch: count('watch'), unrated: count('unrated'),
    targets: targets.size, goal: alt.GUIDE_GOAL, rowsTotal: scan.data.count ?? rows.length,
  };

  return {
    generated: scan.data.generated || '', stats, products, targets: [...targets.values()], categories: [...categories.values()].sort((a, b) => a.label.localeCompare(b.label, 'nl')),
    sectors, excluded, rank, comparisons: buildComparisons(products, [...targets.values()]),
  };
}

// ---- Comparisons ---------------------------------------------------------------------------------------------
// "A or B" pages. Only products that Newground has assessed (a page that compares two unchecked entries would be
// a guess), in the same category, that replace at least one product in common. One page per pair, in
// alphabetical order. A pair is indexed only when both are Advise or Conditional; a comparison with a product
// that is only followed (Watch) stays visible but noindex, like any other page about something not recommended yet.

const INDEXABLE = new Set(['advise', 'conditional']);

export function shortName(p) {
  const n = p.name.replace(/\s*\([^)]*\)/g, '').trim();
  return p.name.length > 26 && n.length >= 3 ? n : p.name;
}

export function buildComparisons(products, targets) {
  const pairs = new Map();
  for (const t of targets) {
    const rated = t.products.filter(p => p.stage !== 'unrated');
    for (let i = 0; i < rated.length; i++) for (let j = i + 1; j < rated.length; j++) {
      const [a, b] = [rated[i], rated[j]].sort((x, y) => x.name.localeCompare(y.name, 'nl') || x.slug.localeCompare(y.slug));
      if (a.category !== b.category) continue;
      if (!(a.assessment || a.note) || !(b.assessment || b.note)) continue;
      const key = `${a.slug}|${b.slug}`;
      if (!pairs.has(key)) pairs.set(key, { a, b, category: a.category, targets: [] });
      pairs.get(key).targets.push(t);
    }
  }
  // Short addresses ("mistral-vibe-vs-langdock"); on a clash the full product addresses are used.
  const plain = p => slugify(p.name.replace(/\s*\([^)]*\)/g, '').trim() || p.name);
  const used = new Set();
  const list = [...pairs.values()].map(c => {
    let slug = `${plain(c.a)}-vs-${plain(c.b)}`;
    if (used.has(slug)) slug = `${c.a.slug}-vs-${c.b.slug}`;
    used.add(slug);
    return { ...c, slug, index: INDEXABLE.has(c.a.stage) && INDEXABLE.has(c.b.stage) };
  });
  // Most useful first: both recommended, then more products in common, then alphabetical.
  list.sort((x, y) => Number(y.index) - Number(x.index) || y.targets.length - x.targets.length || x.slug.localeCompare(y.slug));
  for (const p of products) p.comparisons = [];
  for (const c of list) { c.a.comparisons.push(c); c.b.comparisons.push(c); }
  return list;
}

// Whether a target is worth its own page: at least one product, and for a name that is only free text
// at least one product that is assessed or approved (a lone candidate is not a page).
export const targetHasPage = t => t.products.length > 0 && (t.hq !== null || t.rated > 0 || t.products.length >= 2);

export const isEuropean = p => p.country ? EU_LIKE.has(p.country.code) || ['CH', 'UK', 'GB', 'NO', 'IS'].includes(p.country.code) : null;
