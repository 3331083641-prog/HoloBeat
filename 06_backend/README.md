# HoloBeat Optional Local Archive Backend (`06_backend`)

HoloBeat Web App (`05_web_app`) runs **100% offline** by default using local Web Audio synthesis + IndexedDB + localStorage persistence.

This optional lightweight backend provides local SQLite archiving, idempotent work storage, remix lineage queries, and revocable read-only share links for exhibition demos or multi-device LAN showcases.

## Tech Stack
- **Runtime**: Node.js 24+ (using built-in `node:sqlite` — zero native C++ compilation required)
- **Framework**: Fastify 5 + `@fastify/cors`
- **Validation**: Zod

## Endpoints
- `GET /api/health` — Service status & archived card count
- `GET /api/cards` — List archived minted cards
- `POST /api/cards` — Idempotent upsert by `idempotencyKey`
- `DELETE /api/cards/:id` — Delete an archived card
- `GET /api/lineage/:id` — Retrieve parent ancestors & derivative remix children
- `POST /api/shares` — Mint a random read-only share token (`base64url`)
- `GET /api/shares/:token` — Fetch a shared card (read-only)
- `DELETE /api/shares/:token` — Revoke an existing share link

## Quick Start
```bash
cd 06_backend
npm install
npm start
```

## Automated API Tests
```bash
cd 06_backend
npm test
```
