'use strict';

// Everything is built with textContent, never innerHTML, so entry names cannot inject markup.
const $ = (selector) => document.querySelector(selector);

let state = null;
let toastTimer = null;

function formatMg(value) {
  return `${Math.round(value)} mg`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function renderStatus() {
  const { today, activeMg, halfLifeHours } = state;
  const fill = $('#progress-fill');
  const message = $('#status-message');
  const bar = document.querySelector('.progress');

  $('#today-total').textContent = formatMg(today.totalMg);
  $('#active-mg').textContent = formatMg(activeMg);
  $('#limit-text').textContent = `Daily limit ${formatMg(today.limitMg)} (${today.percent}% used). Half-life ${halfLifeHours} h.`;
  fill.style.width = `${today.percent}%`;
  bar.setAttribute('aria-valuenow', String(today.percent));

  let level = 'ok';
  let text = 'Under your daily limit.';
  if (today.overLimit) {
    level = 'over';
    text = 'Over your daily limit for today.';
  } else if (today.percent >= 80) {
    level = 'near';
    text = 'Getting close to your daily limit.';
  }
  fill.className = `progress-fill ${level === 'ok' ? '' : level}`.trim();
  message.className = `status-message ${level}`;
  message.textContent = text;
}

function renderPresets() {
  const container = $('#presets');
  container.replaceChildren(
    ...state.presets.map((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.append(preset.name);
      const detail = document.createElement('span');
      detail.textContent = `${preset.mg} mg`;
      button.append(detail);
      button.addEventListener('click', () => addEntry({ name: preset.name, mg: preset.mg }));
      return button;
    }),
  );
}

function renderLog() {
  const list = $('#log');
  const entries = state.today.entries;
  $('#log-empty').hidden = entries.length > 0;

  list.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement('li');

      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'log-name';
      name.textContent = entry.name;
      const meta = document.createElement('div');
      meta.className = 'log-meta';
      meta.textContent = formatTime(entry.timestamp);
      info.append(name, meta);

      const mg = document.createElement('span');
      mg.className = 'log-mg';
      mg.textContent = formatMg(entry.mg);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger-link';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${entry.name} at ${formatTime(entry.timestamp)}`);
      remove.addEventListener('click', () => deleteEntry(entry.id));

      item.append(info, mg, remove);
      return item;
    }),
  );
}

function renderWeek() {
  const max = Math.max(state.today.limitMg, ...state.last7Days.map((day) => day.mg));
  const container = $('#week');
  container.replaceChildren(
    ...state.last7Days.map((day) => {
      const column = document.createElement('div');
      column.className = 'week-day';

      const value = document.createElement('span');
      value.className = 'week-value';
      value.textContent = day.mg > 0 ? `${day.mg}` : '';

      const bar = document.createElement('div');
      bar.className = `week-bar${day.mg > state.today.limitMg ? ' over' : ''}`;
      bar.style.height = `${Math.max(2, (day.mg / max) * 100)}%`;
      bar.title = `${day.label}: ${formatMg(day.mg)}`;

      const label = document.createElement('span');
      label.textContent = day.label;

      column.append(value, bar, label);
      return column;
    }),
  );
}

function renderSettings() {
  const input = $('#limit-input');
  // Keep the field in sync unless the user is typing in it.
  if (document.activeElement !== input) {
    input.value = String(state.today.limitMg);
  }
}

function render() {
  $('#today-date').textContent = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  renderStatus();
  renderPresets();
  renderLog();
  renderWeek();
  renderSettings();
}

async function refresh() {
  state = await window.caffeine.getState();
  render();
}

async function addEntry(input) {
  const result = await window.caffeine.addEntry(input);
  if (!result.ok) {
    showToast(result.errors.join(' '), true);
    return;
  }
  state = result.state;
  render();
  showToast(`Added ${input.name}`);
}

async function deleteEntry(id) {
  const result = await window.caffeine.deleteEntry(id);
  if (!result.ok) {
    showToast(result.errors.join(' '), true);
    return;
  }
  state = result.state;
  render();
  showToast('Entry deleted');
}

function bindForms() {
  const now = new Date();
  $('#custom-time').value = toDatetimeLocalValue(now);
  $('#custom-time').max = toDatetimeLocalValue(now);

  $('#custom-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const timeValue = $('#custom-time').value;
    const input = {
      name: $('#custom-name').value,
      mg: $('#custom-mg').value,
      timestamp: timeValue ? new Date(timeValue).toISOString() : undefined,
    };
    const result = await window.caffeine.addEntry(input);
    if (!result.ok) {
      showToast(result.errors.join(' '), true);
      return;
    }
    state = result.state;
    event.target.reset();
    $('#custom-time').value = toDatetimeLocalValue(new Date());
    render();
    showToast(`Added ${input.name.trim()}`);
  });

  $('#limit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const result = await window.caffeine.setDailyLimit($('#limit-input').value);
    if (!result.ok) {
      showToast(result.errors.join(' '), true);
      return;
    }
    state = result.state;
    render();
    showToast('Daily limit saved');
  });
}

async function start() {
  bindForms();
  await refresh();
  // Active caffeine decays with time, so refresh the numbers every minute.
  setInterval(() => refresh().catch(() => {}), 60 * 1000);
}

start().catch((err) => showToast(`Could not load data: ${err.message}`, true));
