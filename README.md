# Minervus

Flashcards with active recall and spaced repetition, like Anki, plus AI that drafts cards from your notes.

- Organize cards into decks, then study whichever cards are due.
- Rate each answer Again, Hard, Good or Easy, and the SM-2 algorithm schedules the next review.
- Paste text or upload a PDF, and Claude Haiku writes draft cards that you edit and approve before saving.
- User and admin accounts, where admins can deactivate users.

**Stack:** React, Vite and Tailwind CSS; FastAPI and PostgreSQL; the Anthropic API.

## Setup

You need Python 3.12, Node 22 and Docker.

1. Start Postgres on port 5433, so that it doesn't clash with a local install. This also creates the `minervus_test` database that the backend tests use.

   ```sh
   docker compose up -d
   ```

2. Set up the backend:

   ```sh
   cd backend
   python3 -m venv .venv
   .venv/bin/pip install -r requirements-dev.txt
   cp .env.example .env
   ```

   In `.env`, set `JWT_SECRET` to the output of `openssl rand -hex 32`. To use AI generation, also set `ANTHROPIC_API_KEY`. Everything else works without it.

3. Create the database tables:

   ```sh
   .venv/bin/alembic upgrade head
   ```

4. Set up the frontend:

   ```sh
   cd ../frontend
   npm ci
   ```

## Running the app

Run each of these in its own terminal, then open http://localhost:5173.

```sh
cd backend && .venv/bin/uvicorn app.main:app --reload
```

```sh
cd frontend && npm run dev
```

The frontend forwards every request under `/api` to the backend on port 8000. If that port is taken, run the backend on another one and point the frontend at it:

```sh
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8001
```

```sh
cd frontend && API_PROXY_TARGET=http://127.0.0.1:8001 npm run dev
```

To try the production build, run `npm run build` and then `npm run preview`, which serves it on port 4173 with the same API proxy.

### Admins

Anyone can register as a regular user. Admins can only be created from the command line, from `backend/`:

```sh
.venv/bin/python -m app.cli create-admin --email you@example.com
```

It asks for the password twice without showing it. To give the password from a script instead, pipe it in with `--password-stdin`, which keeps it out of your shell history.

`create-admin` refuses an email that already has an account. Registration is open and emails aren't verified, so someone could register the address you plan to use and wait for you to promote it. To make an existing account an admin, use `promote-admin`, which also reactivates it and leaves its password alone. That's the way back in if every admin has been deactivated:

```sh
.venv/bin/python -m app.cli promote-admin --email you@example.com
```

## Testing

| Command | Run from | What it checks |
| --- | --- | --- |
| `.venv/bin/pytest` | `backend/` | The API, against the `minervus_test` database |
| `.venv/bin/ruff check . && .venv/bin/ruff format --check .` | `backend/` | Python lint and formatting |
| `npm test` | `frontend/` | Components, with the API mocked |
| `npm run lint` | `frontend/` | JavaScript lint |
| `npm run build` | `frontend/` | The production build |
| `npm run test:e2e` | `frontend/` | The whole app in Chrome |

Backend and browser tests need Postgres running. Browser tests also need Google Chrome installed, and they start their own servers on ports 8100, 8101 and 5174. On each run they delete and recreate a separate `minervus_e2e` database, so your development data is safe. Creating it needs a Postgres user that's allowed to create databases, which the Docker one is.

No test calls the real Anthropic API, so none of them need a key or cost anything. Backend tests run the real SDK against a mocked transport, and browser tests run it against `frontend/e2e/fake-anthropic.mjs`.

## Configuration

These are set in `backend/.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | None, required | Signs session cookies. Must be at least 32 characters. |
| `DATABASE_URL` | Local Docker database | The app's database. |
| `TEST_DATABASE_URL` | Local Docker test database | The database for `pytest`. |
| `COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS. |
| `ANTHROPIC_API_KEY` | Empty | Enables AI generation. Without it, generation returns a clear error. |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` | The model that writes cards. |

The frontend reads one setting from the environment: `API_PROXY_TARGET`, the backend address for `/api`, which defaults to `http://127.0.0.1:8000`.

## Limits

This is an MVP that's meant to run locally. Before putting it on the internet, it would need at least:

- Rate limiting on login and registration, since neither has any.
- Per-user AI quotas. Registration is open, and each request is only limited to 50,000 characters and 30 cards, so anyone with an account could run up your API bill.
- A way to serve the built frontend and the API from one origin over HTTPS, with `COOKIE_SECURE=true`.
- Revocable sessions. Sessions are signed tokens that last 7 days, so logging out only removes the cookie from that browser, and reactivating a user makes their old tokens valid again.
- Pagination. Deck, card and user lists return every row.

Also not built yet: email verification, password reset, Anki import and export, and OCR for scanned PDFs.
