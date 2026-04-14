# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Russian-language single-page landing for an SMS-рассылка (SMS-broadcast) service. A customer submits an order form; the Node backend emails both the operator (new lead notification) and the customer (confirmation) via SMTP.

## Commands

- `npm start` — run the production server (`node server.js`)
- `npm run dev` — run with nodemon for auto-reload
- No test suite, no linter, no build step. The frontend files (`index.html`, `style.css`, `script.js`) are served as static assets directly — edits take effect on page reload.

Before first run, copy `.env.example` → `.env` and fill in SMTP credentials (Yandex/Mail.ru/Gmail app password) plus `OPERATOR_EMAIL`. On startup the server calls `transporter.verify()` and logs SMTP connection status — watch the console for `[SMTP] Подключение успешно` vs. errors.

## Architecture

Monolithic Express app (~370 lines) in [server.js](server.js) with three concerns tangled together:

1. **Static serving** — `express.static(__dirname)` serves the repo root, and a `GET *` catch-all falls back to `index.html`. Do not place secrets or non-public files next to `server.js`; they would be publicly readable.
2. **Two API routes** — `POST /api/send-order` (order form) and `POST /api/subscribe` (footer newsletter). Both validate on the server, then call `transporter.sendMail` one or more times. `/api/send-order` sends *two* emails sequentially — if the first succeeds and the second throws, the operator has a lead but the client gets no confirmation and the route returns 500. There is no queue, retry, or persistence.
3. **HTML email templates** — `buildOperatorEmail` / `buildClientEmail` are inline template literals with table-based layouts (required for email-client compatibility). All user-supplied values MUST go through `escapeHtml()` — it is the only XSS defense in the email pipeline.

Frontend ([script.js](script.js)) is a single IIFE with no framework. It handles: mobile burger menu, smooth anchor scroll, real-time blur validation on the order form, AJAX submit to `/api/send-order`, tariff-card "Заказать" buttons that pre-fill the `#tariff` `<select>` via `data-tariff` attributes, subscribe form, and an info modal. DOM IDs in [index.html](index.html) (`orderForm`, `name`, `email`, `tariff`, `agree`, `formSuccess`, `formFailure`, `subscribeForm`, `subEmail`, `infoModal`, etc.) are the contract between HTML and JS — renaming one requires updating both.

[copy_landing.html](copy_landing.html) is a sibling copy of the landing (appears to be a snapshot/backup). It is *also* served as static content at `/copy_landing.html`. Treat `index.html` as the source of truth unless told otherwise.

## Conventions to preserve

- Russian in user-facing strings, comments, and log tags (`[SMTP]`, `[ORDER]`, `[SUBSCRIBE]`). Keep new log lines in the same bracket-prefix style.
- Brand color `#FF4F12` (orange) is used throughout CSS and email templates — change in all three places together.
- Email HTML must stay table-based with inline styles (no external CSS, no flex/grid) for Outlook/Gmail rendering.
