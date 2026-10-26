import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { csvField, decodeEntities, escapeHtml, extractLinks, htmlToLines, isCallLink, normalizeKey, toCsv, truncate } from '../src/core/text.mjs';

describe('HTML in and out of Notes', () => {
  it('escapes what Notes would read as markup', () => {
    assert.equal(escapeHtml(`<b>"Q&A"</b> it's`), '&lt;b&gt;&quot;Q&amp;A&quot;&lt;/b&gt; it&#39;s');
  });
  it('decodes named and numeric entities', () => {
    assert.equal(decodeEntities('a &amp; b &lt;3 &#233;t&#xE9; &nbsp;x &unknown;'), 'a & b <3 été  x &unknown;');
  });
  it('turns a Notes body back into lines', () => {
    const body = '<div><h1>Inbox</h1></div>\n<div>First</div><div><br></div><div>Second &amp; third</div><ul><li>Item</li></ul>';
    assert.deepEqual(htmlToLines(body), ['Inbox', 'First', '', 'Second & third', 'Item']);
  });
});

describe('links', () => {
  it('finds, cleans and de-duplicates links across fields', () => {
    const links = extractLinks('https://zoom.us/j/1', 'See (https://docs.example.com/plan). And https://zoom.us/j/1, again.', null);
    assert.deepEqual(links, ['https://zoom.us/j/1', 'https://docs.example.com/plan']);
  });
  it('recognises video call links', () => {
    assert.equal(isCallLink('https://us02web.zoom.us/j/123'), true);
    assert.equal(isCallLink('https://meet.google.com/abc-defg-hij'), true);
    assert.equal(isCallLink('https://docs.example.com/zoom.us'), false);
  });
});

describe('small helpers', () => {
  it('normalizes keys for loose matching', () => {
    assert.equal(normalizeKey('Deep-Work'), normalizeKey('deep work'));
    assert.equal(normalizeKey('Café'), 'cafe');
  });
  it('truncates with an ellipsis', () => {
    assert.equal(truncate('abcdefghij', 8), 'abcde...');
    assert.equal(truncate('short', 8), 'short');
  });
  it('writes RFC 4180 CSV', () => {
    assert.equal(csvField('a,b'), '"a,b"');
    assert.equal(csvField('say "hi"'), '"say ""hi"""');
    assert.equal(toCsv([{ a: 1, b: 'x,y' }], [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }]), 'A,B\r\n1,"x,y"\r\n');
  });
});
