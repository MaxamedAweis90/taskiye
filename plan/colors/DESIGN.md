---
name: Kinetic Midnight
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#d1c6ab'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#9a9078'
  outline-variant: '#4d4632'
  surface-tint: '#eec200'
  primary: '#ffecb9'
  on-primary: '#3c2f00'
  primary-container: '#facc15'
  on-primary-container: '#6c5700'
  inverse-primary: '#735c00'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffebc4'
  on-tertiary: '#3f2e00'
  tertiary-container: '#ffc93e'
  on-tertiary-container: '#715500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffe083'
  primary-fixed-dim: '#eec200'
  on-primary-fixed: '#231b00'
  on-primary-fixed-variant: '#574500'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdf9a'
  tertiary-fixed-dim: '#f7be1d'
  on-tertiary-fixed: '#251a00'
  on-tertiary-fixed-variant: '#5a4300'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
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
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 2.5rem
  space-3xl: 3rem
  gutter-mobile: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 2rem
  app-window-padding: 1.5rem
  card-inner-padding: 1.25rem
---

## Brand & Style
The design system delivers an ultra-modern, focused productivity ecosystem tailored for power users, disciplined habit trackers, and high-output professionals. Its ethos balances deep nocturnal immersion with high-voltage focus triggers. 

The aesthetic is a hybrid of **Precision Dark Minimalism** and **Refined Glassmorphism**. Dark slate foundations banish visual fatigue during sustained screen time, while electric amber and kinetic emerald micro-accents direct immediate cognitive attention to active streaks, priorities, and completed habits. UI surfaces evoke polished obsidian instruments: floating translucent cards, ultra-fine frosted specular borders, soft warm ambient backlights, and ergonomic radii engineered for both fluid touch navigation and desktop density.

## Colors
The palette leverages high-contrast atmospheric depth. It grounds the UI in deep blue-black foundations and lifts interactive layers using luminous amber and vibrant emerald.

### Primary & Accent Roles
- **Primary Accent (`#FACC15`)**: Electric Amber. Reserved for high-value targets: primary action buttons, streak indicators, today's active habits, and focused states.
- **Primary Dim / Hover (`#EAB308`)**: Deep Amber. Used for pressed states and focused outlines.
- **Secondary Accent (`#10B981`)**: Kinetic Emerald. Denotes achieved goals, completed habit check-marks, positive momentum, and progress velocity.

### Background & Surface Tiers
- **Canvas Base (`#0B0F19`)**: The underlying page body.
- **App Frame / Floating Canvas (`#0F172A`)**: The bounded main viewport container.
- **Surface Level 1 / Card (`#162032`)**: Standard cards, habit rows, and sidebar panels with 80%–90% opacity over dark backgrounds.
- **Surface Level 2 / Elevated (`#1E293B`)**: Modals, dropdown flyouts, active hover cards, and segmented control backgrounds.
- **Surface Level 3 / Highlight (`#243248`)**: Secondary chips, subtle active pill fills, and nested metric widgets.

### Boundary Tokens
- **Border Default**: `rgba(255, 255, 255, 0.08)` for translucent frosted dividers and card rims.
- **Border Subdued**: `#334155` for distinct structure and panel separators.
- **Border Active Glow**: `rgba(250, 204, 21, 0.4)` paired with an outer box glow.

### Text Contrast Hierarchy
- **Text Headings / Emphasized (`#FFFFFF`)**: Crisp, non-glare high contrast for hero metrics, streak counters, and titles.
- **Text Primary Body (`#E2E8F0`)**: Slate-200 for habit titles, task descriptions, and field inputs.
- **Text Secondary (`#CBD5E1`)**: Slate-300 for supporting task details and timeline items.
- **Text Muted / Metadata (`#94A3B8`)**: Slate-400 for subtext, date timestamps, keyboard shortcuts, and column labels.

## Typography
Plus Jakarta Sans serves across display, body, and UI labeling. Its wide geometric apertures and sharp terminal cuts provide supreme legibility across dense matrix grids, streak heatmaps, and compact dashboard columns.

- **Numerics & Analytics**: Metric figures leverage bold and extra-bold weights (`display-lg`, `metric-val`) set with tight negative tracking (`-0.03em`) for high-impact punch. Tabular lining numbers (`tnum`) must be enforced for habit completion timers, clock rings, and streak tallies.
- **Labels & Microcopy**: Upper-cased micro labels (`label-sm`) utilize generous letter spacing (`+0.06em`) to maintain legibility against dark slate surfaces without optical crowding.
- **Headings**: Tracked tightly to eliminate awkward gaps in prominent habit names and productivity summaries.

## Layout & Spacing
The layout employs an **Enclosed Floating Window Architecture**. The viewport hosts a centralized 24px-radius app canvas floated over the foundational `#0B0F19` backdrop with a consistent 16px to 24px inset margin on desktop screens.

### Grid Rhythm & Breakpoints
- **Desktop (1280px and above)**: 12-column fluid grid inside the primary canvas window. 24px gutters, fixed 260px collapsible sidebar for navigation, and responsive 3-column split (Left: Habits/Routines, Center: Daily Timeline/Task Engine, Right: Analytics/Streak Heatmap).
- **Tablet (768px – 1279px)**: 8-column layout. Sidebar collapses into an icon-rail (68px). Two main content panes with 20px gutters.
- **Mobile (below 768px)**: Single-column reflow. Outer window margins drop to zero to preserve real estate; top and bottom app shell bars handle primary actions with a persistent bottom floating utility pill.

