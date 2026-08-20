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

There's no free, key-less, production-ready global lightning API, so
`js/lightning.js` currently generates **simulated** strikes for demo purposes.
To wire up a real feed, replace `fetchLightningStrikes()` in that file with a
call to a real provider, for example:

- [Blitzortung.org](https://www.blitzortung.org/) — community lightning
  detection network (check current terms before use).
- [Vaisala Xweather](https://www.xweather.com/) or [Spire](https://spire.com/) —
  commercial lightning APIs with proper SLAs.

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
├── js/lightning.js       Lightning data layer (simulated — see above)
└── README.md
```

## Roadmap ideas

- Swap the simulated lightning layer for a real data feed.
- Add a severe weather alerts overlay.
- Add hourly/daily forecast detail in the side panel.
- Persist recent searches.
