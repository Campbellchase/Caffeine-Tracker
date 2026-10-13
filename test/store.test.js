'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  defaultData,
  normalize,
  loadData,
  saveData,
  addEntry,
  deleteEntry,
  setDailyLimit,
} = require('../src/core/store');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'caffeine-test-'));
}

const sampleEntry = { id: 'x1', name: 'Coffee', mg: 95, timestamp: '2026-10-13T12:00:00.000Z' };

test('loadData returns defaults when no file exists', () => {
  const dir = tempDir();
  assert.deepEqual(loadData(path.join(dir, 'missing.json')), defaultData());
});

test('saveData then loadData round-trips the data', () => {
  const file = path.join(tempDir(), 'nested', 'data.json');
  const data = setDailyLimit(addEntry(defaultData(), sampleEntry), 300);
  saveData(file, data);
  assert.deepEqual(loadData(file), data);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

test('a corrupt file is moved aside and replaced with defaults', () => {
  const dir = tempDir();
  const file = path.join(dir, 'data.json');
  fs.writeFileSync(file, '{ not json');
  assert.deepEqual(loadData(file), defaultData());
  assert.equal(fs.existsSync(file), false);
  const backups = fs.readdirSync(dir).filter((name) => name.includes('.corrupt-'));
  assert.equal(backups.length, 1);
});

test('normalize drops malformed entries and out-of-range limits', () => {
  const raw = {
    entries: [sampleEntry, { id: 1, name: 'bad' }, null, { ...sampleEntry, id: 'y', timestamp: 'nope' }],
    settings: { dailyLimitMg: 99999 },
  };
  const data = normalize(raw);
  assert.deepEqual(data.entries, [sampleEntry]);
  assert.equal(data.settings.dailyLimitMg, defaultData().settings.dailyLimitMg);
});

test('addEntry and deleteEntry return new objects without mutating the input', () => {
  const original = defaultData();
  const added = addEntry(original, sampleEntry);
  assert.equal(original.entries.length, 0);
  assert.equal(added.entries.length, 1);

  const removed = deleteEntry(added, sampleEntry.id);
  assert.equal(removed.entries.length, 0);
  assert.equal(added.entries.length, 1);
});

test('setDailyLimit updates only the limit', () => {
  const updated = setDailyLimit(defaultData(), 250);
  assert.equal(updated.settings.dailyLimitMg, 250);
  assert.deepEqual(updated.entries, []);
});
