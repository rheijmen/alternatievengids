// Progressive enhancement for alternatievengids.nl: search, filters and the submit dialog.
// Everything works without this file (links, lists, mailto), and nothing is sent anywhere except an
// inzending the visitor submits on purpose.
(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fold = v => String(v ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  // One typo allowed, as in the scan's search.
  const nearly = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    if (i === a.length && i === b.length) return true;
    return (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) || a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
  };

  // ---- Search -------------------------------------------------------------------------------------------
  const form = $('[data-search]');
  if (form) {
    const input = $('input', form), list = $('.search-results', form);
    let index = null, active = -1, shown = [];
    form.hidden = false;
    const load = () => index || (index = fetch('/zoek.json').then(r => r.json()).catch(() => []));
    const score = (e, q, words) => {
      const n = fold(e.n);
      if (n === q) return 100;
      if (n.startsWith(q)) return 80;
      if (n.split(' ').some(w => w.startsWith(q))) return 60;
      if (n.includes(q)) return 40;
      if (e.k && fold(e.k).includes(q)) return 20;
      if (q.length >= 4 && words.some(w => n.split(' ').some(x => nearly(x, w)))) return 10;
      return 0;
    };
    const render = () => {
      list.innerHTML = '';
      shown.forEach((e, i) => {
        const li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.id = 'sr-' + i;
        li.setAttribute('aria-selected', i === active ? 'true' : 'false');
        const a = document.createElement('a');
        a.href = e.u;
        a.textContent = e.n;
        const t = document.createElement('span');
        t.textContent = e.t === 'doel' ? 'Alternatief voor' : 'Product';
        a.append(' ', t);
        li.append(a);
        list.append(li);
      });
      list.hidden = !shown.length;
      input.setAttribute('aria-expanded', String(shown.length > 0));
      if (active >= 0) input.setAttribute('aria-activedescendant', 'sr-' + active); else input.removeAttribute('aria-activedescendant');
    };
    input.addEventListener('input', async () => {
      const q = fold(input.value);
      if (q.length < 2) { shown = []; active = -1; render(); return; }
      const data = await load();
      const words = q.split(' ');
      shown = data.map(e => [e, score(e, q, words)]).filter(x => x[1] > 0)
        .sort((a, b) => b[1] - a[1] || (a[0].t === 'doel' ? -1 : 1) - (b[0].t === 'doel' ? -1 : 1) || a[0].n.localeCompare(b[0].n, 'nl')).slice(0, 8).map(x => x[0]);
      active = -1;
      render();
    });
    input.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        if (!shown.length) return;
        ev.preventDefault();
        active = (active + (ev.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
        render();
      } else if (ev.key === 'Escape') { shown = []; active = -1; render(); }
    });
    form.addEventListener('submit', ev => { ev.preventDefault(); const e = shown[Math.max(active, 0)]; if (e) location.href = e.u; });
    document.addEventListener('click', ev => { if (!form.contains(ev.target)) { shown = []; render(); } });
  }

  // ---- Filters on lists ---------------------------------------------------------------------------------
  const filters = $('[data-filters]');
  const filterable = $('[data-filterable]');
  if (filters && filterable) {
    filters.hidden = false;
    const apply = key => {
      let visible = 0;
      $$('.item', filterable).forEach(li => {
        const show = key === 'all' || li.dataset[key] === '1';
        li.hidden = !show;
        if (show) visible++;
      });
      $$('.group', filterable).forEach(g => { g.hidden = !$$('.item', g).some(li => !li.hidden); });
      $('.filter-empty', filters).hidden = visible > 0;
    };
    filters.addEventListener('click', ev => {
      const b = ev.target.closest('[data-filter]');
      if (!b) return;
      $$('[data-filter]', filters).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      apply(b.dataset.filter);
    });
  }

  // ---- Submit dialog and forms --------------------------------------------------------------------------
  const dialog = $('#submit-dialog');
  const UPDATE_TEXT = {
    gebruiker: 'Je mag me mailen met vragen over deze inzending.',
    producent: 'Ik ben bereid updates over dit product door te geven en vragen te beantwoorden.',
    leverancier: 'Ik ben bereid updates over dit product door te geven en vragen te beantwoorden.',
  };

  const prefill = (f, params) => {
    const role = params.get('role');
    if (role && $(`input[name=role][value="${role}"]`, f)) $(`input[name=role][value="${role}"]`, f).checked = true;
    if (params.get('product')) f.elements.product.value = params.get('product');
    syncRole(f);
  };
  function syncRole(f) {
    const role = f.elements.role.value;
    const box = f.elements.updates;
    $('[data-updates-text]', f).textContent = UPDATE_TEXT[role];
    box.required = role !== 'gebruiker';
  }

  $$('[data-submit-open]').forEach(a => a.addEventListener('click', ev => {
    if (!dialog || typeof dialog.showModal !== 'function') return;
    ev.preventDefault();
    const f = $('form', dialog);
    prefill(f, new URL(a.href, location.href).searchParams);
    dialog.showModal();
    f.elements.product.focus();
  }));
  if (dialog) {
    dialog.addEventListener('click', ev => { if (ev.target === dialog || ev.target.closest('[data-close]')) dialog.close(); });
  }

  $$('form[data-submit-form]').forEach(f => {
    prefill(f, new URLSearchParams(location.search));
    $$('input[name=role]', f).forEach(r => r.addEventListener('change', () => syncRole(f)));
    f.addEventListener('submit', async ev => {
      ev.preventDefault();
      const err = $('.form-error', f), done = $('.form-done', f);
      err.hidden = true; done.hidden = true;
      if (f.elements.trap.value) return; // bots fill the hidden field
      const d = {
        role: f.elements.role.value, product: f.elements.product.value.trim(), website: f.elements.website.value.trim(), replaces: f.elements.replaces.value.trim(),
        country: f.elements.country.value.trim(), opensource: f.elements.opensource.value, why: f.elements.why.value.trim(),
        name: f.elements.name.value.trim(), email: f.elements.email.value.trim(), updates: f.elements.updates.checked, consent: f.elements.consent.checked,
        source: 'alternatievengids.nl', page: location.pathname, submittedAt: new Date().toISOString(),
      };
      const lines = [
        `Rol: ${d.role}`, `Product: ${d.product}`, `Website: ${d.website}`, `Vervangt: ${d.replaces}`, `Land: ${d.country}`, `Open source: ${d.opensource || 'weet niet'}`,
        `Toelichting: ${d.why}`, `Naam: ${d.name}`, `E-mail: ${d.email}`, `Bereid tot updates en vragen: ${d.updates ? 'ja' : 'nee'}`,
      ];
      const mail = `mailto:${f.dataset.mailto}?subject=${encodeURIComponent('Inzending alternatievengids: ' + d.product)}&body=${encodeURIComponent('Hoi Rik,\n\nIk dien een alternatief in:\n\n' + lines.join('\n') + '\n')}`;
      const button = $('button[type=submit]', f);
      if (f.dataset.endpoint) {
        button.disabled = true;
        try {
          const res = await fetch(f.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
          if (!res.ok) throw new Error(String(res.status));
          done.textContent = 'Bedankt. Je inzending is binnen. Newground toetst hem en mailt je als er vragen zijn.';
          done.hidden = false; f.reset(); syncRole(f);
        } catch {
          err.innerHTML = '';
          err.append('Versturen is niet gelukt. Je kunt je inzending ook per mail sturen: ');
          const a = document.createElement('a'); a.href = mail; a.textContent = 'open een ingevulde mail'; err.append(a, '.');
          err.hidden = false;
        } finally { button.disabled = false; }
      } else {
        location.href = mail;
        done.textContent = 'Je mailprogramma opent met je inzending. Verstuur de mail om af te ronden.';
        done.hidden = false;
      }
    });
  });
})();
