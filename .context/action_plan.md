# CampusHustle — Execution Action Plan

*Days 3–15 · Task Assignment & Timeline for a 6-Person Team (3 Backend, 3 Frontend)*

This document operationalizes the CampusHustle Project Documentation (v1.0) into daily, individually-assigned tasks. It reflects the team's actual composition — three backend and three frontend developers — rather than the five-person split used for the original module-ownership table. Each task references the Functional Requirement (FR) or Non-Functional Requirement (NFR) it satisfies for direct traceability back to the spec.

---

## Table of Contents

- [1. Team & Module Assignment](#1-team--module-assignment)
- [2. Day-by-Day Action Plan](#2-day-by-day-action-plan)
- [3. Definition of Done (per feature)](#3-definition-of-done-per-feature)
- [4. Git & Collaboration Conventions](#4-git--collaboration-conventions)
- [5. Milestone Checkpoints](#5-milestone-checkpoints)

---

## 1. Team & Module Assignment

Modules are paired so each backend developer works in lockstep with one frontend developer, minimizing contract drift (see NFR-8).

| Pair | Backend Dev | Frontend Dev | Module / FRs |
|---|---|---|---|
| A | Daniel (Team Lead) | Chara | Auth, Profile, Discovery, Admin — FR-1–4, FR-13 |
| B | Efrata | Bemnet | Booking, Chat, Notifications — FR-5–8, FR-14 |
| C | Dani | Dlayehu | Notes Marketplace, OCR, Payments, AI/RAG — FR-9–12 |

> Daniel additionally owns Architecture setup, DevOps/deployment pipeline, and cross-team RBAC middleware — carried over from the original Team Lead scope since these are cross-cutting rather than module-specific.

---

## 2. Day-by-Day Action Plan

### Days 1–2 — Architecture & Contracts (Complete)

Output: the Project Documentation itself (schema, API contract, threat model). No further action needed unless a contract changes during build — any change must be re-announced to both devs on the affected pair same-day.

### Days 3–8 — Parallel Core Build

#### Day 3

| Pair | Tasks |
|---|---|
| A | **Daniel:** Express project scaffold, MongoDB Atlas connection, register/login endpoints with bcrypt hashing (FR-1). **Chara:** signup/login form UI, static validation states, wired to a mock API response. |
| B | **Efrata:** Availability + Booking schemas (Mongoose), CRUD skeleton for availability slots (FR-5). **Bemnet:** tutor availability grid UI (static data). |
| C | **Dani:** Cloudinary account/config, Note schema, upload endpoint skeleton. **Dlayehu:** static notes marketplace grid layout. |

#### Day 4

| Pair | Tasks |
|---|---|
| A | **Daniel:** university-email verification flow, JWT refresh-token rotation (NFR-1). **Chara:** wire signup/login to real endpoints; error and loading states. |
| B | **Efrata:** booking request/accept/decline logic and status transitions (FR-6). **Bemnet:** booking status view (pending/confirmed/completed/cancelled). |
| C | **Dani:** file-type/size validation on upload (NFR compliance), Cloudinary storage wired end-to-end. **Dlayehu:** upload flow UI — PDF picker + camera capture entry point (FR-9). |

#### Day 5

| Pair | Tasks |
|---|---|
| A | **Daniel:** RBAC middleware (student/tutor/admin) and rate-limiting scaffolding (NFR-2). **Chara:** profile create/edit UI with structured skill tags (FR-2, FR-3). |
| B | **Efrata:** Socket.io server setup, Message schema, connection auth. **Bemnet:** chat UI shell + socket client connection (no live messages yet). |
| C | **Dani:** Tesseract.js OCR pipeline — photo → text → PDF (FR-9). **Dlayehu:** note detail/preview page (preview pages, description, price). |

#### Day 6

| Pair | Tasks |
|---|---|
| A | **Daniel:** tutor discovery/search endpoint — subject, price, rating, department filters (FR-4). **Chara:** search bar + filter controls + tutor cards. |
| B | **Efrata:** real-time `message:send` / `message:receive` events; contact-info share with consent logging (FR-7, FR-8). **Bemnet:** live chat thread + "share contact info" action. |
| C | **Dani:** note pricing + purchase endpoint stub (Chapa integration deferred to Day 9, per Section 2.2 — payments are the one MVP item pulled forward from Out-of-Scope). **Dlayehu:** purchase button + price display. |

#### Day 7

| Pair | Tasks |
|---|---|
| A | Joint: end-to-end test of signup → login → profile → discovery flow. Fix integration bugs. |
| B | Joint: end-to-end test of booking → accept → chat → contact-share flow. Fix integration bugs. |
| C | **Dani:** prep NoteChunk schema + chunking logic ahead of Day 9 RAG work (early start, since Notes+AI is flagged High risk in Section 13). **Dlayehu:** responsive/mobile pass on notes UI (NFR-6). |

#### Day 8 — Milestone: Core Build Complete

| | Tasks |
|---|---|
| All pairs | Unit + integration tests for own module (Section 11.1). Merge feature branches to main via PR review. Team Lead runs first full cross-module smoke test covering UC-1 through UC-9. |
| **Exit criteria** | Auth, Profile, Discovery, Booking, and Chat are demoable end-to-end without Notes or AI Assistant. |

### Days 9–11 — Notes Marketplace + AI Assistant

This phase carries the project's highest risk (Section 13: "Security gaps introduced by AI-generated code," "OCR accuracy issues"). All six devs contribute here, not just Pair C, since it's the largest remaining surface with the least buffer.

#### Day 9

| Dev | Task |
|---|---|
| Dani | Note chunking + embedding generation via Gemini API (FR-11). |
| Daniel | Assist Dani on Gemini integration and graceful degradation under free-tier rate limits (NFR-10); build FR-14 notification backend (booking/message/purchase events). |
| Efrata | Chapa payment integration for note purchases (FR-10), moved up while Dani is on RAG. |
| Dlayehu | Upload → processing-status UI (queued/embedding/ready states). |
| Chara | AI Study Assistant chat interface shell, scoped-to-tutor selector. |
| Bemnet | Notification bell/toast UI wired to FR-14 events. |

#### Day 10

| Dev | Task |
|---|---|
| Dani | Cosine similarity search over NoteChunk embeddings + grounded answer generation via Gemini (FR-11); explicit "cannot answer from available material" fallback (TC-4). |
| Efrata | Finish Chapa purchase flow, increment `purchaseCount`, unlock note access on success. |
| Chara | Wire AI Assistant UI to `POST /api/ai/ask`; render grounded answers and the fallback state. |
| Dlayehu | Purchase flow UI end-to-end with Chapa redirect/callback handling. |

#### Day 11 — Milestone: Notes + AI Complete

| | Task |
|---|---|
| All | Full walkthrough: upload note → OCR → chunk/embed → ask AI Assistant → get grounded answer (TC-4); full walkthrough: browse → preview → purchase → access note. Bug fixes only, no new features after this point. |

### Days 12–13 — Integration

| Day | Tasks |
|---|---|
| 12 | Merge all remaining branches into main; resolve conflicts. Each dev walks through 2 of the 6 representative user stories from Section 3.3 end-to-end and logs bugs directly against FR/UC IDs. |
| 13 | Bug triage and fixes by original module owner. Cross-browser and mobile-responsive check (NFR-6). Performance spot-check against NFR-4 (search < ~2s) and NFR-5 (chat delivery < ~1s). |

### Day 14 — Security Pass

Directly exercises the STRIDE table in Section 10.2. Daniel coordinates; this day doubles as prep for the INSA peer security review.

| Dev(s) | Task |
|---|---|
| Daniel | Coordinates review; verifies rate limiting is live on every write-heavy endpoint (TC-3); JWT expiry/refresh edge cases. |
| Efrata / Dani | Audit own module against the STRIDE table — Tampering (ownership checks on every mutation) and Elevation of Privilege (RBAC on every route, TC-2) are the two highest-value checks per module. |
| Chara / Bemnet / Dlayehu | Input validation / XSS checks on every form in their module; confirm no sensitive data (passwords, raw contact info) is logged to the browser console or exposed in API responses. |
| **Exit criteria** | All Section 10.2 threats have a verified mitigation in place, not just a documented one. |

### Day 15 — Deploy & Rehearse

| | Task |
|---|---|
| Daniel | Deploy backend to Render; deploy frontend to Vercel; wake/warm the Render free-tier instance well ahead of the demo (Section 13 risk: free-tier cold start). |
| All | Timed run-through of the demo script covering every UC. Finalize README and any last documentation edits. |

---

## 3. Definition of Done (per feature)

- Matches its FR/NFR in Section 4/5 of the spec — no scope drift without a same-day contract update to the paired dev.
- Has at least one unit or integration test per Section 11.1.
- Handles the corresponding failure case (e.g., invalid input, unauthorized role, rate-limit exceeded) — not just the happy path.
- Reviewed via PR by at least one other dev before merging to main.
- If it touches auth, payments, or file upload: manually reviewed regardless of whether it was AI-assisted (per Section 12.4).

---

## 4. Git & Collaboration Conventions

- Branch naming: `feature/<module>-<short-description>`, e.g. `feature/booking-status-transitions`.
- One feature branch per FR/task where practical; merge to main via PR, not direct push.
- Kanban columns: Backlog → In Progress → Testing → Done, seeded from the FR table (Section 4).
- Daily async standup: what shipped yesterday, what's today, any blocker — posted before Core Build work starts.

---

## 5. Milestone Checkpoints

| Day | Milestone | Exit Criteria |
|---|---|---|
| 8 | Core Build Complete | Auth, Profile, Discovery, Booking, Chat demoable end-to-end. |
| 11 | Notes + AI Complete | Upload → OCR → RAG → AI-answer and browse → purchase flows both work end-to-end. |
| 13 | Integration Complete | All 6 representative user stories (Section 3.3) pass manually on merged main. |
| 14 | Security Sign-off | Every STRIDE threat in Section 10.2 has a verified, not just documented, mitigation. |
| 15 | Deployed & Demo-ready | Live on Render/Vercel, warmed, and rehearsed against a timed demo script. |