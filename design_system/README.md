# Agentes Virtuais — Design System

## Overview

**Agentes Virtuais** (formerly AutoSales / VendAi) is a Brazilian B2B SaaS platform that sells AI-powered SDR (Sales Development Representative) automation. The core product automates WhatsApp prospecting, lead qualification (via Gemini AI), CRM pipelines, and appointment scheduling — all in one "Premium SaaS" dashboard focused on high conversion. The company also operates a separate marketing/portfolio website (`agentesvirtuais_novosite`) showcasing their services.

### Products

| Product | Repo | Description |
|---|---|---|
| **AutoSales App** | `robertosouzajr7/autosales` | Full SaaS dashboard: CRM, Conversations, SDR management, Automations, Analytics, Scheduling |
| **Marketing Website** | `robertosouzajr7/agentesvirtuais_novosite` | Portfolio/landing page with dark/light mode, framer-motion animations |

### Contact
- Email: contato@agentesvirtuais.com
- WhatsApp: 71 99204-2802
- Address: Rua Vereador Zezeu Ribeiro, 1117, Boca da Mata, Salvador - Ba. CEP: 41.345-100
- © 2026 Agentes Virtuais

---

## CONTENT FUNDAMENTALS

### Language & Tone
- **Portuguese (Brazilian)** exclusively. All UI copy is pt-BR.
- **Voice:** Authoritative, high-energy, sales-acceleration focused. The brand speaks like a confident SDR closer — direct, urgent, ambitious.
- **Person:** Speaks TO the customer (você/seu), never about itself abstractly. Highly transactional and benefit-focused.
- **Energy level:** HIGH. Never passive or corporate. Uses power words: *"Scale", "Infinitos", "Premium", "Estratégico", "Real-time"*, etc.

### Casing & Typography Rules
- Section titles often MIX cases: normal sentence-case for most words, but key phrases in **italic** for emphasis: `"Scale suas Vendas com *SDRs Infinitos* de IA."`
- Micro-labels: ALL CAPS + extreme letter-spacing (`tracking-widest`): `"REAL-TIME PERFORMANCE METRICS"`
- Feature names: Title Case, often with action words: `"Workflow No-Code"`, `"Agentes IA & Score GenAI"`
- CTA buttons: ALL CAPS or Title Case, `font-black`: `"Testar a Plataforma Agora"`, `"Começar Trial Grátis"`
- Badge labels: ALL CAPS tiny: `"A NOVA GERAÇÃO DE VENDAS B2B ESTÁ AQUI"`

### Copy Patterns
- Urgency + benefit stacking: *"Automatize seu WhatsApp, qualifique leads 24h por dia..."*
- Numbers as proof: *"7 dias grátis"*, *"SDRs Infinitos"*, *"Score de 0 a 100"*
- Contrast headlines: pair a pain with a solution in the same sentence
- Micro-stats everywhere: token usage %, conversion rates, lead counts
- Sub-labels under main metrics use `uppercase tracking-widest text-[10px]` in muted color

### Emoji Usage
- **None** in the main product UI (AutoSales dashboard).
- Occasional use in informal/marketing contexts (website), but minimal.
- No emoji as icons or bullets.

### Examples of Real Copy
- Hero: *"Scale suas Vendas com SDRs Infinitos de IA."*
- Sub-headline: *"Você foca apenas em fechar negócios."*
- Feature card: *"A IA não apenas responde o WhatsApp, ela qualifica e pontua o Lead (Score de 0 a 100)..."*
- Dashboard header: *"Painel Estratégico"* + sub-label *"Real-time Performance Metrics & AI Insights"*
- Empty state: *"Aguardando novos leads..."*
- CTA: *"Começar Agora"*, *"Acessar Central SDR"*, *"Ver Pipeline"*

---

## VISUAL FOUNDATIONS

### Color System

#### AutoSales App (Dark + Light Contrast)
| Role | Value | Usage |
|---|---|---|
| `bg-slate-50` | `#f8fafc` | Main app background, card backgrounds |
| `bg-white` | `#ffffff` | Cards, panels, inputs |
| `bg-slate-900` | `#0f172a` | Sidebar, dark cards, dark sections, pricing |
| `emerald-500` | `#10b981` | Primary accent: active nav, badges, CTAs, success |
| `blue-500` | `#3b82f6` | Data visualization, feature icons |
| `purple-500` | `#8b5cf6` | Secondary icons, AI/smart features |
| `orange-500` | `#f97316` | KPI trends, warnings |
| `rose-500` | `#f43f5e` | Danger/destructive |
| `slate-400` | `#94a3b8` | Muted body text, labels |
| `slate-200` | `#e2e8f0` | Borders, dividers |

