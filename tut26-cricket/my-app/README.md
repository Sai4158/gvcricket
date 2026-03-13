# GV Cricket 2.0

GV Cricket 2.0 is a modern cricket scoring app built for fast live match control, simple umpire scoring, spectator live updates, and polished result pages.

## Highlights

- live umpire scoring with fast ball-by-ball controls
- spectator live score view with score announcer
- walkie-talkie and speaker mic tools
- director console for match audio control
- optional match images and shareable match pages
- result insights, scorecards, and saved sessions
- MongoDB + Mongoose persistence with live SSE updates

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required environment variables

Use `.env`.

Required:

- `MONGODB_URI`
- `MATCH_ACCESS_SECRET`
- `UMPIRE_ADMIN_PIN`
- `MATCH_MEDIA_PIN`
- `IMGBB_API_KEY`

Optional director-specific secrets:

- `DIRECTOR_ACCESS_SECRET`
- `DIRECTOR_CONSOLE_PIN`
- `DIRECTOR_CONSOLE_PIN_HASH`

## Vercel deployment

GV Cricket 2.0 is configured for Vercel deployment.

### Recommended project settings

- Framework preset: `Next.js`
- Node.js version: `20.x`
- Region: `iad1`

### Required Vercel environment variables

Add these in the Vercel dashboard:

- `MONGODB_URI`
- `MATCH_ACCESS_SECRET`
- `UMPIRE_ADMIN_PIN`
- `MATCH_MEDIA_PIN`
- `IMGBB_API_KEY`

### Important live runtime requirements

- MongoDB must support change streams
- Use MongoDB Atlas or another replica set deployment
- Live SSE routes run on the Node runtime with longer execution windows

## Production notes

- `gvLogo.png` is used for app branding and icons
- security headers are applied through middleware
- MongoDB connections are reused server-side
- walkie-talkie state is live-only and not persisted to MongoDB
- spectator, umpire, and director flows are protected with server-side checks

## Build and test

```bash
npm run lint
npm run test
npm run build
npm run typecheck
```

## Deploy checklist

- set all required Vercel env vars
- verify MongoDB replica set / Atlas change streams
- verify live routes connect in production
- verify `gvLogo.png` is used for favicon/app branding
- verify umpire, media, and director PIN settings
