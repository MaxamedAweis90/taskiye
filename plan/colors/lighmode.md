---
name: Kinetic Daylight
colors:
  surface: '#f8fafc'
  surface-dim: '#edf2f7'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ffffff'
  surface-container: '#f1f5f9'
  surface-container-high: '#e2e8f0'
  surface-container-highest: '#cbd5e1'
  on-surface: '#090d16'
  on-surface-variant: '#475569'
  inverse-surface: '#0f172a'
  inverse-on-surface: '#f8fafc'
  outline: '#cbd5e1'
  outline-variant: '#e2e8f0'
  surface-tint: '#d97706'
  primary: '#d97706'
  on-primary: '#ffffff'
  primary-container: '#fef3c7'
  on-primary-container: '#78350f'
  inverse-primary: '#ffb77d'
  secondary: '#059669'
  on-secondary: '#ffffff'
  secondary-container: '#d1fae5'
  on-secondary-container: '#064e3b'
  tertiary: '#7c3aed'
  on-tertiary: '#ffffff'
  tertiary-container: '#ede9fe'
  on-tertiary-container: '#4c1d95'
  error: '#e11d48'
  on-error: '#ffffff'
  error-container: '#ffe4e6'
  on-error-container: '#881337'
  primary-fixed: '#ffdcc3'
  primary-fixed-dim: '#ffb77d'
  on-primary-fixed: '#2f1500'
  on-primary-fixed-variant: '#6e3900'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#eaddff'
  tertiary-fixed-dim: '#d2bbff'
  on-tertiary-fixed: '#25005a'
  on-tertiary-fixed-variant: '#5a00c6'
  background: '#f8fafc'
  on-background: '#090d16'
  surface-variant: '#e0e3e5'
  primary-accent: '#f59e0b'
  secondary-accent: '#10b981'
  text-headings: '#090d16'
  text-body: '#0f172a'
  text-muted: '#64748b'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
  metric-val:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 32px
    letterSpacing: -0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 2rem
  margin: 1.5rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 2.5rem
  space-3xl: 3rem
---

## Brand & Style

Kinetic Daylight is the light-mode counterpart to Kinetic Midnight, tailored for sustained daylight productivity, habit mastery, and disciplined execution. It translates nocturnal focus into a clean, luminous, porcelain-and-slate environment where clarity, legibility, and vitality take precedence.

The aesthetic fuses **Precision Daylight Modernism** with subtle **Tonal Glassmorphism**. Warm porcelain and crisp slate-tinted white surfaces banish visual noise and fatigue during daytime work sessions. Kinetic amber and gold drive cognitive attention to high-value actions, streaks, and priorities, while vibrant emerald denotes momentum and completion. Surfaces feel like polished architectural paper: structured, crisp, ultra-legible, and balanced with soft diffused ambient shadows and calibrated slate borders.

## Colors

The daylight palette balances high contrast with warm neutrality. It anchors surfaces in airy slate whites and porcelain, employing a calibrated amber (`#d97706` / `#f59e0b`) optimized for WCAG AA/AAA legibility against bright backgrounds, paired with vibrant emerald and deep indigo-slate typography.

### Light & Dark Token Pairing Matrix

