# CampusHustle — Coding Style & Conventions

Shared conventions so code from six different people (and AI-assisted boilerplate) reads as one codebase. Follow these unless a specific case has a good reason not to — flag the exception in the PR if so.

## General

- Language: JavaScript (ES modules, `import`/`export`) across both `client/` and `server/`. No CommonJS `require` in new files.
- Async code uses `async`/`await`, not raw `.then()` chains.
- No unused variables, no commented-out dead code left in commits.
- Prettier defaults (2-space indent, semicolons, single quotes) — run before committing. Don't hand-format against it.

## Naming

- Variables/functions: `camelCase`
- React components, classes: `PascalCase`
- Files: `camelCase.js` for utilities/hooks, `PascalCase.jsx` for React components
- Mongoose model files: singular `PascalCase` (`User.js`, `Booking.js`), matching the collection's logical entity
- Constants (config, enums): `UPPER_SNAKE_CASE`
- Booleans read as predicates: `isBlocked`, `hasVerifiedEmail`, not `blocked`/`verified` alone where ambiguous

## Backend (Express + Mongoose)

- Route → controller → service/model layering: routes stay thin (just wiring), business logic lives in controllers or a service layer, not inline in route handlers.
- One router file per resource (`routes/bookings.js`, `routes/notes.js`), matching the API Contract sections in the spec.
- Every mutating route: validate input first (fail fast), then check ownership/role, then perform the mutation. Don't reorder this.
- Use middleware for auth (`requireAuth`) and role checks (`requireRole('admin')`) — don't duplicate access-control logic inline in handlers.
- Errors: throw/pass to a centralized error-handling middleware; don't scatter ad hoc `res.status(500).json(...)` in every catch block. Standard error shape:
  ```js
  { error: { message: string, code?: string } }
  ```
- Never `console.log` sensitive fields (passwords, tokens, raw contact info). Use a logger with levels if you need debug output.
- Environment variables accessed only through a single `config.js`/`env.js`, never `process.env.X` scattered through the codebase.

## Frontend (React + Vite + Tailwind)

- Functional components with hooks only — no class components.
- One component per file; co-locate small subcomponents only if they're not reused elsewhere.
- Prefer composition over prop-drilling more than 2 levels — lift to context if a value is needed deep in the tree (e.g. current user, socket connection).
- Tailwind utility classes directly in JSX; avoid ad hoc inline `style={}` unless the value is truly dynamic (e.g. computed positions).
- Data fetching goes through a small `api/` module wrapping `fetch`, not scattered raw `fetch()` calls in components — keeps auth headers and error handling consistent.
- Loading/error/empty states are handled explicitly in every data-driven view, not just the happy path.

## Git & Commits

- Branch naming: `feature/<area>-<short-desc>` or `fix/<area>-<short-desc>` (e.g. `feature/booking-cancellation`, `fix/auth-refresh-token`)
- Commit messages: imperative mood, short summary line (`Add booking cancellation endpoint`, not `Added` or `Adding`)
- One logical change per PR where possible — easier for the security-sensitive review pass to reason about.
- No secrets, API keys, or `.env` files committed, ever — double-check before pushing.

## Comments & Documentation

- Comment *why*, not *what* — the code should already say what it does.
- Every exported function that isn't self-explanatory from its name gets a one-line JSDoc-style comment above it.
- Non-obvious security logic (rate limiting, ownership checks, contact-info consent flow) gets a comment explaining the threat it mitigates, referencing the relevant STRIDE category from the spec if applicable.

## AI-Assisted Code

- AI-generated boilerplate must still follow every convention above — don't let generated code introduce a second style in the codebase.
- Regenerate rather than hand-patch AI output that doesn't match these conventions; a second inconsistent pass is worse than a clean retry.
- Auth, payment, and upload code always gets human review before merge regardless of how it was drafted — see `system_prompt.md`.
