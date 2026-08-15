# CampusHustle — Pair A End-to-End Test Script & Walkthrough
**Module**: Auth, User Profile, & Tutor Discovery (`FR-1`–`FR-4`, `NFR-1`, `NFR-2`, `NFR-4`)  
**Assigned**: Daniel (Backend) + Chara (Frontend)

---

## 🎯 Test Objectives
Verify the end-to-end user journey from initial account registration through university verification, authentication, profile setup, and tutor discovery.

---

## 🧪 E2E Test Steps & Validation Matrix

### 1. Account Registration (`POST /api/auth/register`)
- **Request**:
  ```json
  {
    "name": "Chara Tesfaye",
    "email": "chara.tesfaye@aau.edu.et",
    "password": "SecurePassword123!",
    "university": "Addis Ababa University",
    "department": "Software Engineering",
    "year": 3,
    "role": "student"
  }
  ```
- **Expected Result**: HTTP `201 Created` with `user`, `accessToken`, `refreshToken`, and `verificationToken`. Non-`.edu.et` emails are rejected with HTTP `400`.

### 2. Email Verification (`POST /api/auth/verify-email`)
- **Request**:
  ```json
  {
    "token": "<verificationToken>"
  }
  ```
- **Expected Result**: HTTP `200 OK`, `isEmailVerified` transitions to `true`.

### 3. User Authentication (`POST /api/auth/login`)
- **Request**:
  ```json
  {
    "email": "chara.tesfaye@aau.edu.et",
    "password": "SecurePassword123!"
  }
  ```
- **Expected Result**: HTTP `200 OK`, returns updated JWT `accessToken` and rotated `refreshToken`.

### 4. Profile & Tutor Skills Configuration (`PUT /api/users/me`)
- **Headers**: `Authorization: Bearer <accessToken>`
- **Request**:
  ```json
  {
    "role": "tutor",
    "hourlyRate": 150,
    "bio": "Senior Software Engineering student offering tutoring in Data Structures, Algorithms, and Web Development.",
    "skillsTeaching": ["Algorithms", "Data Structures", "Python", "JavaScript"]
  }
  ```
- **Expected Result**: HTTP `200 OK`, profile updated with tutor role, hourly pricing, and teaching tags.

### 5. Tutor Discovery & Search Filtering (`GET /api/users/search`)
- **Request**:
  ```http
  GET /api/users/search?subject=Algorithms&department=Software+Engineering&minPrice=100&maxPrice=200
  ```
- **Expected Result**: HTTP `200 OK`, returns array containing the registered tutor with exact rating and hourly rate metadata.
- **Negative Test Case**: Search with `subject=NonExistentCourse` returns HTTP `200 OK` with `count: 0, tutors: []` (no error thrown).

### 6. Token Refresh Rotation (`POST /api/auth/refresh`)
- **Request**:
  ```json
  {
    "refreshToken": "<refreshToken>"
  }
  ```
- **Expected Result**: HTTP `200 OK`, issues new access and refresh token pair, revoking old refresh token to prevent reuse.