| Token Role | Kinetic Midnight (Dark) | Kinetic Daylight (Light) | Purpose & Usage |
| :--- | :--- | :--- | :--- |
| `background` | `#0b0f19` / `#0b1326` | `#f8fafc` | Page canvas base |
| `surface` | `#0b1326` | `#f8fafc` | Base layout viewport surface |
| `surface-dim` | `#0b1326` | `#edf2f7` | Inset wells and depressed surfaces |
| `surface-bright` | `#31394d` | `#ffffff` | Elevated cards, raised panels |
| `surface-container-lowest` | `#060e20` | `#ffffff` | Floating overlays, pure white cards |
| `surface-container-low` | `#131b2e` | `#ffffff` | Primary habit cards and list modules |
| `surface-container` | `#171f33` | `#f1f5f9` | Default grouped sections, search bars |
| `surface-container-high` | `#222a3d` | `#e2e8f0` | Hover states, segmented toggle tracks |
| `surface-container-highest`| `#2d3449` | `#cbd5e1` | Inactive chip fills, disabled states |
| `on-surface` | `#dae2fd` | `#090d16` | Display headers, primary emphasis text |
| `on-surface-variant` | `#d1c6ab` / `#94a3b8` | `#475569` | Secondary content, list metadata |
| `text-muted` | `#94a3b8` | `#64748b` | Timestamps, column heads, shortcuts |
| `outline` | `#9a9078` / `#334155` | `#cbd5e1` | Active borders, focused boundaries |
| `outline-variant` | `#4d4632` / `rgba(255,255,255,0.08)` | `#e2e8f0` | Subtle structural dividers, card borders |
| `primary` | `#facc15` / `#ffecb9` | `#d97706` | Accessible high-contrast primary CTAs |
| `primary-container` | `#facc15` | `#fef3c7` | Warm badge fills, streak highlights |
| `on-primary-container` | `#6c5700` | `#78350f` | Streak count text, accent label text |
| `secondary` | `#4edea3` / `#10b981` | `#059669` | Completed state checks, metric rings |
| `secondary-container` | `#00a572` | `#d1fae5` | Completed status badge backdrops |
| `on-secondary-container` | `#00311f` | `#064e3b` | Completion badge text |
| `tertiary` | `#ffc93e` | `#7c3aed` | Habit routines, focus blocks |
| `tertiary-container` | `#ffebc4` | `#ede9fe` | Routine tags, timeline blocks |
| `error` | `#ffb4ab` | `#e11d48` | Alerts, streak drops, destructive acts |
| `error-container` | `#93000a` | `#ffe4e6` | Urgent warning tags, overdue fills |
| `border-active-glow` | `rgba(250,204,21,0.4)` | `rgba(217,119,6,0.25)` | Amber focus rings on inputs and cards |
| `border-success-glow` | `rgba(16,185,129,0.4)` | `rgba(5,150,105,0.25)` | Completion checkmark feedback aura |

## Typography

Plus Jakarta Sans maintains unified geometry across displays, body text, and dense UI grids. It offers clear optical balance, generous counters, and crisp humanist terminals.

- **Numerics & Analytics**: For completion rates, streak metrics, and counters (`display-lg`, `metric-val`), enable tabular numbers (`font-variant-numeric: tabular-nums`) with tight tracking (`-0.03em`) to prevent jitter across re-renders.
- **Labels & Micro-data**: Overline labels and tags (`label-sm`) require uppercase styling with tracked letters (`+0.06em`) using `text-muted` (`#64748b`) or contextual container colors.
- **Headings & Body Hierarchy**: Headings leverage `#090d16` for high-contrast scanning. Body copy uses slate-900 (`#0f172a`) to ensure readable long-form task notes without stark black glare.

## Layout & Spacing

The layout utilizes a structured, breathable responsive grid that preserves the floating canvas architecture of the product family.

### Adaptive Breakpoints
- **Desktop (≥ 1280px)**: 12-column grid. Outer page margin is `2rem` (32px), with `1.5rem` to `2rem` gutters. Accommodates a 260px fixed or collapsible navigation rail, a center habit stream (minimum 580px), and an analytical right inspector column (320px–360px).
- **Tablet (768px – 1279px)**: 8-column grid with `1.5rem` gutters. Navigation collapses to a 68px icon rail. Center tasks and side stats fold into stacked or tabbed dual-column views.
- **Mobile (< 768px)**: 4-column fluid layout with `1rem` gutters and `1rem` outer canvas padding. App gutters flush to the screen edge; floating quick-add and primary streak widgets pin to top and bottom action bars.

### Internal Spacing Rhythm
- **Habit Rows**: Strict vertical rhythm of `space-sm` (12px) separation between items, with `space-md` (16px) separating distinct categories (e.g., Morning rituals vs. Evening routines).
- **Card Padding**: Standardized at `1.25rem` (20px) on desktop and `1rem` (16px) on mobile viewports.

## Elevation & Depth

In Kinetic Daylight, depth is rendered through subtle porcelain surface tiering, translucent backdrop blurs, and soft slate-tinted ambient drop shadows rather than heavy borders.

### Depth Hierarchy
- **Level 0 (Canvas Base)**: `#f8fafc` porcelain backdrop, foundational and unbordered.
- **Level 1 (Card & Section Containers)**: `#ffffff` with a crisp structural hairline `border: 1px solid #e2e8f0` and an ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Active Cards & Dropdowns)**: `#ffffff` floating with `border: 1px solid #cbd5e1` and a soft expanded shadow: `0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modals, Slide-overs, Floating Quick-Add)**: Pure `#ffffff` (or 95% opacity with `backdrop-blur-md`), rimmed with `border: 1px solid #cbd5e1` and high-elevation shadow: `0 20px 40px -12px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04)`.

