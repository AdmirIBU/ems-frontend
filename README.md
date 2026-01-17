# React + TypeScript + Vite

## Docker (production)

1. Create `.env.production` based on `.env.production.example` and set `VITE_API_URL` to your backend URL.
2. Build and run (from project root):

   ```bash
   docker-compose up --build -d
   ```

   - Frontend will be available at `http://localhost:3000`
   - Backend at `http://localhost:5000`

## Notes
- The frontend reads `VITE_API_URL` at build time (use `VITE_` prefix for Vite env variables).
- For local dev, continue using `npm run dev` (Vite dev server).

## Development environment (.env)

- Copy `.env.example` to `.env` and update the values as needed.

  ```bash
  cp .env.example .env
  ```

- Example values:
  - `VITE_API_URL=http://localhost:5000`

- When running the Vite dev server (`npm run dev`) the `server.proxy` in `vite.config.ts` forwards `/api` calls to the backend automatically.

### Courses
- The frontend exposes a **All Courses** page (`/courses`) where logged-in users can create a course and enroll.
- API calls used:
  - `GET /api/courses` — list courses
  - `POST /api/courses` — create (requires `Authorization: Bearer <token>`)
  - `POST /api/courses/:id/enroll` — enroll (requires `Authorization`)

- When running in Docker the frontend is served behind Nginx which proxies `/api` to the backend, so `VITE_API_URL` can point to `http://backend:5000` in `docker-compose.yml`.
