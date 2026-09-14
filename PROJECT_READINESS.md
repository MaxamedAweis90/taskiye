# Taskiye — Production Project Readiness & Architecture Guide

This document provides a comprehensive operational guide, architectural breakdown, production deployment topology, and post-launch maintenance checklist for **Taskiye** — a daily habit, checklist task, and streak heatmap tracking application.

---

## 1. System Architecture Overview

```mermaid
graph TD
  User((Client Browser / Mobile PWA))
  
  subgraph Frontend ["Frontend (Vercel SPA)"]
    SW[Service Worker / Cache Storage]
    Zustand[Zustand Local Store (localStorage)]
    ReactApp[React 19 + TanStack Query]
    VercelEdge[Vercel Edge Proxy (/api/*)]
  end

  subgraph Backend ["Backend (Vercel Serverless / Express)"]
    BetterAuth[Better Auth Engine]
    ExpressRouter[Express REST API]
    MongoConn[Mongoose & MongoClient Pool]
  end

  subgraph CloudData ["Cloud Storage & Database"]
    MongoDB[(MongoDB Atlas)]
    VercelBlob[(Vercel Blob Storage)]
  end

  User --> SW
  SW --> ReactApp
  ReactApp <--> Zustand
  ReactApp -->|/api/* Requests| VercelEdge
  VercelEdge -->|1st-Party Edge Rewrite| ExpressRouter
  ExpressRouter --> BetterAuth
  ExpressRouter --> MongoConn
  MongoConn --> MongoDB
  ExpressRouter --> VercelBlob
```

### A. Pages & User Interface
- **Overview / Dashboard (`/`)**:
  - **Dynamic Midnight Date Engine**: Instantly updates daily focus at midnight without requiring manual browser refreshes (`useMidnightRollover`).
  - **Daily Checklist**: Interactive tasks with strike-through animations, instant optimistic updates, and habit-projection sync.
  - **Consistency Heatmap Matrix**: 12-month historical completion matrix mapping productivity density dynamically.
  - **Streak Pill & Dynamic Greeting**: Personalized header greeting reacting to time-of-day and current user profile.
- **Habits (`/habits`)**:
  - Full lifecycle habit tracker (Active, Archived, Custom Frequency).
  - Drag-to-archive / drag-to-reorder gesture zones with zero layout shifts.
  - Quick action status toggles, cadence configuration, and streak freeze safeguards.
- **Tasks (`/tasks`) & Goals (`/goals`)**:
  - Specialized views for long-term objectives and categorized action items.

---

### B. Habit Engine & Streak Calculations
1. **Cadence Types**: Supports Daily, Weekly, Custom Day schedules (`activeDays`).
2. **Streak Tracking**: Automatically calculates consecutive completed days while honoring frozen streak states (`isStreakFrozen`).
3. **Daily Habit Projection**: Active habits due on today's date automatically materialize into the Daily Checklist overview for seamless single-screen completion.
4. **Cascade Protection**: Deleting a habit cascades cleanly through its instance tasks, preventing orphan tasks or duplicate entries in the trash drive.

---

### C. 30-Day Soft-Delete Trash & Recovery Drive
- **Recovery Window**: Deleted tasks and habits receive a `deletedAt: Date` timestamp and move to the trash instead of being permanently dropped immediately.
- **MongoDB TTL Index**: Automatically prunes items older than 30 days (`expireAfterSeconds: 2592000`).
- **Google Drive-Style Trash Modal**: Full-screen modal with a left navigation sidebar for switching between "Tasks" and "Habits" folders, restore actions, and permanent wipe options.
- **Instant Reactive Restore**: Restoring an item immediately informs the global store and unsuppresses it from the active views without requiring a page reload.

---

### D. Cloud Data Migration (Guest to Account)
- **Local-First Capability**: Guests can use the entire app without logging in (up to a 100-item threshold).
- **Auto-Migration on Sign-Up**: When registering an account, the modal detects local guest data and offers one-click cloud backup.
- **Safe Cache Clearing**: The local cache (`taskiye-guest-storage`) is only purged after the server returns `200 OK` from `POST /api/sync`. If the network fails, local data is preserved.
- **Toast Notifications**: Floating glassmorphism toasts provide feedback and high-contrast "Undo" actions on destructive events.

---

### E. PWA & Offline Readiness
- **Web App Manifest (`client/public/manifest.webmanifest`)**:
  - Configures standalone display mode for iOS, Android, and Desktop.
  - Defines branded dark theme colors (`#0A0F1D`) and app shortcuts for "Today's Checklist" and "Habit Tracker".
