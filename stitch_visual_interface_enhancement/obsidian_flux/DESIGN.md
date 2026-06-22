---
name: Obsidian Flux
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
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4fdbc8'
  on-secondary: '#003731'
  secondary-container: '#04b4a2'
  on-secondary-container: '#003f38'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#71f8e4'
  secondary-fixed-dim: '#4fdbc8'
  on-secondary-fixed: '#00201c'
  on-secondary-fixed-variant: '#005048'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  code-xs:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1440px
---

## Brand & Style

The design system is engineered for the "Agent Data Browser," a tool for developers to monitor and interact with autonomous AI agents. The brand personality is **technical, precise, and authoritative**, evoking the feeling of a high-end command center. It balances the "hacker" aesthetic with professional reliability.

The design style is a hybrid of **Minimalism and subtle Glassmorphism**, set against a deep, multi-layered dark theme. The interface prioritizes high information density and structural clarity. It uses sharp internal logic—modular components, crisp borders, and purposeful motion—to ensure that complex data streams remain legible and actionable. The emotional response is one of "calm control" amidst high-velocity data.

## Colors

This design system utilizes a **Deep Charcoal and Navy** foundation to reduce eye strain during long debugging sessions.

- **Primary (Indigo):** Used for primary actions, active states, and focus indicators.
- **Secondary (Teal):** Reserved for "Success" states, agent completion signals, and healthy data streams.
- **Tertiary (Amber):** Used for warnings, pending states, and highlighting specific tokens within data snippets.
- **Neutrals:** A range of slates and navies define the hierarchy of the "containers within containers" architecture.
- **Semantic Accents:** Use high-vibrancy variations of these colors for small-scale indicators (e.g., status pips) to ensure they pop against the dark background.

## Typography

The typography strategy employs a dual-font approach to differentiate between UI controls and machine data.

- **Interface UI:** Uses **Inter** for all headings and body copy. It is legible, neutral, and scales perfectly across densities. Use tighter letter spacing for large headings.
- **Technical UI:** Uses **Geist** for labels and small UI metadata to provide a sharper, technical feel.
- **Data Snippets:** Uses **JetBrains Mono** for all agent logs, JSON payloads, and terminal outputs. The increased x-height and clear character distinction are vital for error spotting.

## Layout & Spacing

The layout utilizes a **12-column Fluid Grid** on desktop and a **4-column grid** on mobile. The system is designed for high information density, using a 4px base unit for a tight "technical" rhythm.

- **Information Density:** Components should use `8px` or `12px` internal padding (2x-3x units) to maximize content visibility.
- **Modular Panels:** Layouts are composed of "Sidebars," "Inspectors," and "Main Viewports." Sidebars should be collapsible to allow the data browser to expand.
- **Gaps:** Use a standard `16px` gutter between major modules. For data-rich tables, reduce vertical padding to `4px` or `8px` per row.

## Elevation & Depth

Hierarchy is established through **Tonal Layers and Low-Contrast Outlines** rather than heavy shadows.

- **Level 0 (Background):** The deepest navy (`#020617`).
- **Level 1 (Panels):** Slightly lighter slate (`#0F172A`) with a subtle `1px` border (`#1E293B`).
- **Level 2 (Popovers/Modals):** Floating elements use a translucent background (`rgba(30, 41, 59, 0.8)`) with a `backdrop-filter: blur(12px)` and a thin, luminous top-border to simulate a light source from above.
- **Interactive States:** Use a glow effect (inner-shadow) with the primary indigo color to indicate focus or active agent processes.

## Shapes

The shape language is **Soft but Precise**. While the overall vibe is technical and sharp, the use of a small border-radius prevents the UI from feeling aggressive.

- **Standard Elements:** Buttons, inputs, and cards use a `4px` radius (`0.25rem`).
- **Data Blocks:** Code blocks and log entries use a `2px` radius for a more "terminal-like" appearance.
- **Status Pips:** Small indicators for agent health are perfect circles.

## Components

### Buttons & Controls
- **Primary:** Solid Indigo background with white text. No gradient.
- **Ghost:** Transparent background with a `1px` border of `#334155`. On hover, the border brightens.
- **Action Icons:** 16px icons within 32px hit zones for dense toolbars.

### Agent Status Chips
- Small, pill-shaped indicators.
- **Active:** Pulsing teal dot + "Running" label.
- **Idle:** Solid slate dot + "Paused" label.
- **Error:** Soft amber background with dark amber text for high visibility.

### Data Cards & Logs
- Modular containers with a `1px` border. 
- Header of the card uses a slightly darker sub-fill to separate metadata from the content body.
- Monospace snippets within cards should have a background of `#020617` (Level 0) to create an "inset" look.

### Input Fields
- Dark backgrounds (`#020617`) with a subtle `1px` border.
- Focus state: The border changes to Primary Indigo with a `0 0 0 2px` outer glow.

### Inspector Panels
- Vertical lists for key-value pairs (e.g., `Agent ID: 0x4f2...`).
- Use `label-caps` for the keys and `code-sm` for the values.