// Small text helpers shared by the model and the renderer.

export const fold = v => String(v ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export const slugify = v => fold(v).replace(/ /g, '-') || 'item';

export const esc = v => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// First sentence(s) of a text, cut on a word boundary at max characters.
export function lead(text, max = 220) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const sentence = t.match(/^.{40,}?[.!?](?=\s|$)/);
  if (sentence && sentence[0].length <= max) return sentence[0];
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length).replace(/[,;:\s]+$/, '') + '…';
}

// "A, B en C" for lists in running text.
export function nl(list) {
  const l = list.filter(Boolean);
  if (l.length <= 1) return l.join('');
  return l.slice(0, -1).join(', ') + ' en ' + l[l.length - 1];
}

export const dateNl = iso => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(d);
};

export const isoDay = iso => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

// As many whole sentences as fit in max characters (for meta descriptions).
export function fit(text, max = 155) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  let out = '';
  for (const s of t.match(/[^.!?]+[.!?]+(\s|$)/g) || []) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  if (out.trim().length >= max * 0.55) return out.trim();
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
}
