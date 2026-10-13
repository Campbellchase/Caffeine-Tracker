'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  HALF_LIFE_HOURS,
  remainingMg,
  validateDailyLimit,
  validateEntry,
  summarize,
  localDayKey,
} = require('../src/core/caffeine');

const SETTINGS = { dailyLimitMg: 400 };

test('remainingMg halves the dose after one half-life', () => {
  assert.equal(remainingMg(100, HALF_LIFE_HOURS), 50);
  assert.equal(remainingMg(100, 0), 100);
  assert.ok(Math.abs(remainingMg(100, 2 * HALF_LIFE_HOURS) - 25) < 1e-9);
});

test('validateEntry accepts a well-formed entry and trims the name', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const result = validateEntry({ name: '  Espresso  ', mg: '63' }, now);
  assert.equal(result.ok, true);
  assert.equal(result.entry.name, 'Espresso');
  assert.equal(result.entry.mg, 63);
  assert.equal(result.entry.timestamp, now.toISOString());
  assert.equal(typeof result.entry.id, 'string');
});

test('validateEntry rejects empty names, bad amounts, and bad times', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const result = validateEntry({ name: '   ', mg: -5, timestamp: 'not a date' }, now);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
});

test('validateEntry rejects future timestamps beyond clock skew', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const future = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const result = validateEntry({ name: 'Tea', mg: 47, timestamp: future }, now);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /future/);
});

test('validateEntry handles missing input without throwing', () => {
  const result = validateEntry(undefined);
  assert.equal(result.ok, false);
});

test('validateDailyLimit enforces the allowed range', () => {
  assert.deepEqual(validateDailyLimit('400'), { ok: true, mg: 400 });
  assert.equal(validateDailyLimit(10).ok, false);
  assert.equal(validateDailyLimit(5000).ok, false);
  assert.equal(validateDailyLimit('abc').ok, false);
});

test('summarize totals only today and counts active caffeine', () => {
  const now = new Date(2026, 9, 13, 15, 0, 0); // local time
  const entries = [
    { id: 'a', name: 'Coffee', mg: 100, timestamp: new Date(2026, 9, 13, 14, 0, 0).toISOString() },
    { id: 'b', name: 'Tea', mg: 50, timestamp: new Date(2026, 9, 13, 8, 0, 0).toISOString() },
    { id: 'c', name: 'Yesterday coffee', mg: 200, timestamp: new Date(2026, 9, 12, 9, 0, 0).toISOString() },
  ];

  const view = summarize(entries, SETTINGS, now);

  assert.equal(view.today.totalMg, 150);
  assert.equal(view.today.percent, 38);
  assert.equal(view.today.overLimit, false);
  assert.deepEqual(view.today.entries.map((e) => e.id), ['a', 'b']);

  // Coffee 1h ago decays to about 87 mg. Tea 7h ago decays to about 20 mg. Yesterday's dose is still
  // counted, at about 200 * 0.5^(30/5), which is about 3 mg.
  const expected = 100 * Math.pow(0.5, 1 / 5) + 50 * Math.pow(0.5, 7 / 5) + 200 * Math.pow(0.5, 30 / 5);
  assert.equal(view.activeMg, Math.round(expected));
});

test('summarize flags over-limit days and caps the percentage at 100', () => {
  const now = new Date(2026, 9, 13, 12, 0, 0);
  const entries = [
    { id: 'a', name: 'Big', mg: 500, timestamp: new Date(2026, 9, 13, 11, 0, 0).toISOString() },
  ];
  const view = summarize(entries, SETTINGS, now);
  assert.equal(view.today.overLimit, true);
  assert.equal(view.today.percent, 100);
});

test('summarize returns seven chronological days ending today', () => {
  const now = new Date(2026, 9, 13, 12, 0, 0);
  const view = summarize([], SETTINGS, now);
  assert.equal(view.last7Days.length, 7);
  assert.equal(view.last7Days[6].key, localDayKey(now));
  assert.equal(view.last7Days[0].key, '2026-10-07');
});

test('localDayKey uses local calendar dates with zero padding', () => {
  assert.equal(localDayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});
