import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMeetingPrep, meetingPrepTitle, upcomingMeetings } from '../src/core/meeting-prep.mjs';
import { loadSnapshot } from './helpers/fixtures.mjs';
import { matchSnapshot } from './helpers/snapshot.mjs';

const snapshot = loadSnapshot();

describe('upcomingMeetings', () => {
  it('finds timed meetings starting in the window, in order', () => {
    const titles = upcomingMeetings(snapshot.events, snapshot.now, 4).map((event) => event.title);
    assert.deepEqual(titles, ['Customer demo #demo', 'Weekly wrap-up']);
  });
  it('widens with --hours and can include all-day events', () => {
    const long = upcomingMeetings(snapshot.events, new Date(2026, 9, 21, 23), 24, { includeAllDay: true }).map((event) => event.title);
    assert.deepEqual(long, ['Conference day', 'Team stand-up', 'Deep work #deep', '1:1 with Sam']);
  });
  it('filters by calendar', () => {
    assert.deepEqual(upcomingMeetings(snapshot.events, snapshot.now, 4, { calendars: ['personal'] }), []);
  });
});

describe('buildMeetingPrep', () => {
  const [demo, wrapUp] = upcomingMeetings(snapshot.events, snapshot.now, 4).map(buildMeetingPrep);

  it('titles notes by start time so each meeting gets one note', () => {
    assert.equal(demo.title, 'Prep 2026-10-23 17:00 Customer demo #demo');
    assert.equal(meetingPrepTitle({ title: 'x'.repeat(100), start: snapshot.now }).length, 'Prep 2026-10-23 16:00 '.length + 60);
  });
  it('collects attendees and every link from the invite, call link first', () => {
    assert.deepEqual(demo.event.attendees, 3);
    assert.equal(demo.event.links, 3);
    assert.match(demo.markdown, /- guest@example\.net, declined/);
    assert.match(demo.markdown, /\*\*Join:\*\* https:\/\/zoom\.us\/j\/1234567890/);
    assert.match(demo.markdown, /1 person has declined\./);
  });
  it('says so when the invite has nothing to offer', () => {
    assert.match(wrapUp.markdown, /No attendees on the invite\./);
    assert.match(wrapUp.markdown, /No links in the invite\./);
  });
  it('matches the snapshots', () => {
    matchSnapshot(demo.html, 'meeting-prep.html');
    matchSnapshot(demo.markdown, 'meeting-prep.md');
  });
});
