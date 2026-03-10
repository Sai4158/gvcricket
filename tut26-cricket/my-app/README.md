# GV Cricket

GV Cricket is a Next.js live cricket scoring app with:

- live umpire scoring
- live spectator updates over SSE
- walkie-talkie and speaker mic tools
- optional match images
- MongoDB + Mongoose persistence

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

## Vercel deployment

This app is configured for Vercel production deployment.

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
- The live SSE routes are configured for Node runtime and longer execution windows

## Production notes

- Match images use `gvLogo.png` for app branding and icons
- SSE live routes are pinned to Node runtime
- Security headers are applied through middleware
- MongoDB connections are cached server-side
- Walkie-talkie state is live-only and not persisted to MongoDB

## Build and test

```bash
npm run lint
npm run test
npm run build
```

## Deploy checklist

- set all required Vercel env vars
- verify MongoDB replica set / Atlas change streams
- verify live routes connect in production
- verify `gvLogo.png` is used for favicon/app branding
- verify umpire PIN and image PIN are set correctly
