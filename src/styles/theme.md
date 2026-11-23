# Firelle theme — earth tones

Warm white, sand, latte, mocha, terracotta, sage. Premium, calm, feminine-neutral.
**Single source of truth:** `src/app/globals.css` (`:root`, `.dark`, `@theme inline`).
`tailwind.config.ts` mirrors the same names for tooling. Components only use semantic classes.

Live spec: `/dev/theme` (development only — returns 404 in production).

## Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--background` | `#FDFBF7` | `#1F1814` | App canvas, never a card |
| `--foreground` | `#3B2F2A` | `#F3EBE0` | Body text, headings |
| `--card` | `#FFFFFF` | `#2A211B` | Dialogs, drawers, tables, cards |
| `--primary` | `#7A5C45` | `#C9A98A` | Primary actions, active nav, brand |
| `--secondary` | `#EFE7DA` | `#3A2E26` | Secondary buttons, soft panels, row hover |
| `--muted` | `#F5F0E8` | `#33291F` | Table headers, skeletons, quiet surfaces |
| `--muted-foreground` | `#756455` | `#B5A290` | Helper text, labels, metadata |
| `--accent` | `#E6D5C3` | `#4A3A30` | Hover/selected surface, latched chips |
| `--border` / `--input` | `#E7DDCF` | `#43362C` | All hairlines and field borders |
| `--ring` | `#A8805F` | `#C9A98A` | Focus ring — never removed |
| `--destructive` | `#A94B39` | `#D9735F` | Delete/void, loss, negative stock |
| `--success` | `#6B8F6B` | `#8FA88F` | In stock, profit, completed |
| `--warning` | `#C79A3B` | `#E0B45C` | Low stock, selling below cost |
| `--info` | `#7C8FA0` | `#9DB0C2` | Neutral system notices |

Each semantic colour also has `--{name}-foreground` (text on its tint) and
`--{name}-tint` (12% / 16% background for badges). Classes: `bg-success/12`,
`text-success-foreground`, `border-success/25`.

Charts: `chart-1` mocha, `chart-2` terracotta, `chart-3` sage, `chart-4` camel,
`chart-5` taupe (`--color-chart-1..5`).

## Type

- `font-heading` — Cormorant Garamond 600: page titles, dashboard numbers,
  receipt store name, wordmark.
- `font-sans` — DM Sans 400/500/600: everything else (UI, labels, body).
- `font-mono` + `tabular-nums` — SKU, barcode, every Rupiah/number column.

## Shape & elevation

`--radius: 0.75rem` (cards/dialogs 12px, inputs 8px, pills full).
One warm shadow: `shadow-warm` = `0 1px 2px rgba(59,47,42,.06)`; modals may use
`shadow-warm-lg`. No gradients except the optional sand wash on the login hero.
Focus is always visible: 2px `--ring` with 2px offset.

## Badges

Always **icon + label + tint** (colour-blind safe):

| Meaning | Component | Icon | Tint |
| --- | --- | --- | --- |
| In stock / completed / IN | `StatusBadge variant="completed" \| "in"` | CheckCircle | success |
| Low stock / selling below cost | `variant="low"` | AlertTriangle | warning |
| Out of stock / void / OUT | `variant="out-of-stock" \| "void" \| "out"` | XCircle | destructive |
| Archived | `variant="archived"` | Archive | muted |
| Margin positive | `text-success-foreground` | — | — |

`MoneyText` renders `Rp` in `id-ID` with `tabular-nums`; `direction="in" | "out"`
colours it sage/brick.

## Rules

- No palette classes (`bg-blue-500`, `text-gray-400`, `slate`, `zinc`) and no hex
  in `className` / inline styles. Use tokens only.
- Tables: header `bg-muted`, row hover `bg-secondary/40`, **no zebra**.
- Touch targets ≥ 44px (`default`/`icon` button sizes, inputs, nav items).
- Print (`@media print`) stays monochrome for thermal printers; only the store
  name keeps `font-heading`.

## Documented contrast adjustments

- `--muted-foreground` light: `#8A7868` → `#756455`. The original was 4.09:1 on
  `#FDFBF7`; the darker tone is 5.5:1 and still reads as warm taupe.
- `--destructive` light: `#B4533F` → `#A94B39`. On white it was fine (4.9:1) but
  as 11px text on its own 12% tint it fell to 4.33:1. `#A94B39` gives 4.9:1 on
  the tint and 5.6:1 with white text on solid buttons.
- `--warning-foreground` / `--info-foreground` / `--success-foreground` are dark
  ink tones (not the accent itself) so badge labels clear AA in light mode; dark
  mode uses the lightened accents directly.
