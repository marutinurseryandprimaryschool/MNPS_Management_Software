# CampusOS — Product Requirements Document (PRD)

**Product Name:** CampusOS
**Version:** 1.0
**Date:** April 13, 2026
**Classification:** Confidential — Internal & Investor Use
**Author:** Product & Engineering Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [User Personas](#3-user-personas)
4. [RBAC Matrix](#4-rbac-matrix)
5. [Feature Breakdown](#5-feature-breakdown)
6. [User Flows](#6-user-flows)
7. [Functional Requirements](#7-functional-requirements)
8. [Scheduling Engine Design](#8-scheduling-engine-design)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [System Architecture](#10-system-architecture)
11. [Database Schema](#11-database-schema)
12. [API & Data Flow](#12-api--data-flow)
13. [UI/UX Design System](#13-uiux-design-system)
14. [Mobile-First Design Strategy](#14-mobile-first-design-strategy)
15. [Dashboard UX Layouts](#15-dashboard-ux-layouts)
16. [Security Rules (Firebase RBAC)](#16-security-rules-firebase-rbac)
17. [Edge Cases](#17-edge-cases)
18. [Deployment Strategy](#18-deployment-strategy)
19. [Future Scope](#19-future-scope)
20. [Development Roadmap](#20-development-roadmap)

---

## 1. Executive Summary

CampusOS is a mobile-first, role-based School Management System built as a scalable SaaS web application. It serves three core user roles — **Admin (Counter)**, **Teacher**, and **Parent** (acting on behalf of students) — eliminating the need for a separate student login.

### Problem Statement

Schools today rely on fragmented tools — paper registers, WhatsApp groups, Excel timetables, and disconnected fee systems. This creates:

- **Administrative overhead:** Manual scheduling, attendance tracking, and fee collection consume 15–20 hours/week per admin.
- **Communication gaps:** Parents lack real-time visibility into their child's academic data.
- **Scheduling chaos:** Timetable conflicts, teacher double-bookings, and unavailability handling are manual and error-prone.
- **Data silos:** Student performance, fee status, and attendance live in separate systems.

### Solution

CampusOS provides a unified, real-time platform that:

- Automates timetable generation with conflict detection and teacher availability handling.
- Delivers instant parent visibility into attendance, grades, fees, and assignments.
- Streamlines admin workflows to complete tasks in minimal clicks.
- Enables direct teacher-parent communication via an integrated chat system.

### Key Differentiators

| Differentiator | CampusOS | Traditional Systems |
|---|---|---|
| Mobile-First | Designed from mobile up | Desktop-first, poor mobile |
| Parent-as-Student | Parents manage child data directly | Separate student login required |
| Real-Time Sync | Firebase real-time listeners | Periodic data refresh |
| Scheduling Engine | Automated conflict detection | Manual timetable creation |
| Target Load Time | < 2 seconds (mobile) | 5–10 seconds typical |

### Business Model

- **Freemium Tier:** Up to 50 students, 5 teachers, core features.
- **Standard Tier:** ₹5,000/month — up to 500 students, full features.
- **Premium Tier:** ₹12,000/month — unlimited students, priority support, custom branding.
- **Enterprise:** Custom pricing — multi-campus, API access, dedicated support.

### Target Market

- K–12 private and semi-private schools (India-first, global expansion).
- School chains and education groups managing multiple campuses.
- After-school coaching centers and tuition institutes.

---

## 2. Product Vision

### Vision Statement

> *"Make school operations invisible — so educators can focus on education."*

### Mission

To build the most intuitive, mobile-first school management platform that replaces all operational tools with a single, unified system that loads in under 2 seconds on any device.

### Strategic Goals (12 months)

| Goal | Metric | Target |
|---|---|---|
| Product-Market Fit | NPS | > 50 |
| Adoption | Active Schools | 200 |
| Retention | Monthly Churn | < 3% |
| Performance | P95 page load (mobile) | < 2s |
| Engagement | Daily Active Users / Monthly | > 40% |

### Design Philosophy

1. **Operations should be invisible.** The system should require zero training.
2. **Mobile is the primary device.** Every interaction is designed for a 5" screen first.
3. **Speed is a feature.** If it takes more than 2 taps, redesign it.
4. **Parents are partners.** Real-time transparency builds trust.
5. **Teachers are time-starved.** Every workflow must respect their time.

---

## 3. User Personas

### Persona 1: Admin (Counter Role) — "Priya"

| Attribute | Details |
|---|---|
| **Age** | 28–45 |
| **Role** | School Administrator / Front Desk |
| **Tech Savvy** | Moderate — comfortable with WhatsApp, basic web apps |
| **Device** | Desktop (primary), Android phone (secondary) |
| **Frustrations** | Timetable conflicts, chasing fee payments, repetitive data entry |
| **Goals** | Complete daily admin tasks in < 1 hour, zero scheduling errors |
| **Daily Tasks** | Create/edit student records, manage fee collection, create timetables, assign teachers |
| **Key Metric** | Tasks completed per session, error rate in scheduling |

**Day in the life:**
Priya arrives at 8:30 AM and checks the dashboard for pending fee payments and today's schedule conflicts. She creates a new student record for an admission, assigns them to Class 5-B, and links the parent account. Before lunch, she adjusts the timetable because a teacher called in sick — the system auto-suggests replacements based on availability. By 2 PM, she's sent fee reminders to 12 parents via the notification system.

---

### Persona 2: Teacher — "Rajesh"

| Attribute | Details |
|---|---|
| **Age** | 25–50 |
| **Role** | Subject Teacher (may teach multiple classes/sections) |
| **Tech Savvy** | Low to Moderate |
| **Device** | Android phone (primary), personal laptop (secondary) |
| **Frustrations** | Paper attendance registers, unclear schedules, no way to share materials |
| **Goals** | Mark attendance in < 30 seconds, upload assignments quickly |
| **Daily Tasks** | Check today's schedule, mark attendance per period, upload marks, respond to parent messages |
| **Key Metric** | Time to complete attendance, assignment upload frequency |

**Day in the life:**
Rajesh checks his phone at 8:15 AM and sees today's schedule — 5 periods across Class 8-A, 9-B, and 10-A. At the start of each period, he opens the attendance screen, sees the student list pre-loaded, taps absentees (2–3 students), and submits. Between periods, he uploads a worksheet PDF for Class 9-B. After school, he checks parent messages and responds to two inquiries about a student's performance.

---

### Persona 3: Parent — "Meena"

| Attribute | Details |
|---|---|
| **Age** | 30–50 |
| **Role** | Parent of 1–3 students in the school |
| **Tech Savvy** | Low — primarily uses WhatsApp and YouTube |
| **Device** | Budget Android phone (< ₹15,000), often slow network (3G/4G) |
| **Frustrations** | No visibility into child's school day, surprise fee deadlines, lost circulars |
| **Goals** | Know child's attendance and performance daily, pay fees on time |
| **Daily Tasks** | Check attendance, view assignments, read notifications |
| **Key Metric** | Time to find child's attendance, notification read rate |

**Day in the life:**
Meena picks up her phone during lunch break and checks CampusOS. The dashboard instantly shows her son's attendance today (Present — all 6 periods), a pending assignment in Mathematics (due Thursday), and a fee reminder for Term 2. She taps the fee card, sees the breakdown, and pays via UPI. In the evening, she messages the English teacher about her son's reading assessment.

---

## 4. RBAC Matrix

### Role Definitions

| Role | Scope | Description |
|---|---|---|
| **Admin** | School-wide | Full CRUD on all entities. Creates users, manages timetables, processes fees |
| **Teacher** | Assigned classes only | Read/write on attendance, marks, assignments for assigned classes |
| **Parent** | Own children only | Read-only on academics. Write on chat, fee payments |

### Detailed Permission Matrix

| Resource | Admin | Teacher | Parent |
|---|---|---|---|
| **Students** | | | |
| Create student | ✅ | ❌ | ❌ |
| View all students | ✅ | ❌ | ❌ |
| View assigned class students | ✅ | ✅ | ❌ |
| View own child | ✅ | ✅ (if assigned) | ✅ |
| Edit student details | ✅ | ❌ | ❌ |
| Delete student | ✅ | ❌ | ❌ |
| **Teachers** | | | |
| Create teacher | ✅ | ❌ | ❌ |
| View all teachers | ✅ | ❌ | ❌ |
| View own profile | ✅ | ✅ | ❌ |
| Edit teacher details | ✅ | ❌ | ❌ |
| Set own availability | ❌ | ✅ | ❌ |
| **Classes & Sections** | | | |
| Create/edit/delete | ✅ | ❌ | ❌ |
| View all | ✅ | ❌ | ❌ |
| View assigned | ✅ | ✅ | ❌ |
| View child's class | ✅ | ✅ | ✅ |
| **Timetable** | | | |
| Create/edit timetable | ✅ | ❌ | ❌ |
| View full school timetable | ✅ | ❌ | ❌ |
| View personal timetable | ✅ | ✅ | ❌ |
| View child's timetable | ✅ | ❌ | ✅ |
| **Attendance** | | | |
| Mark attendance | ❌ | ✅ (assigned classes) | ❌ |
| View all attendance | ✅ | ❌ | ❌ |
| View class attendance | ✅ | ✅ (assigned) | ❌ |
| View child attendance | ✅ | ✅ | ✅ |
| **Marks / Grades** | | | |
| Enter marks | ❌ | ✅ (assigned subject) | ❌ |
| View all marks | ✅ | ❌ | ❌ |
| View class marks | ✅ | ✅ (assigned) | ❌ |
| View child marks | ✅ | ✅ | ✅ |
| **Assignments** | | | |
| Create assignment | ❌ | ✅ | ❌ |
| View all assignments | ✅ | ❌ | ❌ |
| View class assignments | ✅ | ✅ (assigned) | ❌ |
| View child assignments | ✅ | ✅ | ✅ |
| **Materials** | | | |
| Upload materials | ❌ | ✅ | ❌ |
| View class materials | ✅ | ✅ | ✅ (child's class) |
| Delete materials | ✅ | ✅ (own) | ❌ |
| **Fees** | | | |
| Create fee structure | ✅ | ❌ | ❌ |
| Record payment | ✅ | ❌ | ❌ |
| View all fee records | ✅ | ❌ | ❌ |
| View own child fees | ❌ | ❌ | ✅ |
| **Chat** | | | |
| Admin broadcast | ✅ | ❌ | ❌ |
| Teacher ↔ Parent chat | ❌ | ✅ | ✅ |
| View all chats | ✅ | ❌ | ❌ |
| **Notifications** | | | |
| Send school-wide | ✅ | ❌ | ❌ |
| Send class-wide | ✅ | ✅ (assigned) | ❌ |
| Receive notifications | ✅ | ✅ | ✅ |
| **Reports** | | | |
| Generate school reports | ✅ | ❌ | ❌ |
| Generate class reports | ✅ | ✅ (assigned) | ❌ |
| View child report card | ✅ | ✅ | ✅ |
| **Settings** | | | |
| School settings | ✅ | ❌ | ❌ |
| Academic year config | ✅ | ❌ | ❌ |
| User management | ✅ | ❌ | ❌ |

---

## 5. Feature Breakdown

### 5.1 Authentication & Access Control

| ID | Feature | Description | Priority |
|---|---|---|---|
| AUTH-01 | Email/Password Login | Firebase Auth with email/password | P0 |
| AUTH-02 | Phone OTP Login | Firebase Auth with phone number (primary for parents) | P0 |
| AUTH-03 | Role-Based Redirect | Auto-redirect to role dashboard after login | P0 |
| AUTH-04 | Session Management | Persistent sessions with 30-day expiry, force logout | P0 |
| AUTH-05 | Password Reset | Email-based password reset flow | P0 |
| AUTH-06 | Account Lockout | Lock after 5 failed attempts, 15-min cooldown | P1 |
| AUTH-07 | Multi-Device Support | Same account on multiple devices, last-active tracking | P1 |
| AUTH-08 | First-Time Setup Wizard | Guided onboarding for new school admins | P1 |

### 5.2 Admin Features

#### 5.2.1 Student Management

| ID | Feature | Description | Priority |
|---|---|---|---|
| STU-01 | Student Registration | Full registration form: name, DOB, gender, blood group, address, photo | P0 |
| STU-02 | Admission Number | Auto-generated unique admission number (configurable prefix) | P0 |
| STU-03 | Class Assignment | Assign student to class + section during creation | P0 |
| STU-04 | Parent Linking | Link 1–2 parent accounts to a student | P0 |
| STU-05 | Bulk Import | CSV import of student data with validation & error reporting | P1 |
| STU-06 | Student Transfer | Move student between sections/classes with history | P1 |
| STU-07 | Student Archive | Soft-delete with archival (graduated, transferred, withdrawn) | P1 |
| STU-08 | Student Profile View | Consolidated view: academics, attendance, fees, assignments | P0 |
| STU-09 | Photo Upload | Profile photo upload with crop and compression | P1 |
| STU-10 | Student Search | Search by name, admission number, class, section | P0 |

#### 5.2.2 Teacher Management

| ID | Feature | Description | Priority |
|---|---|---|---|
| TCH-01 | Teacher Registration | Name, subject specializations, phone, email, photo, employee ID | P0 |
| TCH-02 | Subject Assignment | Assign subjects a teacher can teach (multi-select) | P0 |
| TCH-03 | Class Assignment | Assign teacher to specific class-section-subject combinations | P0 |
| TCH-04 | Availability Management | Teacher sets available/unavailable slots per week | P0 |
| TCH-05 | Teacher Profile | View assigned classes, timetable, workload summary | P0 |
| TCH-06 | Workload Tracking | Visual display of periods per day/week per teacher | P1 |
| TCH-07 | Substitute Management | Assign substitute when teacher marks unavailable | P1 |
| TCH-08 | Teacher Archive | Soft-delete for resigned/transferred teachers | P1 |

#### 5.2.3 Class & Section Management

| ID | Feature | Description | Priority |
|---|---|---|---|
| CLS-01 | Class Creation | Create classes (e.g., Class 1–12, LKG, UKG) | P0 |
| CLS-02 | Section Creation | Create sections (A, B, C...) under each class | P0 |
| CLS-03 | Class Teacher Assignment | Assign a primary class teacher to each section | P0 |
| CLS-04 | Subject Configuration | Define subjects per class (configurable per school) | P0 |
| CLS-05 | Student Capacity | Set max students per section | P1 |
| CLS-06 | Academic Year | Tie classes to academic year with rollover support | P1 |

#### 5.2.4 Fee Management

| ID | Feature | Description | Priority |
|---|---|---|---|
| FEE-01 | Fee Structure Creation | Define fee categories (tuition, transport, lab, etc.) per class | P0 |
| FEE-02 | Fee Assignment | Auto-assign fee structure to all students in a class | P0 |
| FEE-03 | Payment Recording | Record payments (cash, UPI, cheque, bank transfer) | P0 |
| FEE-04 | Receipt Generation | Auto-generate PDF receipt on payment | P0 |
| FEE-05 | Fee Reminders | Push notification + in-app reminder for pending fees | P1 |
| FEE-06 | Discount/Concession | Apply discounts (sibling, merit, hardship) per student | P1 |
| FEE-07 | Fee Reports | Collection summary by class, date range, payment mode | P0 |
| FEE-08 | Installment Plans | Split fees into configurable installments with due dates | P1 |
| FEE-09 | Late Fee Calculation | Auto-calculate late fee based on configurable rules | P2 |
| FEE-10 | Fee Ledger | Per-student fee history with running balance | P0 |

#### 5.2.5 Reports

| ID | Feature | Description | Priority |
|---|---|---|---|
| RPT-01 | Attendance Reports | Daily/weekly/monthly attendance summaries by class | P0 |
| RPT-02 | Fee Collection Report | Revenue tracking with filters | P0 |
| RPT-03 | Student Strength Report | Class-wise, section-wise student counts | P0 |
| RPT-04 | Teacher Workload Report | Periods per teacher per week | P1 |
| RPT-05 | Academic Performance Report | Class-wise mark distribution, toppers | P1 |
| RPT-06 | Export to PDF/CSV | All reports exportable | P1 |

### 5.3 Teacher Features

| ID | Feature | Description | Priority |
|---|---|---|---|
| T-01 | Personal Timetable | View daily/weekly schedule with room info | P0 |
| T-02 | Quick Attendance | Tap-to-mark attendance (full class in < 30 seconds) | P0 |
| T-03 | Mark Entry | Enter marks by exam type, subject, max marks | P0 |
| T-04 | Assignment Creation | Title, description, due date, attachments, target class | P0 |
| T-05 | Material Upload | Upload PDFs, images, documents per class-subject | P0 |
| T-06 | Chat with Parents | 1:1 messaging with parents of assigned students | P0 |
| T-07 | Student List | View student list per assigned class | P0 |
| T-08 | Attendance History | View past attendance records for assigned classes | P1 |
| T-09 | Today's Overview | Dashboard widget: today's classes, pending attendances, unread messages | P0 |
| T-10 | Set Availability | Mark available/unavailable slots for the week | P0 |
| T-11 | Notifications | Receive timetable changes, admin announcements | P0 |

### 5.4 Parent Features

| ID | Feature | Description | Priority |
|---|---|---|---|
| P-01 | Child Dashboard | At-a-glance view: attendance today, next assignment, fee status | P0 |
| P-02 | Attendance View | Calendar view of attendance with daily breakdown | P0 |
| P-03 | Timetable View | Child's weekly timetable with subjects and teachers | P0 |
| P-04 | Marks / Report Card | View exam marks, grade distribution, rank (if enabled) | P0 |
| P-05 | Assignments View | List of assignments with status (pending/submitted/graded) | P0 |
| P-06 | Fee Dashboard | Fee structure, paid/pending amounts, payment history | P0 |
| P-07 | Chat with Teachers | 1:1 messaging with child's teachers | P0 |
| P-08 | Materials Access | View/download study materials shared by teachers | P0 |
| P-09 | Notifications | Fee reminders, attendance alerts, announcements | P0 |
| P-10 | Multi-Child Support | Switch between children from the same parent account | P0 |
| P-11 | Profile Management | Update parent contact details, emergency info | P1 |

### 5.5 Chat System

| ID | Feature | Description | Priority |
|---|---|---|---|
| CHAT-01 | Teacher ↔ Parent Messaging | Real-time 1:1 text messages | P0 |
| CHAT-02 | Read Receipts | Delivered / Read status indicators | P1 |
| CHAT-03 | File Sharing in Chat | Share images, PDFs in chat (up to 5MB) | P1 |
| CHAT-04 | Admin Broadcast | Admin sends message to all parents / specific classes | P0 |
| CHAT-05 | Chat History | Persistent message history with search | P1 |
| CHAT-06 | Unread Badge | Badge count on chat icon for unread messages | P0 |
| CHAT-07 | Push Notifications | Notify on new messages when app is backgrounded | P1 |

### 5.6 File Management

| ID | Feature | Description | Priority |
|---|---|---|---|
| FILE-01 | Teacher File Upload | Upload to Firebase Storage, linked to class-subject | P0 |
| FILE-02 | File Size Limits | Max 10MB per file, configurable per school | P0 |
| FILE-03 | Supported Formats | PDF, DOCX, PPTX, JPEG, PNG, MP4 (< 50MB) | P0 |
| FILE-04 | Download Tracking | Track which parents/students downloaded materials | P2 |
| FILE-05 | Storage Quota | Per-school storage limits based on plan | P1 |

### 5.7 Notification System

| ID | Feature | Description | Priority |
|---|---|---|---|
| NOTIF-01 | In-App Notifications | Bell icon with notification feed | P0 |
| NOTIF-02 | Push Notifications | Firebase Cloud Messaging for mobile web | P1 |
| NOTIF-03 | Notification Categories | Fee reminder, attendance alert, timetable change, announcement | P0 |
| NOTIF-04 | Read/Unread State | Mark as read, batch mark as read | P0 |
| NOTIF-05 | Notification Preferences | User-configurable notification settings | P2 |

---

## 6. User Flows

### 6.1 Admin: New Student Admission

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Dashboard│───▶│ Students Tab │───▶│ + Add Student│───▶│ Basic Info   │
│          │    │              │    │  Button      │    │ Form         │
└─────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                              │
                                                              ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Confirmation │◀───│ Link Parent  │◀───│ Select Class │◀───│ Academic     │
│ + Success    │    │ Account      │    │ & Section    │    │ Details      │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**Steps (optimized for minimal clicks):**

1. Admin taps **"+ Add Student"** FAB on Students screen.
2. **Step 1 — Basic Info:** Name, DOB, gender, blood group, photo (camera/upload). Auto-generates admission number.
3. **Step 2 — Academic:** Select class and section from dropdowns. System shows available capacity.
4. **Step 3 — Parent Link:** Search existing parent OR create new parent account. Enter parent name, phone, email. Link as Father/Mother/Guardian.
5. **Step 4 — Review & Confirm:** Summary card. Tap "Create Student."
6. System creates student record, sends parent an SMS/email with login credentials.

**Mobile optimization:** Multi-step wizard with progress indicator. Each step fits on one screen without scrolling. Back/Next navigation at bottom.

---

### 6.2 Admin: Timetable Creation

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Dashboard│───▶│ Timetable    │───▶│ Select Class │───▶│ Grid Editor  │
│          │    │ Module       │    │ & Section    │    │              │
└─────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                              │
                                        ┌─────────────────────┤
                                        ▼                     ▼
                                  ┌──────────┐    ┌──────────────────┐
                                  │ Conflict  │    │ Assign Subject   │
                                  │ Warning   │    │ + Teacher to Slot│
                                  └──────────┘    └──────────────────┘
                                        │                     │
                                        ▼                     ▼
                                  ┌──────────────────────────────────┐
                                  │ Validate & Publish Timetable     │
                                  └──────────────────────────────────┘
```

**Steps:**

1. Navigate to **Timetable** → Select class and section.
2. System displays an empty weekly grid (Days × Periods).
3. For each cell: tap to open a bottom sheet → select subject → system shows only **available teachers** for that slot.
4. If a conflict exists (teacher already assigned elsewhere), a **red warning badge** appears with explanation.
5. Admin resolves conflict or picks a different teacher.
6. After filling the grid, tap **"Validate"** — system runs full conflict check.
7. If valid: tap **"Publish"** → timetable goes live, teachers and parents are notified.
8. If invalid: system lists all conflicts with **"Fix"** buttons that jump to the problem cell.

---

### 6.3 Teacher: Mark Attendance

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Dashboard│───▶│ Current      │───▶│ Student List │───▶│ Submit       │
│ "Mark    │    │ Period       │    │ (all present │    │ Attendance   │
│  Now"    │    │ Auto-Detected│    │  by default) │    │              │
└─────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

**Steps (optimized for < 30 seconds):**

1. Teacher opens app → Dashboard shows **"Mark Attendance"** card for current period (auto-detected from timetable).
2. Taps the card → Student list appears with **all students marked Present by default**.
3. Teacher taps only the **absent students** (toggles to red/absent).
4. Taps **"Submit"** at bottom.
5. Confirmation toast: "Attendance saved for Class 8-A, Period 3."

**Mobile optimization:** Large tap targets (48px+ height per student row). Swipe-to-mark-absent gesture. No scrolling needed for classes with < 40 students on most phones.

---

### 6.4 Parent: Daily Check

```
┌─────────┐    ┌──────────────┐
│ Open App │───▶│ Child        │
│          │    │ Dashboard    │
│          │    │              │
│          │    │ • Attendance │
│          │    │ • Pending    │
│          │    │   Assignments│
│          │    │ • Fee Status │
│          │    │ • Messages   │
└─────────┘    └──────────────┘
```

**Steps (zero-navigation design):**

1. Parent opens app → Child dashboard loads immediately (< 2 seconds).
2. **Top card:** Today's attendance status (🟢 Present / 🔴 Absent with period breakdown).
3. **Second card:** Pending assignments with due dates.
4. **Third card:** Fee status — amount due with "Pay Now" CTA (future scope).
5. **Bottom:** Unread messages badge.

**Multi-child:** If parent has multiple children, a child selector pill appears at the top. Swipe to switch.

---

## 7. Functional Requirements

### 7.1 Student Management

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-STU-01 | System shall allow admin to create a student with: name, DOB, gender, blood group, address, photo, admission number | Student record created with auto-generated admission number. All fields validated. |
| FR-STU-02 | System shall auto-generate admission numbers with school-configurable prefix (e.g., "CAMPUS-2026-0001") | Sequential, unique, no duplicates. Format configurable in settings. |
| FR-STU-03 | System shall link 1–2 parent accounts to each student | Parent accounts searchable by phone/email. Parent can see linked child immediately. |
| FR-STU-04 | System shall allow student transfer between sections | Transfer date recorded. Previous section access revoked. New section teachers can see student. |
| FR-STU-05 | System shall archive (soft-delete) students with reason | Archived students excluded from active lists but accessible in reports. |
| FR-STU-06 | System shall support CSV bulk import with validation | Preview screen shows valid/invalid rows. Only valid rows imported. Error report downloadable. |
| FR-STU-07 | System shall display consolidated student profile | Single screen: photo, personal info, class, attendance %, recent marks, fee balance, linked parent. |

### 7.2 Timetable & Scheduling

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-TT-01 | System shall provide a grid-based timetable editor (Days × Periods) | Admin can select any cell and assign subject + teacher. |
| FR-TT-02 | System shall only show available teachers for a given slot | Teacher list filtered by: subject match, availability, no existing assignment in that slot. |
| FR-TT-03 | System shall prevent double-booking a teacher | If teacher T is assigned to Class A in Slot S, T cannot be assigned to Class B in Slot S. Error shown inline. |
| FR-TT-04 | System shall respect teacher availability settings | If teacher marks Monday P1 as unavailable, they do not appear in Monday P1 dropdown. |
| FR-TT-05 | System shall detect and display all conflicts before publishing | Validation report lists all conflicts with severity (Error = must fix, Warning = should review). |
| FR-TT-06 | System shall support timetable versioning | Previous timetables archived with effective date. Rollback possible. |
| FR-TT-07 | System shall notify affected teachers and parents on timetable publish/change | Push notification + in-app notification sent to all affected users. |
| FR-TT-08 | System shall display timetable in three views: Admin (full), Teacher (personal), Parent (child) | Each view shows only role-appropriate data. |

### 7.3 Attendance

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-ATT-01 | System shall allow period-wise attendance marking | Teacher selects class + period → student list → marks absent/present. |
| FR-ATT-02 | System shall default all students to Present | Only absent students need to be toggled. |
| FR-ATT-03 | System shall prevent duplicate attendance for same class-period-date | If attendance already marked, show "Edit" option instead of new entry. |
| FR-ATT-04 | System shall calculate attendance percentage per student per subject/overall | Percentage updated in real-time on student profile. |
| FR-ATT-05 | System shall notify parents when child is marked absent | Notification sent within 5 minutes of attendance submission. |

### 7.4 Marks & Grades

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-MRK-01 | System shall allow configurable exam types (Unit Test, Mid-Term, Final, etc.) | Admin creates exam types with names, max marks, weightage. |
| FR-MRK-02 | System shall allow teachers to enter marks per student per exam per subject | Marks entry validates against max marks. Supports decimal (e.g., 87.5). |
| FR-MRK-03 | System shall auto-calculate grade based on configurable grade scale | Grades computed on save: A+ (90–100), A (80–89), etc. |
| FR-MRK-04 | System shall generate report cards | Per-student PDF with all subjects, marks, grades, rank (optional), attendance. |
| FR-MRK-05 | System shall display marks to parents immediately after teacher publishes | Parent sees marks on child dashboard within 1 minute of publish. |

### 7.5 Fee Management

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-FEE-01 | System shall allow admin to create fee structures per class | Fee categories (Tuition, Transport, Lab, Library) with amounts. |
| FR-FEE-02 | System shall auto-assign fees to all students in a class | On fee structure publish, all students in class get fee entries. |
| FR-FEE-03 | System shall record payments with mode (Cash, UPI, Cheque, Bank Transfer) | Payment linked to student, date, amount, mode, and reference number. |
| FR-FEE-04 | System shall generate PDF receipts | Receipt includes school name, student name, amount paid, balance, transaction ID. |
| FR-FEE-05 | System shall show parents their child's fee dashboard | Paid amount, pending amount, due date, payment history. |
| FR-FEE-06 | System shall send automated fee reminders 7 days and 1 day before due date | Notification sent to parent with amount and due date. |

### 7.6 Chat System

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-CHAT-01 | System shall support real-time 1:1 messaging between teacher and parent | Messages delivered in < 2 seconds. Firestore real-time listeners. |
| FR-CHAT-02 | System shall show unread message count as badge | Badge updates in real-time without page refresh. |
| FR-CHAT-03 | System shall support text messages up to 2,000 characters | Character counter shown. Messages truncated at limit. |
| FR-CHAT-04 | System shall support file attachments in chat (images, PDF) | Max 5MB per attachment. Thumbnail preview for images. |
| FR-CHAT-05 | System shall allow admin to send broadcast messages | Target: all parents, specific class, or specific section. Delivered as notification + in-app message. |

---

## 8. Scheduling Engine Design

### 8.1 Overview

The scheduling engine is the most complex subsystem in CampusOS. It manages timetable creation, teacher availability, conflict detection, and timetable distribution across all user roles.

### 8.2 Data Model

```
Timetable
├── schoolId: string
├── classId: string
├── sectionId: string
├── academicYear: string
├── version: number
├── status: 'draft' | 'published' | 'archived'
├── effectiveFrom: timestamp
├── createdBy: string (adminId)
├── createdAt: timestamp
├── updatedAt: timestamp
└── slots: [
      {
        day: 'monday' | 'tuesday' | ... | 'saturday',
        period: number (1-8),
        startTime: '08:30',
        endTime: '09:15',
        subjectId: string,
        teacherId: string,
        roomId: string (optional)
      }
    ]

TeacherAvailability
├── teacherId: string
├── academicYear: string
├── weeklySlots: [
      {
        day: string,
        period: number,
        available: boolean,
        reason: string (optional, e.g., 'Personal', 'Other school')
      }
    ]
└── updatedAt: timestamp
```

### 8.3 Conflict Detection Engine

The engine runs **three passes** during timetable creation and validation:

#### Pass 1: Teacher Availability Check

```
FOR each slot in timetable:
  IF assigned teacher's availability[slot.day][slot.period] === false:
    ADD conflict: {
      type: 'TEACHER_UNAVAILABLE',
      severity: 'ERROR',
      slot: slot,
      teacher: teacherName,
      message: '{teacher} is unavailable on {day} Period {period}',
      fix: 'Choose a different teacher or change the slot'
    }
```

#### Pass 2: Teacher Double-Booking Check

```
FOR each teacher assigned in any timetable:
  COLLECT all slots assigned to this teacher across ALL class-sections
  FOR each pair of slots with same (day, period):
    IF teacher appears in both:
      ADD conflict: {
        type: 'TEACHER_DOUBLE_BOOKED',
        severity: 'ERROR',
        teacher: teacherName,
        slot1: { class, section, subject },
        slot2: { class, section, subject },
        message: '{teacher} is assigned to {class1} and {class2} on {day} Period {period}',
        fix: 'Remove teacher from one of the slots'
      }
```

#### Pass 3: Class Integrity Check

```
FOR each class-section timetable:
  FOR each (day, period) combination:
    IF no subject assigned AND period is within school hours:
      ADD conflict: {
        type: 'EMPTY_SLOT',
        severity: 'WARNING',
        message: 'No subject assigned for {day} Period {period}',
        fix: 'Assign a subject and teacher'
      }
    IF same subject appears more than configured max per day:
      ADD conflict: {
        type: 'SUBJECT_OVERLOAD',
        severity: 'WARNING',
        message: '{subject} appears {count} times on {day} (max: {max})',
        fix: 'Redistribute subject across the week'
      }
```

### 8.4 Validation Rules

| Rule ID | Rule | Severity | Enforced |
|---|---|---|---|
| VAL-01 | A teacher cannot be assigned to two classes in the same slot | Error | Publish blocked |
| VAL-02 | A teacher cannot be assigned to a slot they marked as unavailable | Error | Publish blocked |
| VAL-03 | A class-section cannot have two subjects in the same slot | Error | Publish blocked |
| VAL-04 | Maximum periods per teacher per day: configurable (default 6) | Warning | Alert shown |
| VAL-05 | Maximum consecutive periods per teacher: configurable (default 3) | Warning | Alert shown |
| VAL-06 | All periods in the school day should be filled | Warning | Alert shown |
| VAL-07 | Subject frequency per week should match configured hours | Warning | Alert shown |
| VAL-08 | Break/lunch periods must not have teacher assignments | Error | Publish blocked |

### 8.5 Timetable Views

#### Admin View (Full School)

```
┌──────────────────────────────────────────────────────────────────┐
│ Class: [5-A ▾]  Section: [A ▾]  Status: 🟢 Published           │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│          │ Monday   │ Tuesday  │ Wednesday│ Thursday │ Friday   │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Period 1 │ Math     │ English  │ Science  │ Math     │ Hindi    │
│ 8:30-9:15│ Mr.Kumar │ Ms.Preeti│ Mr.Rajan │ Mr.Kumar │ Ms.Deepa │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Period 2 │ English  │ Math     │ Hindi    │ Science  │ Math     │
│ 9:15-10:0│ Ms.Preeti│ Mr.Kumar │ Ms.Deepa │ Mr.Rajan │ Mr.Kumar │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ BREAK    │          │          │          │          │          │
│10:00-10:2│          │          │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ ...      │ ...      │ ...      │ ...      │ ...      │ ...      │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Features:** Click any cell to edit. Color-coded by subject. Conflict indicators (🔴 Error, 🟡 Warning). Bulk actions (clear row, copy day).

#### Teacher View (Personal Schedule)

```
┌──────────────────────────────────────┐
│ Today: Monday, April 13              │
│ You have 5 classes today             │
├──────────────────────────────────────┤
│ 🕐 Period 1 (8:30 - 9:15)           │
│ Mathematics — Class 8-A             │
│ [Mark Attendance]                    │
├──────────────────────────────────────┤
│ 🕐 Period 2 (9:15 - 10:00)          │
│ Mathematics — Class 9-B             │
│ [Mark Attendance]                    │
├──────────────────────────────────────┤
│ ☕ Break (10:00 - 10:20)             │
├──────────────────────────────────────┤
│ 🕐 Period 3 (10:20 - 11:05)         │
│ Mathematics — Class 10-A            │
│ [Mark Attendance]                    │
├──────────────────────────────────────┤
│ ...                                  │
└──────────────────────────────────────┘
```

**Features:** Timeline view (default) or grid view toggle. Current period highlighted. Direct "Mark Attendance" button. Tap to expand for more details.

#### Parent View (Child's Schedule)

```
┌──────────────────────────────────────┐
│ Arjun's Timetable — Class 5-A       │
│ ┌────────┬────────┬────────┬────── │
│ │        │ Mon    │ Tue    │ Wed   │
│ ├────────┼────────┼────────┼────── │
│ │ P1     │ Math   │ English│Science│
│ │ P2     │ English│ Math   │ Hindi │
│ │ Break  │ ───    │ ───    │ ───   │
│ │ P3     │Science │ Hindi  │ Math  │
│ │ ...    │ ...    │ ...    │ ...   │
│ └────────┴────────┴────────┴────── │
└──────────────────────────────────────┘
```

**Features:** Compact grid. Subject color coding. Teacher names visible on tap. Today's column highlighted. Horizontally scrollable on mobile.

### 8.6 Auto-Suggest Algorithm

When an admin selects a slot to fill, the system suggests teachers using this ranking:

```
FUNCTION suggestTeachers(classId, sectionId, subjectId, day, period):
  candidates = teachers WHERE subjectId IN teacher.subjects
  
  FILTER OUT:
    - Teachers unavailable at (day, period)
    - Teachers already assigned at (day, period) in any class
  
  RANK BY:
    1. Already assigned to this class-section (continuity bonus): +10
    2. Fewest total periods this day (workload balance): +5 per gap
    3. No consecutive periods before/after this slot: +3
    4. Fewest total periods this week: +2 per gap
  
  RETURN ranked list with availability badge:
    🟢 Available, ⚠️ Nearing daily limit, 🔴 At weekly limit
```

---

## 9. Non-Functional Requirements

### 9.1 Performance

| Metric | Target | Measurement |
|---|---|---|
| First Contentful Paint (FCP) | < 1.5s on 4G | Lighthouse, Web Vitals |
| Largest Contentful Paint (LCP) | < 2.5s on 4G | Lighthouse, Web Vitals |
| Time to Interactive (TTI) | < 3s on 4G | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| First Input Delay (FID) | < 100ms | Web Vitals |
| API Response Time (P95) | < 500ms | Firebase Performance Monitoring |
| Bundle Size (initial load) | < 150KB (gzipped) | Webpack Bundle Analyzer |
| Offline Capability | Attendance submission queued when offline | Service Worker |

**Optimization Strategies:**

- Next.js dynamic imports for route-based code splitting
- Firestore query pagination (20 items per page)
- Image optimization via `next/image` with WebP format
- Service Worker for caching static assets
- Skeleton loading states (no blank screens)
- Virtualized lists for student/attendance views (> 50 items)

### 9.2 Scalability

| Dimension | Target |
|---|---|
| Concurrent Users per School | 500 |
| Total Schools (multi-tenant) | 1,000 |
| Students per School | 5,000 |
| Firestore Reads/Day | 50M (within Firebase Blaze plan) |
| Storage per School | 10GB (Standard plan) |
| Real-time Listeners | 100 per school concurrently |

**Multi-Tenancy Strategy:**

- Each school is a top-level Firestore document under `schools/{schoolId}`
- All data is scoped by `schoolId` — enforced in security rules
- Firestore composite indexes per school for query performance
- Firebase Auth custom claims store `schoolId` and `role`

### 9.3 Security

| Threat | Mitigation |
|---|---|
| Unauthorized Data Access | Firestore Security Rules enforce RBAC per document |
| Cross-School Data Leak | All queries filtered by `schoolId` from auth custom claims |
| XSS Attacks | React auto-escapes. CSP headers. No `dangerouslySetInnerHTML` |
| CSRF | SameSite cookies. Firebase Auth tokens are immune to CSRF |
| Brute Force Login | Rate limiting on auth endpoints. Account lockout after 5 attempts |
| File Upload Exploits | File type validation (server-side). Max size enforcement. Virus scan (future) |
| Data Loss | Firestore automatic backups. Point-in-time recovery (Blaze plan) |
| Privacy Compliance | Student PII encryption at rest (Firestore default). GDPR delete flow |

### 9.4 Reliability

| Metric | Target |
|---|---|
| Uptime | 99.9% (Firebase SLA) |
| Data Durability | 99.999999999% (Firestore) |
| Recovery Time Objective (RTO) | < 1 hour |
| Recovery Point Objective (RPO) | < 5 minutes |
| Error Rate (API) | < 0.1% |

---

## 10. System Architecture

### 10.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │
│  │  Mobile   │  │  Tablet   │  │  Desktop  │  │  PWA (Offline)    │   │
│  │  Browser  │  │  Browser  │  │  Browser  │  │  Service Worker   │   │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────────┬──────────┘   │
│        └───────────────┴───────────────┴────────────────┘              │
│                              │                                         │
│                    Next.js App (React)                                 │
│                    ┌────────────────────┐                              │
│                    │ • Pages (SSR/SSG)  │                              │
│                    │ • Components       │                              │
│                    │ • Hooks            │                              │
│                    │ • Context/State    │                              │
│                    │ • Firebase SDK     │                              │
│                    └────────┬───────────┘                              │
└─────────────────────────────┼─────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        FIREBASE PLATFORM                                │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Firebase Auth    │  │ Cloud Firestore   │  │ Firebase Storage     │  │
│  │                  │  │                   │  │                      │  │
│  │ • Email/Password │  │ • Real-time DB    │  │ • File uploads       │  │
│  │ • Phone OTP      │  │ • Security Rules  │  │ • Profile photos     │  │
│  │ • Custom Claims  │  │ • Composite Index │  │ • Study materials    │  │
│  │   (role, school) │  │ • Multi-tenancy   │  │ • Chat attachments   │  │
│  └─────────────────┘  └──────────────────┘  └──────────────────────┘  │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Cloud Functions  │  │ Cloud Messaging   │  │ Firebase Hosting     │  │
│  │ (Node.js)       │  │ (FCM)             │  │                      │  │
│  │                  │  │                   │  │ • Next.js SSR        │  │
│  │ • Custom claims  │  │ • Push notifs     │  │ • CDN distribution   │  │
│  │ • Fee reminders  │  │ • Background      │  │ • SSL/TLS            │  │
│  │ • Scheduled jobs │  │   notifications   │  │ • Custom domain      │  │
│  │ • Data triggers  │  │                   │  │                      │  │
│  └─────────────────┘  └──────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Frontend Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth layout group
│   │   ├── login/
│   │   ├── reset-password/
│   │   └── layout.tsx
│   ├── (dashboard)/              # Protected layout group
│   │   ├── admin/
│   │   │   ├── students/
│   │   │   ├── teachers/
│   │   │   ├── classes/
│   │   │   ├── timetable/
│   │   │   ├── fees/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   └── page.tsx          # Admin dashboard
│   │   ├── teacher/
│   │   │   ├── timetable/
│   │   │   ├── attendance/
│   │   │   ├── marks/
│   │   │   ├── assignments/
│   │   │   ├── materials/
│   │   │   ├── chat/
│   │   │   └── page.tsx          # Teacher dashboard
│   │   ├── parent/
│   │   │   ├── attendance/
│   │   │   ├── timetable/
│   │   │   ├── marks/
│   │   │   ├── assignments/
│   │   │   ├── fees/
│   │   │   ├── chat/
│   │   │   └── page.tsx          # Parent dashboard
│   │   └── layout.tsx            # Shared dashboard layout
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing / redirect
├── components/
│   ├── ui/                       # Design system primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── DataTable.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Skeleton.tsx
│   │   └── Toast.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── BottomNav.tsx
│   │   ├── Header.tsx
│   │   └── PageContainer.tsx
│   ├── timetable/
│   │   ├── TimetableGrid.tsx
│   │   ├── SlotEditor.tsx
│   │   ├── ConflictBadge.tsx
│   │   └── TeacherSuggest.tsx
│   ├── attendance/
│   │   ├── AttendanceSheet.tsx
│   │   ├── StudentRow.tsx
│   │   └── AttendanceCalendar.tsx
│   └── chat/
│       ├── ChatList.tsx
│       ├── ChatWindow.tsx
│       └── MessageBubble.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useFirestore.ts
│   ├── useRealtime.ts
│   ├── useTimetable.ts
│   └── useMediaQuery.ts
├── lib/
│   ├── firebase.ts               # Firebase init
│   ├── auth.ts                   # Auth helpers
│   ├── scheduling.ts             # Scheduling engine
│   └── utils.ts                  # Utilities
├── context/
│   ├── AuthContext.tsx
│   ├── SchoolContext.tsx
│   └── ThemeContext.tsx
├── styles/
│   ├── globals.css               # Design tokens, reset
│   ├── variables.css             # CSS custom properties
│   └── animations.css            # Micro-animations
└── types/
    ├── models.ts                 # TypeScript interfaces
    └── enums.ts                  # Role, status enums
```

### 10.3 State Management Strategy

| State Type | Solution | Reason |
|---|---|---|
| Auth State | React Context (AuthContext) | Global, rarely changes |
| School Config | React Context (SchoolContext) | Global, loaded once |
| Server Data | Firestore real-time listeners + React Query | Auto-sync, caching |
| UI State | React useState/useReducer | Local, ephemeral |
| Form State | React Hook Form | Validation, performance |
| Theme | CSS Custom Properties + Context | SSR-compatible |

---

## 11. Database Schema

### 11.1 Firestore Collections

All data is nested under `schools/{schoolId}` for multi-tenancy isolation.

#### Core Collections

```
schools/{schoolId}
├── name: string
├── address: string
├── phone: string
├── email: string
├── logo: string (Storage URL)
├── academicYear: string (e.g., '2026-27')
├── plan: 'free' | 'standard' | 'premium' | 'enterprise'
├── settings: {
│     admissionPrefix: string,
│     periodsPerDay: number (default 8),
│     schoolDays: string[] (default ['mon','tue','wed','thu','fri','sat']),
│     periodTimings: [
│       { period: 1, start: '08:30', end: '09:15' },
│       { period: 2, start: '09:15', end: '10:00' },
│       { type: 'break', start: '10:00', end: '10:20' },
│       ...
│     ],
│     gradeScale: [
│       { grade: 'A+', min: 90, max: 100 },
│       { grade: 'A', min: 80, max: 89 },
│       ...
│     ],
│     maxPeriodsPerTeacherPerDay: number (default 6),
│     maxConsecutivePeriods: number (default 3)
│   }
├── createdAt: timestamp
└── updatedAt: timestamp

schools/{schoolId}/users/{userId}
├── uid: string (Firebase Auth UID)
├── role: 'admin' | 'teacher' | 'parent'
├── name: string
├── email: string
├── phone: string
├── photo: string (Storage URL)
├── status: 'active' | 'inactive' | 'archived'
├── createdAt: timestamp
└── updatedAt: timestamp

schools/{schoolId}/classes/{classId}
├── name: string (e.g., 'Class 5')
├── order: number (for sorting: 1, 2, 3...)
├── sections: [
│     {
│       id: string,
│       name: string (e.g., 'A'),
│       classTeacherId: string,
│       maxCapacity: number
│     }
│   ]
├── subjects: [
│     {
│       id: string,
│       name: string (e.g., 'Mathematics'),
│       code: string (e.g., 'MATH'),
│       weeklyPeriods: number (e.g., 5)
│     }
│   ]
└── academicYear: string

schools/{schoolId}/students/{studentId}
├── admissionNumber: string
├── name: string
├── dob: timestamp
├── gender: 'male' | 'female' | 'other'
├── bloodGroup: string
├── address: string
├── photo: string (Storage URL)
├── classId: string
├── sectionId: string
├── parentIds: string[] (max 2, references users)
├── status: 'active' | 'archived'
├── archiveReason: string (optional)
├── createdAt: timestamp
└── updatedAt: timestamp

schools/{schoolId}/teachers/{teacherId}
├── userId: string (references users)
├── employeeId: string
├── subjects: string[] (subject IDs they can teach)
├── assignedClasses: [
│     {
│       classId: string,
│       sectionId: string,
│       subjectId: string,
│       isClassTeacher: boolean
│     }
│   ]
├── availability: {
│     monday: { 1: true, 2: true, 3: false, ... },
│     tuesday: { 1: true, 2: true, ... },
│     ...
│   }
├── status: 'active' | 'archived'
├── createdAt: timestamp
└── updatedAt: timestamp
```

#### Feature Collections

```
schools/{schoolId}/timetables/{timetableId}
├── classId: string
├── sectionId: string
├── academicYear: string
├── version: number
├── status: 'draft' | 'published' | 'archived'
├── effectiveFrom: timestamp
├── slots: [
│     {
│       day: string,
│       period: number,
│       subjectId: string,
│       subjectName: string (denormalized),
│       teacherId: string,
│       teacherName: string (denormalized)
│     }
│   ]
├── createdBy: string
├── createdAt: timestamp
└── updatedAt: timestamp

schools/{schoolId}/attendance/{attendanceId}
├── date: string (YYYY-MM-DD, for querying)
├── classId: string
├── sectionId: string
├── period: number
├── subjectId: string
├── teacherId: string
├── records: [
│     {
│       studentId: string,
│       studentName: string (denormalized),
│       status: 'present' | 'absent' | 'late'
│     }
│   ]
├── submittedAt: timestamp
└── editedAt: timestamp (optional)

schools/{schoolId}/marks/{marksId}
├── examType: string (e.g., 'midterm')
├── examName: string (e.g., 'Mid-Term Examination 2026')
├── classId: string
├── sectionId: string
├── subjectId: string
├── teacherId: string
├── maxMarks: number
├── records: [
│     {
│       studentId: string,
│       studentName: string (denormalized),
│       marksObtained: number,
│       grade: string (auto-calculated),
│       remarks: string (optional)
│     }
│   ]
├── status: 'draft' | 'published'
├── createdAt: timestamp
└── publishedAt: timestamp

schools/{schoolId}/assignments/{assignmentId}
├── title: string
├── description: string
├── classId: string
├── sectionId: string
├── subjectId: string
├── teacherId: string
├── dueDate: timestamp
├── attachments: [
│     { name: string, url: string, size: number }
│   ]
├── status: 'active' | 'archived'
├── createdAt: timestamp
└── updatedAt: timestamp

schools/{schoolId}/materials/{materialId}
├── title: string
├── description: string
├── classId: string
├── sectionId: string
├── subjectId: string
├── teacherId: string
├── files: [
│     { name: string, url: string, size: number, type: string }
│   ]
├── createdAt: timestamp
└── updatedAt: timestamp

schools/{schoolId}/fees/{feeId}
├── type: 'structure' | 'payment'
├── --- IF type === 'structure' ---
├── classId: string
├── academicYear: string
├── categories: [
│     {
│       name: string (e.g., 'Tuition Fee'),
│       amount: number,
│       installments: [
│         { dueDate: timestamp, amount: number }
│       ]
│     }
│   ]
├── totalAmount: number
├── --- IF type === 'payment' ---
├── studentId: string
├── studentName: string (denormalized)
├── classId: string
├── amount: number
├── mode: 'cash' | 'upi' | 'cheque' | 'bank_transfer'
├── referenceNumber: string
├── receiptNumber: string (auto-generated)
├── category: string (which fee category)
├── receivedBy: string (admin userId)
├── paidAt: timestamp
└── createdAt: timestamp

schools/{schoolId}/chats/{chatId}
├── participants: string[] (2 userIds)
├── participantNames: { [userId]: string } (denormalized)
├── participantRoles: { [userId]: 'teacher' | 'parent' }
├── lastMessage: {
│     text: string,
│     senderId: string,
│     sentAt: timestamp
│   }
├── unreadCount: { [userId]: number }
├── createdAt: timestamp
└── updatedAt: timestamp

schools/{schoolId}/chats/{chatId}/messages/{messageId}
├── senderId: string
├── text: string
├── attachments: [
│     { name: string, url: string, type: string, size: number }
│   ]
├── readBy: string[] (userIds)
├── sentAt: timestamp
└── readAt: timestamp (by recipient)

schools/{schoolId}/notifications/{notificationId}
├── type: 'fee_reminder' | 'attendance_alert' | 'timetable_change' |
│         'announcement' | 'new_message' | 'assignment_due'
├── title: string
├── body: string
├── targetRole: 'all' | 'admin' | 'teacher' | 'parent'
├── targetUsers: string[] (specific userIds, empty = all of role)
├── targetClass: string (optional, for class-specific)
├── data: { [key]: string } (deep-link data)
├── createdBy: string
├── createdAt: timestamp
└── readBy: string[] (userIds who read it)
```

### 11.2 Firestore Indexes

| Collection | Fields | Query |
|---|---|---|
| attendance | classId ASC, date DESC | Get class attendance by date |
| attendance | date ASC, period ASC | Get all attendance for a day |
| marks | classId ASC, examType ASC | Get class marks by exam |
| fees (payments) | studentId ASC, paidAt DESC | Get student payment history |
| notifications | targetRole ASC, createdAt DESC | Get role-based notifications |
| timetables | classId ASC, status ASC | Get published timetable for class |
| chats | participants ARRAY_CONTAINS, updatedAt DESC | Get user's chats |

### 11.3 Data Denormalization Strategy

To minimize Firestore reads and optimize mobile performance, we denormalize:

| Source | Denormalized Into | Reason |
|---|---|---|
| teacher.name | timetable.slots[].teacherName | Avoid N reads when rendering timetable |
| student.name | attendance.records[].studentName | Avoid N reads when rendering attendance |
| student.name | marks.records[].studentName | Avoid N reads when rendering marks |
| user.name | chat.participantNames | Avoid 2 reads per chat list item |
| chat.lastMessage | chat.lastMessage (embedded) | Show preview without reading messages subcollection |

**Trade-off:** Write operations update denormalized fields via Cloud Functions triggers. Acceptable because writes are infrequent compared to reads (10:1 ratio).

---

## 12. API & Data Flow

### 12.1 Data Access Pattern

CampusOS primarily uses **direct Firestore SDK** from the client (no REST API layer) for real-time capabilities. Cloud Functions handle:

- **Triggers:** Auto-calculations, denormalization, notifications
- **Scheduled Jobs:** Fee reminders, reports
- **Admin Operations:** Setting custom claims, bulk operations

### 12.2 Key Data Flows

#### Flow 1: Student Creation

```
Admin Client                   Firestore                    Cloud Function
    │                              │                              │
    ├──── write student doc ──────▶│                              │
    │                              │                              │
    │                              ├── onCreate trigger ─────────▶│
    │                              │                              │
    │                              │◀── create parent auth account│
    │                              │◀── set custom claims         │
    │                              │◀── send welcome SMS/email    │
    │                              │◀── update school stats       │
    │                              │                              │
    │◀───── real-time listener ────│                              │
    │       (student created)      │                              │
```

#### Flow 2: Attendance Marking

```
Teacher Client                 Firestore                    Cloud Function
    │                              │                              │
    ├── read class students ──────▶│                              │
    │◀── student list ────────────│                              │
    │                              │                              │
    │── write attendance doc ─────▶│                              │
    │                              │                              │
    │                              ├── onCreate trigger ─────────▶│
    │                              │                              │
    │                              │◀── update student attendance%│
    │                              │◀── notify parents of absent  │
    │                              │    students via FCM           │
    │                              │                              │
    │◀──── real-time listener ────│                              │
    │      (confirmed)             │                              │
```

#### Flow 3: Timetable Publishing

```
Admin Client                   Firestore                    Cloud Function
    │                              │                              │
    │── run conflict detection ───▶│ (client-side engine)         │
    │   (reads all timetables +    │                              │
    │    teacher availability)     │                              │
    │                              │                              │
    │◀── conflict results ────────│                              │
    │                              │                              │
    │── [IF no errors] ──────────▶│                              │
    │   update status: 'published' │                              │
    │   set effectiveFrom          │                              │
    │                              │                              │
    │                              ├── onUpdate trigger ─────────▶│
    │                              │                              │
    │                              │◀── archive previous version  │
    │                              │◀── notify all affected       │
    │                              │    teachers (FCM)             │
    │                              │◀── notify all affected       │
    │                              │    parents (FCM)              │
    │                              │                              │
```

#### Flow 4: Real-Time Chat

```
Teacher Client                 Firestore                    Parent Client
    │                              │                              │
    │── write message to ─────────▶│                              │
    │   chats/{id}/messages        │                              │
    │                              │                              │
    │── update chat.lastMessage ──▶│                              │
    │── update chat.unreadCount ──▶│                              │
    │                              │                              │
    │                              │──── real-time listener ─────▶│
    │                              │     (new message appears)     │
    │                              │                              │
    │                              ├── onCreate trigger ──▶ FCM   │
    │                              │                       push   │
    │                              │                       notif  │
    │                              │                         │    │
    │                              │                         └───▶│
    │                              │                    (push notification)
```

### 12.3 Cloud Functions Inventory

| Function | Trigger | Purpose |
|---|---|---|
| `onUserCreate` | Auth onCreate | Set default custom claims (role, schoolId) |
| `onStudentCreate` | Firestore onCreate | Update school stats, create parent account if needed |
| `onStudentUpdate` | Firestore onUpdate | Sync denormalized names across collections |
| `onAttendanceCreate` | Firestore onCreate | Update attendance percentage, notify absent parents |
| `onMarksPublish` | Firestore onUpdate (status→published) | Notify parents, calculate grades |
| `onTimetablePublish` | Firestore onUpdate (status→published) | Archive old version, notify teachers & parents |
| `onMessageCreate` | Firestore onCreate | Update chat metadata, send FCM push |
| `onPaymentCreate` | Firestore onCreate | Update student fee balance, generate receipt |
| `scheduledFeeReminder` | Scheduled (daily 9AM) | Send reminders for fees due in 7 days and 1 day |
| `scheduledAttendanceDigest` | Scheduled (daily 7PM) | Send daily attendance summary to parents |

---

## 13. UI/UX Design System

### 13.1 Design Principles

| Principle | Description | Application |
|---|---|---|
| **Clarity** | Every element must communicate purpose instantly | No icons without labels on mobile. Clear CTAs. |
| **Speed** | Every interaction must feel instant | Skeleton loading. Optimistic updates. No spinners > 2s. |
| **Density** | Show right amount of info per screen | Data cards on mobile, data tables on desktop. |
| **Consistency** | Same patterns everywhere | One button style, one card style, one form pattern. |
| **Accessibility** | Usable by all, even on budget devices | 16px min text, 48px tap targets, WCAG AA contrast. |

### 13.2 Typography System

| Token | Font | Size | Weight | Line Height | Use Case |
|---|---|---|---|---|---|
| `--text-display` | Inter | 28px / 1.75rem | 700 | 1.2 | Page titles (Desktop) |
| `--text-heading-1` | Inter | 22px / 1.375rem | 700 | 1.3 | Page titles (Mobile) |
| `--text-heading-2` | Inter | 18px / 1.125rem | 600 | 1.3 | Section headings |
| `--text-heading-3` | Inter | 16px / 1rem | 600 | 1.4 | Card titles |
| `--text-body` | Inter | 14px / 0.875rem | 400 | 1.5 | Body text |
| `--text-body-sm` | Inter | 13px / 0.8125rem | 400 | 1.5 | Secondary text |
| `--text-caption` | Inter | 12px / 0.75rem | 400 | 1.4 | Labels, timestamps |
| `--text-overline` | Inter | 11px / 0.6875rem | 600 | 1.5 | Badges, statuses (uppercase) |

**Font Loading Strategy:**
```css
@font-face {
  font-family: 'Inter';
  font-display: swap;
  src: url('/fonts/Inter-Regular.woff2') format('woff2');
  font-weight: 400;
}
@font-face {
  font-family: 'Inter';
  font-display: swap;
  src: url('/fonts/Inter-SemiBold.woff2') format('woff2');
  font-weight: 600;
}
@font-face {
  font-family: 'Inter';
  font-display: swap;
  src: url('/fonts/Inter-Bold.woff2') format('woff2');
  font-weight: 700;
}
```

### 13.3 Color System

#### Light Theme

| Token | Hex | Usage |
|---|---|---|
| `--color-primary-50` | `#EEF2FF` | Primary tint (backgrounds) |
| `--color-primary-100` | `#E0E7FF` | Primary lighter |
| `--color-primary-200` | `#C7D2FE` | Primary light |
| `--color-primary-500` | `#6366F1` | Primary (Indigo) — buttons, links |
| `--color-primary-600` | `#4F46E5` | Primary hover |
| `--color-primary-700` | `#4338CA` | Primary active |
| `--color-surface` | `#FFFFFF` | Card backgrounds |
| `--color-surface-dim` | `#F8FAFC` | Page background |
| `--color-surface-variant` | `#F1F5F9` | Alternate rows, input backgrounds |
| `--color-text-primary` | `#0F172A` | Main text (Slate 900) |
| `--color-text-secondary` | `#475569` | Secondary text (Slate 600) |
| `--color-text-tertiary` | `#94A3B8` | Placeholder, disabled (Slate 400) |
| `--color-border` | `#E2E8F0` | Borders, dividers (Slate 200) |
| `--color-success` | `#10B981` | Present, paid, positive |
| `--color-success-bg` | `#ECFDF5` | Success background |
| `--color-error` | `#EF4444` | Absent, unpaid, errors |
| `--color-error-bg` | `#FEF2F2` | Error background |
| `--color-warning` | `#F59E0B` | Late, nearing limit |
| `--color-warning-bg` | `#FFFBEB` | Warning background |
| `--color-info` | `#3B82F6` | Informational |
| `--color-info-bg` | `#EFF6FF` | Info background |

#### Dark Theme

| Token | Hex | Usage |
|---|---|---|
| `--color-primary-500` | `#818CF8` | Primary (lighter indigo for dark) |
| `--color-surface` | `#1E293B` | Card backgrounds (Slate 800) |
| `--color-surface-dim` | `#0F172A` | Page background (Slate 900) |
| `--color-surface-variant` | `#334155` | Alternate rows (Slate 700) |
| `--color-text-primary` | `#F8FAFC` | Main text (Slate 50) |
| `--color-text-secondary` | `#CBD5E1` | Secondary text (Slate 300) |
| `--color-border` | `#334155` | Borders (Slate 700) |

#### Subject Color Codes (Timetable)

| Subject | Color | Background |
|---|---|---|
| Mathematics | `#6366F1` (Indigo) | `#EEF2FF` |
| English | `#EC4899` (Pink) | `#FDF2F8` |
| Science | `#10B981` (Emerald) | `#ECFDF5` |
| Hindi | `#F59E0B` (Amber) | `#FFFBEB` |
| Social Studies | `#8B5CF6` (Violet) | `#F5F3FF` |
| Physical Education | `#14B8A6` (Teal) | `#F0FDFA` |
| Computer Science | `#3B82F6` (Blue) | `#EFF6FF` |
| Art | `#F97316` (Orange) | `#FFF7ED` |

### 13.4 Spacing System

Based on a 4px base unit:

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Inline spacing, icon-text gap |
| `--space-2` | 8px | Tight padding, list item gap |
| `--space-3` | 12px | Input padding, compact cards |
| `--space-4` | 16px | Standard padding, card content |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Card padding, section spacing |
| `--space-8` | 32px | Page margins (desktop) |
| `--space-10` | 40px | Large section spacing |
| `--space-12` | 48px | Page section dividers |
| `--space-16` | 64px | Hero section spacing |

**Mobile Page Margins:** 16px (left/right)
**Desktop Page Margins:** 32px (left/right), max-width 1280px centered

### 13.5 Border Radius System

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Inputs, small buttons |
| `--radius-md` | 8px | Cards, containers |
| `--radius-lg` | 12px | Modals, bottom sheets |
| `--radius-xl` | 16px | Large cards, featured sections |
| `--radius-full` | 9999px | Avatars, pills, badges |

### 13.6 Shadow System

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift (cards at rest) |
| `--shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Interactive cards, dropdowns |
| `--shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals, popovers |
| `--shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | Bottom sheets, dialogs |

### 13.7 Component Library

#### Button Variants

| Variant | Use Case | Style |
|---|---|---|
| Primary | Main CTA (Save, Submit, Publish) | Solid `--color-primary-500`, white text, 700 weight |
| Secondary | Secondary action (Cancel, Back) | Outline with `--color-primary-500` border, primary text |
| Ghost | Tertiary (More, Options) | No background, primary text color |
| Danger | Destructive (Delete, Archive) | Solid `--color-error`, white text |
| Icon | Action buttons (Edit, Filter) | 40px circle, ghost variant |
| FAB | Add new entity | 56px circle, primary, bottom-right fixed on mobile |

**All buttons:** `min-height: 44px` (mobile), `min-height: 40px` (desktop). `border-radius: var(--radius-sm)`. Subtle hover/active states with `transform: scale(0.98)`. Ripple animation on tap.

#### Card Variants

| Variant | Use Case | Style |
|---|---|---|
| Data Card | Dashboard stats | `--color-surface`, `--shadow-sm`, icon + number + label |
| List Card | Student/teacher list item | `--color-surface`, bottom border, avatar + name + meta |
| Action Card | Quick actions on dashboard | `--color-surface`, `--shadow-sm`, icon + title + chevron |
| Alert Card | Important notifications | Colored left border (4px), light background |
| Timetable Cell | Each period in grid | Subject color background, compact text |

#### Form Components

| Component | Behavior |
|---|---|
| Text Input | Label on top. 44px height. `--color-surface-variant` background. Focus ring `--color-primary-500`. |
| Select/Dropdown | Native `<select>` on mobile for performance. Custom dropdown on desktop. |
| Checkbox | Custom 24px. Animated checkmark. |
| Toggle | 48px wide, 28px tall. Animated thumb. |
| Date Picker | Native `<input type="date">` on mobile. Custom calendar on desktop. |
| Search Input | Icon prefix. Debounced (300ms). Clear button on non-empty. |

#### Data Display

| Component | Mobile | Desktop |
|---|---|---|
| Data Table | Stacked cards (1 row = 1 card) | Traditional table with sortable columns |
| Attendance Grid | Vertical list with toggle buttons | Horizontal grid with checkboxes |
| Timetable | Vertical timeline (today's view) | Full week grid |
| Chat | Full-screen conversation | Split pane (list + conversation) |

### 13.8 Micro-Animations

| Animation | Duration | Easing | Usage |
|---|---|---|---|
| Page transition | 200ms | `ease-out` | Route changes |
| Card hover lift | 150ms | `ease-in-out` | Desktop card hover |
| Button press | 100ms | `ease-in` | Scale to 0.98 on press |
| Skeleton pulse | 1.5s | `ease-in-out` infinite | Loading states |
| Toast slide | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Notification toast appearance |
| Bottom sheet | 250ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Sheet slide up |
| Badge bounce | 300ms | `spring(1, 80, 10)` | New notification badge |
| Toggle switch | 200ms | `ease-in-out` | Attendance toggle |
| Checkmark draw | 250ms | `ease-out` (stroke-dashoffset) | Attendance submission |

---

## 14. Mobile-First Design Strategy

### 14.1 Responsive Breakpoints

| Breakpoint | Width | Target Device | Layout Strategy |
|---|---|---|---|
| `--bp-mobile` | 0 – 639px | Phones (5"–6.5") | Single column, bottom nav, stacked cards |
| `--bp-tablet` | 640 – 1023px | Tablets (8"–11") | Two columns, side nav collapsed, split views |
| `--bp-desktop` | 1024 – 1279px | Laptops (13"–15") | Full sidebar, multi-column, data tables |
| `--bp-wide` | 1280px+ | Monitors (24"+) | Max-width 1280px centered, spacious layouts |

### 14.2 Navigation Strategy

#### Mobile (< 640px)

```
┌──────────────────────────────┐
│ 🏫 CampusOS    🔔 2    👤   │  ← Top bar (56px)
├──────────────────────────────┤
│                              │
│    [Page Content]            │  ← Full-width scrollable
│                              │
│                              │
│                              │
├──────────────────────────────┤
│  🏠    📅    ✅    💬    ⚙️  │  ← Bottom nav (64px, safe area)
│  Home  Table  Attend  Chat  More│
└──────────────────────────────┘
```

**Bottom Nav Tabs per Role:**

| Role | Tab 1 | Tab 2 | Tab 3 | Tab 4 | Tab 5 |
|---|---|---|---|---|---|
| Admin | Dashboard | Students | Timetable | Fees | More |
| Teacher | Dashboard | Timetable | Attendance | Chat | More |
| Parent | Dashboard | Attendance | Timetable | Chat | More |

**"More" tab** expands to a full-screen menu with remaining items.

#### Tablet (640px – 1023px)

```
┌──────┬───────────────────────┐
│ ICON │ 🏫 CampusOS    🔔 👤 │  ← Top bar
├──────┤                       │
│  🏠  │                       │
│  👨‍🎓 │    [Page Content]     │  ← Collapsed icon sidebar (64px)
│  📅  │                       │
│  ✅  │                       │
│  💰  │                       │
│  💬  │                       │
│  ⚙️  │                       │
│      │                       │
└──────┴───────────────────────┘
```

#### Desktop (1024px+)

```
┌──────────────┬──────────────────────────────────────────┐
│              │ Dashboard              🔔 2   John ▾    │
│  🏫 CampusOS │                                          │
│              ├──────────────────────────────────────────│
│  🏠 Dashboard│                                          │
│  👨‍🎓 Students │    [Page Content — Max 1280px]           │
│  👩‍🏫 Teachers │                                          │
│  📅 Timetable│                                          │
│  ✅ Attendance│                                         │
│  💰 Fees     │                                          │
│  💬 Chat     │                                          │
│  📊 Reports  │                                          │
│  ⚙️ Settings │                                          │
│              │                                          │
│              │                                          │
│  ▸ Collapse  │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**Sidebar:** 256px expanded, 64px collapsed (icons only). Collapse toggle at bottom. Persistent on desktop.

### 14.3 Mobile Wireframe Descriptions

#### 14.3.1 Admin Dashboard (Mobile)

```
┌──────────────────────────────┐
│ 🏫 CampusOS         🔔 2  👤│
├──────────────────────────────┤
│ Good morning, Priya          │
│ Academic Year: 2026-27       │
├──────────────────────────────┤
│ ┌────────┐ ┌────────┐       │
│ │ 👨‍🎓 420  │ │ 👩‍🏫 32   │       │  ← Stats cards (2-col grid)
│ │Students │ │Teachers │       │
│ └────────┘ └────────┘       │
│ ┌────────┐ ┌────────┐       │
│ │ 💰 ₹2.4L│ │ ⚠️ 3    │       │
│ │Collected│ │Conflicts│       │
│ └────────┘ └────────┘       │
├──────────────────────────────┤
│ ⚡ Quick Actions              │
│ ┌──────────────────────────┐ │
│ │ + Add Student             │ │
│ │ + Create Timetable        │ │
│ │ + Record Payment          │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 📢 Recent Notifications     │
│ ┌──────────────────────────┐ │
│ │ 🔴 Fee overdue: Class 5-A│ │
│ │ 🟡 Timetable conflict    │ │
│ │ 🟢 New student enrolled  │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  🏠    👨‍🎓    📅    💰    ⋯  │
└──────────────────────────────┘
```

#### 14.3.2 Teacher Attendance (Mobile)

```
┌──────────────────────────────┐
│ ← Attendance       Period 3  │
├──────────────────────────────┤
│ Class 8-A | Mathematics      │
│ Monday, April 13, 2026       │
├──────────────────────────────┤
│ 38 of 40 present │ [Select All]│
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ 👤 Arun Kumar       🟢 P │ │  ← 48px row height
│ ├──────────────────────────┤ │
│ │ 👤 Divya Sharma      🟢 P│ │     Tap to toggle P/A
│ ├──────────────────────────┤ │
│ │ 👤 Karthik R.        🔴 A│ │  ← Red = Absent
│ ├──────────────────────────┤ │
│ │ 👤 Lakshmi S.        🟢 P│ │
│ ├──────────────────────────┤ │
│ │ 👤 Mohammed Irfan    🔴 A│ │
│ ├──────────────────────────┤ │
│ │ ...                       │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │    ✅ Submit Attendance │  │  ← Sticky bottom button
│  └────────────────────────┘  │
├──────────────────────────────┤
│  🏠    📅    ✅    💬    ⋯  │
└──────────────────────────────┘
```

#### 14.3.3 Parent Dashboard (Mobile)

```
┌──────────────────────────────┐
│ 🏫 CampusOS         🔔 1  👤│
├──────────────────────────────┤
│ 👦 Arjun  │  👧 Priya       │  ← Child selector (pills)
│ Class 5-A  │  Class 3-B      │
├──────────────────────────────┤
│ Today's Attendance           │
│ ┌──────────────────────────┐ │
│ │ 🟢 Present — All periods │ │
│ │ P1 ● P2 ● P3 ● P4 ● P5 │ │  ← Period-wise dots
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 📝 Pending Assignments       │
│ ┌──────────────────────────┐ │
│ │ Mathematics Worksheet     │ │
│ │ Due: April 15 (2 days)   │ │
│ ├──────────────────────────┤ │
│ │ English Essay             │ │
│ │ Due: April 18 (5 days)   │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 💰 Fee Status               │
│ ┌──────────────────────────┐ │
│ │ Term 2: ₹12,500 due      │ │
│ │ Due: April 30             │ │
│ │ [View Details →]          │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  🏠    ✅    📅    💬    ⋯  │
└──────────────────────────────┘
```

### 14.4 Responsive Layout Strategy

#### Data Tables → Cards Pattern

**Desktop (≥ 1024px):** Traditional sortable data table.
```
| Name          | Class | Admission # | Fee Status | Actions    |
|---------------|-------|-------------|------------|------------|
| Arun Kumar    | 5-A   | CAMPUS-001  | ✅ Paid     | Edit | Del|
| Divya Sharma  | 5-A   | CAMPUS-002  | ⚠️ Partial  | Edit | Del|
```

**Mobile (< 640px):** Stacked list cards.
```
┌──────────────────────────────┐
│ 👤 Arun Kumar                │
│ Class 5-A | CAMPUS-001       │
│ Fee: ✅ Paid                  │
│                    [⋮ Menu]  │
├──────────────────────────────┤
│ 👤 Divya Sharma              │
│ Class 5-A | CAMPUS-002       │
│ Fee: ⚠️ Partial               │
│                    [⋮ Menu]  │
└──────────────────────────────┘
```

#### Timetable Responsive Strategy

**Desktop:** Full week grid (5–6 columns).
**Tablet:** 3-day view with horizontal scroll.
**Mobile:** Single-day timeline (swipe to change day).

#### Forms Responsive Strategy

**Desktop:** 2-column forms with side-by-side fields.
**Tablet:** 2-column forms, reduced padding.
**Mobile:** Single-column stack, full-width inputs.

### 14.5 Performance Budget (Mobile)

| Resource | Budget | Strategy |
|---|---|---|
| HTML | < 14KB | Above-the-fold content in initial HTML |
| CSS | < 50KB (gzipped) | Critical CSS inlined, rest async |
| JavaScript | < 100KB (gzipped, initial) | Code splitting by route. No heavy libs on initial load |
| Images | < 200KB (above fold) | WebP, lazy loading, responsive srcset |
| Fonts | < 60KB | 2 weights of Inter, font-display: swap |
| Total Initial Bundle | < 250KB (gzipped) | Target for 3G: < 3s load |

### 14.6 Offline Strategy

| Feature | Offline Behavior |
|---|---|
| Dashboard | Cached data shown with "Last updated" timestamp |
| Attendance Marking | Queued locally, synced when online. "Pending sync" indicator |
| Chat | Read cached messages. New messages queued |
| Timetable | Fully cached, available offline |
| File Downloads | Previously viewed files available from cache |

---

## 15. Dashboard UX Layouts

### 15.1 Admin Dashboard

#### Desktop Layout (3-Column Grid)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Row 1: Stats Cards (4-column grid)                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐              │
│ │ 👨‍🎓 420    │ │ 👩‍🏫 32     │ │ 📊 92.3%  │ │ 💰 ₹18.4L     │              │
│ │ Total    │ │ Total    │ │ Avg      │ │ Total Fee     │              │
│ │ Students │ │ Teachers │ │ Attend.  │ │ Collected     │              │
│ └──────────┘ └──────────┘ └──────────┘ └──────────────┘              │
├────────────────────────────────────────────────────────────────────────┤
│ Row 2: Two-column layout                                               │
│ ┌───────────────────────────┐ ┌──────────────────────────┐            │
│ │ 📊 Attendance Trend        │ │ ⚡ Quick Actions          │            │
│ │ (Line chart — 7 day view) │ │                          │            │
│ │                           │ │ [+ Add Student]          │            │
│ │ ~~~~/\~~~~~/\~~~          │ │ [+ Create Timetable]     │            │
│ │                           │ │ [+ Record Payment]       │            │
│ │                           │ │ [+ Send Notification]    │            │
│ └───────────────────────────┘ └──────────────────────────┘            │
├────────────────────────────────────────────────────────────────────────┤
│ Row 3: Two-column layout                                               │
│ ┌───────────────────────────┐ ┌──────────────────────────┐            │
│ │ 💰 Fee Collection          │ │ 📢 Recent Activity       │            │
│ │ (Bar chart — class-wise)  │ │                          │            │
│ │                           │ │ • New student enrolled   │            │
│ │ ██  ██  ██  ██  ██       │ │ • Timetable published    │            │
│ │ 5A  5B  6A  6B  7A       │ │ • Fee payment received   │            │
│ │                           │ │ • Teacher marked leave   │            │
│ └───────────────────────────┘ └──────────────────────────┘            │
└────────────────────────────────────────────────────────────────────────┘
```

### 15.2 Teacher Dashboard

#### Mobile Layout (Single Column)

```
┌──────────────────────────────┐
│ Good morning, Rajesh 👋      │
│ You have 5 classes today     │
├──────────────────────────────┤
│ ⏰ Current Period            │
│ ┌──────────────────────────┐ │
│ │ Period 3 (10:20 - 11:05) │ │  ← Highlighted card
│ │ Mathematics — Class 10-A │ │
│ │                          │ │
│ │ [Mark Attendance]        │ │  ← Primary CTA
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ ⏭️ Up Next                   │
│ ┌──────────────────────────┐ │
│ │ Period 4 (11:05 - 11:50) │ │  ← Muted card
│ │ Mathematics — Class 8-B  │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 📋 Pending Actions           │
│ ┌──────────────────────────┐ │
│ │ ⚠️ 2 attendances pending  │ │
│ │ Period 1 — Class 8-A     │ │
│ │ Period 2 — Class 9-B     │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 💬 Unread Messages: 3       │
│ ┌──────────────────────────┐ │
│ │ Meena (Arjun's parent)   │ │
│ │ "Could you share..."     │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  🏠    📅    ✅    💬    ⋯  │
└──────────────────────────────┘
```

### 15.3 Parent Dashboard

#### Mobile Layout (Child-Centric)

```
┌──────────────────────────────┐
│ 🏫 CampusOS         🔔 1  👤│
├──────────────────────────────┤
│ [👦 Arjun ●] [👧 Priya    ] │  ← Child selector pills
├──────────────────────────────┤
│ 📊 Arjun's Summary          │
│ ┌────────┐ ┌────────┐       │
│ │ ✅ 94%  │ │ 📝 B+   │       │
│ │Attend. │ │ Avg.   │       │
│ │this mo.│ │ Grade  │       │
│ └────────┘ └────────┘       │
├──────────────────────────────┤
│ Today                        │
│ ┌──────────────────────────┐ │
│ │ 🟢 Present — 5/5 periods │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 📝 Due Soon                  │
│ ┌──────────────────────────┐ │
│ │ Math Worksheet            │ │
│ │ 📅 Due Apr 15 | 🔴 2 days │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ 💰 Fees                      │
│ ┌──────────────────────────┐ │
│ │ ₹12,500 pending           │ │
│ │ Term 2 | Due Apr 30      │ │
│ │ [View Details]            │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  🏠    ✅    📅    💬    ⋯  │
└──────────────────────────────┘
```

### 15.4 Dashboard Charts & Visualizations

| Chart | Type | Data Source | Refresh |
|---|---|---|---|
| Attendance Trend | Line chart (lightweight, <5KB lib) | Last 7/30 days attendance % | Daily |
| Fee Collection | Horizontal bar chart | Class-wise collection vs target | Real-time |
| Student Distribution | Donut chart | Class-wise student count | On page load |
| Grade Distribution | Bar chart | Subject-wise average marks | After exam publish |

**Chart Library:** Lightweight custom SVG or Recharts (< 40KB gzipped tree-shaken). No heavy libraries like Chart.js or D3 for mobile performance.

---

## 16. Security Rules (Firebase RBAC)

### 16.1 Firebase Auth Custom Claims

```javascript
// Set on user creation via Cloud Function
admin.auth().setCustomUserClaims(uid, {
  role: 'admin' | 'teacher' | 'parent',
  schoolId: 'school_abc123',
  teacherId: 'teacher_xyz' // only for teachers
});
```

### 16.2 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function getRole() {
      return request.auth.token.role;
    }

    function getSchoolId() {
      return request.auth.token.schoolId;
    }

    function isAdmin() {
      return getRole() == 'admin';
    }

    function isTeacher() {
      return getRole() == 'teacher';
    }

    function isParent() {
      return getRole() == 'parent';
    }

    function belongsToSchool(schoolId) {
      return getSchoolId() == schoolId;
    }

    // ---- SCHOOL ----
    match /schools/{schoolId} {
      allow read: if isAuthenticated() && belongsToSchool(schoolId);
      allow write: if isAuthenticated() && isAdmin() && belongsToSchool(schoolId);

      // ---- USERS ----
      match /users/{userId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow create: if isAdmin() && belongsToSchool(schoolId);
        allow update: if isAdmin() && belongsToSchool(schoolId)
                      || request.auth.uid == userId;
        allow delete: if isAdmin() && belongsToSchool(schoolId);
      }

      // ---- STUDENTS ----
      match /students/{studentId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow create, update: if isAdmin() && belongsToSchool(schoolId);
        allow delete: if isAdmin() && belongsToSchool(schoolId);
      }

      // ---- TEACHERS ----
      match /teachers/{teacherId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow create, delete: if isAdmin() && belongsToSchool(schoolId);
        allow update: if isAdmin() && belongsToSchool(schoolId)
                      || (isTeacher()
                          && request.auth.token.teacherId == teacherId);
      }

      // ---- CLASSES ----
      match /classes/{classId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow write: if isAdmin() && belongsToSchool(schoolId);
      }

      // ---- TIMETABLES ----
      match /timetables/{timetableId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow write: if isAdmin() && belongsToSchool(schoolId);
      }

      // ---- ATTENDANCE ----
      match /attendance/{attendanceId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow create: if isTeacher() && belongsToSchool(schoolId);
        allow update: if (isTeacher() && belongsToSchool(schoolId))
                      || (isAdmin() && belongsToSchool(schoolId));
      }

      // ---- MARKS ----
      match /marks/{marksId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow create, update: if isTeacher() && belongsToSchool(schoolId);
        allow delete: if isAdmin() && belongsToSchool(schoolId);
      }

      // ---- ASSIGNMENTS ----
      match /assignments/{assignmentId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow create, update: if isTeacher() && belongsToSchool(schoolId);
        allow delete: if (isTeacher() && belongsToSchool(schoolId))
                      || (isAdmin() && belongsToSchool(schoolId));
      }

      // ---- MATERIALS ----
      match /materials/{materialId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow create, update: if isTeacher() && belongsToSchool(schoolId);
        allow delete: if (isTeacher() && belongsToSchool(schoolId))
                      || (isAdmin() && belongsToSchool(schoolId));
      }

      // ---- FEES ----
      match /fees/{feeId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow write: if isAdmin() && belongsToSchool(schoolId);
      }

      // ---- CHATS ----
      match /chats/{chatId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId)
                    && (isAdmin()
                        || request.auth.uid in resource.data.participants);
        allow create: if isAuthenticated() && belongsToSchool(schoolId)
                      && request.auth.uid in request.resource.data.participants;
        allow update: if isAuthenticated() && belongsToSchool(schoolId)
                      && request.auth.uid in resource.data.participants;

        match /messages/{messageId} {
          allow read: if isAuthenticated() && belongsToSchool(schoolId)
                      && request.auth.uid in
                         get(/databases/$(database)/documents/schools/$(schoolId)/chats/$(chatId)).data.participants;
          allow create: if isAuthenticated() && belongsToSchool(schoolId)
                        && request.auth.uid == request.resource.data.senderId;
        }
      }

      // ---- NOTIFICATIONS ----
      match /notifications/{notificationId} {
        allow read: if isAuthenticated() && belongsToSchool(schoolId);
        allow create: if isAdmin() && belongsToSchool(schoolId)
                      || isTeacher() && belongsToSchool(schoolId);
        allow update: if isAuthenticated() && belongsToSchool(schoolId);
      }
    }
  }
}
```

### 16.3 Firebase Storage Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /schools/{schoolId}/{allPaths=**} {
      allow read: if request.auth != null
                  && request.auth.token.schoolId == schoolId;

      allow write: if request.auth != null
                   && request.auth.token.schoolId == schoolId
                   && (request.auth.token.role == 'admin'
                       || request.auth.token.role == 'teacher')
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches(
                        'image/.*|application/pdf|application/vnd.*');
    }
  }
}
```

---

## 17. Edge Cases

### 17.1 Teacher Unavailability

| Scenario | System Behavior |
|---|---|
| Teacher marks themselves unavailable for a slot that already has a timetable entry | System shows warning to admin. Slot appears with ⚠️ indicator. Admin must reassign or find substitute. |
| Teacher goes on long leave (multi-day) | Admin uses "Substitute Management" to assign a replacement teacher for the duration. Original teacher's timetable preserved but marked inactive. |
| No available teacher for a required subject-slot combination | System displays "No available teachers" with suggestion to adjust timetable or make a teacher available. Cannot publish with unresolved gaps. |
| Teacher is deleted/archived while assigned to timetable | Cloud Function detects this and creates admin notification: "Teacher removed — timetable requires update." Timetable status changes to 'draft'. |

### 17.2 Schedule Conflicts

| Scenario | System Behavior |
|---|---|
| Admin assigns same teacher to two classes in same period | Real-time validation prevents save. Inline error: "Mr. Kumar is already assigned to Class 8-A in this slot." |
| Two admins editing timetables simultaneously | Firestore transactions ensure atomic updates. Second write fails with "Timetable was updated by another admin. Please refresh." |
| Timetable published with a conflict somehow | Post-publish validation Cloud Function runs. If conflict detected, admin is notified and timetable status set to 'needs_review'. |
| School adds a new section mid-year | New section has no timetable. Admin dashboard shows "1 section without timetable" alert. |
| Period timings changed after timetable published | All timetables retain existing slot assignments. Timings update applies to display only. No data loss. |

### 17.3 Student Reassignment

| Scenario | System Behavior |
|---|---|
| Student moves from Section A to Section B | Admin triggers "Transfer." Old attendance and marks records are preserved with original section stamp. New attendance/marks start in new section. Parent's timetable view updates immediately. |
| Student moves to a different class | Same as above + fee structure may change. Admin prompted: "Apply new fee structure? Pending fees will carry over." |
| Two students with the same name in same section | System uses admission number as unique identifier. UI shows name + admission number in lists. |
| Parent linked to student in two different schools | Each school is a separate tenant. Parent has separate accounts per school. Multi-school support is future scope. |
| Student archived but teacher tries to mark attendance | Archived students do not appear in attendance lists. Previously submitted attendance records are preserved. |
| All students removed from a section | Section shows "No students enrolled" message. Timetable and teacher assignment remain valid but attendance marking shows empty list. |

### 17.4 Fee Edge Cases

| Scenario | System Behavior |
|---|---|
| Overpayment recorded | System shows positive balance. Admin can apply credit to next installment. |
| Mid-year admission | Fee is prorated based on joining date. Admin can manually adjust. |
| Fee structure changed after payments started | Existing payments unchanged. New structure applies to unpaid amounts. Admin gets confirmation dialog. |
| Duplicate payment attempted | System checks for duplicate reference numbers (same amount + date + reference). Warning shown: "Similar payment found. Continue?" |

### 17.5 Chat Edge Cases

| Scenario | System Behavior |
|---|---|
| Teacher sends message to a parent whose child is archived | Chat remains accessible for history, but new messages are blocked with message: "This student is no longer active." |
| Parent sends message to a teacher no longer at the school | Message is blocked. "This teacher is no longer available." Old chat history remains accessible in read-only mode. |
| File upload fails mid-chat | Retry mechanism with exponential backoff. "Failed to send attachment. Tap to retry." |

---

## 18. Deployment Strategy

### 18.1 Environment Setup

| Environment | Purpose | Firebase Project | URL |
|---|---|---|---|
| Development | Local development + testing | `campusos-dev` | `localhost:3000` |
| Staging | QA testing, UAT | `campusos-staging` | `staging.campusos.app` |
| Production | Live users | `campusos-prod` | `app.campusos.app` |

### 18.2 CI/CD Pipeline

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Developer │───▶│ GitHub PR    │───▶│ CI Pipeline  │───▶│ Staging      │
│ pushes    │    │ created      │    │ (GitHub      │    │ Deploy       │
│ to branch │    │              │    │  Actions)    │    │              │
└──────────┘    └──────────────┘    └──────┬───────┘    └──────┬───────┘
                                           │                   │
                                    ┌──────┴───────┐    ┌──────┴───────┐
                                    │ • Lint        │    │ QA Testing   │
                                    │ • Type Check  │    │ + Approval   │
                                    │ • Unit Tests  │    │              │
                                    │ • Build       │    └──────┬───────┘
                                    │ • Lighthouse  │           │
                                    └──────────────┘    ┌──────┴───────┐
                                                        │ Production   │
                                                        │ Deploy       │
                                                        │ (manual      │
                                                        │  approval)   │
                                                        └──────────────┘
```

### 18.3 Deployment Checklist

| Step | Action | Tool |
|---|---|---|
| 1 | Run lint and type checks | `npm run lint && npm run type-check` |
| 2 | Run unit tests | `npm run test` |
| 3 | Build production bundle | `npm run build` |
| 4 | Verify bundle size < 250KB | Webpack Bundle Analyzer |
| 5 | Run Lighthouse audit (mobile) | Lighthouse CI (score > 90) |
| 6 | Deploy Firestore rules | `firebase deploy --only firestore:rules` |
| 7 | Deploy Cloud Functions | `firebase deploy --only functions` |
| 8 | Deploy Storage rules | `firebase deploy --only storage` |
| 9 | Deploy Next.js to Firebase Hosting | `firebase deploy --only hosting` |
| 10 | Verify deployment health | Smoke tests on staging URL |
| 11 | Promote to production | Manual approval + `firebase deploy --project prod` |

### 18.4 Monitoring & Observability

| Tool | Purpose |
|---|---|
| Firebase Performance Monitoring | Page load times, API latency, custom traces |
| Firebase Crashlytics | Runtime errors, crash reports |
| Google Analytics (Firebase) | User engagement, screen views, events |
| Firebase Remote Config | Feature flags, gradual rollout |
| Uptime Robot (external) | Availability monitoring, alerting |
| Sentry (optional) | Detailed error tracking with source maps |

---

## 19. Future Scope

> **IMPORTANT:** All future features are non-AI. The product roadmap explicitly excludes AI/ML features, AI chat analysis, AI-based monitoring, or any AI-powered functionality.

### Phase 2 (Months 7–12)

| Feature | Description |
|---|---|
| **Online Fee Payment** | Razorpay/Stripe integration. Parents pay directly from app. Auto-reconciliation. |
| **Exam Management** | Exam scheduling, hall ticket generation, seating arrangement, result publication pipeline. |
| **Library Management** | Book catalog, issue/return tracking, fine calculation, student reading history. |
| **Transport Management** | Route planning, vehicle tracking (GPS), pickup/drop alerts to parents. |
| **Report Card Generator** | Configurable report card templates with school branding, bulk PDF generation. |
| **Multi-Language** | UI translations: Hindi, Tamil, Telugu, Kannada, Malayalam (i18n framework). |

### Phase 3 (Months 13–18)

| Feature | Description |
|---|---|
| **Multi-Campus Support** | Parent organization → multiple schools. Cross-campus reporting. Unified admin. |
| **Calendar & Events** | School calendar, event management, RSVP, holiday management integration with timetable. |
| **Visitor Management** | Gate pass system. Visitor logging. Parent visit scheduling. |
| **Inventory Management** | School supplies, lab equipment tracking. Purchase orders. |
| **Staff HR Module** | Teacher payroll, leave management, appraisal tracking. |
| **Custom Forms Builder** | Admins create custom data collection forms (surveys, consent, health declarations). |

### Phase 4 (Months 19–24)

| Feature | Description |
|---|---|
| **Native Mobile App** | React Native or Flutter app for Android and iOS. Offline-first architecture. |
| **Parent Portal Extensions** | School circular archive, photo gallery, achievement showcase. |
| **API Marketplace** | Public API for integrations with third-party school tools (ERP, LMS). |
| **White-Label Solution** | Custom branding: logo, colors, domain. B2B offering for school chains. |
| **Advanced Reporting** | Custom report builder (drag-and-drop), scheduled report delivery, trend analysis. |
| **Audit Log** | Complete activity log for compliance. Who did what, when, where. |

---

## 20. Development Roadmap

### Phase 1: Foundation (Weeks 1–4)

| Week | Deliverables |
|---|---|
| **Week 1** | Project setup (Next.js, Firebase, TypeScript, ESLint). Design system CSS tokens. Auth flow (login, RBAC redirect). Layout components (sidebar, bottom nav, header). |
| **Week 2** | Admin: School settings. Class/section CRUD. Subject configuration. Firestore schema + security rules (v1). |
| **Week 3** | Admin: Student CRUD. Parent account creation & linking. Student profile view. Search & filter. |
| **Week 4** | Admin: Teacher CRUD. Subject assignment. Class-teacher mapping. Teacher profile. |

### Phase 2: Core Features (Weeks 5–8)

| Week | Deliverables |
|---|---|
| **Week 5** | Timetable engine: Grid editor. Teacher availability. Slot assignment. Conflict detection (Pass 1 & 2). |
| **Week 6** | Timetable engine: Full validation. Publish flow. Version management. Teacher & Parent timetable views. |
| **Week 7** | Attendance: Quick-mark UI. Period-wise recording. Attendance history (calendar view). Absence notifications. |
| **Week 8** | Marks: Exam type config. Mark entry. Auto-grading. Report card generation (basic). |

### Phase 3: Communication & Fees (Weeks 9–12)

| Week | Deliverables |
|---|---|
| **Week 9** | Chat system: Teacher ↔ Parent DM. Real-time messaging. Unread badges. Admin broadcast. |
| **Week 10** | Fee management: Fee structure creation. Payment recording. Receipt PDF. Fee ledger per student. |
| **Week 11** | Notifications: In-app notification center. Fee reminders (Cloud Function). Timetable change alerts. Attendance alerts. |
| **Week 12** | Parent portal: Child dashboard. Attendance view. Timetable view. Marks view. Assignments view. Fee view. Multi-child selector. |

### Phase 4: Polish & Launch (Weeks 13–16)

| Week | Deliverables |
|---|---|
| **Week 13** | Assignments & materials: Teacher upload flow. Parent download. File management. |
| **Week 14** | Reports: Attendance reports. Fee collection reports. Student strength. Export to PDF/CSV. |
| **Week 15** | Performance optimization: Bundle analysis. Lighthouse audit. Image optimization. Skeleton states. Offline caching (Service Worker). |
| **Week 16** | QA: Cross-browser testing (Chrome, Safari, Firefox). Mobile device testing (low-end Android). Security audit. Staging deployment. UAT with pilot school. |

### Milestone Summary

| Milestone | Week | Deliverable |
|---|---|---|
| 🟢 M1: Auth + Setup | 1 | Users can log in and see role-based dashboards |
| 🟢 M2: Data Foundation | 4 | Students, Teachers, Classes fully manageable |
| 🟡 M3: Scheduling | 6 | Timetable creation with conflict detection |
| 🟡 M4: Academic Core | 8 | Attendance + Marks operational |
| 🔵 M5: Communication | 9 | Teacher-Parent chat live |
| 🔵 M6: Fee System | 10 | Fee management operational |
| 🟣 M7: Parent Portal | 12 | Parents can view all child data |
| 🟤 M8: Beta Launch | 16 | Feature-complete, performance-optimized, pilot school onboarded |

### Team Requirements

| Role | Count | Responsibilities |
|---|---|---|
| Full-Stack Dev (Next.js + Firebase) | 2 | Core features, API, Cloud Functions |
| Frontend Dev (React) | 1 | UI components, responsive design, animations |
| UI/UX Designer | 1 | Design system, wireframes, prototypes |
| QA Engineer | 1 | Testing, edge cases, cross-device |
| Product Manager | 1 (part-time) | Requirements, prioritization, user research |
| **Total** | **5–6** | |

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **Academic Year** | The school year period (e.g., 2026–27), typically April–March in India |
| **Section** | A subdivision of a class (e.g., Class 5-A, Class 5-B) |
| **Period** | A single time slot in the timetable (typically 45 minutes) |
| **Slot** | A unique combination of Day + Period (e.g., Monday Period 3) |
| **Class Teacher** | The primary teacher responsible for a section |
| **Subject Teacher** | A teacher assigned to teach a specific subject in a section |
| **Timetable Version** | A snapshot of the timetable at a point in time |
| **Custom Claims** | Firebase Auth metadata attached to a user token (role, schoolId) |
| **Denormalization** | Duplicating data across collections to reduce read operations |
| **FCM** | Firebase Cloud Messaging — push notification service |
| **PWA** | Progressive Web App — web app with native-like capabilities |

## Appendix B: Reference Products

| Product | Relevance | What We Learn |
|---|---|---|
| Zoho Schools | Full-featured school ERP | Feature coverage, module organization |
| ERPNext Education | Open-source school module | Data model, scheduling approach |
| Teachmint | Mobile-first school app (India) | UX patterns for Indian schools, parent engagement |
| Google Classroom | Assignment + communication | Simple teacher-student interaction model |
| Notion | SaaS UX | Clean design, keyboard shortcuts, responsive layout |
| Linear | SaaS UX | Speed, keyboard-first, minimal UI |

---

*End of Document*

**Document Version History:**

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | April 13, 2026 | Product & Engineering Team | Initial release |
