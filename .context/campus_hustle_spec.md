# CampusHustle

**Learn. Teach. Earn.**
*A Peer-to-Peer Academic Marketplace for University Students*

Project Documentation — Software Requirements, Architecture, Security & Design Specification
INSA CTC Summer Camp — Pre-Graduation Project | Development Department
Prepared by: Daniel Gidey (Team Lead), Efrata Endalkachew, and Team
Version 1.0

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [1. Introduction](#1-introduction)
- [2. Project Scope](#2-project-scope)
- [3. User Roles & Use Cases](#3-user-roles--use-cases)
- [4. Functional Requirements](#4-functional-requirements)
- [5. Non-Functional Requirements](#5-non-functional-requirements)
- [6. System Architecture](#6-system-architecture)
- [7. Database Schema](#7-database-schema)
- [8. API Contract](#8-api-contract)
- [9. User Interface & Experience Overview](#9-user-interface--experience-overview)
- [10. Security & Threat Model](#10-security--threat-model)
- [11. Testing & Quality Assurance](#11-testing--quality-assurance)
- [12. Development Process & Team](#12-development-process--team)
- [13. Risk Management](#13-risk-management)
- [14. Future Roadmap](#14-future-roadmap)
- [15. Conclusion](#15-conclusion)
- [Appendix A: Glossary](#appendix-a-glossary)
- [Appendix B: References](#appendix-b-references)

---

## Executive Summary

CampusHustle is a university-verified peer-to-peer academic marketplace that allows students to tutor one another, sell study notes, and access AI-assisted learning support within a single trusted campus community. The platform reframes academic help as an economic opportunity: rather than a conventional tutor-matching app, CampusHustle is designed as an academic creator economy in which students earn from knowledge they already possess, through live mentorship, digital study resources, and AI-enhanced tools grounded in verified course material.

This document is the primary technical and process reference for the CampusHustle team during the INSA CTC Summer Camp graduation project. It defines the problem being solved, the requirements the system must satisfy, the architecture and data design, the API contract between frontend and backend, the security posture and threat model, the testing approach, and the team's development process. Features that extend beyond the Minimum Viable Product are documented separately as a future roadmap so that the current scope remains realistic and fully deliverable within the project timeline.

The project is developed by a six-person team combining frontend and backend specialists, supported by AI-assisted development tools for boilerplate generation, with all security-sensitive code subject to manual review before merging.

---

## 1. Introduction

### 1.1 Background

University students accumulate substantial academic knowledge through coursework, yet have limited structured ways to share or monetize that knowledge among peers. At the same time, many students need affordable, relatable academic support, ideally from someone who has recently completed the same course under the same instructors and curriculum. Existing tutoring platforms are typically built around professional, paid tutors and are not designed for peer-to-peer, campus-scoped exchange, nor do they treat student-generated study material as a monetizable product in its own right.

### 1.2 Problem Statement

University students possess valuable, up-to-date academic knowledge, but have no structured way to monetize it while balancing their own studies. Students seeking help often cannot afford professional tutoring, and no platform currently connects them with verified peers who understand the exact curriculum they are studying.

### 1.3 Proposed Solution

CampusHustle is a university-verified peer-to-peer academic marketplace where students can tutor each other, sell study materials, and access AI-assisted learning support, all within a trusted platform scoped to a single university community. The system creates several parallel income paths for tutors (live sessions, notes sales) and several parallel value paths for learners (affordable tutoring, searchable notes, grounded AI explanations), which is what distinguishes it from a single-purpose tutor-booking tool.

### 1.4 Project Objectives

- Provide a verified, trusted environment for peer-to-peer academic exchange within a university community.
- Enable students to earn income by tutoring peers and selling study materials.
- Reduce the cost and increase the relevance of academic help compared to professional tutoring.
- Demonstrate secure software engineering practice.
- Introduce AI-assisted learning tools that are grounded in tutor-provided material rather than general internet knowledge.
- Deliver a fully working, deployed MVP within the fifteen-day team development window.

### 1.5 Stakeholders

| Stakeholder | Interest |
|---|---|
| Students (Learners) | Affordable, relevant academic help and study material |
| Students (Tutors) | A structured way to earn from their academic knowledge |
| INSA CTC reviewers | Evidence of sound security engineering and process discipline |
| Development team | A deliverable project within a fixed deadline |

### 1.6 Document Purpose and Scope

This document serves as the primary technical reference for the CampusHustle development team. It defines the functional and non-functional requirements, system architecture, database schema, API contracts, UI overview, security posture, testing plan, and development process for the Minimum Viable Product. **Features beyond the MVP are documented separately in the Future Roadmap section and are explicitly out of scope for the current build phase.**

---

## 2. Project Scope

### 2.1 In Scope (MVP)

- User creation (only student emails accepted) and user profiles
- Tutor discovery via structured search (using subject, price, rating, department, name)
- Role selection: single account model (a user can be both student and tutor)
- Booking system based on fixed weekly availability
- Comprehensive management of reservation states (pending, confirmed, completed, cancelled)
- Real-time private chat between connected users
- Study notes marketplace, including photo-to-PDF conversion via OCR
- AI Study Assistant answering questions from a tutor's own uploaded material
- Multi-dimensional ratings and a reporting/blocking system
- Notifications (new booking request, booking accepted, new message, new note purchase)

### 2.2 Out of Scope (Future Work)

- University verification (automated)
- Chapa integration (live payments — MVP uses manual/cash confirmation)
- Subscription plans and recurring billing
- Group sessions and fixed-price crash courses
- Gamified tutor levels and badges
- Live whiteboard, screen sharing, and collaborative code editor
- Recorded session playback
- Native mobile application (Flutter)
- Automated national ID verification
- Advanced tutor analytics dashboards

A complete description of future roadmap items is provided in [Section 14](#14-future-roadmap).

---

## 3. User Roles & Use Cases

### 3.1 Actors

| Actor | Description |
|---|---|
| Student (Learner) | A verified university student seeking tutoring, notes, or AI-assisted help |
| Tutor | A verified university student offering tutoring sessions and/or study notes for a fee |
| Admin | Platform administrator responsible for verification, moderation, and abuse reports |

> **Note:** a single account may hold both the Student and Tutor role simultaneously; the system does not enforce mutual exclusivity between them.

### 3.2 Use Case Summary

| ID | Use Case | Primary Actor |
|---|---|---|
| UC-1 | Student account creation using student email | Student / Tutor |
| UC-2 | Create or edit profile and skill tags | Student / Tutor |
| UC-3 | Search and filter tutors by subject/price/rating/name | Student |
| UC-4 | Set weekly availability | Tutor |
| UC-5 | Request, accept, or decline a booking | Student / Tutor |
| UC-6 | Send and receive real-time chat messages | Student / Tutor |
| UC-7 | Share contact information within a chat | Student / Tutor |
| UC-8 | Upload notes (PDF or photographed) | Tutor |
| UC-9 | Browse, preview, and purchase notes | Student |
| UC-10 | Ask the AI Study Assistant a question | Student |
| UC-11 | Rate a tutor after a completed session | Student |
| UC-12 | Report or block a user | Student / Tutor |
| UC-13 | Review reports and moderate accounts | Admin |

### 3.3 Representative User Stories

- As a student, I want to search for a tutor by course code so that I can find someone who recently completed the exact class I'm struggling with.
- As a tutor, I want to set fixed weekly availability so that students can only book times I have actually reserved for tutoring.
- As a student, I want to preview a few pages of a note before purchasing so that I can judge whether it's relevant to my course.
- As a tutor, I want to photograph my handwritten notes and have them automatically turned into a downloadable PDF so that I don't need a scanner.
- As a student, I want to ask a question about a tutor's uploaded notes and get an answer grounded only in that material, so I'm not misled by generic AI answers.
- As a student, I want to report a tutor who behaves inappropriately in chat so that the platform stays safe for other students.

---

## 4. Functional Requirements

The table below defines the functional requirements (FR) for the CampusHustle MVP. Each requirement is uniquely identified for traceability during development and testing, and maps to the use cases in Section 3.2.

| ID | Requirement | Related Use Case |
|---|---|---|
| FR-1 | System shall restrict signup/login to verified university email addresses. | UC-1 |
| FR-2 | Users shall create a profile with role, skills, department, and year. | UC-2 |
| FR-3 | Tutors shall tag subjects/skills using structured tags, not free text. | UC-2 |
| FR-4 | Students shall search/filter tutors by name, subject, price, rating, department. | UC-3 |
| FR-5 | Tutors shall define fixed weekly availability slots. | UC-4 |
| FR-6 | Students shall request a booking; tutors shall accept or decline. | UC-5 |
| FR-7 | System shall provide real-time 1:1 chat after acceptance. | UC-6 |
| FR-8 | Users shall optionally share contact info in chat, with consent logging. | UC-7 |
| FR-9 | Tutors shall upload notes as a PDF or as a photo converted via OCR. | UC-8 |
| FR-10 | System shall support preview, pricing, and purchase of notes. | UC-9 |
| FR-11 | Notes shall be chunked/embedded to power a scoped AI Q&A assistant. | UC-10 |
| FR-12 | Students shall rate and write a review. | UC-11 |
| FR-13 | Users shall be able to report or block other users. | UC-12 |
| FR-14 | System shall notify users of bookings, messages, and purchases. | UC-5, 6, 9 |

---

## 5. Non-Functional Requirements

Non-functional requirements (NFR) define the quality attributes the system must satisfy, independent of specific features.

| ID | Requirement |
|---|---|
| NFR-1 | Passwords shall be hashed using bcrypt; plaintext passwords are never stored or logged. |
| NFR-2 | All API endpoints shall be rate-limited to prevent abuse such as booking spam or message flooding. |
| NFR-3 | Chat messages and shared contact information shall be stored securely (encrypted at rest, TLS in transit). |
| NFR-4 | Search results shall return within approximately 2 seconds under normal load. |
| NFR-5 | Chat messages shall be delivered within approximately 1 second. |
| NFR-6 | The system shall be usable on mobile browsers via responsive design. |
| NFR-7 | All third-party services shall operate within free-tier limits for the MVP. |
| NFR-8 | The codebase shall separate concerns by module to support parallel development across a six-person team. |
| NFR-9 | Administrators shall be able to audit reported abuse cases, including what was shared and when. |
| NFR-10 | The system shall degrade gracefully if a third-party free-tier service (e.g. Gemini, Cloudinary) is temporarily rate-limited. |

---

## 6. System Architecture

### 6.1 High-Level Architecture

CampusHustle follows a standard three-tier architecture: a React single-page frontend, an Express REST and WebSocket backend, and a MongoDB Atlas data layer, integrated with external free-tier services for AI, file storage, and payments.

```
React App (Vite + Tailwind) <--REST/WS--> Express API + Socket.io <--> MongoDB Atlas
                                                    |
                        +---------------------------+---------------------------+
                        |                            |                          |
                  Cloudinary (files)           Gemini (AI/RAG)            Chapa (payments)
```

### 6.2 Notes-to-AI-Assistant Pipeline

Uploaded notes, whether native PDFs or photographs of physical notes, are processed through a retrieval-augmented generation (RAG) pipeline so that AI answers remain grounded in the tutor's actual material rather than general knowledge.

```
Upload (PDF or photo)
  -> [if photo] OCR text extraction (Tesseract.js)
  -> Text chunking
  -> Embedding generation (Gemini)
  -> Stored in MongoDB with vector + metadata
  -> Student question -> embed query -> cosine similarity search
  -> Top matching chunks -> Gemini generates grounded answer
```

### 6.3 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + Tailwind CSS |
| Backend | Node.js + Express |
| Real-time communication | Socket.io |
| Database | MongoDB Atlas (free tier) + Mongoose |
| Authentication | JWT + bcrypt |
| File storage | Cloudinary (free tier) |
| OCR | Tesseract.js |
| AI / Embeddings | Gemini API |
| Payments | Cash (manual payment confirmation) |
| Deployment | Vercel/Netlify (frontend), Render (backend) |

All third-party services are used strictly within their free tiers, consistent with the project's scope as a student learning and graduation project.

---

## 7. Database Schema

CampusHustle uses MongoDB with Mongoose for schema validation. The core collections are described below.

### 7.1 User
```js
{
  _id, name, email, passwordHash, role,
  university, department, year, bio, profilePicUrl,
  skillsTeaching: [String], skillsLearning: [String],
  rating: { knowledge, communication, punctuality, count },
  verified: Boolean, isBlocked: Boolean, createdAt
}
```

### 7.2 Availability
```js
{ _id, tutorId, dayOfWeek, startTime, endTime, isBooked }
```

### 7.3 Booking
```js
{ _id, studentId, tutorId, availabilityId, status, createdAt }
```

### 7.4 Message
```js
{ _id, conversationId, senderId, content, containsContactInfo, createdAt }
```

### 7.5 Note
```js
{
  _id, tutorId, title, course, description,
  fileUrl, price, previewPages, purchaseCount, createdAt
}
```

### 7.6 NoteChunk (RAG)
```js
{ _id, noteId, tutorId, text, embedding: [Number], pageNumber }
```

### 7.7 Review
```js
{
  _id, bookingId, studentId, tutorId,
  knowledge, communication, punctuality, wouldRecommend, comment, createdAt
}
```

### 7.8 Report
```js
{ _id, reporterId, reportedUserId, reason, status, createdAt }
```

---

## 8. API Contract

### 8.1 Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with university email |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/verify-email` | Verify university email |
| POST | `/api/auth/refresh` | Refresh access token |

### 8.2 Users & Profiles

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me` | Update own profile |
| GET | `/api/users/:id` | Get public profile |
| GET | `/api/users/search` | Search tutors by subject, price, rating, department |

### 8.3 Availability & Booking

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/availability` | Tutor creates an availability slot |
| GET | `/api/availability/:tutorId` | Get a tutor's open slots |
| POST | `/api/bookings` | Student requests a booking |
| PATCH | `/api/bookings/:id` | Tutor accepts or declines |
| GET | `/api/bookings/me` | Get own bookings |

### 8.4 Chat

| Method / Event | Endpoint / Event | Description |
|---|---|---|
| GET | `/api/messages/:conversationId` | Get message history |
| Socket event | `message:send` | Send a message |
| Socket event | `message:receive` | Receive a message |

### 8.5 Notes Marketplace

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/notes` | Upload a note (PDF or photo) |
| GET | `/api/notes/search` | Browse/search notes by course, price |
| GET | `/api/notes/:id` | Get note detail and preview |
| POST | `/api/notes/:id/purchase` | Purchase a note via Chapa |

### 8.6 AI Assistant

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/ask` | `{ tutorId, question }` -> grounded answer from that tutor's notes |

### 8.7 Reviews & Reports

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/reviews` | Submit a review after a completed booking |
| POST | `/api/reports` | Report a user |
| PATCH | `/api/reports/:id` | Admin updates report status |

### 8.8 Example Request/Response — Booking Creation

```
POST /api/bookings

Request:
{
  "tutorId": "64f...",
  "availabilityId": "64a..."
}

Response 201:
{
  "bookingId": "64b...",
  "status": "pending",
  "createdAt": "2026-08-08T10:00:00Z"
}
```

---

## 9. User Interface & Experience Overview

The interface prioritizes a clean, mobile-responsive layout with minimal friction between browsing, booking, and messaging. The key screens are described below at a functional level; visual design exploration happens separately from this specification.

### 9.1 Landing / Authentication
- University email signup and login form
- Brief platform explanation for first-time visitors

### 9.2 Discovery / Search
- Search bar with subject, price, rating, and department filters
- Tutor cards showing photo, rating, subjects, and price

### 9.3 Tutor Profile
- Bio, department, year, verification badge, and rating breakdown
- Weekly availability grid and a "Request Booking" action
- List of the tutor's uploaded notes, if any

### 9.4 Booking & Chat
- Booking status view (pending, confirmed, completed, cancelled)
- Real-time chat thread, unlocked once a booking is accepted
- Optional, explicit action to share contact information within the thread

### 9.5 Notes Marketplace
- Browsable/searchable grid of notes by course and price
- Note detail page with preview pages, description, and purchase button
- Upload flow supporting both direct PDF upload and camera capture

### 9.6 AI Study Assistant
- Chat-style interface scoped to a single tutor's uploaded notes
- Clear indication when the assistant cannot answer from available material

### 9.7 Admin Dashboard
- Queue of pending verifications and abuse reports
- User search with the ability to suspend or reinstate accounts

---

## 10. Security & Threat Model

### 10.1 Security Principles

The system follows the principles of least privilege, defense in depth, and data minimization, particularly around the exchange of personal contact information.

- Passwords are hashed with bcrypt; JWTs are short-lived, with refresh token rotation.
- Rate limiting is applied to booking creation, message sending, and note upload endpoints.
- All user-submitted content is validated and sanitized before processing or storage.
- Role-based access control (student / tutor / admin) is enforced at the middleware level.
- Contact information shared within chat is flagged and logged for audit purposes.
- Uploaded files are validated by type and size before being processed.

### 10.2 STRIDE Threat Analysis

The following threat model applies the STRIDE framework to CampusHustle's core flows: authentication, booking, chat, and the notes marketplace.

| Category | Example Threat | Mitigation |
|---|---|---|
| Spoofing | Attacker registers with a fake or borrowed university email | Email domain verification; future work: institutional SSO |
| Tampering | User modifies booking or price data via crafted API requests | Server-side validation; ownership checks on every mutation |
| Repudiation | User denies having shared contact info or sent an abusive message | Message and contact-share audit logging with timestamps |
| Information Disclosure | Chat contents or contact info exposed via insecure transport or storage | TLS in transit, encryption at rest, strict access control |
| Denial of Service | Attacker floods booking or chat endpoints with requests | Rate limiting per user/IP on write-heavy endpoints |
| Elevation of Privilege | Student account attempts to access admin-only endpoints | Role-based access control enforced server-side on every route |

### 10.3 Data Sensitivity Summary

| Data Type | Sensitivity | Handling |
|---|---|---|
| Password | High | Hashed (bcrypt), never logged or returned in API responses |
| Phone number / contact info | High | Shared only with explicit consent inside chat, logged for audit |
| Chat messages | Medium | Encrypted in transit; access restricted to conversation participants |
| Uploaded notes | Low–Medium | Access controlled by purchase status; owner-only before publication |
| Ratings and reviews | Low | Publicly visible by design, tied to completed bookings only |

---

## 11. Testing & Quality Assurance

### 11.1 Testing Strategy

Testing is layered to match the team's compressed timeline: each feature owner is responsible for unit and integration tests on their own module, with a dedicated integration and security testing pass before deployment.

- Unit tests for core business logic (booking status transitions, rating aggregation, RAG chunk retrieval)
- Integration tests for API endpoints, including authentication and authorization failure cases
- Manual end-to-end walkthroughs of each core user flow before the security review
- Targeted security tests: rate-limit verification, JWT expiry handling, role-based access boundary tests

### 11.2 Sample Test Cases

| ID | Test Case | Expected Result |
|---|---|---|
| TC-1 | Register with a non-university email | Registration rejected with clear error |
| TC-2 | Student attempts to access an admin-only endpoint | 403 Forbidden response |
| TC-3 | Send more than the rate limit of booking requests in one minute | Requests beyond the limit are rejected |
| TC-4 | Ask the AI assistant a question unrelated to any uploaded note | Assistant indicates it cannot answer from available material |
| TC-5 | Upload a non-PDF, non-image file as a note | Upload rejected with a validation error |
| TC-6 | Two users complete a booking and one submits a rating | Rating is recorded and reflected in the tutor's aggregate score |

---

## 12. Development Process & Team

### 12.1 Team Structure

| Area of Ownership | Role |
|---|---|
| Architecture, Authentication backend, DevOps, AI Assistant (RAG) | Backend Developer 1 (Team Lead) |
| Booking and Chat backend, Notifications | Backend Developer 2 |
| Notes Marketplace backend (upload, OCR, payments) | Backend Developer 3 |
| Authentication/Profile/Discovery UI | Frontend Developer 1 |
| Booking UI, Chat UI | Frontend Developer 2 |
| Notes Marketplace UI, AI Assistant UI | Frontend Developer 3 |

### 12.2 Fifteen-Day Development Timeline

| Days | Phase | Focus |
|---|---|---|
| 1–2 | Architecture & Contracts | Finalize schema and API contracts; environment setup for all six members |
| 3–8 | Parallel Core Build | Auth, Profiles, Discovery, Booking, and Chat built in frontend/backend pairs |
| 9–11 | Notes Marketplace + AI Assistant | Upload/OCR/payments backend, RAG pipeline, and corresponding UI |
| 12–13 | Integration | Merge all branches; full end-to-end walkthrough of every user flow |
| 14 | Security Pass | Rate limiting, validation, threat model finalization, bug fixes |
| 15 | Deploy & Rehearse | Deployment, documentation finalization, timed demo rehearsal |

### 12.3 Repository Structure

```
campus-hustle/
├── client/     (React frontend)
├── server/     (Express backend)
├── docs/       (documentation, diagrams)
└── README.md
```

### 12.4 Tools & Collaboration

- **Version control:** Git, with a feature-branch-per-task workflow merged into main after review
- **Project tracking:** GitHub Projects Kanban board (Backlog, In Progress, Testing, Done), seeded from Section 4
- **AI-assisted development:** used for boilerplate, scaffolding, and documentation; all authentication, payment, and file-upload code is manually reviewed before merge regardless of how it was drafted
- **Daily short async standups** to surface blockers early given the compressed timeline

---

## 13. Risk Management

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fifteen-day timeline slips due to integration issues | Medium | High | Sequence Notes/AI after core; budget dedicated integration days |
| Free-tier API rate limits hit during demo | Medium | Medium | Test under load beforehand; wake Render instance ahead of demo |
| OCR accuracy issues on photographed notes | Medium | Low | Scope MVP to text-based/printed sources; set expectations clearly |
| Security gaps introduced by AI-generated code | Medium | High | Mandatory manual review of all auth/payment/upload code |
| Team member unavailability mid-sprint | Low | Medium | Feature ownership documented; lead can cover any module if needed |

---

## 14. Future Roadmap

The following features represent the platform's intended direction beyond the current MVP. They are excluded from the present build to keep the delivery scope realistic within the project timeline.

- Subscription plans for recurring access to a tutor's content
- Group sessions and fixed-price crash courses
- Gamified tutor levels (Bronze, Silver, Gold, Diamond) and badges
- Live whiteboard, screen sharing, and a collaborative code editor
- Recorded session playback
- A native mobile application built with Flutter
- Automated national ID verification, combining OCR, format validation, and face-match confidence scoring with human review fallback
- Advanced analytics dashboards for tutors

---

## 15. Conclusion

CampusHustle is designed to demonstrate that peer-to-peer academic knowledge exchange can be structured as a genuine creator economy rather than a simple tutor-matching tool. By combining verified university identity, live mentorship, a study notes marketplace, and an AI assistant grounded strictly in tutor-provided material, the platform aims to deliver both practical value to students and a strong demonstration of secure, well-architected software engineering practice appropriate to the goals of the INSA CTC Summer Camp program.

This document will be maintained as a living reference throughout development and updated as requirements are refined during implementation and testing.

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| RAG | Retrieval-Augmented Generation — an AI technique that grounds model answers in retrieved source material |
| Embedding | A numeric vector representation of text used to measure semantic similarity |
| JWT | JSON Web Token — a compact, signed token used for stateless authentication |
| OCR | Optical Character Recognition — extracting text from images or scanned documents |
| STRIDE | A threat modeling framework: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege |
| MVP | Minimum Viable Product — the smallest feature set that delivers real value and can be tested |

## Appendix B: References

- MongoDB Atlas documentation — free-tier cluster setup and usage limits
- Google Gemini API documentation — embeddings and generation endpoints
- Tesseract.js documentation — in-browser and Node OCR usage
- Chapa API documentation — payment integration for Ethiopian merchants
- OWASP Top 10 — reference for common web application security risks
- Socket.io documentation — real-time WebSocket communication
