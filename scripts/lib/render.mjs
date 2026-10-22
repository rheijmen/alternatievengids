// Shared page parts: layout, header, footer, sponsor banner and slots, the submit modal, analytics.
// Plain template strings; every dynamic value goes through esc().

import { esc, dateNl } from './text.mjs';
import { STAGE_LABEL } from './model.mjs';

export const link = (href, text, attrs = '') => `<a href="${esc(href)}"${attrs ? ' ' + attrs : ''}>${text}</a>`;

export function mailto(to, subject, body) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const badge = stage => `<span class="badge badge-${stage}">${esc(STAGE_LABEL[stage])}</span>`;

// ---- Analytics -----------------------------------------------------------------------------------------------
// Simple Analytics, as on newground.nl: Dutch, no cookies, no personal data. Switch off in data/site.json.

export const SA = { script: 'https://scripts.simpleanalyticscdn.com', queue: 'https://queue.simpleanalyticscdn.com', badge: 'https://simpleanalyticsbadges.com' };

const analyticsHead = ctx => (ctx.site.analytics?.simpleAnalytics ? `<script async src="${SA.script}/latest.js"></script>` : '');
const analyticsBody = ctx => (ctx.site.analytics?.simpleAnalytics ? `<noscript><img src="${SA.queue}/noscript.gif" alt="" referrerpolicy="no-referrer-when-downgrade"></noscript>` : '');

export function csp(ctx) {
  const sa = ctx.site.analytics?.simpleAnalytics;
  const endpoint = ctx.site.submit?.endpoint ? new URL(ctx.site.submit.endpoint).origin : '';
  return [
    "default-src 'none'",
    `script-src 'self'${sa ? ' ' + SA.script : ''}`,
    "style-src 'self'",
    `img-src 'self' data:${sa ? ' ' + SA.queue : ''}${sa && ctx.site.analytics.badge ? ' ' + SA.badge : ''}`,
    "font-src 'self'",
    `connect-src 'self'${sa ? ' ' + SA.queue : ''}${endpoint ? ' ' + endpoint : ''}`,
    "base-uri 'none'", "form-action 'self'", "object-src 'none'",
  ].join('; ');
}

// ---- Sponsor -------------------------------------------------------------------------------------------------

export function sponsorBanner(ctx) {
  return `<aside class="sponsor-banner" aria-label="Sponsor">
  <p class="sponsor-tag">Sponsor</p>
  <div class="sponsor-body">
    <p class="sponsor-title">Newground: Europese grond onder je data &amp; AI.</p>
    <p class="sponsor-text">Weten waar je begint met een overstap? In een half uur bespreken we jouw situatie. Zonder verplichtingen.</p>
  </div>
  <a class="btn btn-primary" href="${esc(ctx.site.bookingUrl)}" rel="sponsored noopener" target="_blank">Plan een klankbordgesprek</a>
  <p class="sponsor-note">Newground beheert deze gids en is ook de sponsor hier. ${link('/hoe-we-beoordelen/#onafhankelijk', 'Zo houden we oordeel en sponsoring gescheiden')}.</p>
</aside>`;
}

const slotMail = (ctx, n) => mailto(ctx.site.sponsorMail.to, ctx.site.sponsorMail.subject,
  `Hoi Rik,\n\nIk wil graag sponsor worden van alternatievengids.nl (plek ${n}).\n\nBedrijf:\nWebsite:\nWat wil ik laten zien:\nVoorkeursperiode:\n\nGroet,\n`);

