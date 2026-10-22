import test from 'node:test';
import assert from 'node:assert/strict';
import { excludeReason, parseReplaces, categoryOf, buildModel, targetHasPage, STAGE_RANK } from '../scripts/lib/model.mjs';
import { lead, fit, slugify, nl } from '../scripts/lib/text.mjs';

const catalog = {
  slack: { name: 'Slack', vendor: 'Salesforce', hq: 'US', category: 'communication' },
  m365: { name: 'Microsoft 365', vendor: 'Microsoft', hq: 'US', category: 'productivity' },
  teams: { name: 'Microsoft Teams', vendor: 'Microsoft', hq: 'US', category: 'communication' },
};
const matchTech = n => ({ slack: 'slack', 'microsoft 365': 'm365', teams: 'teams', 'microsoft teams': 'teams' })[String(n).trim().toLowerCase()] || null;
const row = (id, o = {}) => ({ id, Name: `Product ${id}`, Type: 'Vendor', Gidsstatus: 'Kandidaat', Verdict: '', Replaces: 'Slack', Category: 'Messaging / collaboration', ...o });

test('statusregels uit de overdracht: wat nooit publiek mag', () => {
  assert.equal(excludeReason(row(1, { Gidsstatus: 'Afgewezen' })), 'afgewezen');
  assert.equal(excludeReason(row(2, { Gidsstatus: 'Sectorkennis', Type: 'Sectorkennis' })), 'type');
  assert.equal(excludeReason(row(3, { Gidsstatus: 'Gangbaar product' })), 'gangbaar product');
  assert.equal(excludeReason(row(4, { Gidsstatus: 'Twijfel' })), 'twijfel');
  assert.equal(excludeReason(row(5, { Type: 'Implementation partner' })), 'type');
  assert.equal(excludeReason(row(6, { Type: 'Overheidsprogramma (geen product)' })), 'type');
});

test('Twijfel mag wel mét oordeel (dan met melding), kandidaten en goedgekeurde rijen mogen', () => {
  assert.equal(excludeReason(row(7, { Gidsstatus: 'Twijfel', Verdict: { value: 'Conditional' } })), null);
  assert.equal(excludeReason(row(8, { Gidsstatus: 'Kandidaat' })), null);
  assert.equal(excludeReason(row(9, { Gidsstatus: 'Goedgekeurd door filter' })), null);
  assert.equal(excludeReason(row(10, { Gidsstatus: { value: 'Afgewezen' } })), 'afgewezen', 'single-select cellen werken ook');
});

test('Replaces: catalogusnamen, haakjes, scheidingstekens en rommel', () => {
  const o = { matchTech, catalog };
  assert.deepEqual(parseReplaces('Slack; Microsoft Teams (chat only)', o).map(t => t.key), ['slack', 'teams']);
  assert.deepEqual(parseReplaces('Microsoft 365 / Teams', o).map(t => t.key), ['m365', 'teams']);
  const free = parseReplaces('Stripe; Direct US LLM APIs plus gateways; Een heel lange naam die echt veel te lang is om een product te zijn', o);
  assert.deepEqual(free.map(t => t.name), ['Stripe'], 'rommel valt weg, vrije tekst blijft als doel');
  assert.deepEqual(parseReplaces('Chat Tool', { ...o, aliases: { 'chat tool': 'slack' } }).map(t => t.key), ['slack'], 'alias-tabel');
  assert.deepEqual(parseReplaces('Slack; Slack', o).length, 1, 'geen dubbelen');
});

test('categorie uit Baserow-tekst: "platform" is geen formulier', () => {
  assert.equal(categoryOf('Platform as a service'), 'infrastructure');
  assert.equal(categoryOf('Forms and surveys'), 'forms');
  assert.equal(categoryOf('Hospital EPD'), 'vertical');
  assert.equal(categoryOf('Iets geheel anders', 'crm'), 'crm');
  assert.equal(categoryOf('Iets geheel anders'), 'other');
});

