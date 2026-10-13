'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_DAILY_LIMIT_MG, MIN_DAILY_LIMIT_MG, MAX_DAILY_LIMIT_MG } = require('./caffeine');

function defaultData() {
  return { entries: [], settings: { dailyLimitMg: DEFAULT_DAILY_LIMIT_MG } };
}

function isValidStoredEntry(entry) {
  return (
    entry &&
    typeof entry.id === 'string' &&
    typeof entry.name === 'string' &&
    typeof entry.mg === 'number' &&
    Number.isFinite(entry.mg) &&
    typeof entry.timestamp === 'string' &&
    !Number.isNaN(Date.parse(entry.timestamp))
  );
}

// Fills in defaults and drops malformed records so a hand-edited file cannot break the app.
function normalize(raw) {
  const data = defaultData();
  if (!raw || typeof raw !== 'object') {
    return data;
  }
  if (Array.isArray(raw.entries)) {
    data.entries = raw.entries.filter(isValidStoredEntry);
  }
  const limit = Number(raw.settings && raw.settings.dailyLimitMg);
  if (Number.isFinite(limit) && limit >= MIN_DAILY_LIMIT_MG && limit <= MAX_DAILY_LIMIT_MG) {
    data.settings.dailyLimitMg = Math.round(limit);
  }
  return data;
}

// Reads the data file. A missing file gives empty data. An unreadable file is moved aside, not overwritten.
function loadData(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return defaultData();
    }
    throw err;
  }

  try {
    return normalize(JSON.parse(text));
  } catch (err) {
    const backupPath = `${filePath}.corrupt-${Date.now()}`;
    fs.renameSync(filePath, backupPath);
    return defaultData();
  }
}

// Writes to a temp file first, then renames, so a crash mid-write cannot leave a half-written file.
function saveData(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

// The helpers below return new data objects and never mutate their input.
function addEntry(data, entry) {
  return { ...data, entries: [...data.entries, entry] };
}

function deleteEntry(data, id) {
  return { ...data, entries: data.entries.filter((entry) => entry.id !== id) };
}

function setDailyLimit(data, mg) {
  return { ...data, settings: { ...data.settings, dailyLimitMg: mg } };
}

module.exports = {
  defaultData,
  normalize,
  loadData,
  saveData,
  addEntry,
  deleteEntry,
  setDailyLimit,
};
