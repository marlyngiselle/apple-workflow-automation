import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AwaError, EXIT_CODES, exitCodeFor, formatError, translateAppError } from '../src/core/errors.mjs';
import { normalizeEvent, normalizeSnapshot, senderName } from '../src/core/model.mjs';

describe('errors', () => {
  it('turns Apple Events failures into actionable errors', () => {
    const denied = translateAppError('Calendar', new Error('Error: Not authorized to send Apple events to Calendar. (-1743)'));
    assert.equal(denied.code, 'permission');
    assert.equal(exitCodeFor(denied), EXIT_CODES.permission);
    assert.match(denied.hint, /Privacy & Security > Automation/);
    assert.equal(translateAppError('Notes', new Error("Can't get object. (-1728)")).code, 'notFound');
    assert.equal(translateAppError('Mail', new Error('AppleEvent timed out. (-1712)')).code, 'internal');
  });
  it('passes AwaError through untouched and formats it for stderr', () => {
    const error = new AwaError('usage', 'Bad flag.', 'Try --help.');
    assert.equal(translateAppError('Notes', error), error);
    assert.equal(formatError('weekly-review', error), 'awa weekly-review: Bad flag.\nhint: Try --help.');
    assert.equal(exitCodeFor(new Error('boom')), 1);
    assert.equal(new AwaError('made-up', 'x').code, 'internal');
  });
});

describe('model', () => {
  it('fills safe defaults for a sparse event', () => {
    const event = normalizeEvent({ title: ' Focus ', start: '2026-10-20T09:00:00' });
    assert.equal(event.title, 'Focus');
    assert.equal(event.calendar, '(no calendar)');
    assert.deepEqual(event.end, event.start);
    assert.equal(event.status, 'confirmed');
  });
  it('keeps only the display name of a sender', () => {
    assert.equal(senderName('Billing Team <billing@example.com>'), 'Billing Team');
    assert.equal(senderName('"Alex Doe" <alex@example.net>'), 'Alex Doe');
    assert.equal(senderName('<solo@example.com>'), 'solo@example.com');
  });
  it('says which snapshot record is broken', () => {
    assert.throws(() => normalizeSnapshot({ events: [{ title: 'No start' }] }), /events\[0\]: Missing start/);
    assert.throws(() => normalizeSnapshot({ notes: 'nope' }), /must be an array/);
    assert.throws(() => normalizeSnapshot([]), /JSON object/);
    assert.deepEqual(normalizeSnapshot({}).events, []);
  });
});