function fakeScan(rows, alts = []) {
  return {
    alt: { ALTERNATIVES: alts, applyVerdicts() {}, GUIDE_GOAL: 1000 }, catalog, matchTech,
    tasks: { SYSTEM_TASKS: [], OTHER_TASK: { cat: 'infrastructure' }, taskIds: () => [] },
    data: { generated: '2026-10-22T06:40:00+02:00', count: rows.length, results: rows },
  };
}
const site = { indexUnrated: false, belangen: { ids: [] }, minSectorPage: 3 };

test('model: kandidaten komen erin met label, de rest niet', () => {
  const m = buildModel(fakeScan([
    row(1, { Name: 'Goed' }), row(2, { Name: 'Weg', Gidsstatus: 'Afgewezen' }), row(3, { Name: 'Twijfelaar', Gidsstatus: 'Twijfel' }),
    row(4, { Name: 'Gangbaar', Gidsstatus: 'Gangbaar product' }), row(5, { Name: 'Partner', Type: 'Implementation partner' }),
    row(6, { Name: 'goed' }),
  ]), site);
  assert.deepEqual(m.products.map(p => p.name), ['Goed']);
  assert.equal(m.products[0].stage, 'unrated');
  assert.equal(m.products[0].basis, 'candidate');
  assert.equal(m.products[0].index, false, 'kandidaat is noindex zolang indexUnrated uit staat');
  assert.deepEqual(m.excluded.map(e => e.why).sort(), ['afgewezen', 'dubbel', 'gangbaar product', 'twijfel', 'type']);
});

test('model: indexUnrated schakelt indexering van kandidaten in', () => {
  const m = buildModel(fakeScan([row(1, { Name: 'Goed' })]), { ...site, indexUnrated: true });
  assert.equal(m.products[0].index, true);
});

test('model: oordeel zonder koppeling in de scan wordt niet als kandidaat gepubliceerd', () => {
  const m = buildModel(fakeScan([row(1, { Name: 'Beoordeeld', Verdict: { value: 'Advise' }, Gidsstatus: '' })]), site);
  assert.equal(m.products.length, 0, 'een oordeel komt alleen via de scan-regels (fromBaserow) binnen');
});

test('model: gedeelde rangschikking en doelpagina-regel', () => {
  const alts = [
    { id: 'a', name: 'Alfa', replaces: ['slack'], category: 'communication', verdict: 'watch', hq: 'EU', delivery: [], license: 'open-source' },
    { id: 'b', name: 'Bravo', replaces: ['slack'], category: 'communication', verdict: 'advise', hq: 'EU', delivery: [], license: 'open-source' },
    { id: 'c', name: 'Charlie', replaces: ['slack'], category: 'communication', hq: 'EU', delivery: [], license: 'proprietary' },
  ];
  const m = buildModel(fakeScan([], alts), site);
  const t = m.targets.find(x => x.key === 'slack');
  assert.deepEqual(t.products.map(p => p.stage), ['advise', 'unrated', 'watch'], 'zelfde volgorde als de scan: advies, onbeoordeeld, volgen');
  assert.equal(t.rated, 2);
  assert.ok(targetHasPage(t));
  assert.equal(STAGE_RANK.advise < STAGE_RANK.conditional && STAGE_RANK.conditional < STAGE_RANK.unrated && STAGE_RANK.unrated < STAGE_RANK.watch, true);
});

test('model: een los vrije-tekst-doel met één kandidaat krijgt geen pagina', () => {
  const m = buildModel(fakeScan([row(1, { Name: 'Eén', Replaces: 'Onbekend Ding' })]), site);
  const t = m.targets.find(x => x.name === 'Onbekend Ding');
  assert.equal(targetHasPage(t), false);
});

test('tekst-hulpjes', () => {
  assert.equal(slugify('Nextcloud Hub (NL)'), 'nextcloud-hub-nl');
  assert.equal(nl(['A', 'B', 'C']), 'A, B en C');
  assert.ok(lead('Een zin die lang genoeg is om door te gaan. Nog een zin hier.', 60).endsWith('.'));
  assert.ok(fit('Eerste zin. Tweede zin is wat langer dan de eerste. Derde.', 40).length <= 41);
});
