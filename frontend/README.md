Deployment (Vercel)

1) Set env var VITE_API_BASE_URL to your backend URL
   Example: https://saas-notes-3xdwek06h-jayeshs-projects-0a118279.vercel.app

2) Install Vercel CLI (once):
   npm i -g vercel

3) Deploy
   vercel --prod

Vite will build to dist/ and Vercel will serve it as a SPA. Make sure SPA fallback is enabled (see vercel.json below if needed).
# SaaS Notes – Frontend

## Overview
Minimal React app (Vite) with routes for Login, Signup, Dashboard, and Notes.

## Routes
- `/login` – authenticate and store JWT in `localStorage`
- `/signup` – create a tenant and admin user
- `/dashboard` – landing after login
- `/notes` – list/create/update/delete notes

## API Client
`src/api/api.js` uses Axios with bearer token from `localStorage` and base URL `http://localhost:5000`. To change:
```js
// src/api/api.js
// set your deployed backend URL here if needed
// baseURL: 'https://your-backend.example.com'
```

## Local Development
```bash
cd frontend
npm install
npm run dev
```

## Deploy (Vercel)
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: set the backend URL inside `src/api/api.js` or via `VITE_API_URL` pattern if you prefer.

## Tenant & Plans (UI behavior)
- Shows upgrade call-to-action when FREE limit reached.
- Calls `POST /tenants/upgrade` and retries note creation afterwards.
