# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A portfolio and learning project. There is no outside audience to win over yet, so the people using it are the developer and anyone they show it to: reviewers who want to see the stack running from start to finish. Any persona beyond that is hypothetical and must not be presented as a real customer base.

## Product Purpose

A todo app: sign up, make lists, add tasks, tick them off. It exists to show a complete production stack (a NestJS API with Postgres, a Next.js frontend, k3s, and Argo CD with GitOps deploys) behind a product that works properly instead of a toy demo. It succeeds when the app feels finished and the live, multi-client behaviour is obvious within seconds of using it.

## Positioning

Live collaboration. Changes reach every open client right away over socket.io, fanned out through Redis across API pods. Shared lists with several users are planned and are the reason accounts exist. For now each list has a single owner, which is temporary.

## Operating Context

- Used in a browser, often on a phone.
- Demoed by opening the same list in two windows and watching edits appear in the other one.
- Self-hosted on a single-node k3s cluster behind Caddy.

## Capabilities and Constraints

- Accounts: signup and login with JWT access and refresh tokens. The short-lived access token may be exposed to browser JS.
- Lists (tasklists) hold at most 50 tasks each (`MAX_TASKS_PER_LIST`).
- Tasks can be created, edited inline, completed and deleted (with a delete confirmation). They have optional due dates, entered in local time and stored as UTC. Each list has a "Show completed" toggle.
- Tasks move between lists by dragging only. Never add a per-row "move to" select.
- Undecided: the sharing and permission model for multi-user lists.

## Brand Commitments

The name is "Todo". The current tagline is "Get things done." and the description is "make lists, add tasks, tick them off." The voice is plain, short and direct. Live collaboration is not a selling point on the login/home page: it shows a plain list being ticked off, not the sync between tabs (user decision, 2026-11-23).

## Evidence on Hand

There are no users, testimonials, metrics or press. Do not invent any. The real proof is the running app and its live sync between clients.

## Product Principles

1. Show live sync, don't describe it: other people's changes should be visible as they happen.
2. Finish the job: every state (empty, error, limit reached, offline) is handled, because the app is a showcase of craft.
3. Low friction: fast capture, inline editing, no settings sprawl.
4. Phone-first ergonomics: every core flow must work comfortably on a narrow touch screen.

## Accessibility & Inclusion

Mobile phone use is a hard requirement: touch-sized targets and narrow layouts. Beyond that, follow general good practice. No formal standard has been committed to.
