# Backend

## Tenant Isolation
- Users and notes are scoped by tenantId.
- JWT contains tenantId and role; middleware enforces access per tenant and role.

## Auth & Roles
- POST /signup creates a FREE tenant and an ADMIN user.
- POST /login returns { token } with userId, tenantId, role.
- ADMIN only: update and delete notes; upgrade tenant.

## Notes API
- GET /notes – list current tenant notes
- POST /notes – create note (FREE limited to 3)
- GET /notes/:id – fetch one (tenant-guarded)
- PUT /notes/:id – update (ADMIN)
- DELETE /notes/:id – delete (ADMIN)

## Subscription
- Plans: FREE vs PRO.
- FREE limit: 3 notes per tenant.
- POST /tenants/upgrade (ADMIN) → upgrades current tenant to PRO.

## Health
- GET /health → { status: 'ok' }

## Environment
- DATABASE_URL – Prisma MongoDB connection string
- JWT_SECRET – token signing secret
- PORT – default 5000

## Local Run
```
npm install
npm run start
```

## Deploy (Vercel)
- Deploy on a Node runtime host (Vercel Node, Render, Railway, etc.).
- Set env vars: DATABASE_URL, JWT_SECRET, PORT (optional).
