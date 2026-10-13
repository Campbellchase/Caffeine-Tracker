# Caffeine Tracker

A small desktop app for logging what you drink and seeing how much caffeine is still active in your body.

- One-tap presets for common drinks, plus a custom entry form with a time you can set
- Today's total against a daily limit you choose (default 400 mg)
- Estimated active caffeine right now, using a 5-hour half-life
- Last 7 days at a glance
- Data stays on your machine in a local JSON file

Built with Electron, so it runs on Windows, macOS and Linux from one codebase.

## Run it

Developed and tested with Node.js 22.

```bash
npm install
npm start
```

## Test it

```bash
npm test
```

The tests cover the caffeine math, input validation, and the data store. They run without launching Electron.

## Package it

```bash
npm run dist
```

Installers are written to `dist/`. electron-builder targets the current platform by default. Configure targets under `build` in `package.json` if you need a specific format.

## Where data is stored

The app writes `caffeine-data.json` to Electron's per-user data directory:

| OS      | Location                                              |
|---------|-------------------------------------------------------|
| Windows | `%APPDATA%\Caffeine Tracker\caffeine-data.json`       |
| macOS   | `~/Library/Application Support/Caffeine Tracker/`     |
| Linux   | `~/.config/Caffeine Tracker/caffeine-data.json`       |

If that file is unreadable, it is renamed to `caffeine-data.json.corrupt-<timestamp>` and the app starts fresh, so no data is silently overwritten.

## How the numbers work

- **Caffeine values** in the presets are approximate averages. Brands, brew strength and serving sizes vary a lot.
- **Active caffeine** is the sum of each dose decayed by a 5-hour half-life. The model is a rough estimate and varies between people.
- **Daily limit** defaults to 400 mg, the commonly cited guideline for healthy adults. Change it in Settings.

This app is for tracking only and is not medical advice.

## Project layout

```
src/
  main.js              Electron main process: window, IPC handlers, persistence
  preload.js           Exposes a small, named API to the renderer
  core/
    caffeine.js        Pure logic: validation, decay math, summaries, presets
    store.js           Load/save the JSON file and immutable data helpers
  renderer/
    index.html         UI markup
    styles.css         Light and dark theme
    renderer.js        UI behavior (builds DOM with textContent only)
test/
  caffeine.test.js
  store.test.js
```

The renderer runs with `contextIsolation`, `sandbox` and no Node integration. It can only call the functions that `preload.js` exposes.
