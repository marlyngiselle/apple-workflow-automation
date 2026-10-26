import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toHtml, toMarkdown } from '../src/core/render.mjs';

describe('render', () => {
  const doc = [
    { type: 'h1', text: 'Title' },
    { type: 'p', text: { strong: 'Label:', text: 'value' } },
    { type: 'ul', items: ['plain [x] *y*', { text: 'docs', href: 'https://example.com/a?b=1&c=2' }] },
    { type: 'table', head: ['Name', 'Count'], rows: [['a|b', '1']] },
  ];
  it('puts the title first, as Notes expects', () => {
    assert.ok(toHtml(doc).startsWith('<h1>Title</h1>\n'));
  });
  it('renders HTML for Notes, escaping text and attributes', () => {
    const html = toHtml(doc);
    assert.ok(html.includes('<div><b>Label:</b> value</div>'));
    assert.ok(html.includes('<a href="https://example.com/a?b=1&amp;c=2">docs</a>'));
    assert.ok(html.includes('<li>a|b, Count 1</li>'));
  });
  it('renders Markdown with escaping and a real table', () => {
    const markdown = toMarkdown(doc);
    assert.ok(markdown.includes('**Label:** value'));
    assert.ok(markdown.includes('- plain \\[x\\] \\*y\\*'));
    assert.ok(markdown.includes('| Name | Count |\n| --- | ---: |\n| a\\|b | 1 |'));
  });
  it('refuses unknown blocks', () => {
    assert.throws(() => toHtml([{ type: 'blink' }]), /Unknown block/);
    assert.throws(() => toMarkdown([{ type: 'blink' }]), /Unknown block/);
  });
});
