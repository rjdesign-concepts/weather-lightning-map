# Weather & Lightning Map

An interactive web map showing current weather conditions and (simulated) recent
lightning activity. Built with [Leaflet](https://leafletjs.com/) and
[Open-Meteo](https://open-meteo.com/) — no build step, no API keys required to run.

## Features

- Click anywhere on the map to see current weather for that spot (temperature,
  feels-like, humidity, wind speed, conditions).
- Search for a city by name.
- "Use my location" button.
- A lightning overlay that shows recent strikes near the visible map area.

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
├── js/app.js             Map, weather, search, geolocation
├── js/lightning.js       Lightning data layer (live Blitzortung.org feed — see above)
└── README.md
```

## Roadmap ideas

- Add a severe weather alerts overlay.
- Add hourly/daily forecast detail in the side panel.
- Persist recent searches.
- Fade/shrink strike markers by age instead of a hard cutoff.
