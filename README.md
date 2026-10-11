# Property Mogul

An isometric property-tycoon game for desktop and mobile browsers, inspired by the 2012 Flash game. Start in the island city of Centropolis with $1,000,000 and a small cottage, then buy, rent, build and haggle your way to the top.

- 13 suburbs, including a ski town, a lake, farmland, docks and a beach island
- Multi-tenant buildings, a rent slider with letting odds, and business leases
- Negotiation, inspections, mortgages and private investors
- Zoning, council applications, demolition and a building designer
- Staff, skills, degrees, parties, a marketplace and a stock market

No dependencies and no framework. Everything is drawn procedurally with Canvas 2D and SVG.

## Run locally

```bash
npm run dev
```

Then open http://localhost:3000. You can also run `npm run build` and open `dist/property-mogul.html` directly.

## Layout

- `src/index.html`, `src/style.css`: page shell and styles
- `src/js/`: game code (world generator, art, simulation, business systems, renderer, UI)
- `build.mjs`: bundles everything into one HTML file in `dist/`
- `server.js`: zero-dependency server used in production (Railway)

## Deploy on Railway

Railway detects Node, runs `npm run build`, then `npm start`. The server listens on `$PORT` and serves a health check at `/healthz`.
