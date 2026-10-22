import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

// form-rules.js is a plain browser script; it is run here in an empty context.
const ctx = { URL }; // the browser provides URL; the test context has to be given it
vm.runInNewContext(await fs.readFile('static/js/form-rules.js', 'utf8'), ctx);
const { normalizeUrl, isEmail, validate, MESSAGES } = ctx.GidsRules;

test('website: elke gangbare schrijfwijze wordt een volledig adres, zonder https:// te hoeven typen', () => {
  assert.equal(normalizeUrl('kannietbedenkuh.nl'), 'https://kannietbedenkuh.nl');
  assert.equal(normalizeUrl('Kannietbedenkuh.NL'), 'https://kannietbedenkuh.nl');
  assert.equal(normalizeUrl('www.voorbeeld.nl'), 'https://www.voorbeeld.nl');
  assert.equal(normalizeUrl('  voorbeeld.nl  '), 'https://voorbeeld.nl', 'spaties eromheen zijn geen fout');
  assert.equal(normalizeUrl('https://voorbeeld.nl/'), 'https://voorbeeld.nl');
  assert.equal(normalizeUrl('http://voorbeeld.nl/pad?x=1#a'), 'http://voorbeeld.nl/pad?x=1#a');
  assert.equal(normalizeUrl('voorbeeld.nl/producten'), 'https://voorbeeld.nl/producten');
  assert.equal(normalizeUrl('//voorbeeld.nl'), 'https://voorbeeld.nl');
  assert.equal(normalizeUrl('voorbeeld.nl:8080'), 'https://voorbeeld.nl:8080');
  assert.equal(normalizeUrl('app.sub.voorbeeld.co.uk'), 'https://app.sub.voorbeeld.co.uk');
  assert.equal(normalizeUrl('bücher.nl'), 'https://xn--bcher-kva.nl', 'ook een naam met trema');
});

test('website: wat geen website is wordt afgewezen, ook gevaarlijke adressen', () => {
  for (const bad of ['', '   ', 'voorbeeld', 'voor beeld.nl', 'x.y', 'localhost', 'https://localhost', 'foo@bar.nl', 'user:pw@voorbeeld.nl',
    'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'mailto:a@b.nl', 'ftp://voorbeeld.nl', 'file:///etc/passwd', '.nl', 'voorbeeld..nl', '-a.nl']) {
    assert.equal(normalizeUrl(bad), null, `"${bad}" is geen website`);
  }
});

test('e-mail: ruimhartig voor echte adressen, streng voor onzin', () => {
  for (const ok of ['naam@voorbeeld.nl', ' naam@voorbeeld.nl ', 'voor.naam+tag@sub.voorbeeld.co.uk']) assert.equal(isEmail(ok), true, ok);
  for (const bad of ['', 'naam', 'naam@', '@voorbeeld.nl', 'naam@voorbeeld', 'naam@voorbeeld.n', 'na me@voorbeeld.nl', 'naam@@voorbeeld.nl', 'naam@voor..beeld.nl']) assert.equal(isEmail(bad), false, bad);
});

test('validatie: Nederlandse meldingen per veld, en updates alleen verplicht voor producent en leverancier', () => {
  const ok = { product: 'X', website: 'x.nl', name: 'A', email: 'a@x.nl', updates: false, consent: true };
  assert.deepEqual(Object.keys(validate(ok, 'gebruiker')), [], 'een goed ingevuld formulier geeft geen meldingen');
  assert.deepEqual(Object.keys(validate(ok, 'producent')), ['updates']);
  assert.deepEqual(Object.keys(validate({ ...ok, updates: true }, 'leverancier')), []);
  const all = validate({ product: '', website: '', name: '', email: '', updates: false, consent: false }, 'producent');
  assert.deepEqual(Object.keys(all).sort(), ['consent', 'email', 'name', 'product', 'updates', 'website']);
  assert.equal(validate({ ...ok, website: 'iets' }, 'gebruiker').website, MESSAGES.websiteInvalid);
  assert.equal(validate({ ...ok, email: 'iets' }, 'gebruiker').email, MESSAGES.emailInvalid);
});

test('alle meldingen zijn Nederlands en zeggen wat je moet doen', () => {
  for (const [k, m] of Object.entries(MESSAGES)) {
    assert.ok(!/please|fill out|enter a|invalid|required|valid /i.test(m), `${k} bevat Engels: ${m}`);
    assert.ok(/[.]$/.test(m), `${k} eindigt met een punt`);
  }
  assert.match(MESSAGES.websiteInvalid, /voorbeeld\.nl/, 'noemt een voorbeeld');
  assert.ok(!/https?:\/\//.test(MESSAGES.websiteEmpty + MESSAGES.websiteInvalid), 'vraagt nergens om https://');
});
