# Taskiye - Database Schema & Backend API Contracts

## Data Schemas

### 1. User

- `name`: String (Required, trimmed)
- `username`: String (Unique, sparse, lowercase, trimmed)
- `email`: String (Unique, sparse, lowercase, trimmed)
- `avatarUrl`: String (Default: empty string, targets Vercel Blob)
- `passwordHash`: String (Selected: false)
- `googleId`: String (Unique, sparse)
- `isVerified`: Boolean (Default: false)
- `timestamps`: CreatedAt, UpdatedAt

### 2. Habit

- `userId`: Reference to User (Default: null for guest mode, indexed)
- `title`: String (Required, trimmed)
- `frequency`: String (Default: 'daily')
- `isArchived`: Boolean (Default: false)
- `timestamps`: CreatedAt, UpdatedAt

### 3. Task

- `userId`: Reference to User (Default: null for guest mode, indexed)
- `title`: String (Required, trimmed)
- `date`: Date (Required, indexed)
- `isCompleted`: Boolean (Default: false)
- `isHabitInstance`: Boolean (Default: false)
- `habitId`: Reference to Habit (Default: null)
- `sortOrder`: Number (Default: 0)
- `timestamps`: CreatedAt, UpdatedAt

### 4. Goal

- `userId`: Reference to User (Default: null for guest mode, indexed)
- `title`: String (Required, trimmed)
- `deadline`: Date (Required)
- `targetType`: String (Allowed values: 'weekly', 'yearly', 'custom', required)
- `isCompleted`: Boolean (Default: false)
- `timestamps`: CreatedAt, UpdatedAt

---

## Express API Routes & Endpoint Matrix

### Auth & User Management (`/api/auth` & `/api/users`)

- `POST /api/auth/register` - Create user account
- `POST /api/auth/login` - Authenticate with email/password
- `POST /api/auth/google` - Google OAuth / OTP verification
- `GET  /api/auth/me` - Fetch active session profile
- `POST /api/users/avatar` - Upload profile avatar via Vercel Blob (Auth required)

### Habits Management (`/api/habits`)

- `GET  /api/habits` - Fetch active habits
- `POST /api/habits` - Create habit (Auth required)
- `DELETE /api/habits/:id` - Soft-delete/archive habit (Auth required)

### Daily Tasks Engine (`/api/tasks`)

- `GET  /api/tasks?date=YYYY-MM-DD` - Fetch tasks and habit instances for given day
- `POST /api/tasks` - Create one-off task
- `PATCH /api/tasks/:id` - Toggle completion status / reorder
- `DELETE /api/tasks/:id` - Delete task (Auth required)

### Goals Tracker (`/api/goals`)

- `GET  /api/goals` - List active goals
- `POST /api/goals` - Create long-term goal
- `PATCH /api/goals/:id` - Toggle goal state / update target
- `DELETE /api/goals/:id` - Delete goal (Auth required)
