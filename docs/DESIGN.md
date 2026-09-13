---
name: Modern PropTech Management
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3e4947'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#7d4200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a15600'
  on-tertiary-container: '#ffe6d5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
  numeric-metric:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system serves high-velocity enterprise operators, property managers, and institutional landlords running multi-location boarding facilities and serviced apartments. 

### Core Personality & Ethos
- **Pragmatic Precision:** Visual clutter is eliminated in favor of high information density and crisp spatial hierarchy. Critical operational metrics—such as occupancy rates, rent collection cash flows, and overdue utility receivables—are front and center.
- **Financial Authority & Trust:** Built around rich emerald and balanced slate neutrals, evoking solvency, institutional-grade fiscal governance, and reliable infrastructure.
- **Action-Oriented Visibility:** Operational urgency is immediately decipherable via categorical color codes (rent default, unit turnaround, maintenance blockages) without visual chaos.

### Design Movement
**Modern Functional Corporate with Subtle Tactility.** The visual framework pairs precise structural grids with deliberate low-contrast borders, micro-elevation, and purposeful semantic accents. It rejects ornamental excess, leaning into clean data presentation, dense analytical tables, contextual status indicators, and modular operational dashboards.

## Colors

The palette balances fiscal stability, operational clarity, and high-contrast data visualization.

### Functional Roles

- **Primary (`#0F766E` - Deep Teal / Emerald):** Anchor for operational health, realized revenue, core actions (e.g., "Tạo hợp đồng mới", "Xác nhận thu tiền"), and primary navigation states. Communicates liquidity and trust.
- **Secondary (`#4F46E5` - Digital Indigo):** Digitization, system automations, IoT smart-meter integration, tenant app synchronization, and secondary workflow triggers.
- **Tertiary / Warning (`#D97706` - Amber Saffron):** Payment warnings, pending utility reconciliations, contracts nearing expiration (within 30 days), and review flags.
- **Neutral (`#0F172A` - Deep Slate):** Provides crisp contrast for typography, deep structured toolbars, tabular borders, and structural framing.

### Surface & Semantic Extensions
- **Surface Canvas:** `#F8FAFC` (Slate 50) creates a bright, low-strain workplace canvas.
- **Surface Layer 1 (Cards, Tables):** `#FFFFFF` (Pure White).
- **Surface Layer 2 (Muted Panels, Nested Tables):** `#F1F5F9` (Slate 100).
- **Critical / Arrears (`#DC2626` - Crimson Red):** Overdue rent, defaulted tenants, failed webhook triggers, and safety-related maintenance tickets.
- **Success / Vacancy Available (`#16A34A` - Leaf Green):** Paid-in-full markers, clean inspection passes, and available units ready for leasing.
- **Neutral Accent / Maintenance (`#64748B` - Slate Muted):** Off-market inventory, scheduled structural renovations, and inactive contracts.

## Typography

The type system separates analytical data ingestion from structural page identity by coupling **Plus Jakarta Sans** (headings, key metrics, KPIs) with **Inter** (dense data grids, tabular layouts, badges, and forms).

