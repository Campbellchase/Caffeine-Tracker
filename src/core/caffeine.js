'use strict';

const { randomUUID } = require('node:crypto');

// Caffeine's half-life in adults is commonly estimated at about 5 hours.
const HALF_LIFE_HOURS = 5;
const DEFAULT_DAILY_LIMIT_MG = 400;
const MIN_DAILY_LIMIT_MG = 50;
const MAX_DAILY_LIMIT_MG = 2000;
const MAX_ENTRY_MG = 1000;
const MAX_NAME_LENGTH = 60;
const CLOCK_SKEW_MS = 60 * 1000;

// Approximate caffeine content per serving. Actual values vary by brand and brew.
const PRESETS = [
  { name: 'Brewed coffee (8 oz)', mg: 95 },
  { name: 'Espresso (1 shot)', mg: 63 },
  { name: 'Latte (12 oz)', mg: 150 },
  { name: 'Black tea (8 oz)', mg: 47 },
  { name: 'Green tea (8 oz)', mg: 28 },
  { name: 'Cola (12 oz)', mg: 34 },
  { name: 'Energy drink (8 oz)', mg: 80 },
  { name: 'Dark chocolate (1 oz)', mg: 12 },
];

function localDayKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sumMg(entries) {
  return entries.reduce((total, entry) => total + entry.mg, 0);
}

function byTimeDesc(a, b) {
  return Date.parse(b.timestamp) - Date.parse(a.timestamp);
}

// Returns the caffeine (mg) still active from a dose after `hoursElapsed`.
function remainingMg(mg, hoursElapsed, halfLifeHours = HALF_LIFE_HOURS) {
  return mg * Math.pow(0.5, hoursElapsed / halfLifeHours);
}

function validateDailyLimit(value) {
  const mg = Number(value);
  if (!Number.isFinite(mg) || mg < MIN_DAILY_LIMIT_MG || mg > MAX_DAILY_LIMIT_MG) {
    return { ok: false, error: `Daily limit must be between ${MIN_DAILY_LIMIT_MG} and ${MAX_DAILY_LIMIT_MG} mg.` };
  }
  return { ok: true, mg: Math.round(mg) };
}

// Checks user input for a new entry and builds the stored record when it is valid.
function validateEntry(input, now = new Date()) {
  const source = input || {};
  const errors = [];

  const name = typeof source.name === 'string' ? source.name.trim() : '';
  if (!name) {
    errors.push('Name is required.');
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push(`Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }

  const mg = Number(source.mg);
  if (!Number.isFinite(mg) || mg <= 0 || mg > MAX_ENTRY_MG) {
    errors.push(`Caffeine must be between 1 and ${MAX_ENTRY_MG} mg.`);
  }

  const timestamp = source.timestamp ? new Date(source.timestamp) : now;
  if (Number.isNaN(timestamp.getTime())) {
    errors.push('Time is invalid.');
  } else if (timestamp.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    errors.push('Time cannot be in the future.');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    entry: {
      id: randomUUID(),
      name,
      mg: Math.round(mg * 10) / 10,
      timestamp: timestamp.toISOString(),
    },
  };
}

// Builds the view model the UI renders. `now` is injectable so tests can pin the clock.
function summarize(entries, settings, now = new Date()) {
  const todayKey = localDayKey(now);
  const todayEntries = entries
    .filter((entry) => localDayKey(new Date(entry.timestamp)) === todayKey)
    .sort(byTimeDesc);
  const totalTodayMg = sumMg(todayEntries);
  const limitMg = settings.dailyLimitMg;

  const activeMg = entries.reduce((total, entry) => {
    const hoursElapsed = (now.getTime() - Date.parse(entry.timestamp)) / 3600000;
    // Entries slightly in the future (clock skew) count at full strength.
    return total + (hoursElapsed < 0 ? entry.mg : remainingMg(entry.mg, hoursElapsed));
  }, 0);

  const last7Days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = localDayKey(day);
    const dayEntries = entries.filter((entry) => localDayKey(new Date(entry.timestamp)) === key);
    last7Days.push({
      key,
      label: day.toLocaleDateString([], { weekday: 'short' }),
      mg: Math.round(sumMg(dayEntries)),
    });
  }

  return {
    today: {
      totalMg: Math.round(totalTodayMg),
      limitMg,
      percent: Math.min(100, Math.round((totalTodayMg / limitMg) * 100)),
      overLimit: totalTodayMg > limitMg,
      entries: todayEntries,
    },
    activeMg: Math.round(activeMg),
    halfLifeHours: HALF_LIFE_HOURS,
    last7Days,
  };
}

module.exports = {
  HALF_LIFE_HOURS,
  DEFAULT_DAILY_LIMIT_MG,
  MIN_DAILY_LIMIT_MG,
  MAX_DAILY_LIMIT_MG,
  PRESETS,
  localDayKey,
  remainingMg,
  validateDailyLimit,
  validateEntry,
  summarize,
};
