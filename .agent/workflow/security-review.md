---
description: Run the CampusHustle security checklist against a module before merge, based on the STRIDE threat model and security principles in campushustle_spec.md
---

1. Ask which file(s) or module to review if not already specified in the request (e.g. "review the booking controller").

2. Read the target file(s) in full before commenting on anything.

3. Check authentication & authorization:
   - Does every route in this module require auth where it should?
   - Are role checks (student/tutor/admin) enforced server-side via middleware, not just assumed from the frontend?
   - For any mutation, is there an explicit ownership check (e.g. does this booking actually belong to this user) before the write happens?

4. Check input handling:
   - Is all user-submitted input validated before use?
   - Is anything passed into a DB query, file path, or template without sanitization?
   - Are uploaded files checked for type and size before processing?

5. Check secrets & sensitive data:
   - Any hardcoded API keys, tokens, or credentials?
   - Any passwords, tokens, or contact info written to logs or returned in API responses that shouldn't be?
   - Is contact-info sharing in chat still opt-in and logged, if this module touches chat?

6. Check rate limiting & abuse surface:
   - Does this module include a write-heavy endpoint (booking creation, message sending, note upload) that needs rate limiting?
   - Is it actually rate-limited, or just assumed to be?

7. Map findings to STRIDE categories (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) from campushustle_spec.md Section 10.2 — note which category each finding falls under.

8. Produce a short report:
   - Pass/fail per category above
   - Specific line references for any issue found
   - Severity (blocker vs. nice-to-fix)
   - Whether this code touches auth/payment/upload — if so, flag explicitly that human review is mandatory regardless of this automated pass, per system_prompt.md

9. Do not auto-fix anything found — report only. Ask before making changes, since security fixes need explicit review here.