#### Marketing Website (Blue-Purple Gradient)
| Role | Value | Usage |
|---|---|---|
| Blue-Purple gradient | `from-blue-500 via-purple-500 to-blue-600` | Logo, hero accents, primary buttons |
| Glass backgrounds | `bg-white/40` or `bg-gray-900/40` + `backdrop-blur-xl` | Navigation pill |
| Dark mode bg | `bg-gray-900` | Dark variant backgrounds |

### Typography
- **Font family:** `system-ui` via Tailwind's default `font-sans` — **zero font imports, zero load time**. No custom webfonts are used intentionally.
  - macOS / iOS → **San Francisco (SF Pro)**
  - Windows → **Segoe UI**
  - Android → **Roboto**
  - Linux → Ubuntu / Cantarell
  - For design previews and AI prompts: use **Inter** or **SF Pro** as the closest simulation of this aesthetic.
- **Weight scale:** `font-medium` (500) → `font-bold` (700) → `font-black` (900). The brand almost exclusively uses 700 and 900.
- **Display / Hero:** `font-black tracking-tighter leading-[0.9]` — extremely tight, massive
- **Section titles:** `font-black tracking-tighter text-4xl–7xl`
- **UI labels / badges:** `font-black uppercase tracking-widest text-[9px]–text-[11px]`
- **Body:** `font-medium text-slate-500 leading-relaxed`
- **Italic accent:** Key phrases inside headings use `italic` for dramatic emphasis

### Backgrounds
- **App:** Pure white or `slate-50` for main areas; `slate-900` for sidebar + dark accent cards
- **Landing page:** Alternates `bg-slate-50` (hero) → `bg-white` (features) → `bg-slate-900` (pricing) → `bg-white` (footer)
- **Decorative "glass blobs":** Absolutely positioned blurred circles inside `relative overflow-hidden` containers. Pattern: `<div class="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />`. Used on dark cards and dark sections for ambient ambient glow.
- **No full-bleed imagery, no patterns, no textures** — strictly clean, minimal surfaces

### Cards
- **Rounding:** Extreme — `rounded-[40px]` and `rounded-[45px]` standard; `rounded-3xl` for smaller elements; `rounded-2xl` for buttons/inputs
- **Border:** `border-none` on cards — shadow provides definition instead. Occasional `border-2 border-slate-50` for subtle edge
- **Shadow:** Deep (`shadow-xl`, `shadow-2xl`, `shadow-3xl`). Dark cards on dark backgrounds use `shadow-[0_50px_100px_rgba(0,0,0,0.2)]`
- **Hover:** `hover:shadow-2xl hover:translate-y-[-8px]` — cards "lift" on hover. Sometimes `hover:border-primary/20` reveals a faint border
- **Bottom-border accent:** Active/featured cards use `border-b-8` with brand color
- **Dark card pattern:** `bg-slate-900` with decorative glow blobs + `relative overflow-hidden`

### Buttons
- **Primary CTA:** `h-16 px-10 bg-slate-900 text-white rounded-[28px] font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 active:scale-95` — tall, near-black, all-caps micro-text
- **Positive/accent CTA:** `h-16 px-10 bg-emerald-500 text-white rounded-[28px] font-black hover:scale-105` — emerald glow
- **Outline/Ghost:** `h-14 bg-slate-50 border-none rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100`
- **Rule:** Buttons are always tall (`h-14`/`h-16`) for a tactile "premium" feel — never the standard short button
- **Active/press:** `active:scale-95` — shrink on press always

### Inputs
- **Classes:** `h-14 bg-slate-50 rounded-2xl px-6 font-bold border-none focus:ring-2 focus:ring-emerald-500/20 outline-none` — pill-inflated, no visible border
- Height: `h-14` standard, `h-16` on login/auth forms
- Background: `bg-slate-50` — never white directly, always slightly off
- **No hard border** — relies on background color + focus ring for definition
- Leading icon always present where applicable (Mail, Lock, Search)
- Label: `text-[10px] font-black uppercase tracking-widest text-slate-400`

### Animations & Motion
- **App:** CSS transitions only. `transition-all duration-300` or `duration-500`. No spring physics.
- **Website:** Framer Motion — `fade-in + y: 30→0`, staggered with `delay: 0.2` increments
- **Hover scale:** `hover:scale-105` on CTAs; `hover:scale-110` on icon containers
- **Press:** `active:scale-95` on all interactive buttons
- **Loading:** `animate-spin` for spinners; `animate-pulse` for typing indicators
- **In-page transitions:** `animate-in slide-in-from-bottom-10 duration-500` for modals/chat

