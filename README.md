# 🎓 CampusHustle Backend API

> **The peer-to-peer academic and skill-sharing platform tailored for Ethiopian university students.**
> 
> *Connect with verified student tutors, schedule learning sessions, exchange course notes with OCR conversion, chat in real-time, and query tutor study materials with scoped AI assistant grounding.*

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Runtime & Server** | Node.js (v20+), Express.js (v5) | RESTful API server with centralized error handling |
| **Real-Time Layer** | Socket.io (v4) | WebSocket engine for low-latency 1:1 chat |
| **Database** | MongoDB & Mongoose (v9) | Document store & embedded vector storage |
| **Authentication** | JWT & bcryptjs | Access + Refresh token rotation, university domain validator |
| **File Storage & OCR** | Cloudinary & Tesseract.js | PDF/image uploads, photo-to-PDF OCR conversion |
| **AI Study Assistant** | Google Gemini API | 768-dim vector embeddings (`gemini-embedding-001`) & grounded Q&A (`gemini-3.6-flash`) |
| **Security & Auditing** | Express Rate Limit, Regex Sanitizers | STRIDE-aligned threat mitigations and abuse contact detection |
| **Testing** | Node.js Test Runner (`node --test`) | 154 unit and integration tests with zero external test frameworks |

---

## 🚀 Key Functional Features

- **🔐 FR-1 — University-Only Authentication**: Restricted to `.edu.et` university emails, bcrypt password hashing, 24h verification link token flow, and refresh token rotation with reuse revocation.
- **👤 FR-2 & FR-3 — Profiles & Structured Skill Tags**: Student/tutor profile customization with a curated taxonomy of 65 canonical subject tags (no free-text noise).
- **🔍 FR-4 — Tutor Discovery & Search**: Fast multi-parameter filter by name, subject, price, rating, and department with ReDoS and NoSQL injection safeguards.
- **📅 FR-5 & FR-6 — Availability Slots & Booking Workflow**: Weekly recurring availability slots, booking requests, and state machine (`pending` ➔ `confirmed` / `declined` / `cancelled` / `completed`).
- **💬 FR-7 & FR-8 — Real-Time 1:1 Chat & Contact Info Auditing**: Socket.io chat room unlocked exclusively after confirmed bookings. Automatic regex detection and audit trail logging for shared phone numbers, Telegram handles, and email addresses.
- **📄 FR-9 — Note Uploads & Photo-to-PDF OCR**: Upload course notes directly as PDF or upload handwritten photos converted into searchable PDFs using Tesseract OCR and stored on Cloudinary.
- **🛒 FR-10 — Notes Marketplace**: Course note browsing, detail previews, and instant purchase records.
- **🤖 FR-11 — AI Study Assistant (RAG)**: Automated text chunking and 768-dimensional vector embedding of uploaded notes. Answers are strictly bounded and grounded to the selected tutor's study materials with source citations.
- **⭐ FR-12 — Multi-Axis Reviews & Ratings**: 3-axis review (Knowledge, Communication, Punctuality: 1–5) for completed bookings with atomic aggregate rating updates on user profiles.
- **🛡️ FR-13 — User Reporting & Moderation**: Peer user blocking and abuse report queue with admin resolution actions and platform-wide account suspension.
- **🔔 FR-14 — In-App Notifications**: Real-time notifications for booking status updates, new messages, reviews, and note purchases.

---

## 📦 Getting Started

