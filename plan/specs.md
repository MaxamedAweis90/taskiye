# Taskiye - Product Specifications (V1 MVP)

## 1. System Overview

- **App Name:** Taskiye
- **Core Value Proposition:** Daily task and habit management platform with goal tracking, interactive heatmap visualization, and deferred user authentication.
- **Architecture:** Monorepo with React + Vite frontend, Node.js + Express backend, and MongoDB (Mongoose) database.
- **Deployment Target:** Frontend deployed on Vercel; Backend deployed on Railway.

---

## 2. Core Functional Requirements

### A. Habits Engine

- Habits are defined and managed strictly in the **Settings / Preferences** section.
- Active habits automatically generate daily task instances for current and upcoming dates.
- **Immutability:** Habit instances appearing on the daily board or future dates **cannot** be deleted directly from today/future task views. They can only be removed or disabled via Settings.

### B. Tasks Engine

- Supports one-off daily tasks assigned to specific dates (Today, Tomorrow, Future).
- Flexible list management: Users can drag-and-drop or reorder both one-off tasks and injected habit items together.
- One-off tasks can be created, edited, and marked complete directly on daily views.

### C. Goals Engine

- Objectives distinct from daily tasks and habits.
- Targets are bound to strict deadlines (Weekly, Yearly, or Custom Future Date).
- Dedicated management view for tracking long-term progress.

### D. Layout & Dashboard Heatmap

- **Layout Structure:** Persistent left sidebar and top navigation bar inspired by reference wireframes.
- **Calendar Heatmap:** Visual representation of daily task completion percentages:
  - **Default / Gray:** 0% – 10% completed
  - **Faded Yellow:** 11% – 50% completed
  - **Medium Yellow:** 51% – 99% completed
  - **Solid Bright Yellow:** 100% completed

### E. Soft / Deferred Authentication Flow

- Unauthenticated guest access allowed by default with local persistence.
- **Auth Triggers (Prompts registration/login screen):**
  1. User attempts to delete a task or habit.
  2. User reaches 100 total local items (tasks/habits combined).
  3. User attempts to save global habits in Settings/Preferences.
- **Supported Auth Providers:** Email/Password, Google OAuth, and OTP verification (for Google/email validation).

---

## 3. Core Data Schemas (Mongoose / MongoDB)

### User Schema (`users`)

- `_id`: ObjectId
- `email`: String (Unique, Sparse)
- `passwordHash`: String (Optional for OAuth users)
- `googleId`: String (Optional)
- `isVerified`: Boolean (Default: false)
- `createdAt`: Timestamp

### Habit Schema (`habits`)

- `_id`: ObjectId
- `userId`: ObjectId (Ref: User, Nullable for local guest items)
- `title`: String (Required)
- `frequency`: String (e.g., 'daily')
- `isArchived`: Boolean (Default: false)
- `createdAt`: Timestamp

### Task Schema (`tasks`)

- `_id`: ObjectId
- `userId`: ObjectId (Ref: User, Nullable for local guest items)
- `title`: String (Required)
- `date`: Date (Required)
- `isCompleted`: Boolean (Default: false)
- `isHabitInstance`: Boolean (Default: false)
- `habitId`: ObjectId (Ref: Habit, Nullable)
- `sortOrder`: Number (Default: 0)
- `createdAt`: Timestamp

### Goal Schema (`goals`)

- `_id`: ObjectId
- `userId`: ObjectId (Ref: User, Nullable for local guest items)
- `title`: String (Required)
- `deadline`: Date (Required)
- `targetType`: String (Enum: ['weekly', 'yearly', 'custom'])
- `isCompleted`: Boolean (Default: false)
- `createdAt`: Timestamp
