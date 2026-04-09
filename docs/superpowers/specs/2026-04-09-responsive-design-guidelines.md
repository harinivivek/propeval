# PropEval — Responsive Design Guidelines

## Platform Targets

| Platform | Users | Priority |
|----------|-------|----------|
| Desktop (1024px+) | All users (Lender, Vendor, Admin) | Primary |
| Tablet (768-1023px) | Lender + Vendor field users | Secondary |
| Mobile (< 768px) | Vendor PWA (accept requests, upload reports) | Critical for vendors |

## Breakpoints (Tailwind)

- `sm:` 640px — Large phones
- `md:` 768px — Tablets
- `lg:` 1024px — Desktop
- `xl:` 1280px — Wide desktop

## Layout Rules

### Sidebar Navigation
- **Desktop (lg+):** Fixed sidebar 256px wide, always visible
- **Tablet (md-lg):** Collapsible sidebar, hamburger icon, overlay on toggle
- **Mobile (< md):** Bottom navigation bar (4-5 key items), no sidebar

### Login Page
- **Desktop:** Split-screen (brand left, form right, 50/50)
- **Tablet:** Split-screen (brand left 40%, form right 60%)
- **Mobile:** Full-width form, brand panel hidden, logo above form

### Tables
- **Desktop:** Full table with all columns
- **Tablet:** Reduced columns, horizontal scroll if needed
- **Mobile:** Card-based list view instead of tables

### Forms
- **All sizes:** Full-width inputs, stacked fields
- **Desktop:** Optional 2-column layouts for wide forms
- **Mobile:** Single column always, larger touch targets (min 44px)

### Popups/Modals (vendor notifications)
- **Desktop:** Right panel slide-in or centered modal
- **Tablet:** Centered modal
- **Mobile:** Full-screen bottom sheet

## Touch Targets
- Minimum 44x44px for all interactive elements on mobile
- Adequate spacing between tappable items (8px minimum)

## PWA Considerations (Vendor Mobile)
- Notification permission prompt on first login
- Offline-capable data entry forms
- Service worker caches critical assets
- Add to Home Screen prompt
