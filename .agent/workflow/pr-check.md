---
description: Pre-PR checklist for CampusHustle — lint, secrets check, contract alignment, and scope check before opening a pull request
---

1. Run the linter/formatter and report any issues.
// turbo
2. Run `git status` and `git diff --staged` to see what's actually changed.

3. Check for accidentally staged secrets or env files:
// turbo
4. Run `git diff --staged --name-only` and flag if `.env`, any `*.pem`, `*.key`, or credential-looking file is present.

5. Check the change against campushustle_spec.md:
   - If new/changed API routes exist, do they match the paths, methods, and shapes documented in Section 8? If not, flag the mismatch — either the code or the spec needs updating, not silently diverging.
   - If new/changed schema fields exist, do they match Section 7? Same rule.
   - Does this change touch anything listed as out-of-scope in Section 2.2 (Chapa live payments, subscriptions, group sessions, etc.)? If so, flag it before proceeding.

6. Check against coding_style.md:
   - Correct naming conventions (camelCase/PascalCase/UPPER_SNAKE_CASE) used consistently?
   - Backend: routes thin, logic in controllers/services, centralized error handling used?
   - Frontend: functional components only, data fetching through the api/ module not raw fetch() in components?

7. If this PR touches authentication, payments, or file upload code, explicitly state that in the summary and flag it for mandatory human review per system_prompt.md — do not let it merge on automated checks alone.

8. Summarize: what changed, which module/owner area it falls under (per Team Structure in Section 12.1), any flags raised above, and a suggested PR title following the `feature/<area>-<desc>` or `fix/<area>-<desc>` convention.
