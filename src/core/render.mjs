// A tiny document model rendered two ways: HTML for the body of an Apple Note,
// and Markdown for --dry-run, logs and anything outside Notes.
//
// Blocks: { type: 'h1' | 'h2' | 'h3' | 'p', text }
//         { type: 'ul', items: [Inline] }
//         { type: 'table', head: [string], rows: [[string]], items?: [Inline] }
//           (a Markdown table; in HTML, `items` or a generated list)
// Inline: a string, or { text, href }, or { strong, text } for "Label: value" lines.

import { escapeHtml } from './text.mjs';

function inlineHtml(item) {
  if (typeof item === 'string') return escapeHtml(item);
  if (item.href) return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.text || item.href)}</a>`;
  if (item.strong) return `<b>${escapeHtml(item.strong)}</b> ${escapeHtml(item.text || '')}`.trimEnd();
  return escapeHtml(item.text || '');
}

function escapeMarkdown(text) {
  return String(text).replace(/([\\`*_[\]<>|])/g, '\\$1');
}

function inlineMarkdown(item) {
  if (typeof item === 'string') return escapeMarkdown(item);
  if (item.href) return item.text && item.text !== item.href ? `[${escapeMarkdown(item.text)}](${item.href})` : `<${item.href}>`;
  if (item.strong) return `**${escapeMarkdown(item.strong)}** ${escapeMarkdown(item.text || '')}`.trimEnd();
  return escapeMarkdown(item.text || '');
}

// Notes keeps the first line as the note's title, so the h1 must come first.
export function toHtml(doc) {
  const out = [];
  for (const block of doc) {
    if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
      if (block.type !== 'h1') out.push('<div><br></div>');
      out.push(`<${block.type}>${escapeHtml(block.text)}</${block.type}>`);
    } else if (block.type === 'p') {
      out.push(`<div>${inlineHtml(block.text)}</div>`);
    } else if (block.type === 'ul') {
      out.push(`<ul>${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')}</ul>`);
    } else if (block.type === 'table') {
      // Notes has no reliable way to receive a table through scripting, so rows become list items.
      const items = block.items || block.rows.map((row) => row.map((cell, index) => (index === 0 ? cell : `${block.head[index]} ${cell}`)).join(', '));
      out.push(`<ul>${items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')}</ul>`);
    } else {
      throw new TypeError(`Unknown block type: ${block.type}`);
    }
  }
  return `${out.join('\n')}\n`;
}

export function toMarkdown(doc) {
  const out = [];
  for (const block of doc) {
    if (block.type === 'h1') out.push(`# ${block.text}`);
    else if (block.type === 'h2') out.push(`## ${block.text}`);
    else if (block.type === 'h3') out.push(`### ${block.text}`);
    else if (block.type === 'p') out.push(inlineMarkdown(block.text));
    else if (block.type === 'ul') out.push(block.items.map((item) => `- ${inlineMarkdown(item)}`).join('\n'));
    else if (block.type === 'table') {
      const head = `| ${block.head.map(escapeMarkdown).join(' | ')} |`;
      const rule = `| ${block.head.map((_, index) => (index === 0 ? '---' : '---:')).join(' | ')} |`;
      const rows = block.rows.map((row) => `| ${row.map(escapeMarkdown).join(' | ')} |`);
      out.push([head, rule, ...rows].join('\n'));
    } else throw new TypeError(`Unknown block type: ${block.type}`);
  }
  return `${out.join('\n\n')}\n`;
}