- **Native High-Performance Service Worker (`client/public/sw.js`)**:
  - **Cache-First Strategy**: Pre-caches the core HTML app shell, CSS, JavaScript chunks, Plus Jakarta Sans web fonts, and brand assets.
  - **Network-First API Strategy**: Queries the server when online; gracefully falls back to local cache when offline.
  - **Zero Bundle Overhead**: Implemented using the native Web Cache API without heavy external dependencies.
  - **Full Offline Operation**: Combined with Zustand's `localStorage` persistence, users can open the app, mark checklist items, and review habits completely offline.

---

## 2. Production Deployment Topology & Environment Variables

### A. Deployment Architecture
- **Frontend App**: Deployed on Vercel as a single-page application (`client`).
- **Backend API**: Deployed as an Express Serverless Function on Vercel (`server`) or continuous container.
- **Vercel Edge Proxy (`vercel.json`)**: Transparently proxies `/api/*` requests to the backend server:
  - **Advantage**: Cookies are treated as **100% 1st-party** by browsers (`Domain=taskiye.vercel.app`), preventing Safari/Chrome third-party cookie blocking.
  - **Zero CORS Issues**: Avoids cross-origin failures.

---

### B. Environment Variables Reference

#### 1. Backend Server Environment Variables
Set these in your Backend hosting provider (e.g. Vercel Backend Project or Railway):

| Variable | Required | Example / Format | Purpose |
| :--- | :---: | :--- | :--- |
| `MONGODB_URI` | **Yes** | `mongodb+srv://user:pass@cluster.mongodb.net/taskiye?retryWrites=true&w=majority` | Primary MongoDB Atlas connection string |
| `BETTER_AUTH_SECRET` | **Yes** | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` (32+ chars) | Cryptographic secret for signing session tokens |
| `BETTER_AUTH_URL` | **Yes** | `https://taskiye.vercel.app` (or backend URL) | Base URL for auth callbacks and token verification |
| `CLIENT_URL` | **Yes** | `https://taskiye.vercel.app` | Allowed CORS origins (supports comma-separated list) |
| `BLOB_READ_WRITE_TOKEN` | Optional | `vercel_blob_rw_xxxx` | Vercel Blob access token for user avatar uploads |
| `PORT` | Optional | `5000` | Port for standalone server execution (auto-assigned in serverless) |
| `NODE_ENV` | Optional | `production` | Enables production optimizations and security rules |

#### 2. Frontend Client Environment Variables
Set these in your Frontend hosting provider (Vercel):

| Variable | Required | Example / Format | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | Optional | `https://taskiye-server.vercel.app` | Direct backend URL (falls back to same-domain proxy when using `vercel.json` rewrites) |

---

## 3. Post-Launch Maintenance & Operational Checklist

### 1. MongoDB Database Index Hygiene
Verify that the TTL and query compound indexes are active in production:
```javascript
// Verify indexes in mongosh:
db.tasks.getIndexes()
db.habits.getIndexes()

// Ensure TTL index exists for auto-pruning trash after 30 days:
db.tasks.createIndex({ "deletedAt": 1 }, { expireAfterSeconds: 2592000 })
db.habits.createIndex({ "deletedAt": 1 }, { expireAfterSeconds: 2592000 })
```

### 2. Service Worker Cache Versioning
When releasing breaking changes to static assets or layout templates:
- Increment `CACHE_NAME` in [client/public/sw.js](file:///c:/Users/HP/Desktop/WorkPlace/Dev_Place/Taskiye/client/public/sw.js) (e.g. from `taskiye-cache-v1` to `taskiye-cache-v2`).
- The active Service Worker will automatically purge the old cache on the next `activate` cycle.

### 3. Serverless Connection Pooling
- Mongoose and the native `MongoClient` instances are cached across hot lambdas.
- In [server/src/db/connection.ts](file:///c:/Users/HP/Desktop/WorkPlace/Dev_Place/Taskiye/server/src/db/connection.ts), the connection check (`readyState === 1`) prevents opening duplicate sockets on every function invocation.
- Ensure your MongoDB Atlas cluster has sufficient connection limits (M0 free tier allows up to 500 connections).

### 4. Client Storage Quota Checks
- Guest mode data is stored in `localStorage` under key `taskiye-guest-storage`.
- Total guest items are capped at 100 to prevent exceeding browser `localStorage` limits (typically 5MB).
- Once users convert to an account, local data is safely migrated to MongoDB and `localStorage` is cleared.

---

*Taskiye is fully tested, built with zero TypeScript compilation errors, and ready for production deployment.*
