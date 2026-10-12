# Property Mogul

An isometric property-tycoon game for desktop and mobile browsers, inspired by the 2012 Flash game. Start in the island city of Centropolis with $1,000,000 and a small cottage, then buy, rent, build and haggle your way to the top.

- 13 suburbs, including a ski town, a lake, farmland, docks and a beach island
- Multi-tenant buildings, a rent slider with letting odds, and business leases
- Negotiation, inspections, mortgages and private investors
- Zoning, council applications, demolition and a building designer
- Staff, skills, degrees, parties, a marketplace and a stock market
- Home age and build quality, historic homes, prestige tiers and holiday lets
- An upgrade tech tree with rare, rotating upgrades for each biome
- Family dynasties with heirs and succession, plus yacht, motor, ski and golf clubs
- **Online mode:** sign in with Apple or Google, a live leaderboard, friends, co-op property deals, player-to-player loans with your own APY and terms, a watchlist, and a public portfolio page you can share

The game is drawn procedurally with Canvas 2D and SVG and ships as a single HTML file. The server (`server/`) adds sign-in and the online features. Without it, the game still plays offline.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:8080. `npm run dev` turns on a no-password **dev sign-in** so you can try the online features with made-up players, and stores data in an embedded Postgres in `.data/`. You don't need any accounts or keys for this.

## Layout

- `src/index.html`, `src/style.css`: page shell and styles
- `src/js/`: game code (world generator, art, simulation, business, life, renderer, UI, online client)
- `build.mjs`: bundles everything into one HTML file in `dist/`
- `server/`: Node server: static game, Google/Apple sign-in, JSON API, share pages

## How online money works

Each player's city runs in their own browser on its own clock. Money that moves between players goes through a server ledger. The sender's game takes the money out and reports it, and the receiver's game picks it up on its next sync, about every 20 seconds. Co-op deal payouts, loan repayments and refunds all work this way, and every payment carries an id, so a retry never pays twice.

- **Co-op deals:** open a property and tap *Go In With Friends* to set a raise target and a minimum stake. Friends chip in, you close funding (their money lands in your cash), then you buy. Each friend owns the share of the equity that their money paid for, gets that share of the monthly profit and of the sale, and can be bought out.
- **Lending:** offer a loan or ask for one, with an amount, APY (0–25%), term (6 months to 5 years), monthly or interest-only-plus-balloon repayment, and friends-only or public visibility. Borrowers build a repayment record that lenders can see.
- **Shared cities:** when you start a new game while signed in, you can choose a friend's city. You then share streets, can see what each other is watching on the map, and can run co-op deals there.

## Deploy on Railway with Neon

Railway runs `npm run build`, then `npm start`. The health check is at `/healthz`.

### 1. Database (Neon)

Create a project at [neon.tech](https://neon.tech) and copy its connection string (`postgresql://…?sslmode=require`). The server creates its tables the first time it starts.

### 2. Google sign-in

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type *Web application*.

- Authorised JavaScript origin: `https://<your domain>`
- Authorised redirect URI: `https://<your domain>/auth/google/callback`

### 3. Sign in with Apple

This needs an Apple Developer account. In *Certificates, Identifiers & Profiles*:

1. Create an **App ID** with *Sign in with Apple* enabled.
2. Create a **Services ID** (for example `xyz.valyd.mogul`) and enable *Sign in with Apple* on it.
3. In that Services ID's configuration, add your domain, and set the return URL to `https://<your domain>/auth/apple/callback`.

The Services ID is your `APPLE_CLIENT_ID`. No private key is needed, because the server verifies Apple's signed id token directly.

### 4. Environment variables

| Variable | Value |
| --- | --- |
| `PUBLIC_URL` | `https://<your domain>` (exactly as registered with Google and Apple) |
| `DATABASE_URL` | Neon connection string |
| `SESSION_SECRET` | a long random string, e.g. from `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 2 |
| `APPLE_CLIENT_ID` | Services ID from step 3 |

Each sign-in button only appears once its keys are set. Dev sign-in is always off in production.

## Privacy

The server stores the provider's opaque account id, a display name, and game data. It does not store emails or provider tokens. Players can delete their online account from *Online › My Profile*.
