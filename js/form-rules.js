// Input rules for the forms of alternatievengids.nl. Kept apart from gids.js so they can be tested without a browser.
//
// Rules (Newground): a visitor never has to know web jargon. A website may be typed as "voorbeeld.nl", "www.voorbeeld.nl"
// or "https://voorbeeld.nl"; the browser's own English messages ("Please enter a URL") are never shown; every message is
// Dutch and says what to do.
(function (root) {
  'use strict';

  const MESSAGES = {
    product: 'Vul de naam van het product in.',
    websiteEmpty: 'Vul de website in, bijvoorbeeld voorbeeld.nl.',
    websiteInvalid: 'Dit lijkt geen websiteadres. Vul het zo in: voorbeeld.nl.',
    name: 'Vul je naam in.',
    emailEmpty: 'Vul je e-mailadres in.',
    emailInvalid: 'Dit lijkt geen e-mailadres. Vul het zo in: naam@voorbeeld.nl.',
    updates: 'Als producent of leverancier help je ons met updates en vragen. Vink dit vakje aan om door te gaan.',
    consent: 'Zonder je toestemming kunnen we je inzending niet beoordelen. Vink dit vakje aan om door te gaan.',
    summary: 'Er klopt nog iets niet. Kijk bij de gemarkeerde velden.',
  };

  // "voorbeeld.nl", "www.voorbeeld.nl" and "https://voorbeeld.nl/pad" all become a full address; anything that is
  // clearly not a website gives null. Never accepts other schemes (javascript:, data:, mailto:) or addresses with a login.
  function normalizeUrl(input) {
    let v = String(input == null ? '' : input).trim();
    if (!v || /\s/.test(v)) return null;
    if (/^(javascript|data|file|mailto|ftp|tel|blob):/i.test(v)) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = 'https://' + v.replace(/^\/\//, '');
    let u;
    try { u = new URL(v); } catch (e) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    const labels = u.hostname.split('.');
    const tld = labels[labels.length - 1];
    if (labels.length < 2 || !/^([a-z]{2,}|xn--[a-z0-9-]+)$/.test(tld)) return null;
    if (!labels.every(l => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return null;
    return u.href.replace(/\/$/, '');
  }

  function isEmail(input) {
    const v = String(input == null ? '' : input).trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(v) && !/\.\./.test(v);
  }

  // values: { product, website, name, email, updates (bool), consent (bool) }; role: gebruiker, producent or leverancier.
  // Returns an object with a Dutch message per field that is not right (empty when everything is fine).
  function validate(values, role) {
    const e = {};
    if (!String(values.product || '').trim()) e.product = MESSAGES.product;
    if (!String(values.website || '').trim()) e.website = MESSAGES.websiteEmpty;
    else if (!normalizeUrl(values.website)) e.website = MESSAGES.websiteInvalid;
    if (!String(values.name || '').trim()) e.name = MESSAGES.name;
    if (!String(values.email || '').trim()) e.email = MESSAGES.emailEmpty;
    else if (!isEmail(values.email)) e.email = MESSAGES.emailInvalid;
    if (role !== 'gebruiker' && !values.updates) e.updates = MESSAGES.updates;
    if (!values.consent) e.consent = MESSAGES.consent;
    return e;
  }

  root.GidsRules = { MESSAGES: MESSAGES, normalizeUrl: normalizeUrl, isEmail: isEmail, validate: validate };
})(typeof window !== 'undefined' ? window : globalThis);
