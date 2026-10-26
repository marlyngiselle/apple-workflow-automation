// Text helpers: HTML that Notes accepts, plain text out of a note body, links, CSV.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    const known = ENTITIES[name.toLowerCase()];
    return known === undefined ? whole : known;
  });
}

// Notes stores bodies as HTML, one <div> per line and <div><br></div> for an empty line.
// This turns a body back into lines of text. A body with no tags is split on newlines.
export function htmlToLines(html) {
  const source = String(html || '').replace(/\r\n?/g, '\n');
  const text = /<[a-z!/][^>]*>/i.test(source)
    ? source
        .replace(/\n/g, '')
        .replace(/<br\s*\/?>\s*(?=<\/(?:div|p|li|h[1-6])>)/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/(?:<\/(?:div|p|li|h[1-6]|tr)>\s*)+/gi, '\n')
        .replace(/<[^>]+>/g, '')
    : source;
  const lines = decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ' ').replace(/\s+$/g, ''));
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines;
}

export function collapseSpaces(value) {
  return String(value).replace(/\s+/g, ' ').trim();
}

// Lowercase and drop everything but letters and digits, so "Deep-Work" matches "deep work".
export function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

export function extractLinks(...sources) {
  const seen = new Set();
  const links = [];
  for (const source of sources) {
    if (!source) continue;
    const found = String(source).match(URL_PATTERN) || [];
    for (const raw of found) {
      const url = raw.replace(/[).,;:!?\]}>]+$/, '');
      if (!seen.has(url)) {
        seen.add(url);
        links.push(url);
      }
    }
  }
  return links;
}

const CALL_HOSTS = ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'teams.live.com', 'webex.com', 'whereby.com', 'facetime.apple.com'];

export function hostOf(url) {
  const match = /^https?:\/\/([^/?#:]+)/i.exec(url);
  return match ? match[1].toLowerCase().replace(/^www\./, '') : '';
}

export function isCallLink(url) {
  const host = hostOf(url);
  return CALL_HOSTS.some((known) => host === known || host.endsWith(`.${known}`));
}

export function truncate(value, max) {
  const text = String(value);
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm || `${singular}s`}`;
}

export function csvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// columns: [{ key, header }]. Lines end with CRLF as RFC 4180 asks, which spreadsheets expect.
export function toCsv(rows, columns) {
  const lines = [columns.map((column) => csvField(column.header)).join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvField(row[column.key])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}
