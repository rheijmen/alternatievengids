// All pages of the Gids. Each builder returns { path, html, index } so the sitemap knows what to list.

import { esc, lead, fit, nl, dateNl, isoDay } from './text.mjs';
import { STAGES, STAGE_LABEL, CATEGORY_LABEL, targetHasPage, shortName } from './model.mjs';
import { layout, link, badge, mailto, sponsorBanner, submitForm, scanCta, faqHtml, faqLd, breadcrumbs, organizationLd, meter, NEWTAB } from './render.mjs';

const OWNERSHIP_TIP = 'Er is nieuws over een overname of nieuwe eigenaar. Newground bekijkt dit oordeel opnieuw. Tot die tijd kan het oordeel achterhaald zijn.';

const OPEN = { yes: 'Ja', core: 'Gedeeltelijk (open core)', no: 'Nee' };
const DELIVERY = { managed: 'Beheerd door een host', 'self-hosted': 'Zelf te hosten', saas: 'Als dienst (SaaS)' };
const lc = s => s.charAt(0).toLowerCase() + s.slice(1);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const productPath = p => `/alternatieven/${p.slug}/`;
const targetPath = t => `/alternatief-voor/${t.slug}/`;

function metaText(p) {
  const bits = [];
  if (p.vendor) bits.push(esc(p.vendor));
  if (p.country) bits.push(esc(p.country.name));
  return bits.join(' · ');
}

function chips(p) {
  const c = [];
  if (p.openSource === 'yes') c.push('Open source');
  if (p.openSource === 'core') c.push('Open core');
  if (p.govUse.length || p.govSupplier) c.push('Overheid');
  if (p.smbFit) c.push('Mkb');
  if (p.country?.code === 'NL') c.push('Nederlands');
  return c;
}

function itemText(p) {
  if (p.summary) return p.summary;
  const reps = p.replaces.map(r => r.name);
  return `${CATEGORY_LABEL[p.category]}${reps.length ? `, vervangt ${nl(reps.slice(0, 3))}` : ''}. Nog niet beoordeeld door Newground.`;
}