### Ambient Glows & Accents
- **Amber Focus Halo**: On text inputs, active task cards, and current timer states: `box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15), 0 2px 4px rgba(217, 119, 6, 0.05)`.
- **Emerald Completion Flare**: On completed habit checks: `box-shadow: 0 0 14px -2px rgba(5, 150, 105, 0.25)`.

## Shapes

The design system maintains the signature rounded aesthetic (`roundedness: 2`, base 8px corner geometry) aligned with the mobile and desktop habit tracking flow.

- **Checkboxes & Habit Nodes**: 8px corner radius (`rounded-lg`), delivering a geometric squircle feel.
- **Card Panels & Content Blocks**: 16px corner radius (`rounded-2xl` / 1rem to 1.25rem).
- **Modals & Overlays**: 20px to 24px corner radius.
- **Buttons & Filter Badges**: Full pill shape (`rounded-full` / `9999px`) for action buttons, filter tags, and streak counters.
- **Input Fields**: 12px corner radius (`rounded-xl`) to harmonize between the squircle checkboxes and pill buttons.

## Components

### 1. Buttons & Triggers
- **Primary CTA**: Solid Amber (`#d97706`) with pure white text (`#ffffff`, weight: 700). Pill format (`rounded-full`). On hover, shifts to `#b45309` with a subtle amber shadow: `0 4px 12px rgba(217, 119, 6, 0.25)`. Active state triggers scale down (0.98).
- **Secondary Action Button**: Surface container white (`#ffffff`), `1px solid #cbd5e1`, text `#0f172a` (weight: 600). Hover shifts background to `#f1f5f9` with border `#94a3b8`.
- **Ghost Utility Button**: Transparent background, text `#475569`. Hover triggers `#f1f5f9` fill and `#090d16` text.

### 2. Habit Tracker Row & List Items
- **Container**: Elevated `#ffffff` surface, 16px corner radius, `1px solid #e2e8f0` border, `16px` internal horizontal padding. Hover elevates the card with `border-color: #cbd5e1` and subtle shadow level 2.
- **Category Indicator**: 3px vertical accent bar on the left edge (Amber for Focus, Emerald for Health, Violet for Routines, Coral for Deadlines).
- **Habit Check Node**: A 28px squircle (8px corner radius) with `#f1f5f9` background and `1px solid #cbd5e1`. 
  - *Completed State*: Fills instantly with Emerald (`#059669`), crisp white checkmark icon, and emerald pulse halo (`0 0 14px rgba(5, 150, 105, 0.25)`).
  - *Text State*: Habit title transitions from bold `#090d16` to struck-through `#64748b`.

### 3. Chips, Badges & Streaks
- **Streak Flame Badge**: Pill format (`rounded-full`), `#fef3c7` container fill, `1px solid #fde68a` border, text `#b45309` (weight: 700), accompanied by a warm gold flame icon.
- **Category Filter Chips**: Pill format. 
  - *Inactive*: `#f1f5f9` background, `1px solid transparent`, text `#475569`.
  - *Active / Selected*: `#090d16` background, text `#ffffff`, font-weight 600.

### 4. Input Fields & Quick-Add Task Bar
- **Field Base**: `#ffffff` background with `1px solid #cbd5e1`, height 44px, 12px corner radius. Typography is `#090d16` with `#64748b` placeholder text.
- **Focus State**: Hairline border changes to `#d97706` coupled with an ambient focus ring `0 0 0 3px rgba(217, 119, 6, 0.15)`.
- **Keyboard Shortcut Badge**: Inset trailing container (`#f1f5f9`, border `#e2e8f0`, text `#475569`, font size `11px`, `rounded-md`).

### 5. Cards & Analytics Widgets
- Surfaces feature `#ffffff` background, `16px` border radius, `1px solid #e2e8f0`, and Level 1 elevation.
- Category headers use uppercase `label-sm` in `#64748b`.
- Highlight values utilize `metric-val` in `#090d16` tabular text.
- Progress bars and circular rings use `#f1f5f9` tracks paired with `#d97706` (streaks) or `#059669` (completion) fills.