### Icon System
- **Library:** `lucide-react` exclusively (stroke-based, consistent weight)
- **Size convention:** `w-4 h-4` (14px) in text; `w-5 h-5` in list items; `w-6 h-6` in cards; `w-8 h-8` in large feature icons; `w-10 h-10` in hero elements
- **Icon containers:** `rounded-3xl` or `rounded-2xl` with colored tinted background (e.g., `bg-blue-50 text-blue-500`). On hover: full color fill with white icon (`group-hover:bg-blue-500 group-hover:text-white`)
- **Active nav icons:** `text-emerald-400` in sidebar

### Spacing & Layout
- **Card padding:** `p-10` standard; `p-6` tight; `p-12` generous
- **Section spacing:** `py-20`, `py-32`, `py-40` for marketing sections
- **Grid gaps:** `gap-6`, `gap-8`
- **Max widths:** `max-w-4xl` (hero text), `max-w-7xl` (full-width sections), `max-w-[1600px]` (dashboard)
- **Sidebar:** 260px expanded, 68px collapsed

### Corner Radii (Design Token Reference)
| Token | Value | Usage |
|---|---|---|
| `rounded-xl` | 12px | Small elements, badges |
| `rounded-2xl` | 16px | Buttons, inputs |
| `rounded-3xl` | 24px | Icon containers, small cards |
| `rounded-[40px]` | 40px | Standard cards |
| `rounded-[45px]` | 45px | Large feature cards |
| `rounded-full` | 50% | Avatars, pills, FAB buttons |

### Imagery
- Screenshots of the actual product UI (in `assets/screenshots/`)
- No illustrations, no stock photos found in codebase
- Background decorations: blurred circles / blobs only (CSS, no images)

---

## ICONOGRAPHY

- **Icon system:** `lucide-react` v0.462.0 — all icons are stroke-based SVGs, consistent line weight
- **CDN available:** Yes — `https://unpkg.com/lucide@latest/dist/umd/lucide.js` or via React (`lucide-react`)
- **No custom icon font** and **no PNG icon set** found in the codebase
- **No emoji used** as icons in the product UI
- **Colored icon containers:** Icons are placed in `rounded-3xl` boxes with a tinted background color matching the icon's semantic meaning (blue=data, purple=AI, emerald=success, orange=metrics, rose=danger, indigo=scheduling)
- **Common icons used:**
  - `Target` — brand logo icon / prospecting
  - `Bot` — AI SDR agents
  - `Zap` — automations / energy
  - `MessageSquare` — conversations / chat
  - `Users` — CRM / leads
  - `Calendar` — appointments
  - `BarChart3` — analytics
  - `TrendingUp` — performance
  - `Shield` / `ShieldCheck` — security / admin
  - `Send` — bulk messaging
  - `Phone` — WhatsApp / calls
  - `Mail` — email
  - `Globe` — integrations

---

## FILE INDEX

```
/
├── README.md                    ← This file
├── SKILL.md                     ← Agent skill definition
├── colors_and_type.css          ← All CSS variables: colors, type, spacing tokens
├── assets/
│   ├── favicon.ico              ← App favicon
│   ├── logo.svg                 ← Agentes Virtuais wordmark SVG
│   └── screenshots/             ← Real product screenshots
│       ├── dashboard.png
│       ├── crm.png
│       ├── sdrs.png
│       ├── automations.png
│       ├── appointments.png
│       └── connections.png
├── preview/                     ← Design System tab cards
│   ├── colors-base.html
│   ├── colors-semantic.html
│   ├── colors-dark.html
│   ├── type-scale.html
│   ├── type-specimens.html
│   ├── spacing-radii.html
│   ├── spacing-shadows.html
│   ├── components-buttons.html
│   ├── components-inputs.html
│   ├── components-cards.html
│   ├── components-badges.html
│   ├── components-kpi.html
│   ├── components-sidebar.html
│   └── brand-logo.html
└── ui_kits/
    ├── app/                     ← AutoSales SaaS App UI Kit
    │   ├── README.md
    │   ├── index.html           ← Interactive app prototype
    │   ├── Sidebar.jsx
    │   ├── KpiCard.jsx
    │   ├── DashboardPage.jsx
    │   └── CRMPage.jsx
    └── website/                 ← Marketing website UI Kit
        ├── README.md
        └── index.html           ← Marketing site prototype
```
