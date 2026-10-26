import { readFileSync } from 'node:fs';
import { normalizeSnapshot } from '../../src/core/model.mjs';

export function loadSnapshot(name = 'week-2026-w43.json') {
  return normalizeSnapshot(JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')));
}