export function sponsorSlots(ctx) {
  const slots = [0, 1, 2].map(i => {
    const s = ctx.site.sponsorSlots?.[i];
    if (s?.url && s?.name) {
      return `<li><a class="slot slot-filled" href="${esc(s.url)}" rel="sponsored noopener" target="_blank">${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.name)}" width="160" height="160" loading="lazy">` : `<span class="slot-name">${esc(s.name)}</span>`}<span class="slot-tag">Sponsor</span></a></li>`;
    }
    return `<li><a class="slot slot-empty" href="${esc(slotMail(ctx, i + 1))}" aria-label="Sponsorplek ${i + 1} is vrij. Mail ons om sponsor te worden."><span class="slot-plus" aria-hidden="true">+</span><span class="slot-text">Sponsor worden</span></a></li>`;
  });
  return `<section class="sponsors" aria-labelledby="sponsors-h">
  <div class="wrap">
    <div class="sponsors-head">
      <h2 id="sponsors-h">Sponsor deze gids</h2>
      <p>Drie plekken onderaan elke pagina. Zichtbaar voor mensen die actief zoeken naar een Europees alternatief. Sponsoring koopt zichtbaarheid, geen oordeel. ${link('/sponsor/', 'Lees hoe het werkt')}.</p>
    </div>
    <ul class="slots">${slots.join('')}</ul>
  </div>
</section>`;
}

// ---- Submit form and modal -----------------------------------------------------------------------------------

export function submitForm(ctx, { id }) {
  return `<form class="submit-form" data-submit-form${ctx.site.submit?.endpoint ? ` data-endpoint="${esc(ctx.site.submit.endpoint)}"` : ''} data-mailto="${esc(ctx.site.submit.mailTo)}">
  <fieldset class="field-group">
    <legend>Wie ben je?</legend>
    <label class="choice"><input type="radio" name="role" value="gebruiker" checked><span><strong>Gebruiker of fan</strong><small>Ik gebruik dit product en vind dat het erin hoort.</small></span></label>
    <label class="choice"><input type="radio" name="role" value="producent"><span><strong>Producent</strong><small>Ik maak dit product, als ontwikkelaar of als team.</small></span></label>
    <label class="choice"><input type="radio" name="role" value="leverancier"><span><strong>Leverancier</strong><small>Ik lever, host of implementeer dit product.</small></span></label>
  </fieldset>

  <div class="field-grid">
    <label class="field"><span>Naam van het product <b>*</b></span><input type="text" name="product" required maxlength="120" autocomplete="off"></label>
    <label class="field"><span>Website <b>*</b></span><input type="url" name="website" required maxlength="200" placeholder="https://" autocomplete="url"></label>
    <label class="field"><span>Welk Amerikaans product vervangt het?</span><input type="text" name="replaces" maxlength="160" placeholder="Bijvoorbeeld Slack of Google Analytics"></label>
    <label class="field"><span>In welk land zit het bedrijf?</span><input type="text" name="country" maxlength="80" autocomplete="country-name"></label>
    <label class="field"><span>Is het open source?</span>
      <select name="opensource"><option value="">Weet ik niet</option><option value="ja">Ja</option><option value="open core">Gedeeltelijk (open core)</option><option value="nee">Nee</option></select></label>
  </div>
  <label class="field"><span>Waarom hoort het erin? Wat wil je ons vertellen?</span><textarea name="why" rows="4" maxlength="2000" placeholder="Wat doet het, voor wie, waar draait het, waarom is het een goed alternatief?"></textarea></label>

  <div class="field-grid">
    <label class="field"><span>Jouw naam <b>*</b></span><input type="text" name="name" required maxlength="120" autocomplete="name"></label>
    <label class="field"><span>Jouw e-mailadres <b>*</b></span><input type="email" name="email" required maxlength="160" autocomplete="email"></label>
  </div>
  <label class="check" data-updates><input type="checkbox" name="updates"><span data-updates-text>Je mag me mailen met vragen over deze inzending.</span></label>
  <label class="check"><input type="checkbox" name="consent" required><span>Ik ga ermee akkoord dat Newground mijn gegevens gebruikt om deze inzending te beoordelen en mij daarover te mailen. Lees de ${link('/privacy/', 'privacyverklaring')}. <b>*</b></span></label>
  <label class="trap" aria-hidden="true">Laat dit leeg<input type="text" name="trap" tabindex="-1" autocomplete="off"></label>

  <p class="form-error" role="alert" hidden></p>
  <div class="form-actions">
    <button class="btn btn-primary" type="submit">Verstuur inzending</button>
    <span class="hint">Alles met een * is nodig. Een inzending komt in de lijst als kandidaat; daarna toetst Newground hem.</span>
  </div>
  <p class="form-done" role="status" hidden></p>
</form>`;
}

function submitDialog(ctx) {
  return `<dialog class="dialog" id="submit-dialog" aria-labelledby="submit-title">
  <button class="dialog-close" type="button" aria-label="Sluiten" data-close>×</button>
  <h2 id="submit-title">Dien een alternatief in</h2>
  <p class="dialog-lead">Mis je een Europees of open-source alternatief? Vertel het ons. Als producent of leverancier help je ons vooral door updates door te geven en vragen te beantwoorden.</p>
  ${submitForm(ctx, { id: 'dialog' })}
</dialog>`;
}

// ---- Layout --------------------------------------------------------------------------------------------------

const NAV = [
  ['/alternatief-voor/', 'Alternatief voor'], ['/categorie/', 'Categorieën'], ['/alternatieven/', 'Alle producten'], ['/hoe-we-beoordelen/', 'Hoe we beoordelen'],
];

function header(ctx, path) {
  const nav = NAV.map(([href, text]) => `<a href="${href}"${path.startsWith(href) ? ' aria-current="page"' : ''}>${text}</a>`).join('');
  return `<a class="skip" href="#inhoud">Direct naar inhoud</a>
<header class="topbar">
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="${esc(ctx.site.name)}, naar de startpagina">
      <img class="brand-das ng-img" src="/assets/das.svg" alt="" width="46" height="49">
      <span class="brand-text"><span class="brand-name">${esc(ctx.site.name)}</span><span class="brand-by">een initiatief van Newground</span></span>
    </a>
    <nav class="main-nav" aria-label="Hoofdnavigatie">${nav}</nav>
    <div class="bar-actions">
      <a class="btn" href="/dien-in/" data-submit-open>Dien een alternatief in</a>
      <a class="btn btn-primary" href="${esc(ctx.site.scanUrl)}">Doe de scan</a>
    </div>
  </div>
</header>`;
}

function footer(ctx) {
  const c = ctx.scan.company;
  const mail = ctx.scan.contact.email;
  const badgeHtml = ctx.site.analytics?.simpleAnalytics && ctx.site.analytics.badge
    ? `<a class="footer-badge" href="https://www.simpleanalytics.com?utm_source=alternatievengids.nl&amp;utm_content=badge" referrerpolicy="origin" target="_blank" rel="noopener"><img src="${SA.badge}/alternatievengids.nl?mode=light&amp;radius=0" alt="Bezoekersstatistieken van alternatievengids.nl via Simple Analytics" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous"></a>` : '';
  return `${sponsorSlots(ctx)}
<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <a class="brand" href="/"><img class="brand-das ng-img" src="/assets/das.svg" alt="" width="46" height="49"><span class="brand-text"><span class="brand-name">${esc(ctx.site.name)}</span><span class="brand-by">een initiatief van Newground</span></span></a>
      <p class="footer-line">Europese grond<br>onder je data &amp; AI.</p>
    </div>
    <div class="footer-cols">
      <nav aria-labelledby="f1"><h2 id="f1">De gids</h2><ul>
        <li><a href="/alternatief-voor/">Alternatief voor</a></li><li><a href="/categorie/">Categorieën</a></li><li><a href="/alternatieven/">Alle producten</a></li>${ctx.model.comparisons.length ? '<li><a href="/vergelijk/">Vergelijken</a></li>' : ''}${ctx.model.sectors.map(s => `<li><a href="/sector/${s.slug}/">${esc(s.name)}</a></li>`).join('')}</ul></nav>
      <nav aria-labelledby="f2"><h2 id="f2">Over de gids</h2><ul>
        <li><a href="/hoe-we-beoordelen/">Hoe we beoordelen</a></li><li><a href="/over/">Over deze gids</a></li><li><a href="/bronnen/">Bronnen en voortgang</a></li><li><a href="/dien-in/" data-submit-open>Dien een alternatief in</a></li><li><a href="/sponsor/">Sponsor worden</a></li></ul></nav>
      <nav aria-labelledby="f3"><h2 id="f3">Newground</h2><ul>
        <li><a href="${esc(ctx.site.scanUrl)}">Soevereiniteitsscan</a></li><li><a href="${esc(ctx.site.newgroundUrl)}">newground.nl</a></li><li><a href="${esc(ctx.site.bookingUrl)}" target="_blank" rel="noopener">Plan een klankbordgesprek</a></li></ul></nav>
      <div><h2 id="f4">Contact</h2><ul><li><a href="mailto:${esc(mail)}">${esc(mail)}</a></li><li><address>${esc(c.address).replace(/, (\d)/, '<br>$1')}</address></li></ul></div>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} ${esc(c.tradeName)}, een handelsnaam van ${esc(c.legalName)} · KvK ${esc(c.kvk)}${ctx.model.generated ? ` · Lijst bijgewerkt op ${esc(dateNl(ctx.model.generated))}` : ''}</p>
      <nav class="footer-links" aria-label="Overige links"><a href="/privacy/">Privacy</a>${badgeHtml}</nav>
    </div>
  </div>
</footer>
${submitDialog(ctx)}
${analyticsBody(ctx)}`;
}

// jsonld: array of objects. robots: 'index,follow' or 'noindex,follow'.
export function layout(ctx, { path, title, description, body, jsonld = [], robots = 'index,follow', type = 'website', modified = '' }) {
  const canonical = ctx.site.siteUrl + path;
  const fullTitle = path === '/' ? `${ctx.site.name}: ${ctx.site.tagline}` : `${title} | ${ctx.site.name}`;
  const ld = jsonld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('');
  return `<!doctype html>
<html lang="${ctx.site.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}${robots.startsWith('index') ? ',max-image-preview:large,max-snippet:-1' : ''}">
<meta http-equiv="Content-Security-Policy" content="${esc(csp(ctx))}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/gids.css?v=${ctx.assets.css}">
<meta property="og:type" content="${type}"><meta property="og:locale" content="nl_NL"><meta property="og:site_name" content="${esc(ctx.site.name)}">
<meta property="og:url" content="${esc(canonical)}"><meta property="og:title" content="${esc(fullTitle)}"><meta property="og:description" content="${esc(description)}">
<meta name="twitter:card" content="summary">
${modified ? `<meta property="article:modified_time" content="${esc(modified)}">` : ''}
${analyticsHead(ctx)}
<script src="/js/gids.js?v=${ctx.assets.js}" defer></script>
${ld}
</head>
<body>
${header(ctx, path)}
<main id="inhoud" class="wrap">
${body}
</main>
${footer(ctx)}
</body>
</html>
`;
}

export function breadcrumbs(ctx, crumbs) {
  const html = `<nav class="crumbs" aria-label="Kruimelpad"><ol>${crumbs.map(([href, text], i) => `<li>${i === crumbs.length - 1 ? `<span aria-current="page">${esc(text)}</span>` : `<a href="${href}">${esc(text)}</a>`}</li>`).join('')}</ol></nav>`;
  const ld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([href, text], i) => ({ '@type': 'ListItem', position: i + 1, name: text, item: ctx.site.siteUrl + href })) };
  return { html, ld };
}

