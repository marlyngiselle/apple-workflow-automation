// Mail adapter, strictly read only: headers of flagged messages in the unified Inbox.
// No message body is read, and nothing is moved, marked or sent.

import { guard, readAll } from './apps.mjs';

export function readFlagged() {
  return guard('Mail', (Mail) => {
    const flagged = Mail.inbox.messages.whose({ flaggedStatus: true });
    const subjects = readAll(flagged, 'subject');
    const senders = readAll(flagged, 'sender');
    const received = readAll(flagged, 'dateReceived');
    return subjects
      .map((subject, i) => ({ subject, sender: senders[i], receivedAt: received[i], mailbox: 'Inbox' }))
      .sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0));
  });
}
