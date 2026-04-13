# PropEval Design System & UI Overhaul

**Date:** 2026-04-13
**Scope:** Design system foundation + Lender portal full restyling
**Direction:** Warm & Approachable (Airbnb/Notion aesthetic)
**Approach:** shadcn/ui full setup on existing Radix UI primitives

---

## 1. Goals

- Establish a unified design system (tokens, components, patterns) that all three portals share
- Fully restyle the Lender portal as proof of concept
- Replace scattered inline Tailwind classes with consistent, reusable shadcn/ui components
- Achieve production-grade visual quality comparable to Airbnb/Notion

## 2. Design Tokens & Theme

### 2.1 Color Palette — Teal/Emerald with Warm Neutrals

All colors defined as CSS custom properties in `globals.css` (shadcn/ui convention using HSL values):

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | warm gray-50 (#F9FAFB) | Page backgrounds |
| `--foreground` | gray-900 (#111827) | Primary text |
| `--card` | white (#FFFFFF) | Card backgrounds |
| `--card-foreground` | gray-900 (#111827) | Card text |
| `--primary` | teal-600 (#0D9488) | Primary buttons, active states, links |
| `--primary-foreground` | white (#FFFFFF) | Text on primary |
| `--secondary` | teal-50 (#F0FDFA) | Hover backgrounds, subtle highlights |
| `--secondary-foreground` | teal-900 (#134E4A) | Text on secondary |
| `--muted` | gray-100 (#F3F4F6) | Disabled states, section backgrounds |
| `--muted-foreground` | gray-500 (#6B7280) | Secondary/helper text |
| `--accent` | teal-500 (#14B8A6) | Focus rings, accent badges |
| `--accent-foreground` | teal-950 (#042F2E) | Text on accent |
| `--destructive` | red-500 (#EF4444) | Delete actions, error states |
| `--destructive-foreground` | white (#FFFFFF) | Text on destructive |
| `--border` | gray-200 (#E5E7EB) | Borders, dividers |
| `--input` | gray-300 (#D1D5DB) | Input borders |
| `--ring` | teal-500 (#14B8A6) | Focus rings |

### 2.2 Typography — Inter

Load via `next/font/google` in root layout for automatic optimization.

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Display | 30px (text-3xl) | 700 (bold) | 1.2 | Page titles |
| Heading | 20px (text-xl) | 600 (semibold) | 1.3 | Section titles |
| Subheading | 16px (text-base) | 600 (semibold) | 1.4 | Card titles |
| Body | 14px (text-sm) | 400 (normal) | 1.5 | Content text |
| Small | 12px (text-xs) | 400-500 | 1.4 | Labels, badges, captions |

### 2.3 Spacing

4px base unit (Tailwind default). Standardized usage:

- Card padding: `p-5` (20px)
- Page container padding: `p-6` (24px)
- Grid gaps: `gap-4` (16px) for card grids, `gap-6` (24px) for sections
- Form field spacing: `space-y-4` between fields, `mb-1.5` between label and input

### 2.4 Shadows

| Level | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Default card elevation |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Hover/raised cards |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns, popovers |

### 2.5 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` (12px) | shadcn base radius |
| Cards | `rounded-xl` (12px) | All cards |
| Buttons | `rounded-xl` (12px) | All buttons |
| Inputs | `rounded-lg` (10px) | Form inputs |
| Badges | `rounded-full` | Status badges |
| Modals | `rounded-2xl` (16px) | Dialogs |

---

## 3. Core Components (shadcn/ui)

### 3.1 Buttons

Install: `shadcn@latest add button`

4 variants + destructive:

| Variant | Style | Usage |
|---------|-------|-------|
| `default` | Solid teal bg, white text, hover darkens to teal-700 | Primary actions (Submit, Create, Save) |
| `secondary` | Teal-50 bg, teal-700 text, hover teal-100 | Secondary actions (Cancel, Filter) |
| `outline` | White bg, teal border, teal text, hover teal-50 | Tertiary actions (Export, View) |
| `ghost` | Transparent, teal-700 text, hover teal-50 | Inline actions, nav items |
| `destructive` | Red-500 bg, white text, hover red-600 | Delete, Remove |

Sizes: `sm` (h-8, text-xs), `default` (h-10, text-sm), `lg` (h-12, text-base).

All buttons: `font-medium`, `transition-colors duration-150`, `focus-visible:ring-2 ring-ring ring-offset-2`.

### 3.2 Cards

Install: `shadcn@latest add card`

- White background, `rounded-xl`, `shadow-sm`, `border border-border`
- Interactive cards: `hover:shadow-md transition-shadow duration-200 cursor-pointer`
- Sub-components: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

### 3.3 Metric Cards (custom component)

Extends Card with:
- Left colored accent strip (4px `border-l-4` in contextual color — teal, amber, emerald, blue)
- Icon in soft-colored circle (40px, matching accent background at 10% opacity)
- Large stat number (display size, `font-bold text-foreground`)
- Label below in `text-muted-foreground text-sm`

### 3.4 Form Inputs

Install: `shadcn@latest add input label`

- `rounded-lg`, `border-input`, `h-10`, `text-sm`
- Focus: `ring-2 ring-teal-500/20 border-teal-500` (subtle glow)
- Labels: `text-sm font-medium text-foreground mb-1.5`
- Error state: `border-destructive ring-destructive/20` + error message in `text-destructive text-sm mt-1`

### 3.5 Tables

Install: `shadcn@latest add table`

- Clean horizontal lines only (no vertical borders, no full grid)
- Header: `bg-muted text-muted-foreground text-xs uppercase tracking-wider font-medium`
- Rows: `border-b border-border`
- Row hover: `hover:bg-secondary/50` (very subtle teal tint)
- Mobile: transforms to card-based list (preserve existing responsive pattern)

### 3.6 Status Badges

Install: `shadcn@latest add badge`

`rounded-full px-2.5 py-0.5 text-xs font-medium`

Semantic color mapping:

| Status | Background | Text |
|--------|-----------|------|
| PENDING | amber-100 | amber-800 |
| BROADCAST | blue-100 | blue-800 |
| ACCEPTED | teal-100 | teal-800 |
| IN_PROGRESS | indigo-100 | indigo-800 |
| COMPLETED | emerald-100 | emerald-800 |
| REJECTED | red-100 | red-800 |
| CANCELLED | gray-100 | gray-800 |

### 3.7 Dialogs/Modals

Install: `shadcn@latest add dialog`

- `rounded-2xl`, backdrop blur (`bg-black/40 backdrop-blur-sm`)
- Entry animation: `animate-in fade-in slide-in-from-bottom-4 duration-200`
- Max-width constraint per size: `sm` (400px), `default` (500px), `lg` (640px)

### 3.8 Additional shadcn Components to Install

- `tabs` — settings pages, dashboard sections
- `select` — dropdowns, filters
- `dropdown-menu` — action menus, user menu
- `separator` — dividers
- `skeleton` — loading states
- `tooltip` — icon-only button hints
- `avatar` — user photos, vendor profiles
- `sheet` — mobile sidebar drawer (replaces custom drawer)

---

## 4. Navigation & Layout

### 4.1 Sidebar — Notion-Style Icon + Label

**Structure:**
```
┌─────────────────────┐
│  🏠 PropEval         │  ← Logo + portal label
│  Lender Portal      │
├─────────────────────┤
│                     │
│  MAIN               │  ← Section header (xs, uppercase, muted)
│  📊 Dashboard       │  ← Active: bg-teal-50, text-teal-700
│  📋 Requests        │  ← Default: text-muted-foreground
│  🔍 Marketplace     │
│                     │
│  REPORTS            │
│  📄 Listings        │
│  🛒 Purchased       │
│                     │
│  ACCOUNT            │
│  ⚙️ Settings        │
│                     │
├─────────────────────┤
│  👤 User Name       │  ← Avatar + name + logout
│  Logout             │
└─────────────────────┘
```

**Specifications:**
- Width: 260px on desktop (`lg+`)
- Background: white, `border-r border-border`
- Logo area: `py-6 px-5`, portal name in `text-sm text-muted-foreground`
- Section headers: `text-xs uppercase tracking-wider text-muted-foreground font-medium px-3 mb-2 mt-6`
- Nav items:
  - Lucide icon (20px) + text label, `gap-3`
  - `rounded-lg px-3 py-2.5 text-sm`
  - Default: `text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150`
  - Active: `bg-secondary text-teal-700 font-medium`
- Footer: user avatar (32px circle) + name + logout link, `border-t border-border py-4 px-5`

**Mobile drawer:**
- Uses shadcn `Sheet` (side="left") instead of custom overlay
- Same content as desktop sidebar
- Slide-in animation with backdrop blur

### 4.2 Top Header Bar

- Desktop: `h-14`, white bg, `border-b border-border`, right-aligned content area with NotificationBell + user avatar dropdown
- Mobile: `h-14`, hamburger button (left) + portal name (center) + NotificationBell (right)

### 4.3 Page Layout Structure

```
<main className="flex-1 bg-background">
  <div className="max-w-7xl mx-auto p-6">
    {/* Page header */}
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Page Title</h1>
        <p className="text-muted-foreground mt-1">Optional description</p>
      </div>
      <Button>Primary Action</Button>
    </div>
    {/* Page content */}
    {children}
  </div>
</main>
```

- `max-w-7xl mx-auto` prevents ultra-wide stretching
- Content sits on `bg-background` (warm gray), cards provide elevation contrast
- Consistent page header pattern across all pages

---

## 5. Lender Portal Page Designs

### 5.1 Dashboard (`/lender/dashboard`)

**Top row — Metric cards:**
- 4 metric cards in `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`
- Cards: Active Requests (teal accent), Pending Reports (amber accent), Total Spent (emerald accent), Reports Received (blue accent)
- Each with contextual Lucide icon in soft circle

**Middle row — Two cards side by side:**
- "Recent Requests" — compact table (5 latest): property, status badge, date. "View all" link in card footer.
- "Recent Activity" — timeline list: colored dot + action text + relative timestamp. Vertical connector line between items.
- Layout: `grid-cols-1 lg:grid-cols-2 gap-6`

**Bottom row — Optional chart:**
- "Monthly Spending" area chart (Recharts) in a card. Teal gradient fill.
- Only renders if data exists (no empty chart shells)

### 5.2 Requests List (`/lender/requests`)

**Page header:** "Requests" (display) + "New Request" primary button (right)

**Filter bar:**
- Horizontal row in `bg-card rounded-xl shadow-sm border p-4 mb-6`
- Filters: status Select, property type Select, date range (two date inputs)
- "Clear filters" ghost button when any filter active

**Table (desktop):**
- Columns: Reference, Property Address, Type (badge), Status (badge), Vendor, Date, Amount
- Sortable columns with subtle chevron indicators
- Row click → navigates to detail page
- Pagination at bottom: "Showing 1-10 of 48" + prev/next buttons

**Card list (mobile):**
- Each request as a card: property address bold, reference in muted text, status badge, vendor name, date, amount right-aligned
- Tap → navigates to detail

### 5.3 New Request (`/lender/requests/new`)

- Single card, max-width 640px, centered
- Multi-section form with separator dividers:
  - **Property Details:** address (textarea), city (input), pin code (input), property type (select)
  - **Report Type:** valuation/legal radio group styled as selectable cards
  - **Additional Notes:** optional textarea
- Footer: "Submit Request" primary button + "Cancel" ghost button

### 5.4 Marketplace (`/lender/marketplace`)

**Filter bar (top):**
- Location autocomplete + property type select + rating filter + tier filter
- All in one `rounded-xl` container with `shadow-sm`

**Split view (desktop):**
- Left: Leaflet map (50% width) with teal markers (reports) and emerald markers (vendors)
- Right: scrollable card grid (50% width), `grid-cols-1 xl:grid-cols-2 gap-4`
- Map/list toggle visible on mobile

**Result cards:**
- `rounded-xl shadow-sm hover:shadow-md transition-shadow`
- Report cards: small teal left accent strip. Title, location, price, property type badge.
- Vendor cards: small emerald left accent strip. Name, tier badge, rating stars, specializations.

### 5.5 Listings (`/lender/listings`)

- Same table/card pattern as Requests
- Map/list toggle retained
- Listing cards show: property address, pin code, property type, report count, price

### 5.6 Listing Detail (`/lender/listings/:id`)

**Two-column layout (desktop):**
- Left (2/3): Report details card — property info in key-value grid, extracted report data sections
- Right (1/3): Sticky purchase card — price (large, bold), "Purchase Report" primary button, vendor mini-profile (avatar, name, tier badge, rating stars)

**Mobile:** Stacks vertically — details on top, purchase card below (fixed to bottom on scroll as a slim bar with price + buy button)

### 5.7 Purchased Reports (`/lender/listings/purchases`)

- Table: report name, vendor, purchase date, amount, download button (outline)
- Download button with split action (original vs template format)

### 5.8 Settings (`/lender/settings`)

- shadcn Tabs component: "Users" | "Report Template"
- **Users tab:** User list table + "Invite User" button
- **Template tab:** Existing template builder restyled with new components — form inputs for header/colors, drag-and-drop field list in cards

---

## 6. Shared Patterns

### 6.1 Empty States

- Centered in container
- Lucide icon (48px) in `text-muted-foreground`
- Heading: `text-lg font-semibold text-foreground`
- Description: `text-sm text-muted-foreground max-w-sm mx-auto mt-2`
- CTA: primary button, `mt-4`
- No illustrations — keep it clean and fast

### 6.2 Loading States

- Skeleton screens matching layout shapes with `animate-pulse bg-muted rounded-lg`
- Cards: skeleton card with header bar + 2-3 content lines
- Tables: skeleton rows (6 rows of alternating-width bars)
- No spinners — skeletons feel faster and more polished

### 6.3 Toast Notifications

- Sonner (already installed) — position: bottom-right
- Styled with design tokens: success (teal), error (red), info (blue)
- `rounded-xl shadow-lg`

### 6.4 Transitions & Micro-interactions

- All hover states: `transition-colors duration-150`
- Card hover elevation: `transition-shadow duration-200`
- Sidebar nav: `transition-colors duration-150`
- Page transitions: none (keep navigation instant — perceived speed > animations)
- Button press: subtle `active:scale-[0.98]` for tactile feedback

---

## 7. Migration Strategy

### 7.1 Phase 1: Foundation (this phase)

1. Initialize shadcn/ui (`npx shadcn@latest init`) — use "new-york" style, Tailwind CSS v4 mode (supported by shadcn v2+), teal as primary color
2. Configure theme in `globals.css` with teal/emerald CSS custom properties
3. Set up Inter font via `next/font/google` in root layout
4. Install core shadcn components: button, card, input, label, table, badge, dialog, tabs, select, dropdown-menu, separator, skeleton, tooltip, avatar, sheet
5. Create custom components: MetricCard, StatusBadge (semantic color map), PageHeader, Sidebar (shared across portals)
6. Restyle all 3 portal layouts (sidebar + header) simultaneously (they share the pattern)

### 7.2 Phase 2: Lender Portal (this phase)

7. Restyle each Lender page, replacing inline Tailwind with shadcn components:
   - Dashboard
   - Requests (list + new + detail)
   - Marketplace
   - Listings (browse + detail)
   - Purchased Reports
   - Settings

### 7.3 Phase 3: Vendor + Admin Portals (future)

- Apply the same design system to Vendor and Admin portals
- Vendor portal gets additional mobile-specific optimizations (PWA context)
- Admin portal may keep denser information layout but uses same tokens/components

### 7.4 Migration Rules

- **No functionality changes.** This is purely visual. All API calls, state management, and business logic stay untouched.
- **Replace inline classes with shadcn components** where a component exists (Button, Card, Input, etc.)
- **Keep inline Tailwind** for layout (flex, grid, padding, margin) — these are not component concerns
- **Preserve all responsive breakpoints** and mobile/tablet/desktop behavior
- **Test each page after restyling** — visual check on mobile + desktop

---

## 8. Files Changed

### New Files
- `frontend/src/app/globals.css` — complete rewrite with shadcn theme variables
- `frontend/src/components/ui/` — shadcn component directory (auto-generated by CLI)
- `frontend/src/components/metric-card.tsx` — custom metric card component
- `frontend/src/components/status-badge.tsx` — semantic status badge wrapper
- `frontend/src/components/page-header.tsx` — reusable page header (title + description + action)
- `frontend/src/components/app-sidebar.tsx` — shared sidebar component (parameterized per portal)

### Modified Files
- `frontend/src/app/layout.tsx` — Inter font, updated body classes
- `frontend/src/app/lender/layout.tsx` — new sidebar + header using shared components
- `frontend/src/app/vendor/layout.tsx` — new sidebar + header (same shared component, different nav items)
- `frontend/src/app/admin/layout.tsx` — new sidebar + header (same shared component, different nav items)
- `frontend/src/app/lender/dashboard/page.tsx` — restyled with MetricCard, Card, Table
- `frontend/src/app/lender/requests/page.tsx` — restyled with Table, Badge, Button, Card
- `frontend/src/app/lender/requests/new/page.tsx` — restyled with Card, Input, Label, Select, Button
- `frontend/src/app/lender/marketplace/page.tsx` — restyled filter bar, result cards
- `frontend/src/app/lender/listings/page.tsx` — restyled with Table, Badge, Card
- `frontend/src/app/lender/settings/page.tsx` — restyled with Tabs, Card, Input
- All Lender `_components/` files — updated to use shadcn components
- `frontend/src/app/login/page.tsx` — restyled with new tokens and components
- `frontend/src/components/notification-bell.tsx` — updated to use new design tokens

### Unchanged
- All backend code
- All API calls and data fetching logic
- All state management (hooks, contexts)
- Vendor and Admin page content (future phase)

---

## 9. Out of Scope

- Dark mode (can be added later — shadcn/ui supports it natively with the token system)
- Animations/page transitions beyond micro-interactions
- Backend changes
- New features or functionality
- Vendor and Admin portal page restyling (future phase — only their layouts/sidebars get updated)