function item(p) {
  const c = chips(p);
  return `<li class="item" data-os="${p.openSource === 'yes' || p.openSource === 'core' ? 1 : 0}" data-gov="${p.govUse.length || p.govSupplier ? 1 : 0}" data-smb="${p.smbFit ? 1 : 0}" data-nl="${p.country?.code === 'NL' ? 1 : 0}">
  <div class="item-main">
    <h3><a href="${productPath(p)}">${esc(p.name)}</a></h3>
    ${metaText(p) ? `<p class="item-meta">${metaText(p)}</p>` : ''}
    <p class="item-text">${esc(lead(itemText(p), 200))}</p>
  </div>
  <div class="item-side">${badge(p.stage)}${p.review ? `<span class="badge badge-review has-tip" tabindex="0">Eigendom verandert<span class="tip">${OWNERSHIP_TIP}</span></span>` : ''}${p.publicOnly ? '<span class="badge badge-gov">Alleen voor overheid</span>' : ''}${c.length ? `<ul class="chips">${c.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>
</li>`;
}

const GROUPS = [
  ['advise', 'Aanbevolen door Newground', ''],
  ['conditional', 'Geschikt onder voorwaarden', 'Newground ziet deze producten als goede keuze, mits aan de voorwaarden in de beoordeling is voldaan.'],
  ['watch', 'Newground volgt deze', 'Nog niet aan te bevelen. Newground houdt de ontwikkeling in de gaten.'],
  ['unrated', 'Gevonden, nog niet beoordeeld', 'Deze producten komen uit openbare bronnen. Newground heeft ze nog niet getoetst en de gegevens zijn niet gecontroleerd.'],
];

function grouped(products, { headingLevel = 2 } = {}) {
  return GROUPS.map(([stage, title, note]) => {
    const list = products.filter(p => p.stage === stage);
    if (!list.length) return '';
    return `<section class="group group-${stage}" aria-labelledby="g-${stage}"><h${headingLevel} id="g-${stage}">${title} <span class="count">${list.length}</span></h${headingLevel}>${note ? `<p class="group-note">${note}</p>` : ''}<ul class="items">${list.map(item).join('')}</ul></section>`;
  }).join('');
}

const filters = () => `<div class="filters" data-filters hidden role="group" aria-label="Filter">
  <button type="button" class="chip" data-filter="all" aria-pressed="true">Alles</button>
  <button type="button" class="chip" data-filter="os" aria-pressed="false">Open source</button>
  <button type="button" class="chip" data-filter="nl" aria-pressed="false">Nederlands</button>
  <button type="button" class="chip" data-filter="gov" aria-pressed="false">Door overheden gebruikt</button>
  <button type="button" class="chip" data-filter="smb" aria-pressed="false">Geschikt voor mkb</button>
  <span class="filter-empty" hidden>Geen producten met dit filter.</span>
</div>`;

const trim = (s, n = 155) => fit(s, n);

// ---- Answers (written for people and for search and AI answer engines) -------------------------------------

function targetAnswer(t) {
  const of = s => t.products.filter(p => p.stage === s);
  const adv = of('advise'), con = of('conditional');
  const parts = [];
  if (adv.length) parts.push(`Newground adviseert ${nl(adv.map(p => p.name))} als Europees alternatief voor ${t.name}.`);
  if (con.length) parts.push(`${nl(con.map(p => p.name))} ${con.length > 1 ? 'zijn' : 'is'} geschikt onder voorwaarden.`);
  if (!adv.length && !con.length) parts.push(`Newground beveelt nog geen alternatief voor ${t.name} aan.`);
  const rest = t.products.length - adv.length - con.length;
  if (rest > 0) parts.push(`Daarnaast ${rest === 1 ? 'staat er 1 product' : `staan er ${rest} producten`} in de gids die Newground volgt of nog niet heeft beoordeeld.`);
  return parts.join(' ');
}

function productAnswer(p) {
  const reps = p.replaces.map(r => r.name);
  const what = `${p.name} is ${p.category === 'ai' ? 'een AI-product' : `een product voor ${lc(CATEGORY_LABEL[p.category])}`}${p.vendor ? ` van ${p.vendor}` : ''}${p.country ? ` (${p.country.name})` : ''}.`;
  const verdict = {
    advise: `Newground adviseert dit product${reps.length ? ` als Europees alternatief voor ${nl(reps.slice(0, 4))}` : ''}.`,
    conditional: `Newground ziet dit product${reps.length ? ` als alternatief voor ${nl(reps.slice(0, 4))}` : ''} onder voorwaarden geschikt.`,
    watch: 'Newground volgt dit product, maar beveelt het nog niet aan.',
    unrated: 'Dit product staat in de gids, maar Newground heeft het nog niet beoordeeld. De gegevens hieronder zijn nog niet gecontroleerd.',
  }[p.stage];
  return `${what} ${verdict}`;
}

// Title stays under about 70 characters including the site name that the layout adds.
function productTitle(p) {
  const r = p.replaces[0]?.name;
  const options = [
    r && `${p.name}: ${STAGE_LABEL[p.stage].toLowerCase()}, alternatief voor ${r}`, r && `${p.name}: alternatief voor ${r}`,
    `${p.name}: Europees alternatief`, p.name,
  ].filter(Boolean);
  return options.find(o => o.length + 21 <= 68) || p.name;
}

// ---- Product page --------------------------------------------------------------------------------------------

function productPage(ctx, p) {
  const { site } = ctx;
  const bc = breadcrumbs(ctx, [['/', 'Start'], ['/alternatieven/', 'Alle producten'], [productPath(p), p.name]]);
  const reps = p.replaces;
  const other = reps[0] ? ctx.model.targets.find(t => t.key === reps[0].key)?.products.filter(x => x !== p && x.stage !== 'unrated').slice(0, 4) || [] : [];
  const facts = [
    ['Hoofdkantoor', p.country ? esc(p.country.name) : 'Nog niet gecontroleerd'],
    p.vendor && ['Bedrijf', esc(p.vendor)],
    p.openSource && ['Open source', OPEN[p.openSource]],
    p.delivery.length && ['Levering', p.delivery.map(d => DELIVERY[d] || d).join(', ')],
    p.govSupplier && ['Overheidseisen', 'Newground las een geldig ISO 27001-certificaat en een verklaring over BIO, NIS2 of NEN 7510.'],
    p.smbFit && ['Mkb', 'Webinterface en een beheerde Europese dienst, geschikt voor 30 tot 300 medewerkers.'],
    p.sealLevel && ['EU-soevereiniteitsniveau', `SEAL-${esc(p.sealLevel)}${p.bottleneck ? `: ${esc(p.bottleneck)}` : ''}`],
    p.checked && ['Laatst gecontroleerd', esc(dateNl(p.checked))],
    p.reevaluate && ['Opnieuw bekijken', esc(p.reevaluate)],
    p.website && ['Website', `<a href="${esc(p.website)}" rel="${p.stage === 'unrated' ? 'nofollow ' : ''}noopener" target="_blank">${esc(p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}${NEWTAB}</a>`],
  ].filter(Boolean);

  const body = `${bc.html}
<article class="product" data-basis="${p.basis}">
  <header class="page-head">
    <p class="kicker">${esc(CATEGORY_LABEL[p.category])}</p>
    <h1>${esc(p.name)}</h1>
    <p class="head-badges">${badge(p.stage)}${p.review ? '<span class="badge badge-review">Eigendom verandert</span>' : ''}${p.publicOnly ? '<span class="badge badge-gov">Alleen voor overheid</span>' : ''}</p>
  </header>
  <p class="answer"><strong>Kort antwoord.</strong> ${esc(productAnswer(p))}</p>
  ${p.review ? '<p class="notice">Er is nieuws over een overname of nieuwe eigenaar. Newground bekijkt dit oordeel opnieuw.</p>' : ''}
  ${p.belang ? `<p class="notice notice-belang"><strong>Belang.</strong> ${esc(site.belangen.text)}</p>` : ''}
  ${p.stage === 'unrated' ? `<p class="notice">Newground heeft dit product nog niet beoordeeld. We hebben het gevonden in openbare bronnen. Lees ${link('/hoe-we-beoordelen/', 'hoe we beoordelen')}.</p>` : ''}
  <div class="product-grid">
    <div class="product-main">
      ${p.assessment ? `<section><h2>Oordeel van Newground</h2><blockquote class="assessment">${esc(p.assessment)}</blockquote></section>` : ''}
      ${p.note && p.note !== p.assessment ? `<section><h2>Wat het is</h2><p>${esc(p.note)}</p></section>` : ''}
      ${p.govUse.length ? `<section><h2>Door overheden gebruikt</h2><ul class="plain">${p.govUse.map(g => `<li><strong>${esc(g.who)}</strong>${g.what ? `: ${esc(g.what)}` : ''}${g.url ? ` (${link(g.url, `bron<span class="visually-hidden"> van ${esc(g.who)} (opent in een nieuw tabblad)</span>`, 'rel="noopener" target="_blank"')})` : ''}</li>`).join('')}</ul></section>` : ''}
      ${reps.length ? `<section><h2>Vervangt</h2><ul class="chips chips-lg">${reps.map(r => { const t = ctx.model.targets.find(x => x.key === r.key); return `<li>${t && targetHasPage(t) ? link(targetPath(t), esc(r.name)) : esc(r.name)}</li>`; }).join('')}</ul></section>` : ''}
      ${p.sources.length ? `<section><h2>Bronnen</h2><ul class="plain sources">${p.sources.map(s => `<li>${link(s, esc(s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')) + NEWTAB, 'rel="noopener" target="_blank"')}</li>`).join('')}</ul></section>` : ''}
      ${other.length ? `<section><h2>Andere alternatieven voor ${esc(reps[0].name)}</h2><ul class="items">${other.map(item).join('')}</ul></section>` : ''}
      ${p.comparisons?.length ? `<section><h2>Vergelijk ${esc(shortName(p))} met</h2><ul class="chips chips-lg">${p.comparisons.slice(0, 6).map(c => `<li>${link(comparePath(c), esc(shortName(c.a === p ? c.b : c.a)))}</li>`).join('')}</ul></section>` : ''}
    </div>
    <aside class="product-side">
      <h2 class="visually-lead">Feiten</h2>
      <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <p class="side-links">
        <a href="${esc(mailto(ctx.scan.contact.email, `Klopt er iets niet: ${p.name}`, `Hoi Rik,\n\nBij ${p.name} op alternatievengids.nl (${site.siteUrl}${productPath(p)}) klopt volgens mij iets niet:\n\n`))}">Klopt er iets niet? Meld het</a><br>
        <a href="/dien-in/?role=producent&amp;product=${encodeURIComponent(p.name)}" data-submit-open>Ben je de producent of leverancier? Geef een update door</a>
      </p>
    </aside>
  </div>
  ${scanCta(ctx, p.replaces[0] ? `Gebruikt jouw organisatie ${esc(p.replaces[0].name)}? Doe de gratis Soevereiniteitsscan van Newground en zie in ongeveer vijf minuten hoe afhankelijk je bent en wat een eerste stap is.` : '')}
</article>`;

  const ld = [organizationLd(ctx), bc.ld, {
    '@context': 'https://schema.org', '@type': 'WebPage', name: p.name, url: site.siteUrl + productPath(p), dateModified: isoDay(ctx.model.generated),
    isPartOf: { '@type': 'WebSite', name: site.name, url: site.siteUrl + '/' }, publisher: { '@id': site.newgroundUrl + '/#organization' },
    about: { '@type': 'SoftwareApplication', name: p.name, applicationCategory: CATEGORY_LABEL[p.category], ...(p.website ? { url: p.website } : {}), ...(p.vendor ? { author: { '@type': 'Organization', name: p.vendor } } : {}) },
  }];
  return {
    path: productPath(p), index: p.index,
    html: layout(ctx, {
      path: productPath(p), title: productTitle(p),
      description: trim(productAnswer(p)), body, jsonld: ld, robots: p.index ? 'index,follow' : 'noindex,follow', modified: ctx.model.generated,
    }),
  };
}

// Title stays under about 70 characters including the site name that the layout adds.
function targetTitle(t, rec) {
  const base = `Europees alternatief voor ${t.name}`;
  for (const extra of [`: ${plural(t.products.length, 'optie', 'opties')}, ${rec} aanbevolen`, `: ${plural(t.products.length, 'optie', 'opties')}`]) {
    if (extra.includes('0 aanbevolen') && rec === 0) continue;
    if ((base + extra).length + 21 <= 68) return base + extra;
  }
  return base;
}

// ---- Target ("Europees alternatief voor X") ------------------------------------------------------------------

function targetPage(ctx, t) {
  const { site, model } = ctx;
  const bc = breadcrumbs(ctx, [['/', 'Start'], ['/alternatief-voor/', 'Alternatief voor'], [targetPath(t), t.name]]);
  const os = t.products.filter(p => p.openSource === 'yes' || p.openSource === 'core');
  const rec = t.products.filter(p => p.stage === 'advise' || p.stage === 'conditional');
  const us = t.hq === 'US';
  const faq = [
    [`Wat is het beste Europese alternatief voor ${t.name}?`, `${esc(targetAnswer(t))} Welk product past hangt af van de grootte van je organisatie, je sector en wie het beheer doet. Lees per product het oordeel van Newground.`],
    [`Is er een open-source alternatief voor ${t.name}?`, os.length
      ? `Ja. In de gids staan ${plural(os.length, 'open-source of open-core alternatief', 'open-source of open-core alternatieven')}: ${esc(nl(os.slice(0, 6).map(p => p.name)))}. Controleer per product of de licentie echt open is en wie het beheert.`
      : `In de gids staat nog geen open-source alternatief voor ${esc(t.name)}. Mis je er een? ${link('/dien-in/', 'Dien het in', 'data-submit-open')}.`],
    ...(us ? [[`Waarom een alternatief voor ${t.name} zoeken?`, `${esc(t.name)} komt van ${esc(t.vendor || 'een Amerikaans bedrijf')}, een Amerikaans bedrijf. Daarmee valt de dienst onder Amerikaanse wetgeving zoals de CLOUD Act, ook als je gegevens in een Europees datacenter staan. Een Europees alternatief valt onder Europese wet.`]] : []),
    [`Hoe weet ik hoe afhankelijk mijn organisatie van ${t.name} is?`, `Doe de gratis ${link(site.scanUrl, 'Soevereiniteitsscan')} van Newground. In ongeveer vijf minuten zie je welke systemen je gebruikt, hoe afhankelijk je bent van Amerikaanse leveranciers en wat een eerste stap is.`],
  ];
  const compares = model.comparisons.filter(c => c.targets.includes(t)).slice(0, 8);
  const relatedTargets = model.targets.filter(x => x !== t && targetHasPage(x) && t.category && x.category === t.category).slice(0, 8);

  const body = `${bc.html}
<header class="page-head">
  <p class="kicker">Alternatief voor</p>
  <h1>Europees alternatief voor ${esc(t.name)}</h1>
</header>
<p class="answer"><strong>Kort antwoord.</strong> ${esc(targetAnswer(t))} <span class="updated">Bijgewerkt op ${esc(dateNl(model.generated))}.</span></p>
${us ? `<p class="context">${esc(t.name)} is van ${esc(t.vendor || 'een Amerikaans bedrijf')}, een Amerikaans bedrijf. Daarmee valt het onder Amerikaanse wetten zoals de CLOUD Act, ook als je gegevens in Europa staan. De alternatieven hieronder vallen onder Europese wet, of zijn open source en dus te verplaatsen.</p>` : ''}
${sponsorBanner(ctx)}
${t.products.length > 3 ? filters() : ''}
<div data-filterable>${grouped(t.products)}</div>
${compares.length ? `<section class="related"><h2>Vergelijk de beoordeelde alternatieven</h2><ul class="chips chips-lg">${compares.map(c => `<li>${link(comparePath(c), `${esc(shortName(c.a))} of ${esc(shortName(c.b))}`)}</li>`).join('')}</ul></section>` : ''}
${scanCta(ctx, `Gebruik je ${esc(t.name)}? Doe de gratis Soevereiniteitsscan van Newground en zie in ongeveer vijf minuten hoe afhankelijk je organisatie is en wat een eerste stap is.`)}
${faqHtml(faq)}
${relatedTargets.length ? `<section class="related"><h2>Meer alternatieven in ${esc(lc(CATEGORY_LABEL[t.category]))}</h2><ul class="chips chips-lg">${relatedTargets.map(x => `<li>${link(targetPath(x), esc(x.name))}</li>`).join('')}</ul></section>` : ''}`;

  const ld = [organizationLd(ctx), bc.ld, faqLd(faq), {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: `Europees alternatief voor ${t.name}`, url: site.siteUrl + targetPath(t), dateModified: isoDay(model.generated),
    isPartOf: { '@type': 'WebSite', name: site.name, url: site.siteUrl + '/' }, publisher: { '@id': site.newgroundUrl + '/#organization' },
    mainEntity: { '@type': 'ItemList', numberOfItems: t.products.length, itemListElement: t.products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: site.siteUrl + productPath(p) })) },
  }];
  return {
    path: targetPath(t), index: true,
    html: layout(ctx, {
      path: targetPath(t), title: targetTitle(t, rec.length),
      description: trim(`Europees alternatief voor ${t.name}? ${targetAnswer(t)} Met oordeel en bronnen van Newground.`), body, jsonld: ld, modified: model.generated,
    }),
  };
}

// ---- Comparison ("A of B") -----------------------------------------------------------------------------------
// Everything on these pages comes from the data Newground keeps for both products; nothing is invented.

const comparePath = c => `/vergelijk/${c.slug}/`;
const verdictWord = stage => `"${STAGE_LABEL[stage]}"`;
const OPEN_WORD = { yes: 'open source', core: 'open core', no: 'niet open source' };

function differences(a, b) {
  const A = shortName(a), B = shortName(b), out = [];
  if (a.openSource && b.openSource && a.openSource !== b.openSource) out.push(`${A} is ${OPEN_WORD[a.openSource]}, ${B} is ${OPEN_WORD[b.openSource]}.`);
  if (a.country && b.country && a.country.code !== b.country.code) out.push(`${A} komt uit ${a.country.name}, ${B} uit ${b.country.name}.`);
  const da = a.delivery.map(d => DELIVERY[d] || d).join(', '), db = b.delivery.map(d => DELIVERY[d] || d).join(', ');
  if (da && db && da !== db) out.push(`Levering. ${A}: ${da.toLowerCase().replace('saas', 'SaaS')}. ${B}: ${db.toLowerCase().replace('saas', 'SaaS')}.`);
  if (Boolean(a.govSupplier) !== Boolean(b.govSupplier)) out.push(`${a.govSupplier ? A : B} voldoet aan de overheidseisen die Newground controleert; bij ${a.govSupplier ? B : A} is dat niet bevestigd.`);
  if (Boolean(a.smbFit) !== Boolean(b.smbFit)) out.push(`${a.smbFit ? A : B} past bij organisaties van 30 tot 300 medewerkers; bij ${a.smbFit ? B : A} is dat niet bevestigd.`);
  if (a.govUse.length !== b.govUse.length) {
    const n = (k, name) => (k ? `${k} bij ${name}` : `geen bij ${name}`);
    out.push(`Newground kent overheidsreferenties: ${n(a.govUse.length, A)}, ${n(b.govUse.length, B)}.`);
  }
  if (a.stage !== b.stage) out.push(`Newground geeft ${A} het oordeel ${verdictWord(a.stage)} en ${B} ${verdictWord(b.stage)}.`);
  return out;
}

function compareAnswer(c) {
  const { a, b } = c, A = shortName(a), B = shortName(b);
  const parts = [a.stage === b.stage
    ? `Newground geeft ${A} en ${B} hetzelfde oordeel: ${verdictWord(a.stage)}.`
    : `Newground geeft ${A} het oordeel ${verdictWord(a.stage)} en ${B} ${verdictWord(b.stage)}.`];
  parts.push(`Beide zijn een alternatief voor ${nl(c.targets.map(t => t.name).slice(0, 4))}.`);
  const diffs = differences(a, b).filter(d => !d.startsWith('Newground geeft'));
  parts.push(...diffs.slice(0, 2));
  if (!diffs.length) parts.push('Op de gegevens die Newground bijhoudt lijken ze op elkaar; lees de beoordelingen voor de verschillen.');
  return parts.join(' ');
}

export const comparisonSummary = c => compareAnswer(c);

function compareTitle(c) {
  const A = shortName(c.a), B = shortName(c.b);
  const base = n => n.replace(/\s*\([^)]*\)/g, '').split(' / ')[0].trim();
  const fits = t => t.length + 21 <= 68;
  return [`${A} of ${B}: vergelijking`, `${A} of ${B}`, `${base(A)} of ${base(B)}: vergelijking`, `${base(A)} of ${base(B)}`].find(fits) || `${base(A)} of ${base(B)}`;
}

function compareLinks(c, list) {
  return list.filter(x => x !== c).slice(0, 6).map(x => `<li>${link(comparePath(x), `${esc(shortName(x.a))} of ${esc(shortName(x.b))}`)}</li>`).join('');
}

function comparePage(ctx, c) {
  const { site, model } = ctx;
  const { a, b } = c, A = shortName(a), B = shortName(b);
  const path = comparePath(c);
  const bc = breadcrumbs(ctx, [['/', 'Start'], ['/vergelijk/', 'Vergelijken'], [path, `${A} of ${B}`]]);
  const answer = compareAnswer(c);
  const val = (p, k) => ({
    stage: badge(p.stage),
    country: p.country ? esc(p.country.name) : 'Nog niet gecontroleerd',
    vendor: p.vendor ? esc(p.vendor) : '',
    open: p.openSource ? OPEN[p.openSource] : '',
    delivery: p.delivery.map(d => DELIVERY[d] || d).join(', '),
    gov: p.govUse.length ? `${plural(p.govUse.length, 'referentie', 'referenties')} bij overheden` : 'Geen referentie bekend bij Newground',
    govSupplier: p.govSupplier ? 'Bevestigd' : 'Niet bevestigd',
    smb: p.smbFit ? 'Geschikt' : 'Niet bevestigd',
    checked: p.checked ? esc(dateNl(p.checked)) : '',
    replaces: p.replaces.slice(0, 6).map(r => esc(r.name)).join(', '),
  })[k];
  const rows = [
    ['Oordeel van Newground', 'stage'], ['Hoofdkantoor', 'country'], ['Bedrijf', 'vendor'], ['Open source', 'open'], ['Levering', 'delivery'],
    ['Door overheden gebruikt', 'gov'], ['Overheidseisen', 'govSupplier'], ['Mkb (30 tot 300 medewerkers)', 'smb'], ['Laatst gecontroleerd', 'checked'], ['Vervangt', 'replaces'],
  ].filter(([, k]) => val(a, k) || val(b, k));
  const table = `<table class="compare">
  <caption class="visually-hidden">Vergelijking van ${esc(A)} en ${esc(B)}</caption>
  <thead><tr><td></td><th scope="col"><a href="${productPath(a)}">${esc(A)}</a></th><th scope="col"><a href="${productPath(b)}">${esc(B)}</a></th></tr></thead>
  <tbody>${rows.map(([label, k]) => `<tr><th scope="row">${label}</th><td>${val(a, k) || '<span class="muted">Onbekend</span>'}</td><td>${val(b, k) || '<span class="muted">Onbekend</span>'}</td></tr>`).join('')}</tbody>
</table>`;
  const sayings = [a, b].map(p => `<section class="saying"><h3><a href="${productPath(p)}">${esc(shortName(p))}</a> ${badge(p.stage)}</h3>${p.assessment ? `<blockquote class="assessment">${esc(p.assessment)}</blockquote>` : `<p>${esc(p.note)}</p>`}${p.checked ? `<p class="hint">Laatst gecontroleerd op ${esc(dateNl(p.checked))}.</p>` : ''}</section>`).join('');
  const diffs = differences(a, b);
  const notes = [a, b].filter(p => p.belang).map(p => `<p class="notice notice-belang"><strong>Belang.</strong> ${esc(shortName(p))}: ${esc(site.belangen.text)}</p>`).join('') +
    [a, b].filter(p => p.review).map(p => `<p class="notice">Bij ${esc(shortName(p))} is er nieuws over een overname of nieuwe eigenaar. Newground bekijkt dit oordeel opnieuw.</p>`).join('');
  const faq = [
    [`Wat is het verschil tussen ${A} en ${B}?`, esc(answer)],
    [`Welke adviseert Newground: ${A} of ${B}?`, a.stage === b.stage
      ? `Newground geeft beide hetzelfde oordeel (${esc(verdictWord(a.stage))}). Welke past, hangt af van je situatie; lees per product de beoordeling.`
      : `Newground geeft ${esc(A)} het oordeel ${esc(verdictWord(a.stage))} en ${esc(B)} ${esc(verdictWord(b.stage))}. Lees per product de beoordeling.`],
    ...(a.openSource && b.openSource ? [[`Zijn ${A} en ${B} open source?`, `${esc(A)} is ${OPEN_WORD[a.openSource]} en ${esc(B)} is ${OPEN_WORD[b.openSource]}.`]] : []),
  ];
  const body = `${bc.html}
<header class="page-head">
  <p class="kicker">Vergelijking</p>
  <h1>${esc(A)} of ${esc(B)}</h1>
  <p class="lead">Twee Europese alternatieven voor ${esc(nl(c.targets.map(t => t.name).slice(0, 3)))}, naast elkaar. Alle gegevens komen uit de lijst van Newground.</p>
</header>
<p class="answer"><strong>Kort antwoord.</strong> ${esc(answer)} <span class="updated">Bijgewerkt op ${esc(dateNl(model.generated))}.</span></p>
${notes}
${sponsorBanner(ctx)}
<section><h2>De gegevens naast elkaar</h2><div class="table-wrap" tabindex="0" role="region" aria-label="Vergelijking van ${esc(A)} en ${esc(B)}, scroll zijwaarts als de tabel niet past">${table}</div></section>
${diffs.length ? `<section><h2>Waar ze op verschillen</h2><ul class="plain">${diffs.map(d => `<li>${esc(d)}</li>`).join('')}</ul></section>` : ''}
<section><h2>Wat Newground zegt</h2><div class="sayings">${sayings}</div></section>
${scanCta(ctx, `Gebruik je ${esc(c.targets[0].name)}? Doe de gratis Soevereiniteitsscan van Newground en zie in ongeveer vijf minuten hoe afhankelijk je organisatie is en wat een eerste stap is.`)}
${faqHtml(faq)}
<section class="related"><h2>Meer vergelijken</h2><ul class="chips chips-lg">${compareLinks(c, [...a.comparisons, ...b.comparisons].filter((x, i, all) => all.indexOf(x) === i))}</ul>
<p class="hint">${c.targets.map(t => link(targetPath(t), `Alle alternatieven voor ${esc(t.name)}`)).join(' · ')}</p></section>`;

  const ld = [organizationLd(ctx), bc.ld, faqLd(faq), {
    '@context': 'https://schema.org', '@type': 'WebPage', name: `${A} of ${B}`, url: site.siteUrl + path, dateModified: isoDay(model.generated),
    isPartOf: { '@type': 'WebSite', name: site.name, url: site.siteUrl + '/' }, publisher: { '@id': site.newgroundUrl + '/#organization' },
    about: [a, b].map(p => ({ '@type': 'SoftwareApplication', name: shortName(p), applicationCategory: CATEGORY_LABEL[p.category], url: site.siteUrl + productPath(p) })),
  }];
  return {
    path, index: c.index,
    html: layout(ctx, { path, title: compareTitle(c), description: trim(`${A} of ${B}? ${answer}`), body, jsonld: ld, robots: c.index ? 'index,follow' : 'noindex,follow', modified: model.generated }),
  };
}

function comparisonsIndex(ctx) {
  const all = ctx.model.comparisons;
  const bc = breadcrumbs(ctx, [['/', 'Start'], ['/vergelijk/', 'Vergelijken']]);
  const byCat = new Map();
  for (const c of all) (byCat.get(c.category) || byCat.set(c.category, []).get(c.category)).push(c);
  const body = `${bc.html}
<header class="page-head"><h1>Europese alternatieven vergelijken</h1><p class="lead">Twee alternatieven naast elkaar: oordeel van Newground, land, open source, levering en overheidsreferenties. Alleen producten die Newground heeft beoordeeld.</p></header>
${[...byCat.entries()].sort((x, y) => CATEGORY_LABEL[x[0]].localeCompare(CATEGORY_LABEL[y[0]], 'nl')).map(([cat, list]) => `<section class="letter"><h2>${esc(CATEGORY_LABEL[cat])} <span class="count">${list.length}</span></h2><ul class="list-cols">${list.map(c => `<li><a href="${comparePath(c)}">${esc(shortName(c.a))} of ${esc(shortName(c.b))}</a></li>`).join('')}</ul></section>`).join('')}
${scanCta(ctx)}`;
  return { path: '/vergelijk/', index: true, html: layout(ctx, { path: '/vergelijk/', title: 'Europese alternatieven vergelijken', description: `${all.length} vergelijkingen van Europese en open-source alternatieven, met het oordeel van Newground.`, body, jsonld: [organizationLd(ctx), bc.ld], modified: ctx.model.generated }) };
}

// ---- Listings ------------------------------------------------------------------------------------------------

function lettered(list, nameOf, hrefOf, countOf) {
  const by = new Map();
  for (const x of list) { const l = nameOf(x).charAt(0).toUpperCase().replace(/[^A-Z0-9]/, '#'); (by.get(l) || by.set(l, []).get(l)).push(x); }
  const letters = [...by.keys()].sort();
  return `<nav class="letters" aria-label="Spring naar letter">${letters.map(l => `<a href="#l-${l === '#' ? 'other' : l}">${l}</a>`).join('')}</nav>` +
    letters.map(l => `<section class="letter" id="l-${l === '#' ? 'other' : l}"><h2>${l}</h2><ul class="list-cols">${by.get(l).map(x => `<li><a href="${hrefOf(x)}">${esc(nameOf(x))}</a> <span class="count">${countOf(x)}</span></li>`).join('')}</ul></section>`).join('');
}

function targetsIndex(ctx) {
  const ts = ctx.model.targets.filter(targetHasPage);
  const bc = breadcrumbs(ctx, [['/', 'Start'], ['/alternatief-voor/', 'Alternatief voor']]);
  const body = `${bc.html}
<header class="page-head"><h1>Europees alternatief voor welk product?</h1><p class="lead">Kies het Amerikaanse product dat je wilt vervangen. Je ziet welke Europese en open-source alternatieven Newground bijhoudt, en wat we ervan vinden.</p></header>
${lettered(ts, t => t.name, targetPath, t => plural(t.products.length, 'alternatief', 'alternatieven'))}`;
  return { path: '/alternatief-voor/', index: true, html: layout(ctx, { path: '/alternatief-voor/', title: 'Europees alternatief voor Amerikaanse software', description: `Per Amerikaans product de Europese en open-source alternatieven: ${ts.length} producten om te vervangen, met het oordeel van Newground.`, body, jsonld: [organizationLd(ctx), bc.ld] }) };
}

function productsIndex(ctx) {
  const ps = ctx.model.products;
  const bc = breadcrumbs(ctx, [['/', 'Start'], ['/alternatieven/', 'Alle producten']]);
  const body = `${bc.html}
<header class="page-head"><h1>Alle Europese alternatieven</h1><p class="lead">${ps.length} producten, van A tot Z. ${ctx.model.stats.rated} zijn beoordeeld door Newground; de rest is gevonden en nog niet getoetst.</p></header>
${lettered(ps, p => p.name, productPath, p => STAGE_LABEL[p.stage].toLowerCase())}`;
  return { path: '/alternatieven/', index: true, html: layout(ctx, { path: '/alternatieven/', title: 'Alle Europese alternatieven van A tot Z', description: `${ps.length} Europese en open-source alternatieven voor Amerikaanse software, met het oordeel van Newground.`, body, jsonld: [organizationLd(ctx), bc.ld] }) };
}

function categoriesIndex(ctx) {
  const bc = breadcrumbs(ctx, [['/', 'Start'], ['/categorie/', 'Categorieën']]);
  const body = `${bc.html}
<header class="page-head"><h1>Europese alternatieven per categorie</h1><p class="lead">Zoek op soort software: van werkplek en bestanden tot hosting en AI.</p></header>
<ul class="tiles">${ctx.model.categories.map(c => `<li><a class="tile" href="/categorie/${c.slug}/"><span class="tile-name">${esc(c.label)}</span><span class="tile-count">${plural(c.products.length, 'product', 'producten')}</span></a></li>`).join('')}</ul>`;
  return { path: '/categorie/', index: true, html: layout(ctx, { path: '/categorie/', title: 'Europese alternatieven per categorie', description: 'Europese en open-source alternatieven per soort software: werkplek, bestanden, hosting, AI en meer.', body, jsonld: [organizationLd(ctx), bc.ld] }) };
}

function listPage(ctx, { path, crumbs, h1, kicker, lead: leadText, products, title, description, extra = '' }) {
  const bc = breadcrumbs(ctx, crumbs);
  const body = `${bc.html}
<header class="page-head"><p class="kicker">${kicker}</p><h1>${esc(h1)}</h1><p class="lead">${leadText}</p></header>
${sponsorBanner(ctx)}
${products.length > 3 ? filters() : ''}
<div data-filterable>${grouped(products)}</div>
${extra}
${scanCta(ctx)}`;
  const ld = [organizationLd(ctx), bc.ld, { '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: ctx.site.siteUrl + path, dateModified: isoDay(ctx.model.generated), mainEntity: { '@type': 'ItemList', numberOfItems: products.length, itemListElement: products.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: ctx.site.siteUrl + productPath(p) })) } }];
  return { path, index: true, html: layout(ctx, { path, title, description, body, jsonld: ld, modified: ctx.model.generated }) };
}

const categoryPage = (ctx, c) => listPage(ctx, {
  path: `/categorie/${c.slug}/`, crumbs: [['/', 'Start'], ['/categorie/', 'Categorieën'], [`/categorie/${c.slug}/`, c.label]],
  h1: `Europese alternatieven voor ${lc(c.label)}`, kicker: 'Categorie', products: c.products,
  lead: `${plural(c.products.length, 'product', 'producten')} in deze categorie, ${c.products.filter(p => p.stage !== 'unrated').length} daarvan beoordeeld door Newground.`,
  title: `${`Europese alternatieven voor ${lc(c.label)}`.length + 21 <= 68 ? 'Europese alternatieven' : 'Alternatieven'} voor ${lc(c.label)}`, description: trim(`${c.products.length} Europese en open-source alternatieven voor ${lc(c.label)}. ${c.products.filter(p => p.stage === 'advise').length ? `Newground adviseert ${nl(c.products.filter(p => p.stage === 'advise').map(p => p.name).slice(0, 4))}.` : 'Met het oordeel van Newground.'}`),
});

const sectorPage = (ctx, s) => listPage(ctx, {
  path: `/sector/${s.slug}/`, crumbs: [['/', 'Start'], [`/sector/${s.slug}/`, s.name]],
  h1: `Europese alternatieven voor ${lc(s.name)}`, kicker: 'Sector', products: s.products,
  lead: `Software die past bij ${lc(s.name)}, of die al in die sector wordt gebruikt.`,
  title: `Europese alternatieven voor ${lc(s.name)}`, description: trim(`${s.products.length} Europese en open-source alternatieven voor ${lc(s.name)}, met het oordeel van Newground.`),
});

// ---- Home ----------------------------------------------------------------------------------------------------

function homePage(ctx) {
  const { site, model } = ctx;
  const pages = model.targets.filter(targetHasPage);
  const popular = pages.filter(t => t.hq === 'US').sort((a, b) => b.rated - a.rated || b.products.length - a.products.length).slice(0, 12);
  const faq = [
    ['Wat is alternatievengids.nl?', 'Een Nederlandse gids met Europese en open-source alternatieven voor Amerikaanse software. Per product dat je wilt vervangen zie je welke alternatieven er zijn, wat Newground ervan vindt en waar de bronnen staan.'],
    ['Wie zit erachter?', `De gids is een initiatief van Newground (${esc(ctx.scan.company.legalName)}) in Amsterdam. Newground helpt organisaties bij een overstap naar Europese oplossingen en beheert deze gids. ${link('/over/', 'Lees meer over de gids')}.`],
    ['Wat betekent Advies, Onder voorwaarden en Volgen?', `Advies betekent dat Newground het product aanbeveelt. Onder voorwaarden betekent dat het goed past mits aan genoemde voorwaarden is voldaan. Volgen betekent dat het nog niet aan te bevelen is. Alles zonder oordeel is nog niet beoordeeld. ${link('/hoe-we-beoordelen/', 'Zo beoordelen we')}.`],
    ['Kan ik zelf een alternatief indienen?', `Ja. Gebruikers, producenten en leveranciers kunnen een product aanmelden. Het komt als kandidaat in de lijst en Newground toetst het daarna. ${link('/dien-in/', 'Dien een alternatief in', 'data-submit-open')}.`],
  ];
  const body = `<section class="hero">
  <h1>Europese alternatieven voor Big Tech</h1>
  <p class="lead">Een onafhankelijke gids voor Nederlandse organisaties. Per Amerikaans product zie je de Europese en open-source alternatieven, met bron, datum en een eerlijk oordeel.</p>
  <form class="search" role="search" data-search hidden>
    <label for="q" class="visually-hidden">Zoek een product of alternatief</label>
    <input id="q" type="search" placeholder="Welk product wil je vervangen? Bijvoorbeeld Slack" autocomplete="off" aria-controls="search-results" aria-expanded="false">
    <ul id="search-results" class="search-results" role="listbox" hidden></ul>
    <p class="search-empty" role="status" hidden>Niets gevonden voor <b></b>. Probeer een ander woord, bekijk ${link('/alternatief-voor/', 'alle producten die je kunt vervangen')} of ${link('/dien-in/', 'dien het alternatief in', 'data-submit-open')}.</p>
  </form>
  <p class="popular"><span>Populair:</span> ${popular.slice(0, 6).map(t => link(targetPath(t), esc(t.name))).join(' ')}</p>
</section>
${sponsorBanner(ctx)}
<section aria-labelledby="h-targets"><div class="section-head"><h2 id="h-targets">Welk product wil je vervangen?</h2><a href="/alternatief-voor/">Alle ${pages.length} producten</a></div>
<ul class="tiles">${popular.map(t => `<li><a class="tile" href="${targetPath(t)}"><span class="tile-name">${esc(t.name)}</span><span class="tile-count">${plural(t.products.length, 'alternatief', 'alternatieven')}${t.rated ? `, ${t.rated} beoordeeld` : ''}</span></a></li>`).join('')}</ul></section>
${model.comparisons.length ? `<section aria-labelledby="h-cmp"><div class="section-head"><h2 id="h-cmp">Twee alternatieven vergelijken</h2><a href="/vergelijk/">Alle ${model.comparisons.length} vergelijkingen</a></div>
<ul class="tiles">${model.comparisons.filter(c => c.index).slice(0, 6).map(c => `<li><a class="tile" href="${comparePath(c)}"><span class="tile-name">${esc(shortName(c.a))} of ${esc(shortName(c.b))}</span><span class="tile-count">alternatief voor ${esc(c.targets[0].name)}</span></a></li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="h-cats"><div class="section-head"><h2 id="h-cats">Of zoek op soort software</h2><a href="/categorie/">Alle categorieën</a></div>
<ul class="tiles tiles-sm">${model.categories.slice(0, 12).map(c => `<li><a class="tile" href="/categorie/${c.slug}/"><span class="tile-name">${esc(c.label)}</span><span class="tile-count">${c.products.length}</span></a></li>`).join('')}</ul></section>
<section class="progress" aria-labelledby="h-prog"><h2 id="h-prog">De gids groeit</h2>
  <p><strong class="big">${model.stats.products}</strong> producten in de gids, waarvan <strong>${model.stats.rated}</strong> beoordeeld door Newground. Het doel is ${model.stats.goal}.</p>
  ${meter(model.stats.rated, model.stats.unrated, model.stats.goal, `${model.stats.products} van ${model.stats.goal} producten`)}
  <p class="hint">${link('/bronnen/', 'Bronnen en voortgang')}</p></section>
${scanCta(ctx)}
${faqHtml(faq)}`;
  const ld = [organizationLd(ctx), {
    '@context': 'https://schema.org', '@type': 'WebSite', '@id': site.siteUrl + '/#website', name: site.name, url: site.siteUrl + '/', inLanguage: 'nl-NL', publisher: { '@id': site.newgroundUrl + '/#organization' },
    description: 'Nederlandse gids met Europese en open-source alternatieven voor Amerikaanse software.',
  }, faqLd(faq)];
  return { path: '/', index: true, html: layout(ctx, { path: '/', title: '', description: `Europese en open-source alternatieven voor Amerikaanse software, met bron en oordeel. ${model.stats.products} producten, ${pages.length} producten om te vervangen. Een initiatief van Newground.`, body, jsonld: ld, modified: model.generated }) };
}

// ---- Fixed pages ---------------------------------------------------------------------------------------------

function simple(ctx, { path, title, description, h1, lead: leadText, html, crumbName, extraLd = [] }) {
  const bc = breadcrumbs(ctx, [['/', 'Start'], [path, crumbName || h1]]);
  const body = `${bc.html}<article class="prose"><header class="page-head"><h1>${esc(h1)}</h1>${leadText ? `<p class="lead">${leadText}</p>` : ''}</header>${html}</article>`;
  return { path, index: true, html: layout(ctx, { path, title, description, body, jsonld: [organizationLd(ctx), bc.ld, ...extraLd], modified: ctx.model.generated }) };
}

function howPage(ctx) {
  const s = ctx.model.stats;
  return simple(ctx, {
    path: '/hoe-we-beoordelen/', h1: 'Hoe we beoordelen', title: 'Hoe Newground Europese alternatieven beoordeelt',
    description: 'Welke vier eisen een alternatief moet halen, wat Advies, Onder voorwaarden en Volgen betekenen, en hoe Newground oordeel en sponsoring gescheiden houdt.',
    lead: 'Een lijst met namen is niet genoeg. Hier staat wat een product moet halen om in de gids te komen, wat onze oordelen betekenen en waar je ons op kunt controleren.',
    html: `<h2 id="oordelen">Wat de oordelen betekenen</h2>
<dl class="defs">
<dt>${badge('advise')}</dt><dd>Newground adviseert dit alternatief. Het haalt de eisen hieronder en past in de praktijk bij Nederlandse organisaties.</dd>
<dt>${badge('conditional')}</dt><dd>Geschikt, mits aan de voorwaarden in de beoordeling is voldaan. Bijvoorbeeld: afnemen via een Europese host in plaats van zelf draaien, of een bepaalde omvang van de organisatie.</dd>
<dt>${badge('watch')}</dt><dd>Nog niet aan te bevelen. Newground volgt de ontwikkeling.</dd>
<dt>${badge('unrated')}</dt><dd>Gevonden in openbare bronnen. Newground heeft het nog niet getoetst en de gegevens zijn nog niet gecontroleerd. Op dit moment ${s.unrated} van de ${s.products} producten.</dd>
</dl>
<h2 id="eisen">De vier eisen</h2>
<ol>
<li><strong>Soevereiniteit, met bron.</strong> Het bedrijf zit juridisch en feitelijk in de EU of EER (Zwitserland, het Verenigd Koninkrijk en Noorwegen mogen, maar noemen we). Geen Amerikaanse moeder of meerderheidsaandeelhouder. Gegevens staan in de EU bij een host die geen Amerikaanse hyperscaler is, of er is een duidelijke optie daarvoor. Elk punt heeft een bron die meer is dan de eigen marketing. Niet te bevestigen betekent: niet goedgekeurd.</li>
<li><strong>Geen slechte reviews.</strong> Gemiddeld minstens 3,8 van 5 bij minstens 20 onafhankelijke reviews, of aantoonbare referenties bij een overheid of grote organisatie. Te weinig reviews is geen afwijzing, wel een opmerking.</li>
<li><strong>Raakvlak met Nederland.</strong> Nederlandse interface of support, Nederlandse klanten, een Nederlandse partner, of een vestiging of datacenter hier.</li>
<li><strong>Een stabiel bedrijf.</strong> Minstens drie jaar actief en minstens tien medewerkers, of een open-sourceproject met actieve ontwikkeling en een stichting of bedrijf erachter.</li>
</ol>
<h3>Open source met een beheerder buiten Europa</h3>
<p>Bij open source hoeft de beheerder niet Europees te zijn, want wie de software zelf draait of bij een Europese host afneemt, geeft de beheerder geen toegang tot zijn gegevens. De licentie moet dan wel door het OSI erkend zijn. Hangen de updates af van één niet-Europees bedrijf, dan staat dat als voorwaarde bij het oordeel.</p>
<h2 id="wie">Wie doet wat</h2>
<p>Een deel van het zoeken en toetsen doen AI-assistenten van Newground: ze verzamelen kandidaten, lezen bronnen en schrijven hun bevindingen op. Ze geven nooit zelf een oordeel. Elk oordeel (Advies, Onder voorwaarden of Volgen) is van Newground, met een datum en bronnen erbij. Veranderingen in eigendom, zoals een overname, worden bijgehouden; dan zie je de melding "Eigendom verandert" tot het oordeel opnieuw is bekeken. De lijst wordt elke ochtend bijgewerkt.</p>
<h2 id="onafhankelijk">Onafhankelijk, ook met sponsors</h2>
<ul>
<li>Newground beheert deze gids en is ook de sponsor die bovenaan veel pagina's staat. Dat is altijd aangegeven met het label "Sponsor".</li>
<li>Andere bedrijven kunnen een van de sponsorplekken onderaan de pagina's nemen. Sponsoring koopt zichtbaarheid, nooit een oordeel, een betere plek in de lijst of het weghalen van een bevinding.</li>
<li>Levert Newground zelf een product, bijvoorbeeld Nextcloud als dienst, dan staat dat als "Belang" op de productpagina.</li>
<li>Sponsorlinks krijgen <code>rel="sponsored"</code>, zodat zoekmachines ze als betaald herkennen.</li>
</ul>
<h2 id="fout">Klopt er iets niet?</h2>
<p>Dan horen we het graag, met een bron erbij. Mail ${link('mailto:' + ctx.scan.contact.email, esc(ctx.scan.contact.email))} of ${link('/dien-in/', 'dien een update in', 'data-submit-open')}. Als producent of leverancier mag je ook zelf updates doorgeven; we toetsen ze op dezelfde manier.</p>`,
  });
}

function aboutPage(ctx) {
  const c = ctx.scan.company;
  return simple(ctx, {
    path: '/over/', h1: 'Over deze gids', crumbName: 'Over deze gids', title: 'Over alternatievengids.nl',
    description: 'Alternatievengids.nl helpt Nederlandse organisaties een Europees alternatief te vinden voor Amerikaanse software. Een initiatief van Newground.',
    lead: 'Een gids om te vinden wat er is, en om te weten wat je kunt vertrouwen.',
    html: `<p>Steeds meer Nederlandse organisaties willen minder afhankelijk zijn van Amerikaanse software. Wat ontbreekt is een plek waar je eerlijk ziet wat er is, per product dat je wilt vervangen. Dat is deze gids: Europese en open-source alternatieven, met bron, datum en het oordeel van Newground.</p>
<h2>Waarom beta</h2>
<p>De gids is nog in opbouw. De lijst groeit (nu ${ctx.model.stats.products} producten, het doel is ${ctx.model.stats.goal}), niet elk product is al beoordeeld en er kan nog iets haperen. Zie je iets dat niet klopt of beter kan? Mail ${link('mailto:' + ctx.scan.contact.email, esc(ctx.scan.contact.email))}; daar zijn we blij mee.</p>
<h2>Wat je hier vindt</h2>
<ul><li>Per Amerikaans product de alternatieven, op pagina's als <a href="/alternatief-voor/">Europees alternatief voor...</a>.</li><li>Per alternatief een eigen pagina met feiten, bronnen en ons oordeel.</li><li>Overzichten per categorie en sector.</li></ul>
<h2>Wie erachter zit</h2>
<p>De gids is een initiatief van Newground, een handelsnaam van ${esc(c.legalName)} in Amsterdam, opgericht door ${esc(ctx.scan.contact.name)}. Newground helpt organisaties bij de overstap naar Europese oplossingen en maakt ook de ${link(ctx.site.scanUrl, 'Soevereiniteitsscan')}. De gids en de scan gebruiken dezelfde lijst, zodat wat je hier leest hetzelfde is als wat de scan adviseert. Lees ook ${link('/hoe-we-beoordelen/#onafhankelijk', 'hoe we oordeel en sponsoring gescheiden houden')}.</p>
<h2>Doe mee</h2>
<ul><li>Mis je een alternatief? ${link('/dien-in/', 'Dien het in', 'data-submit-open')}.</li><li>Ben je producent of leverancier? Geef updates door, dan blijft je pagina kloppen.</li><li>Wil je zichtbaar zijn voor mensen die actief een alternatief zoeken? ${link('/sponsor/', 'Word sponsor')}.</li></ul>
<h2>Contact</h2>
<p>${esc(ctx.scan.contact.name)}, ${link('mailto:' + ctx.scan.contact.email, esc(ctx.scan.contact.email))}.<br>${esc(c.tradeName)}, ${esc(c.address)}. KvK ${esc(c.kvk)}.</p>`,
  });
}

function sourcesPage(ctx) {
  const s = ctx.model.stats;
  return simple(ctx, {
    path: '/bronnen/', h1: 'Bronnen en voortgang', title: 'Bronnen en voortgang van de gids',
    description: `Waar de gegevens in de gids vandaan komen, onder welke licentie, en hoe ver we zijn: ${s.products} producten, ${s.rated} beoordeeld.`,
    lead: 'Waar de gegevens vandaan komen en hoe ver de gids is.',
    html: `<h2>Voortgang</h2>
<p><strong class="big">${s.products}</strong> producten in de gids op ${esc(dateNl(ctx.model.generated))}. Het doel is ${s.goal}.</p>
${meter(s.rated, s.unrated, s.goal, `${s.rated} beoordeeld en ${s.unrated} nog niet beoordeeld, van ${s.goal}`)}
<ul class="legend"><li><i class="k-rated"></i>${s.rated} beoordeeld door Newground (${s.advise} Advies, ${s.conditional} Onder voorwaarden, ${s.watch} Volgen)</li><li><i class="k-found"></i>${s.unrated} gevonden, nog niet beoordeeld</li></ul>
<h2>Waar de gegevens vandaan komen</h2>
<ul>
<li><strong>Eigen onderzoek van Newground:</strong> websites van leveranciers, handelsregisters, jaarverslagen, investor relations en betrouwbare vakpers. Elke bron staat bij het oordeel.</li>
<li><strong>Openbare lijsten met een vrije licentie:</strong> switching.software (CC BY-SA), awesome-european-cloud (CC BY-SA), awesome-gdpr-services (CC0) en de bouwstenen van MijnBureau, openDesk en La Suite numérique. Gegevens uit deze bronnen blijven onder de licentie van die bron; wij vermelden de bron.</li>
<li><strong>Inzendingen van bezoekers:</strong> producenten, leveranciers en gebruikers die een product aanmelden.</li>
</ul>
<p>Overzichtssites die kopiëren in hun voorwaarden verbieden gebruiken we niet als bron voor onze lijst.</p>
<h2>Wat we niet doen</h2>
<ul><li>Geen oordeel zonder bron, geen verzonnen reviews.</li><li>Geen oordeel te koop. Zie ${link('/hoe-we-beoordelen/#onafhankelijk', 'onafhankelijkheid')}.</li></ul>`,
  });
}

function sponsorPage(ctx) {
  const to = ctx.site.sponsorMail.to;
  const general = mailto(to, ctx.site.sponsorMail.subject, 'Hoi Rik,\n\nIk wil graag sponsor worden van alternatievengids.nl.\n\nBedrijf:\nWebsite:\nWat wil ik laten zien:\nVoorkeursperiode:\n\nGroet,\n');
  return simple(ctx, {
    path: '/sponsor/', h1: 'Sponsor deze gids', title: 'Sponsor alternatievengids.nl',
    description: 'Drie sponsorplekken onderaan elke pagina van alternatievengids.nl, zichtbaar voor mensen die actief een Europees alternatief zoeken.',
    lead: 'Wil je zichtbaar zijn voor mensen die actief een Europees alternatief zoeken?',
    html: `<p>Onderaan elke pagina staan drie sponsorplekken. Wie hier komt, zoekt een alternatief voor Amerikaanse software: precies het moment waarop een Europese aanbieder gevonden wil worden.</p>
<h2>Hoe het werkt</h2>
<ul>
<li>Je logo en een link staan op een van de drie plekken, op alle pagina's.</li>
<li>Sponsorplekken zijn duidelijk gemarkeerd als "Sponsor" en de links hebben <code>rel="sponsored"</code>.</li>
<li><strong>Sponsoring koopt zichtbaarheid, geen oordeel.</strong> Je product krijgt er geen betere plek of een ander oordeel door, en een bevinding verdwijnt er niet door. Lees ${link('/hoe-we-beoordelen/#onafhankelijk', 'hoe we dit scheiden')}.</li>
<li>Newground is zelf ook sponsor en staat bovenaan veel pagina's, met hetzelfde label.</li>
</ul>
<p><a class="btn btn-primary" href="${esc(general)}">Mail ons over sponsoring</a></p>
<p class="hint">Je mailprogramma opent met een ingevuld bericht. Je ontvangt de voorwaarden en het tarief per mail.</p>`,
  });
}

function submitPage(ctx) {
  return simple(ctx, {
    path: '/dien-in/', h1: 'Dien een alternatief in', title: 'Dien een Europees alternatief in',
    description: 'Mis je een Europees of open-source alternatief in de gids? Dien het in als gebruiker, producent of leverancier.',
    lead: 'Mis je een Europees of open-source alternatief? Vertel het ons. Als producent of leverancier help je ons vooral door updates door te geven en vragen te beantwoorden.',
    html: `<p>Een inzending komt in de lijst als kandidaat, met je rol erbij. Daarna toetst Newground het aan ${link('/hoe-we-beoordelen/#eisen', 'dezelfde vier eisen')} als alle andere producten. Een inzending is dus geen garantie op plaatsing en kost niets.</p>${submitForm(ctx, { id: 'page' })}`,
  });
}

function privacyPage(ctx) {
  const sa = ctx.site.analytics?.simpleAnalytics;
  const endpoint = Boolean(ctx.site.submit?.endpoint);
  return simple(ctx, {
    path: '/privacy/', h1: 'Privacy', title: 'Privacy', description: 'Welke gegevens alternatievengids.nl verwerkt, waarom, en wat je rechten zijn.',
    lead: 'Een gids over digitale soevereiniteit moet zuinig zijn met jouw gegevens. Hier lees je wat we verwerken.',
    html: `<p class="hint">Laatst bijgewerkt: <time datetime="${esc(ctx.site.privacyDate)}">${esc(dateNl(ctx.site.privacyDate))}</time></p>
<h2>Kort gezegd</h2>
<ul><li>Geen cookies, geen advertentienetwerken en geen lettertypen of scripts van andere websites${sa ? ', op één uitzondering na: bezoekcijfers via Simple Analytics' : ''}.</li>
<li>Zoeken op de site gebeurt in je eigen browser.</li>
<li>Alleen als je zelf een alternatief indient, vragen we je naam en e-mailadres.</li></ul>
<h2>Wie we zijn</h2>
<p>${esc(ctx.scan.company.tradeName)} is een handelsnaam van ${esc(ctx.scan.company.legalName)}, ${esc(ctx.scan.company.address)}. ${esc(ctx.scan.company.legalName)} is verantwoordelijk voor de verwerking van persoonsgegevens via deze site. Vragen stel je aan ${esc(ctx.scan.contact.name)} via ${link('mailto:' + ctx.scan.contact.email, esc(ctx.scan.contact.email))}.</p>
<h2>Als je de website bezoekt</h2>
<p>De site draait bij ${esc(ctx.site.hosting.provider)}. Zoals elke webserver legt die technische gegevens vast in logbestanden: je IP-adres, het tijdstip, de opgevraagde pagina en je browser. Dat is nodig om de site veilig en werkend te houden; dat is ons gerechtvaardigd belang. We gebruiken deze gegevens niet om je te volgen of een profiel van je te maken.</p>
${sa ? `<h2>Bezoek meten</h2>
<p>We willen weten welke pagina's gelezen worden. Daarvoor gebruiken we Simple Analytics, een Nederlandse dienst, zoals ook op newground.nl. Simple Analytics plaatst geen cookies, slaat geen IP-adressen op en maakt geen profielen. Het telt alleen anonieme gegevens, zoals welke pagina is bekeken, van welke website je kwam en wat voor soort apparaat je gebruikt. Je bent daarin niet herkenbaar. De gegevens blijven in de EU. Het script laadt van de server van Simple Analytics.</p>` : ''}
<h2>Cookies en lokale opslag</h2>
<p>Deze site plaatst geen cookies en gebruikt geen lokale opslag in je browser.</p>
<h2>Als je een alternatief indient</h2>
<p>Dien je een product in, dan verwerken we wat je invult: je rol, de gegevens over het product, je naam, je e-mailadres en eventuele toelichting. We gebruiken dat om je inzending te beoordelen en om je te mailen met vragen of voor updates over het product, waarvoor je toestemming geeft door het vakje aan te vinken. ${endpoint ? 'Je inzending gaat via een beveiligde verbinding naar Newground en komt in onze lijst als kandidaat.' : 'Op dit moment opent je mailprogramma met een ingevuld bericht aan Newground; er gaat niets via onze website.'} Productgegevens kunnen op de site verschijnen als het product wordt opgenomen; je naam en e-mailadres tonen we nooit. Je gegevens bewaren we zolang dat nodig is voor ons contact, en uiterlijk twee jaar na het laatste contact.</p>
<h2>Als je sponsor wilt worden of ons mailt</h2>
<p>De sponsorplekken en de links om ons te mailen openen je eigen mailprogramma. We gebruiken je naam, e-mailadres en bericht om je te antwoorden en om ons contact te onthouden.</p>
<h2>Links naar andere sites</h2>
<p>De gids linkt naar de websites van leveranciers en naar bronnen. Klik je zo'n link aan, dan geldt daar het privacybeleid van die partij.</p>
<h2>Met wie we gegevens delen</h2>
<p>We verkopen geen gegevens. We delen ze alleen met de dienstverleners hierboven, die ze in onze opdracht verwerken, of als de wet ons daartoe verplicht.</p>
<h2>Jouw rechten</h2>
<p>Je kunt ons vragen je gegevens in te zien, te verbeteren, te verwijderen of over te dragen, en bezwaar te maken tegen een verwerking. Mail daarvoor naar ${link('mailto:' + ctx.scan.contact.email, esc(ctx.scan.contact.email))}; we reageren binnen een maand. Ben je niet tevreden, dan kun je een klacht indienen bij de ${link('https://www.autoriteitpersoonsgegevens.nl', 'Autoriteit Persoonsgegevens', 'rel="noopener" target="_blank"')}.</p>
<h2>Wijzigingen</h2>
<p>Passen we deze verklaring aan, dan zie je dat aan de datum bovenaan.</p>`,
  });
}

function notFoundPage(ctx) {
  const body = `<header class="page-head"><h1>Deze pagina bestaat niet</h1><p class="lead">Misschien is het product hernoemd of van de lijst gehaald. Zoek verder via ${link('/alternatief-voor/', 'alternatief voor')}, de ${link('/categorie/', 'categorieën')} of ${link('/alternatieven/', 'alle producten')}.</p></header>`;
  return { path: '/404.html', index: false, html: layout(ctx, { path: '/404.html', title: 'Pagina niet gevonden', description: 'Deze pagina bestaat niet.', body, robots: 'noindex,follow' }) };
}

export function buildPages(ctx) {
  const { model } = ctx;
  const pages = [
    homePage(ctx), targetsIndex(ctx), productsIndex(ctx), categoriesIndex(ctx),
    howPage(ctx), aboutPage(ctx), sourcesPage(ctx), sponsorPage(ctx), submitPage(ctx), privacyPage(ctx), notFoundPage(ctx),
    ...(model.comparisons.length ? [comparisonsIndex(ctx)] : []), ...model.comparisons.map(c => comparePage(ctx, c)),
    ...model.targets.filter(targetHasPage).map(t => targetPage(ctx, t)),
    ...model.products.map(p => productPage(ctx, p)),
    ...model.categories.map(c => categoryPage(ctx, c)),
    ...model.sectors.map(s => sectorPage(ctx, s)),
  ];
  return pages;
}
