# Architecture

This document describes the high-level architecture of Histoboard, a pathology foundation model leaderboard built with Next.js and TypeScript.

## System Overview

Histoboard is a **static-first web application**. All benchmark data lives in JSON files that are imported at build time — there are no runtime API calls or database queries. The build produces a static HTML export deployed to GitHub Pages.

```
JSON data files ──build──> Static HTML/JS ──deploy──> Cloudflare Pages
```

This design ensures:
- **Fast page loads** — no API latency, data is bundled into the JavaScript
- **Simple hosting** — any static file server works (GitHub Pages, Cloudflare, Netlify)
- **Reproducibility** — the entire state of the dashboard is versioned in git
- **No backend** — zero operational complexity

## Directory Structure

```
histoboard/
├── frontend/                       # Next.js application
│   ├── src/
│   │   ├── app/                    # Pages (Next.js App Router)
│   │   ├── components/             # React components
│   │   │   ├── arena/              # Arena head-to-head comparison
│   │   │   ├── charts/             # Vega-Lite chart wrappers
│   │   │   ├── filters/            # Shared filter UI components
│   │   │   ├── layout/             # Header, Footer
│   │   │   ├── leaderboard/        # Leaderboard-specific filters
│   │   │   ├── tables/             # Benchmark result tables (14 files)
│   │   │   └── ui/                 # Shadcn/Radix UI primitives
│   │   ├── data/                   # Static JSON data (models, tasks, results, rankings)
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── lib/                    # Pure utility functions (no React)
│   │   └── types/                  # TypeScript type definitions
│   ├── next.config.ts              # Static export, base path config
│   ├── tailwind.config.ts          # Tailwind CSS v4
│   └── tsconfig.json               # Strict TypeScript, @/* path alias
│
├── scraper/                        # Python data monitoring & collection
│   ├── src/
│   │   ├── scrapers/               # Benchmark-specific scrapers
│   │   ├── normalizers/            # Model ID normalization
│   │   ├── exporters/              # JSON export to frontend/src/data/
│   │   ├── config.py               # Data source definitions (14 sources)
│   │   ├── main.py                 # Scraper orchestration
│   │   └── monitor.py              # Weekly change detection via SHA256 hashes
│   └── data/                       # Snapshots, hashes, change reports
│
├── ARCHITECTURE.md                 # This file
├── DEVELOPER_GUIDE.md              # Developer onboarding guide
└── CONTRIBUTING.md                 # Contribution guidelines
```

## Data Model

### Entities

```
Model ──────────────────┐
  id, name, params,     │
  license, org, ...     │
                        ▼
Benchmark ─────────> Result <──── Task
  id, name,          modelId       id, name, organ,
  shortName,         taskId        metric, category,
  category           value         benchmarkId
                     rank
                     source
```

### JSON Files (`frontend/src/data/`)

| File | Records | Description |
|------|---------|-------------|
| `models.json` | ~54 | Foundation model metadata (architecture, params, license, training data, URLs) |
| `benchmarks.json` | 13 | Benchmark definitions (name, category, task count, source URLs) |
| `tasks.json` | 400+ | Individual evaluation tasks (organ, metric, category, benchmark link) |
| `results.json` | ~7,800 | Performance scores — one record per (model, task) pair |
| `rankings.json` | ~230 | Pre-computed average ranks per (model, benchmark) pair |

### Key Type Definitions (`types/index.ts`)

