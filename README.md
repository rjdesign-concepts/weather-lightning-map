# Weather & Lightning Map

An interactive web map showing current weather conditions and recent live
lightning activity. Built with [Leaflet](https://leafletjs.com/) and
[Open-Meteo](https://open-meteo.com/) — no build step, no API keys required to run.

## Features

- A floating toolbar (top-left) with a location search box, a "use my
  location" button, a **Weather / Lightning / Aircraft** toggle group, and a
  settings button.
- Click anywhere on the map (with Weather on) to drop a pin showing current
  conditions for that spot — temperature and a short description — in a
  small floating badge above the pin.
- A live data-feed status pill (bottom-left) with three states: **Live**
  (with a "updated Xs ago" timestamp), **Partial connection**, and
  **Disconnected**.
- Map controls (bottom-right): a light/dark theme toggle (which also swaps
  the map's basemap tiles) and zoom in/out buttons.
- A lightning overlay showing recent strikes near the visible map area; a
  fresh live strike plays a one-shot "sound wave" ring that expands outward
  from the strike location and fades — meant to read as the thunder
  physically propagating across the land — then settles into a plain dot.
  Panning/zooming replays historical strikes in view without re-triggering
  that animation.
- Aircraft toggle is present and fully interactive (it persists like the
  other two and flips its pressed state normally) but intentionally shows no
  data yet — there's no live flight-tracking source wired up. See "Aircraft
  data" below.
- Customizable via the toolbar's core toggles/theme switch and a settings
  modal for everything else — see Settings below.

## Settings

Controls are split into two tiers:

- **Toolbar (core, one click)** — the Weather / Lightning / Aircraft toggle
  group, and the light/dark theme toggle (also drives the map basemap).
- **Settings modal (gear icon, more deliberate)** — lightning strike time
  window (5/10/20/60 min), max strikes rendered at once, whether the live
  connection status pill is shown, units (metric/imperial), and what the map
  does on load (fixed default view, remember where you left off, or use your
  current location).

Everything is saved to the browser's `localStorage` and persists between
visits — see `js/settings.js` for the storage format.

## Aircraft data

The Aircraft toggle in the toolbar is a placeholder for a future live
flight-tracking layer. FlightRadar24 was ruled out (no free/legal API path
for this kind of use). OpenSky Network was investigated as an alternative,
but its API blocks direct cross-origin requests from a browser regardless of
auth tier, so it would need a small server-side proxy (or a scheduled
snapshot job) to work from a static site like this one. That's parked for
now — see the project notes for the fuller writeup — so the toggle exists
and behaves like a real control, it just has nothing to render yet.

## Lightning data

Live strikes come from [Blitzortung.org](https://www.blitzortung.org/), a
community lightning detection network — via the same public WebSocket feed
their own live map uses. There's no official REST API for this; the
protocol in `js/lightning.js` (server list, handshake, and the LZW
decompression used on incoming frames) is reverse-engineered and matches
several independent open-source clients, for example:

- [SimonSchick/BlitzortungAPI](https://github.com/SimonSchick/BlitzortungAPI) (TypeScript)
- [ZaptoInc/blitzortung-discord](https://github.com/ZaptoInc/blitzortung-discord) (JavaScript)
- [akeamc/blitzortung](https://github.com/akeamc/blitzortung) (Rust)
- [gkbrk.com/blitzortung](https://www.gkbrk.com/blitzortung) (protocol writeup)

Because it's unofficial, it may break if Blitzortung changes their protocol.

**Usage terms** (see [Blitzortung's contact/policy page](https://www.blitzortung.org/en/contact.php)):
data is offered under CC BY-SA 4.0, for **personal / non-commercial /
entertainment use only** — not for storm warning systems, damage
assessment, or risk analysis. This app attributes Blitzortung.org in the
footer and opens a single WebSocket connection with backoff-based
reconnect, as a good citizen of their infrastructure.

## Running locally

This is a static site — no build tools needed. Any static file server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed URL in your browser.

## Project structure

```
.
├── index.html          Page markup
├── css/style.css        Styling
├── js/app.js             Map, weather, search, geolocation, settings wiring
├── js/settings.js        User settings — localStorage-backed store (see Settings above)
├── js/lightning.js       Lightning data layer (live Blitzortung.org feed — see above)
└── README.md
```

## Roadmap ideas

- Add a severe weather alerts overlay.
- Add hourly/daily forecast detail (e.g. an expanded view off the pin badge).
- Persist recent searches.
- Fade/shrink strike markers by age instead of a hard cutoff.
- Wire up a real Aircraft data source (see "Aircraft data" above).
