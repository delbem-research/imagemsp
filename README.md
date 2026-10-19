# IMAGEM:SP — Interactive Map of Aging for the City of São Paulo

Public territorial visualization platform for population ageing in São Paulo, developed under the FAPESP project. Enables managers, researchers, and citizens to explore data on elderly population, health services, mobility, and urban conditions by municipal district.

---

## Table of Contents

- [About](#about)
- [Stack](#stack)
- [Architecture](#architecture)
- [Routes](#routes)
- [Route /mapas](#route-mapas)
- [Data](#data)
- [Development](#development)
- [Quality](#quality)
- [Roadmap](#roadmap)

---

## About

**IMAGEM:SP** answers the central question:

> **Where is the potential pressure from ageing greatest, and where is basic service coverage lowest, by territory?**

The application displays a choropleth map of São Paulo municipal districts with elderly population indicators (65+), allows filtering by category and age group, and shows a legend panel with threshold-based classification.

---

## Stack

| Category  | Technology                             |
| --------- | -------------------------------------- |
| Framework | Next.js 16 (App Router)                |
| UI        | React 19 + Chakra UI v3                |
| Map       | MapLibre GL + `@ttoss/geovis`          |
| Language  | TypeScript ~6                          |
| Styles    | Chakra UI (no Tailwind)                |
| Icons     | `@iconify/react`                       |
| Tests     | Jest + `@ttoss/config`                 |
| Linting   | ESLint 9 + Prettier                    |
| CI        | GitHub Actions (typecheck, lint, test) |
| Manager   | pnpm                                   |
| Node      | ≥ 24                                   |

---

## Architecture

```
src/
├── app/
│   ├── (default)/         # Homepage and informational pages (with Header/Footer)
│   ├── (features)/        # Feature pages (layout without editorial footer)
│   │   └── mapas/         # Interactive map /mapas
│   ├── (internal)/        # Internal pages
│   └── (legal)/           # Terms, cookies, accessibility
├── components/
│   ├── map/               # CategoryMenu, LegendPanel
│   │   └── lib/           # mapConfig, indicators, icons (canonical)
│   ├── site/              # Header, Footer
│   ├── layouts/           # DefaultLayout, FeaturesLayout, LegalLayout
│   └── ui/                # Chakra primitives (Provider, tokens)
├── config/
│   ├── navigation.ts      # mainNav, footerNavGroups, legalNav
│   ├── theme.ts           # Custom Chakra tokens
│   └── locales.ts
├── data-source-static/    # Reads pre-computed JSON snapshot (readStaticMapsData)
├── data-gateway/          # Transformers + typed schema (MapsDataContract)
└── gateway.ts             # Gateway singleton instance
```

The `data-source-static` layer reads the pre-computed `maps-data.json`. The `data-gateway` transforms raw data into the `MapsDataContract` contract, ensuring separation between data source and application domain.

---

## Routes

| Route                 | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `/`                   | Editorial homepage (Hero, themes, how it works, data sources) |
| `/mapas`              | Interactive ageing map by district                            |
| `/sobre`              | About the project                                             |
| `/oportunidades`      | Collaboration opportunities                                   |
| `/contato`            | Contact                                                       |
| `/termos`, `/cookies` | Legal pages                                                   |

---

## Route /mapas

The `/mapas` route renders an interactive choropleth map of São Paulo's 96 municipal districts showing population ageing indicators.

### Visualization

- **Choropleth map** rendered by [MapLibre GL](https://maplibre.org/) via the [`@ttoss/geovis`](https://github.com/ttoss/ttoss) adapter.
- **GeoJSON source**: `public/distrito-municipal-v2.geojson` — São Paulo municipal district boundaries. Carries geometry and a feature `id` only (`properties` is `null`); every label and value is joined from the data by that id.
- **Color scale**: ColorBrewer Blues-7 (`#c6dbef` → `#08306b`) in `src/components/map/lib/mapConfig.ts`, 7 bands. Breaks live in `src/config/thresholds.ts`, one set per indicator series, each fitted to that series' full-period range and **fixed across years** so a colour means the same share in 2000 and in 2050.
- **Projection-year timeline**: a `timeline` control in the left sidebar walks the quinquennial series 2000–2050 with play/pause, publishing the year into the workspace selection. The legend heading carries the active year.
- **Camera fitted to the viewport**: the whole district mesh is framed on any screen size at load, computed in `src/components/map/lib/mapCamera.ts` (geovis takes only `center`/`zoom`, so there is no `fitBounds` to delegate to). It refits on rotation but not on window resize, which would pull the camera away from wherever the user had panned. The left sidebar starts open only above 480px, below which it covers the map entirely.
- **Hover tooltip**: `GeoVisHoverTooltip` renders district name, percentage value, and absolute counts (numerator / denominator) for the selected indicator.

### Filters

| Component      | Location                          | Description                                           |
| -------------- | --------------------------------- | ----------------------------------------------------- |
| `CategoryMenu` | `src/components/map/CategoryMenu` | Slide-out panel with category and age group selectors |
| `LegendPanel`  | `src/components/map/LegendPanel`  | Fixed panel showing color bands and value ranges      |

**Category options** (`Category` type):

| Value               | Description                                 |
| ------------------- | ------------------------------------------- |
| `cumulative-total`  | Elderly population as % of total population |
| `cumulative-65plus` | Subgroup as % of the 65+ population         |
| `5year-65plus`      | 5-year age band as % of the 65+ population  |

**Age group options** (`Group` type): `65`, `70`, `75`, `65-69`, `70-74` — available groups vary by category.

### Data flow

```
evolucao_msp_pop_sexo_idade.csv (SEADE, versioned in data/raw/)
  └─ scripts/generateMapsData.ts  # offline; run when the CSV changes
       └─ maps-data.json (static) # 96 districts × 11 years
            └─ readStaticMapsData()        # data-source-static
                 └─ toAppMapsData()        # data-gateway transformer
                      └─ MapsDataContract  # prop to MapsView (client component)
                           └─ buildMapRows()  # rates for the active year/series
                                └─ buildSpec() # VisualizationSpec for @ttoss/geovis
```

The snapshot holds **absolute counts**, not rates. The eight indicator series are ratios of four numbers, and the timeline multiplies them by eleven years: pre-computing all of them server-side would ship roughly 700 kB of rows to the browser against 94 kB for the counts, to save 96 divisions per timeline tick. So `buildMapRows` derives the rates per selection, client-side.

The gateway injects `SERIES_THRESHOLDS` at transformation time — thresholds are never read from the JSON source — and rejects a snapshot whose years are unevenly spaced, since the timeline walks a constant step.

---

## Data

Population figures come from SEADE's projections by sex and age, per municipal district. The source CSV is versioned at `src/data-source-static/data/raw/evolucao_msp_pop_sexo_idade.csv` and aggregated offline into `src/data-source-static/data/maps-data.json` by `scripts/generateMapsData.ts`:

```bash
node scripts/generateMapsData.ts            # default CSV
node scripts/generateMapsData.ts other.csv  # another export
```

The series is **quinquennial, 2000 to 2050, and entirely projected** — the past years are the model's figures for them, not the censuses taken in those years. That keeps one methodology across the whole series, so it is comparable end to end, but the values do not match census counts.

**Canonical schema (`MapsDataContract`):**

```ts
type Category = 'cumulative-total' | 'cumulative-65plus' | '5year-65plus';
type Group = '65' | '70' | '75' | '65-69' | '70-74';

/** Absolute counts for one district in one projection year. */
type DistrictCounts = {
  geometryId: number;
  name: string;
  year: number;
  count65to69: number;
  count70to74: number;
  count75plus: number;
  total: number; // every age — the share-of-total denominator
};

type MapsDataContract = {
  years: number[]; // ascending, evenly spaced; drives the timeline
  thresholds: Record<Category, Partial<Record<Group, number[]>>>;
  counts: DistrictCounts[]; // one entry per district per year
};
```

`buildMapRows` (`src/components/map/lib/mapRows.ts`) turns those counts into the map's `MapDataRow[]` for the active year and series — the category decides the denominator (the district's whole population, or its own 65+ population) and the group decides the numerator.

### Geographic levels

The "Recorte" chips, in the "Filtros" tab, paint the choropleth by district, subprefeitura, health supervision (STS, 26) or health coordination (CRS, 5). Every level above the districts is a sum of whole districts, done by the gateway per request, so the levels never disagree and every rate is re-derived from summed counts. The groupings come from GeoSampa and are generated offline, with their polygons in `public/`:

```bash
node scripts/generateSubprefeituras.ts          # subprefeituras.json + subprefeituras.geojson
node scripts/generateHealthTerritoriesData.ts   # health-divisions.json + CRS/STS GeoJSON, and the UBS and Saúde da Família overlays
```

The subprefeitura division is versioned by year (Sapopemba split from Vila Prudente in 2013). The health division has no history in GeoSampa, so today's applies to the whole series. No GeoSampa layer tags a district with its STS, so the generator assigns each district by area and fails if any falls less than 95% inside one STS, or if its STS and CRS disagree.

---

## Development

```bash
# install dependencies
pnpm install

# development server
pnpm dev

# production build
pnpm build

# type check
pnpm typecheck

# lint (with auto-fix)
pnpm eslint --fix

# tests
pnpm test
```

> **Prerequisites:** Node ≥ 24 and pnpm.

### Conventions

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) with `commitlint`.
- Hooks via `husky` + `lint-staged` run typecheck and lint on the staged diff before each commit.
- Code in English; UI content in pt-BR.
- Arrow functions; no classes. Parameters as objects when > 1 argument.

---

## Quality

The CI (`/.github/workflows/pr.yml`) runs on every pull request:

1. `pnpm typecheck` — zero TypeScript errors
2. `pnpm lint` — zero ESLint warnings
3. `pnpm test` — minimum 10% coverage (branches, functions, lines, statements)

Coverage must never decrease — the threshold in `tests/unit/jest.config.ts` is updated with every code change.

---

## Roadmap

The minimum vertical slice **Ageing Maps V0** includes the following features not yet implemented:

| Feature                                    | Status                         |
| ------------------------------------------ | ------------------------------ |
| District data tooltip (hover)              | 🔄 In review (PR #11)          |
| Internationalisation pt-BR / en-US         | 🔄 In review (PR #5, Issue #4) |
| UBS points layer (service supply)          | ⏳ Planned                     |
| Territory detail side panel                | ⏳ Planned                     |
| A vs B comparison panel                    | ⏳ Planned                     |
| URL permalink with state (`?ind=&ubs=&t=`) | ⏳ Planned                     |
| Territory search by name                   | ⏳ Planned                     |
| Priority GAP indicator (composite)         | ⏳ Planned                     |
| Vulnerability proxy indicator              | ⏳ Planned                     |
| % 60+ population indicator                 | ⏳ Planned                     |
| `/metodologia` page                        | ⏳ Planned                     |

---

## License

Private repository — Delbem Research and Innovation / FAPESP. All rights reserved.
