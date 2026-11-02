import { defineConfig } from '@playwright/test'

import { ADMIN_EMAIL, PASSWORD } from './e2e/constants.js'

const API_PORT = 8100
const WEB_PORT = 5174
const FAKE_ANTHROPIC_PORT = 8101
const DB_URL = 'postgresql+psycopg://minervus:minervus@localhost:5433/minervus_e2e'

// Runs the real app against its own database, on ports that don't clash with `npm run dev`.
export default defineConfig({
  testDir: 'e2e',
  // The tests share one database and one backend.
  workers: 1,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      name: 'fake-anthropic',
      command: `node e2e/fake-anthropic.mjs ${FAKE_ANTHROPIC_PORT}`,
      url: `http://127.0.0.1:${FAKE_ANTHROPIC_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      name: 'backend',
      cwd: '../backend',
      command: [
        '.venv/bin/python -m scripts.prepare_e2e_db',
        `printf '%s\\n' '${PASSWORD}' | .venv/bin/python -m app.cli create-admin --email ${ADMIN_EMAIL} --password-stdin`,
        `exec .venv/bin/uvicorn app.main:app --port ${API_PORT} --log-level warning`,
      ].join(' && '),
      env: {
        DATABASE_URL: DB_URL,
        JWT_SECRET: 'e2e-secret-that-is-only-used-by-the-browser-tests',
        ANTHROPIC_API_KEY: 'e2e-key',
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${FAKE_ANTHROPIC_PORT}`,
      },
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      stdout: 'pipe',
      reuseExistingServer: false,
    },
    {
      name: 'frontend',
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
    },
  ],
})
