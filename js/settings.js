/**
 * User-configurable settings, persisted to localStorage.
 *
 * Two tiers by design:
 *  - "Core" settings are surfaced directly in the toolbar (the Weather /
 *    Lightning / Aircraft toggle group, and the theme toggle) — one click,
 *    no menu.
 *  - Everything else lives behind the gear icon in the settings modal —
 *    changed rarely enough that a bit of friction is fine.
 *
 * Both tiers read/write through this same module so there's one source of
 * truth and one persistence mechanism.
 */

const SETTINGS_KEY = "weatherLightningMap:settings:v1";
const LAST_VIEW_KEY = "weatherLightningMap:lastView:v1";

const DEFAULTS = {
  // Core
  weatherVisible: true,
  lightningVisible: true,
  aircraftVisible: false, // toggle exists in the UI; no live data source yet
  theme: "light", // "light" | "dark" — also drives the map basemap

  // Settings panel
  units: "metric", // "metric" (°C, km/h) | "imperial" (°F, mph)
  lightningWindowMinutes: 20, // 5 | 10 | 20 | 60
  lightningMaxMarkers: 300, // 100 | 300 | 1000 | 0 (0 = unlimited)
  showStatusBadge: true,
  startLocation: "default", // "default" | "remember" | "geolocate"
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

function persist(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    // Storage unavailable (private browsing, quota, etc.) — settings just
    // won't survive a reload. Not worth surfacing to the user.
  }
}

let state = loadSettings();
const listeners = new Set();

const Settings = {
  get(key) {
    return state[key];
  },
  getAll() {
    return { ...state };
  },
  /** Update one or more keys and persist. Notifies subscribers with the full settings object. */
  set(partial) {
    state = { ...state, ...partial };
    persist(state);
    listeners.forEach((cb) => cb(state));
  },
  /** Reset everything to defaults. */
  reset() {
    state = { ...DEFAULTS };
    persist(state);
    listeners.forEach((cb) => cb(state));
  },
  /** Register a callback fired on every change (and once immediately with current state). */
  subscribe(callback) {
    listeners.add(callback);
    callback(state);
    return () => listeners.delete(callback);
  },
};

/** Helpers for the "remember last view" start-location mode. */
const LastView = {
  save(lat, lon, zoom) {
    try {
      localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ lat, lon, zoom }));
    } catch (err) {
      // ignore
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(LAST_VIEW_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  },
};