### 1. Prerequisites
- **Node.js**: v20.x or later
- **MongoDB**: v6.x or later running locally or a MongoDB Atlas URI
- **Google Gemini API Key**: Free API key from [Google AI Studio](https://aistudio.google.com/)
- *(Optional)* **Cloudinary Account**: Free credentials from [Cloudinary Console](https://cloudinary.com/)

---

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/CampusHustle/backend.git
cd backend
npm install
```

---

### 3. Environment Configuration

Create a `.env` file in the `backend/` root directory:

```env
# Server
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database
DATABASE_URL=mongodb://localhost:27017/campus_hustle

# Authentication Secrets (Generate with crypto.randomBytes(32).toString('hex'))
JWT_SECRET=your_super_secret_jwt_access_key
JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key
EMAIL_VERIFICATION_SECRET=your_super_secret_email_verification_key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
EMAIL_VERIFICATION_EXPIRES_IN=24h

# Google Gemini API (RAG & AI Assistant)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_CHAT_MODEL=gemini-3.6-flash

# Cloudinary Storage (Optional for local dev, required for real file hosting)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

---

### 4. Running the Server

#### Start in Development Mode (with hot-reload):
```bash
npm run dev
```

#### Start in Production Mode:
```bash
npm start
```

The API server and WebSocket gateway will be running at `http://localhost:5000`.

---

### 5. Running Automated Tests

Run the full automated test suite (154 tests covering models, routes, services, rate-limiting, and security):

```bash
npm test
```

Run lint / syntax checks:
```bash
npm run lint
```

---

## 📡 REST API Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/auth/register` | None | Register with university email (`.edu.et`) |
| `POST` | `/api/auth/login` | None | Authenticate with university credentials |
| `POST` | `/api/auth/verify-email` | None | Verify signed email token |
| `POST` | `/api/auth/resend-verification` | None | Request new verification email link |
| `POST` | `/api/auth/refresh` | None | Rotate refresh token and get new access token |
| `POST` | `/api/auth/logout` | Bearer | Revoke active refresh token session |

---

### 👤 Users & Profiles (`/api/users`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/users/skills` | None | Get canonical list of 65 allowed subject tags |
| `GET` | `/api/users/me` | Bearer | Get authenticated user's full profile |
| `PUT` | `/api/users/me` | Bearer | Update profile (skills, bio, department, rate, year) |
| `GET` | `/api/users/search` | None | Search/filter tutors (`?subject=python&minPrice=0&minRating=4`) |
| `GET` | `/api/users/:id` | None | Get public user or tutor profile |
| `POST` | `/api/users/block/:id` | Bearer | Block a specific user |
| `DELETE` | `/api/users/block/:id` | Bearer | Unblock a user |
| `PATCH` | `/api/users/:id/status` | Admin | Suspend or unsuspend user account |

---

### 📅 Tutor Availability (`/api/availability`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/availability` | Tutor | Create a weekly recurring open slot |
| `GET` | `/api/availability/me` | Tutor | Get authenticated tutor's slots |
| `GET` | `/api/availability/tutor/:tutorId`| None | Get a tutor's active availability slots |
| `PUT` | `/api/availability/:id` | Tutor | Update an availability slot |
| `DELETE` | `/api/availability/:id` | Tutor | Delete an availability slot |

---

### 🤝 Bookings (`/api/bookings`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/bookings` | Student | Request a booking for a tutor's availability slot |
| `GET` | `/api/bookings/me` | Bearer | Get all user's bookings (as student or tutor) |
| `GET` | `/api/bookings/:id` | Bearer | Get single booking details |
| `PATCH` | `/api/bookings/:id/status` | Bearer | Update status (`confirmed`, `declined`, `completed`, `cancelled`) |

---

### 💬 Real-Time Chat & Messages (`/api/messages`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/messages/:conversationId` | Bearer | Get paginated message history by conversation ID |
| `GET` | `/api/messages/conversation/:userId`| Bearer | Get message history with another user |

#### Socket.io Gateway Events:
- **Connection Handshake**: `io.connect('http://localhost:5000', { auth: { token: '<jwt>' } })`
- **Client Emit**: `join_conversation` ➔ `{ conversationId: "userId1_userId2" }` *(Requires confirmed booking)*
- **Client Emit**: `message:send` ➔ `{ conversationId: "...", content: "..." }`
- **Server Broadcast**: `message:receive` ➔ `{ _id, senderId, content, containsContactInfo, createdAt }`

---

### 📚 Course Notes Marketplace (`/api/notes`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/notes` | Tutor | Upload note (PDF or image with OCR) |
| `GET` | `/api/notes/search` | None | Search/browse all notes (`?q=calculus&course=MATH101`) |
| `GET` | `/api/notes/tutor/:tutorId` | None | Get notes uploaded by a specific tutor |
| `GET` | `/api/notes/:noteId` | Optional | Get note detail and page previews |
| `POST` | `/api/notes/:noteId/purchase` | Student | Record note purchase |
| `GET` | `/api/notes/purchases/me` | Student | List authenticated student's purchased notes |

---

### 🤖 AI Study Assistant / RAG (`/api/ai`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/ai/ask` | None | Query tutor notes: `{ "tutorId": "...", "question": "..." }` |

---

### ⭐ Reviews & Ratings (`/api/reviews`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/reviews` | Bearer | Submit 3-axis review for a completed booking |
| `GET` | `/api/reviews/user/:userId` | None | Get all reviews for a specific user/tutor |

---

### 🛡️ Moderation & Reports (`/api/reports`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/reports` | Bearer | Report a user for misconduct |
| `GET` | `/api/reports` | Admin | List all abuse reports with status filters |
| `PATCH` | `/api/reports/:id` | Admin | Update report resolution, log admin action, or ban user |

---

### 🔔 Notifications (`/api/notifications`)
| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/notifications` | Bearer | Get paginated user notifications |
| `GET` | `/api/notifications/unread-count` | Bearer | Get unread notifications count |
| `PATCH` | `/api/notifications/:id/read` | Bearer | Mark single notification as read |
| `PATCH` | `/api/notifications/read-all` | Bearer | Mark all notifications as read |

---

## 🔒 Security Architecture (STRIDE Alignment)

- **Spoofing**: Enforces strict `.edu.et` regex validation on registration; Socket.io handshake and API routes verify signed JWTs with expiration bounds.
- **Tampering**: Passwords hashed with bcrypt (10 rounds); input sanitization strips NoSQL operators and escapes special regex characters on search.
- **Repudiation**: Automatic detection and audit persistence of phone numbers, Telegram handles, and email addresses (`containsContactInfo: true`) in chat.
- **Information Disclosure**: Tutor-scoped RAG searches prevent cross-tutor data leakage; chat history requires active confirmed bookings.
- **Denial of Service (DoS)**: Tiered rate-limiting on write actions and general endpoints; file sizes capped at 10MB (PDF) and 5MB (Image).
- **Elevation of Privilege**: Role-based access control (`requireRole('admin')`, `requireRole('tutor')`); self-service role changes restricted strictly between `student` and `tutor`.

---

## 👥 Contributors

- **Team Lead & Core Backend**: Daniel Gidey / Chara
- **Platform**: CampusHustle MVP