### Micro-Spacing Rules
Internal card components adhere strictly to a 4px/8px modular scale. Dense task lists employ `space-sm` (12px) row separation with `space-md` (16px) vertical breathing room between logical groups (e.g., Morning Routine vs. Evening Check-in).

## Elevation & Depth
Depth is created through specular frosted glass, calibrated dark slate luminescence, and amber focus halos. Opaque drop shadows are replaced with soft ambient tints.

### Depth Hierarchy
- **Level 0 (Backdrop)**: `#0B0F19` void, static and unblurred.
- **Level 1 (App Canvas Frame)**: `#0F172A` with `border: 1px solid rgba(255, 255, 255, 0.05)`, floating above Level 0 with a diffused ambient shadow: `0 24px 48px -12px rgba(0, 0, 0, 0.65)`.
- **Level 2 (Containers & Habit Cards)**: `#162032` at 85% opacity, backdrop blur of 12px (`backdrop-blur-md`), rimmed by a top-to-bottom subtle gradient border (`rgba(255, 255, 255, 0.1)` fading to `rgba(255, 255, 255, 0.02)`).
- **Level 3 (Modals, Overlays, Floating Menus)**: `#1E293B` at 95% opacity with 20px backdrop blur, bordered by `rgba(255, 255, 255, 0.12)`, casting an ambient shadow: `0 20px 40px -8px rgba(0, 0, 0, 0.75), 0 0 1px 1px rgba(255, 255, 255, 0.05)`.

### Glowing Accents
- **Amber Focus / Active Pulse**: Active items, selected dates, or ongoing timers project an amber glow: `box-shadow: 0 0 20px -3px rgba(250, 204, 21, 0.35)`.
- **Emerald Completion Flare**: Completed streaks and checkboxes produce a crisp micro-glow: `box-shadow: 0 0 16px -2px rgba(16, 185, 129, 0.4)`.

## Shapes
The interface features large, ergonomic curvatures (Level 2 base with expanded boundary tokens) designed to soften data-dense productivity grids.

- **Outer App Window**: 24px corner radius (`rounded-2xl`).
- **Cards, Panels, & Dialogs**: 16px to 20px corner radius (`rounded-xl` to `rounded-2xl`).
- **Interactive Controls (Inputs, Habit Chips, Buttons)**: Pill shapes (`rounded-full` or 9999px) for primary action triggers and filter chips; 12px to 14px radius for text inputs and dropdown targets.
- **Checkboxes & Habit Nodes**: 8px corner radius on checkboxes for a refined squircle geometry; habit frequency squares use 6px smooth rounding.

## Components

### 1. Buttons & Triggers
- **Primary CTA**: Solid Amber (`#FACC15`) with deep dark slate typography (`#0F172A`, font-weight 700). Rounded-full pill format. Hover shifts background to `#EAB308` with an amber halo: `box-shadow: 0 0 20px -2px rgba(250, 204, 21, 0.4)`.
- **Secondary Button**: `#1E293B` background, border `1px solid rgba(255, 255, 255, 0.08)`, text `#E2E8F0`. Hover lifts background to `#243248` with pure white text.
- **Ghost / Utility Action**: Transparent background, text `#94A3B8`. Hover introduces `rgba(255, 255, 255, 0.05)` fill and slate-200 text.

### 2. Habit Tracker Row & List Items
- Container uses `#162032` with a 16px radius and `1px solid rgba(255, 255, 255, 0.06)` border.
- Left edge features an optional 3px vertical accent bar corresponding to habit color category.
- **Habit Check Node**: A 28px squircle (8px radius) with `#1E293B` background and `1px solid #334155`. On completion, it transitions smoothly to an Emerald (`#10B981`) fill with a pure white check icon and emerald shadow flare (`0 0 14px rgba(16, 185, 129, 0.5)`). Habit title receives a soft strikethrough and transitions from `#FFFFFF` to `#94A3B8`.

### 3. Chips, Badges & Streaks
- **Streak Flame Badge**: Pill badge with `#1E293B` fill, `rgba(250, 204, 21, 0.2)` border, and `#FACC15` text accompanied by a stylized flame icon.
- **Category & Filter Chips**: 9999px pill format. Inactive: `#162032` with `#94A3B8` text. Selected: `#243248` with `1px solid #FACC15`, text `#FFFFFF`.

### 4. Input Fields & Quick-Add Task Bar
- Input backgrounds use `#162032` (or `#0F172A` inside elevated cards) with `1px solid #334155`. Text is `#E2E8F0` with `#94A3B8` placeholders.
- Focus state switches the border to `#FACC15` with an ambient ring: `0 0 0 3px rgba(250, 204, 21, 0.15)`. Height is standardized to 44px for primary fields, featuring inline keyboard-shortcut badges (e.g., `⌘K`) on the right edge.

### 5. Cards & Analytics Widgets
- Surfaces utilize 16px to 20px radii, translucent slate styling (`bg-slate-900/80` with backdrop blur), and an internal padding of 20px.
- Metric cards pair a muted upper-case category label (`label-sm`, `#94A3B8`) with a massive white metric value (`metric-val`) and a sparkline or completion ring colored in `#FACC15` or `#10B981`.