- **`Model`** — ID, name, organization, architecture, params (string like "307M"), license (`open-source` | `non-commercial` | `closed-source`), modelType (`vision` | `vision-language`), trainingMethod, publication URLs
- **`Benchmark`** — ID, name, shortName, category array, organ list, task count
- **`Task`** — ID, name, benchmarkId, organ, metric (e.g. "balanced_accuracy"), category (e.g. "patch-level")
- **`Result`** — modelId, taskId, value (float), rank (int), source (benchmark ID), retrievedAt; optional `ciLower`/`ciUpper` for confidence intervals
- **`ModelRanking`** — Pre-computed average rank + task count per model per benchmark

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Build Time                                  │
│  data/*.json ──import──> pages ──generateStaticParams──> static HTML │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                          Runtime (Client)                            │
│                                                                      │
│  Page component                                                      │
│    │                                                                 │
│    ├── passes data to hooks ──────────────────────────────┐          │
│    │   useModelAttributeFilters(models)                   │          │
│    │   useTaskFiltering(tasks)                            │          │
│    │   useDetailedTableData({models, filteredTasks, results})        │
│    │                                                      │          │
│    ├── passes hook outputs to components ◄────────────────┘          │
│    │   <LeaderboardTable models={sortedModels} ... />                │
│    │   <VegaChart spec={chartSpec} />                                │
│    │   <MultiSelectDropdown selectedIds={filter.selected} ... />     │
│    │                                                                 │
│    └── user interaction loops back through hooks                     │
│        filter.toggle("breast") → re-filter → re-render              │
└──────────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

The frontend has four layers, each with a clear responsibility:

### Layer 1: Pages (`app/`)

Next.js App Router pages. Each page:
1. Imports static JSON data
2. Type-casts it (e.g., `modelsData as Model[]`)
3. Passes data to hooks for transformation
4. Renders components with the transformed data

Pages using dynamic routes (`[id]`) export `generateStaticParams()` to pre-render all variants at build time.

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Champion podiums (top 3 per benchmark), stats counters |
| `/leaderboard` | Leaderboard | Ranked table + scaling law charts with model attribute filters |
| `/models` | Model Browser | Card grid with attribute filters and search |
| `/models/[id]` | Model Detail | Profile page with metadata, badges, per-benchmark rankings |
| `/arena` | Arena | Head-to-head comparison of 2–5 models with task filters |
| `/benchmarks` | Benchmark Index | Overview cards for all 13 benchmarks |
| `/benchmarks/[id]` | Benchmark Detail | Per-benchmark results table (dispatches to custom component) |
| `/timeline` | Timeline | Model release dates visualized chronologically |
| `/news` | News | Chronological log of updates: new models, benchmark refreshes, feature additions |
| `/about` | About | Project description, benchmark summaries, methodology |

### Layer 2: Hooks (`hooks/`)

Custom React hooks encapsulate all stateful logic — filtering, ranking, data transformation. They use `useMemo` extensively to avoid recalculating on every render.

**Hook composition chain:**

```
useSetToggle (generic Set<T> state: toggle, selectAll, clearAll)
    │
    ├──> useTaskFiltering (composes 3 useSetToggle for organs, categories, task names)
    │       used by: benchmark tables, arena
    │
    ├──> useModelAttributeFilters (composes 9 useSetToggle for model attributes)
    │       │
    │       └──> useLeaderboardFilters (adds model selection on top)
    │               used by: leaderboard page
    │
    └──> useDetailedTableData (resultsMap, taskStats, avgRanks, sortedModels)
            used by: all benchmark tables
```

| Hook | Purpose |
|------|---------|
| `useSetToggle` | Generic toggle state backed by `Set<T>`. Foundation for all filters. |
| `useTaskFiltering` | Composes organ/category/task name filters with optional search. |
| `useModelAttributeFilters` | Filters models by size, data, training, license, year, type. |
| `useLeaderboardFilters` | Extends `useModelAttributeFilters` with per-model selection. |
| `useDetailedTableData` | Builds resultsMap, computes task stats/ranks, sorts models. Supports generic result types and custom metric extractors. |
| `useBenchmarkAxisLabel` | Derives readable axis labels from benchmark selection state. |

### Layer 3: Libraries (`lib/`)

Pure functions with zero React dependencies. Can be tested in isolation, imported by hooks or components.

| Module | Purpose |
|--------|---------|
| `utils.ts` | CSS class merging (`cn`), number formatting, value-to-color mapping |
| `modelFilters.ts` | Parse model params to size category, classify training method, license |
| `tableUtils.ts` | Table formatting helpers, organ grouping, metric parsing |
| `vegaSpecBuilder.ts` | Build Vega-Lite spec fragments: scatter layers, text labels, regression lines |
| `chartColors.ts` | 35-color palette, greedy label placement algorithm to avoid overlaps |
| `regression.ts` | Ordinary least-squares linear regression (slope, intercept, R-squared) |
| `scalingLaws.ts` | Scaling law fitting and prediction for model size vs. performance |

### Layer 4: Components (`components/`)

React components that receive data and render UI. No business logic — that lives in hooks and lib.

| Directory | Components | Description |
|-----------|-----------|-------------|
| `tables/` | 14 files | Benchmark result tables (1 leaderboard + 13 benchmark-specific) |
| `charts/` | 4 files | Vega-Lite chart wrappers and chart-specific data assembly |
| `filters/` | 1 file | `ModelAttributeFilterBar` — 7 filter dropdowns shared across pages |
| `leaderboard/` | 1 file | `LeaderboardFilters` — composes `ModelAttributeFilterBar` + model selector |
| `arena/` | 2 files | Arena stats display and comparison table |
| `layout/` | 2 files | Header (navigation) and Footer |
| `ui/` | 11 files | Shadcn/Radix primitives (Button, Dropdown, MultiSelectDropdown, etc.) |

## Chart System

Charts use **Vega-Lite v5** via `vega-embed`, dynamically imported to avoid SSR errors.

### Rendering Pipeline

```
ScalingLawsChart / ModelSizePerformanceChart
  │
  │  1. Transform data (compute scaling law fits, normalize axes)
  │  2. Enrich data with colors + label directions via chartColors.ts
  │  3. Build Vega-Lite spec via vegaSpecBuilder.ts
  │
  └──> VegaChart (dynamic import wrapper, ssr: false)
         │
         └──> VegaChartInner
                │  1. Measures container width via ResizeObserver
                │  2. Injects width into spec
                │  3. Calls vegaEmbed(container, spec)
                │  4. Re-renders on spec or width change
```

### Label Placement

To avoid overlapping text labels on scatter plots, the system uses a **greedy placement algorithm** (`chartColors.ts`):

1. For each data point, try 4 directions: NE, NW, SE, SW
2. Pick the direction with minimum overlap with already-placed labels
3. Store the chosen direction (`labelDir`) in the data

Since Vega-Lite cannot vary `dx`/`dy` per datum on continuous scales, the spec uses **4 filtered text layers** — one per direction — each with fixed `dx`/`dy` values (`vegaSpecBuilder.ts`).

## Filter Architecture

Two independent filter systems serve different use cases:

### Model Attribute Filters (leaderboard + models pages)

Filter **models** by their metadata attributes:

```
useModelAttributeFilters(models)
  ├── Size (Tiny ≤10M, Small ≤100M, Medium ≤500M, Large ≤1B, XL ≤5B, XXL >5B)
  ├── WSI Data Size (Small <10K, Medium <100K, Large ≥100K)
  ├── Image-Caption Data (categories based on pair count)
  ├── Training Method (DINOv2, CLIP, MAE, etc.)
  ├── License (open-source, non-commercial, closed-source)
  ├── Publication Year
  ├── Publication Type (peer-reviewed, preprint, blog)
  └── Model Type (Foundation Model, Vision-Language Model)
```

The `ModelAttributeFilterBar` component renders these as `MultiSelectDropdown` instances. The `LeaderboardFilters` component wraps it with an additional per-model selector.

### Task Filters (benchmark tables + arena)

Filter **tasks** by their properties:

```
useTaskFiltering(tasks, config)
  ├── Organs / Indications (breast, lung, colon, ...)
  ├── Task Categories (classification, survival, segmentation, ...)
  ├── Task Names (individual task toggle)
  └── Optional: text search with fuzzy multi-word matching
```

Each benchmark table uses this hook (or `useSetToggle` directly for custom filter dimensions).

### MultiSelectDropdown Pattern

Every filter dimension follows the same integration pattern:

```typescript
const organs = useSetToggle(availableOrgans);

<MultiSelectDropdown
  label="Indications"
  options={availableOrgans.map(o => ({ id: o, label: capitalize(o) }))}
  selectedIds={organs.selected}      // Set<string>
  onToggle={organs.toggle}           // (id: string) => void
  onSelectAll={organs.selectAll}     // () => void
  onClearAll={organs.clearAll}       // () => void
/>
```

The dropdown shows "Indications (5/8)" in its trigger, with Select All / Clear All buttons.

## Benchmark Table Pattern

Each of the 13 benchmarks has a dedicated table component. Most follow this standard pattern:

```typescript
function MyBenchmarkDetailedTable({ models, tasks, results }) {
  // 1. Task filtering
  const { filteredTasks, organs, categories, taskNames } = useTaskFiltering(tasks);

  // 2. Data computation
  const { resultsMap, taskStats, modelAvgRanks, modelAvgValues, sortedModels } =
    useDetailedTableData({ models, filteredTasks, results });

  // 3. Render: filter dropdowns + scrollable table
  return (
    <div>
      <MultiSelectDropdown ... />
      <table>
        <thead>...</thead>
        <tbody>
          {sortedModels.map(model => (
            <tr>
              {filteredTasks.map(task => {
                const value = resultsMap.get(model.id)?.get(task.id)?.value;
                return <td className={getValueColor(value, taskStats.get(task.id))}>{value}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Per-Benchmark Customizations

| Table | What's Different |
|-------|-----------------|
| **EVA** (`DetailedResultsTable`) | Excludes BACH task from average metric computation |
| **PathBench** | 4 filter dimensions including grouped categories (Survival → OS/DFS/DSS) |
| **Stanford** | Multi-metric selector (AUROC/BA/Sensitivity/Specificity), confidence intervals, separate resultsMap for CI display |
| **HEST** | Simple: organs + task names only, no categories |
| **Sinai / Patho-Bench** | Results include std values (displayed as value ± std) |
| **PathoROB / PLISM** | Sorted by average value (descending) instead of average rank |
| **THUNDER** | Manual data computation: lower-is-better metrics (ECE, ASR), rank sum sort |
| **STAMP** | Standard pattern with search |
| **PFM-DenseBench** | Multi-metric selector (9 options); default shows mDICE Rank (avg rank ± SD); other metrics show avg value + 95% CI; inverted color scale (lower rank = greener); uses extended `PFMDenseBenchResult` type |
| **CRoMa** | Multi-metric selector (9 options); default CRoMa cells pair the median margin with LTM₁₀ underneath; Δ is left uncoloured (its sign, not its size, is what reads); sorted by the official mean rank carried on a virtual `croma_aggregate` row alongside the Pareto-frontier and TCGA-exposure flags |

## Scraper System

The Python scraper monitors 14 benchmark data sources for changes.

### Pipeline

```
config.py (14 DataSource definitions)
    │
    ▼
monitor.py (weekly via GitHub Actions)
    │  1. Fetch content from each source URL
    │  2. Compute SHA256 hash
    │  3. Compare against stored hashes
    │  4. Generate diff report if changed
    │  5. Save snapshot for future comparison
    │
    ▼
data/source_hashes.json (persisted hashes)
data/snapshots/ (content snapshots)
data/reports/ (change detection reports)
```

### Data Source Types

| Type | Parsing | Examples |
|------|---------|---------|
| `csv` | Raw text comparison | EVA, Stanford, CRoMa (4 files) |
| `json` | Raw text comparison | PathBench |
| `readme` / `markdown` | Section extraction via fuzzy header matching | HEST, Sinai, PathoROB, PLISM, THUNDER |
| `html` | Raw HTML comparison | Patho-Bench (arXiv) |
| `binary` | Hex-encoded comparison | STAMP (Excel file) |

The monitor runs weekly via GitHub Actions. When changes are detected, it exits with code 1, enabling CI notifications.

## Key Design Decisions

### Static data over API
All data is checked into git as JSON. This eliminates backend infrastructure, ensures reproducibility, and enables instant page loads. The tradeoff is that data updates require a git commit and rebuild.

### Pre-computed rankings
`rankings.json` contains pre-computed average ranks per model per benchmark. This avoids computing ranks on every page load. When a benchmark table changes its filtered tasks, ranks are recomputed client-side by `useDetailedTableData`.

### Vega-Lite for charts
Chosen for its declarative specification language and interactive features (tooltips, zoom). The spec builder pattern (`lib/vegaSpecBuilder.ts`) keeps chart logic as pure functions separate from React rendering.

### Set-based filter state
All multi-select filters use `Set<string>` for O(1) membership testing. The `useSetToggle` hook provides a consistent API (`toggle`, `selectAll`, `clearAll`) that every dropdown connects to.

### Memoization discipline
Every computed value in hooks uses `useMemo`. Without this, filtering 14,000 results across 400 tasks would re-run on every render (e.g., mouse movements). Dependencies are explicitly listed to prevent stale data.

### Benchmark-specific table components
Rather than one generic table, each benchmark has its own component. This accommodates real differences: some benchmarks have confidence intervals, others have std values, some sort by rank sum instead of average rank. Shared logic lives in `useDetailedTableData`; presentation varies per benchmark.