### Rules and Numerical Treatment
- **Tabular Numerics (`tnum`):** All financial summaries, unit numbering schemas (e.g., `P.402`, `A-1201`), utility meter logs (kWh, $m^3$), and currency markers (`₫`, `VND`) must render with tabular numbers (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during filtering or real-time polling.
- **Hierarchy Distinction:** Headings are authoritative and compact. Body copy prioritizes comfortable scan-reading over prolonged literary immersion. Labels and metadata chips use deliberate medium-to-semibold weights to retain legibility at small sizes.

## Layout & Spacing

A 12-column fluid grid system serves high-density workstation environments, pairing an anchored 260px collapsible sidebar with dynamic viewport adaptation.

### Breakpoints & Layout Model
- **Desktop (≥ 1440px):** 12 columns, 24px (`gutter-lg`) gutters, 32px (`margin-lg`) canvas margin. Enables side-by-side floor plan matrices, tenant dossier flyout trays, and nested financial metrics.
- **Laptop / Compact Desktop (1024px – 1439px):** 12 columns, 16px (`gutter`) gutters, 24px (`margin-md`) outer padding. Analytical sidebars transition into off-canvas drawers or stacked tabs.
- **Tablet (768px – 1023px):** 8 columns, 16px gutters, 16px margins. Quick stats drop to a 2x2 grid; unit grids convert to two-column multi-unit cards.
- **Mobile (< 768px):** 4 columns, 12px gutters, 16px (`margin`) edges. Complex tables swap to vertically stacked cards; property selection transforms into an anchored sticky bottom sheet.

### Spacing Rhythm
- Compact density is applied within operational modules: `space-xs` (4px) for badge internals and micro-tags; `space-sm` (8px) for input icon padding and button insets; `space-md` (14px) for standard table cell vertical padding; `space-lg` (20px) for inner card separation; `space-xl` (32px) for major dashboard section headers.

## Elevation & Depth

Visual depth is achieved through structural layering and soft, low-opacity ambient shadows rather than stark elevation planes.

### Depth Hierarchy
1. **Base Plane (Z-0):** `#F8FAFC` background canvas.
2. **Structural Plane (Z-1 - Cards, Tables, Unit Blocks):** Pure white `#FFFFFF` surface with a crisp 1px perimeter border (`#E2E8F0`) and subtle ambient shadow (`0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`).
3. **Interactive & Hover Plane (Z-2 - Unit Hover, Popovers, Dropdowns):** Elevated with `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)` and border tint `#CBD5E1`.
4. **Overlay / Drawer Plane (Z-3 - Property Configuration Modal, Tenant Ledger Slider):** Supported by a 30% slate backdrop blur (`rgba(15, 23, 42, 0.35)` with `backdrop-filter: blur(4px)`) and a directional drop shadow (`0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)`).

High-contrast drop shadows are strictly avoided to maintain clarity across dense numerical grids.

## Shapes

The design uses balanced, modern geometry (`roundedness: 2`). 

### Radius Architecture
- **Micro Radii (`0.25rem` / 4px):** Checkboxes, radio indicators, unit status indicator dots, internal utility meter micro-badges.
- **Base Components (`0.5rem` / 8px):** Form controls, inputs, action buttons, table row selections, unit matrix cards, and operational dropdown menus.
- **Container Level (`0.75rem` - `1rem` / 12px - 16px):** Main analytics summary cards, branch configuration modals, and floor plan zoning containers.
- **Pill Shapes (`9999px`):** Reserved exclusively for dynamic status tags (e.g., "Đang thuê", "Quá hạn") and filter counters.

## Components

### Buttons & Actions
- **Primary:** Teal fill (`#0F766E`), white text, `0.5rem` radius, subtle top inset highlight. Active state deepens to `#115E59`.
- **Secondary / Digitized:** Indigo tint or stroke (`#4F46E5`), used for smart-meter sync, e-invoicing exports, and tenant portal communications.
- **Destructive:** Soft crimson background (`#FEF2F2`) with red text (`#DC2626`) for initial state, transitioning to full `#DC2626` fill upon secondary confirmation (e.g., "Chấm dứt hợp đồng").
- **Sizes:** Compact (32px height) for table row actions; Standard (40px) for page tools; Large (48px) for primary workflow gates.

### Status Indicators & Badges (Unit Status Matrix)
Statuses rely on dual coding—color paired with high-contrast text and a 6px status bead:
- **Đang thuê (Occupied):** Muted Teal/Emerald tint (`bg: #F0FDF4`, `border: #BBF7D0`, `text: #166534`, dot: `#16A34A`).
- **Phòng trống (Vacant):** Neutral Slate tint (`bg: #F8FAFC`, `border: #E2E8F0`, `text: #475569`, dot: `#94A3B8`).
- **Đang sửa chữa (Maintenance):** Amber tint (`bg: #FFFBEB`, `border: #FDE68A`, `text: #92400E`, dot: `#D97706`).
- **Chưa thanh toán / Nợ tiền (Unpaid / Overdue):** Light rose tint (`bg: #FEF2F2`, `border: #FECACA`, `text: #991B1B`, dot: `#DC2626`).

### Summary Metric Cards (Thẻ thống kê)
- Structured with an upper metadata row: metric title (e.g., "Doanh thu tháng này", "Tỷ lệ lấp đầy"), date scope selector, and an icon encased in a 10% tinted rounded container.
- Main numeric metric displayed in `numeric-metric` token size.
- Footer row includes a directional trend badge (e.g., `+4.2% so với tháng trước`) colored according to polarity (positive = green, negative = red).

### Data Tables (Bảng quản lý cơ sở & hợp đồng)
- **Header:** Sticky positioning, background `#F8FAFC`, 12px uppercase label text (`#64748B`), separated by a bottom border `#E2E8F0`.
- **Rows:** Alternating hover state (`#F8FAFC`), explicit height (48px for compact lists, 60px for tenant details with subtext).
- **Inline Actions:** Right-aligned icon buttons appearing on hover to minimize visual noise.

### Unit Grid Matrix (Sơ đồ phòng trực quan)
- Represented as modular tiles grouped by floor/block.
- Each tile displays: Room Number (e.g., `P.301`), Room Type tag (`Studio`, `1BR`, `Duplex`), Tenant Name (or "Trống"), monthly rental amount, and a colored left border stripe signaling real-time status.

### Modals & Drawers (Cấu hình chi nhánh & phòng)
- **Branch Configuration Modal:** Two-column grid inside a 680px container. Section 1 covers branch identity and bank account mapping; Section 2 handles automated utility pricing formulas (điện bậc thang, nước khối, phí dịch vụ cố định).
- **Ledger Slide-over Drawer:** Anchored to the right viewport edge (480px width), featuring a vertical timeline of invoice events, payment confirmations, and automated SMS/Zalo tenant reminders.

### Occupancy Chart (Biểu đồ tỷ lệ lấp đầy)
- Clean area/spline or rounded bar chart rendering monthly occupancy percentages.
- Uses Teal gradient fills (`rgba(15, 118, 110, 0.2)` to transparent) with an anchor line at `#0F766E`.
- Benchmark reference line set at target operational breakeven (e.g., `85%`) marked with a subtle dashed Slate outline.