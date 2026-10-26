// The only place that calls Application(). Every Apple Event goes through guard(),
// which turns OSA error codes into AwaError with a hint the user can act on.

import { translateAppError } from '../../core/errors.mjs';

const cache = {};

export function app(name) {
  if (!cache[name]) {
    try {
      cache[name] = Application(name);
    } catch (error) {
      throw translateAppError(name, error);
    }
  }
  return cache[name];
}

export function guard(name, work) {
  try {
    return work(app(name));
  } catch (error) {
    throw translateAppError(name, error);
  }
}

// Bulk property reads (`specifier.title()` returns an array) are one Apple Event
// instead of one per item. On an empty specifier some apps throw; treat that as empty.
export function readAll(specifier, property) {
  try {
    const values = specifier[property]();
    return Array.isArray(values) ? values : [];
  } catch (error) {
    if (/-1728|can.t get/i.test(String(error && error.message))) return [];
    throw error;
  }
}

export function safe(read, fallback) {
  try {
    const value = read();
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}