export const scanCta = (ctx, text) => `<aside class="scan-cta">
  <div>
    <p class="scan-cta-title">Hoe afhankelijk is jouw organisatie?</p>
    <p>${text || 'Doe de gratis Soevereiniteitsscan van Newground. In ongeveer vijf minuten zie je welke systemen je gebruikt, hoe afhankelijk je bent van Amerikaanse leveranciers en wat een eerste stap is.'}</p>
  </div>
  <a class="btn btn-primary btn-lg" href="${esc(ctx.site.scanUrl)}">Start de scan</a>
</aside>`;

export const faqHtml = items => `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">Veelgestelde vragen</h2>${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('')}</section>`;

// HTML answer to plain text for structured data: no tags, no entities.
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export const faqLd = items => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a) } })) });

export const organizationLd = ctx => ({
  '@context': 'https://schema.org', '@type': 'Organization', '@id': ctx.site.newgroundUrl + '/#organization', name: 'Newground', legalName: ctx.scan.company.legalName,
  url: ctx.site.newgroundUrl + '/', email: ctx.scan.contact.email, founder: { '@type': 'Person', name: ctx.scan.contact.name },
});

// Progress bar as inline SVG: the Content Security Policy does not allow style attributes.
export const meter = (rated, found, goal, label) => {
  const w = n => Math.max(0, Math.min(100, (n / goal) * 100)).toFixed(2);
  return `<svg class="meter" viewBox="0 0 100 3" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><rect class="meter-rated" x="0" y="0" width="${w(rated)}" height="3"/><rect class="meter-found" x="${w(rated)}" y="0" width="${w(found)}" height="3"/></svg>`;
};
