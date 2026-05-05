<p align="center">
  <img src="frontend/public/logo.svg" alt="Histoboard Logo" width="80" height="80">
</p>

<h1 align="center">Histoboard</h1>

<p align="center">
  <strong>The Pathology Foundation Model Leaderboard</strong>
</p>

<p align="center">
  A centralized dashboard aggregating benchmark results to compare pathology foundation models.
</p>

<p align="center">
  <a href="https://wearewaiv.github.io/histoboard">
    <img src="https://img.shields.io/badge/Live%20Demo-histoboard-blueviolet?style=for-the-badge" alt="Live Demo">
  </a>
  <a href="https://github.com/wearewaiv/histoboard/stargazers">
    <img src="https://img.shields.io/github/stars/wearewaiv/histoboard?style=for-the-badge&color=yellow" alt="Stars">
  </a>
  <a href="https://github.com/wearewaiv/histoboard/network/members">
    <img src="https://img.shields.io/github/forks/wearewaiv/histoboard?style=for-the-badge&color=lightblue" alt="Forks">
  </a>
  <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">
    <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-green?style=for-the-badge" alt="License">
  </a>
</p>

---

## What is Histoboard?

Histoboard provides a **unified view** of pathology foundation model performance across multiple benchmarks. It enables researchers and practitioners to make informed decisions when selecting models for computational pathology applications. Data sources are taken directly from the official benchmarks or papers.

| Metric | Count |
|--------|-------|
| Benchmarks | 12 |
| Models | 48 |
| Evaluation Tasks | 400+ |
| Organs/Indications | 20+ |

## Features

- **Leaderboard** — Compare models across all benchmarks with detailed per-task rankings
- **Arena** — Head-to-head comparison of 2-5 models with win/tie/loss statistics
- **Model Profiles** — Detailed view of each model's performance, architecture, and metadata
- **Scaling Laws** — Visualize the relationship between model size and performance
- **Timeline** — Track model releases over time
- **News** — Chronological log of updates: new models, benchmark refreshes, and feature additions

## Supported Benchmarks

| Benchmark | Tasks | Task Type |
|-----------|-------|-----------|
| [EVA](https://github.com/kaiko-ai/eva) | 13 | Patch-level classification, Slide-level classification, Segmentation |
| [PathBench](https://github.com/birkhoffkiki/PathBench) | 229 | Slide-level classification |
| [Stanford PathBench](https://pathbench.stanford.edu) | 41 | Patch-level classification, Slide-level classification |
| [HEST](https://github.com/mahmoodlab/HEST) | 9 | Spatial transcriptomics |
| [Patho-Bench](https://github.com/mahmoodlab/Patho-Bench) | 95 | Slide-level classification |
| [Sinai](https://github.com/sinai-computational-pathology/SSL_tile_benchmarks) | 22 | Slide-level classification |
| [STAMP](https://github.com/KatherLab/STAMP-Benchmark) | 31 | Slide-level classification |
| [THUNDER](https://mics-lab.github.io/thunder/) | 6 | Patch-level classification, Calibration, Robustness, Segmentation |
| [PathoROB](https://github.com/bifold-pathomics/PathoROB) | 3 | Robustness |
| [Plismbench](https://github.com/owkin/plism-benchmark) | 4 | Robustness |
| [PFM-DenseBench](https://github.com/lingxitong/PFM_Segmentation) | 18 | Segmentation |
| [BC Survival](https://arxiv.org/abs/2604.24679) | 4 | Survival prediction |

Results are checked every Sunday at midnight UTC.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS, shadcn/ui, Radix UI |
| Charts | Vega-Lite v5 (via vega-embed) |
| Data | Static JSON (pre-processed) |
| Hosting | GitHub Pages |

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Local Development

```bash
# Clone the repository
git clone https://github.com/wearewaiv/histoboard.git
cd histoboard/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

### Building for Production

```bash
cd frontend
npm run build
```

Static files will be generated in `frontend/out/`.

## Project Structure

```
histoboard/
├── frontend/                    # Next.js frontend application
│   ├── src/
│   │   ├── app/                # Pages (home, leaderboard, arena, models, benchmarks)
│   │   ├── components/         # React components
│   │   │   ├── arena/          # Arena comparison components
│   │   │   ├── charts/         # Vega-Lite chart wrappers
│   │   │   ├── filters/        # Shared filter UI (ModelAttributeFilterBar)
│   │   │   ├── layout/         # Header, Footer
│   │   │   ├── leaderboard/    # Leaderboard-specific filters
│   │   │   ├── tables/         # Benchmark result tables (10 benchmarks)
│   │   │   └── ui/             # shadcn/ui primitives
│   │   ├── data/               # Static JSON data
│   │   │   ├── models.json     # Model definitions
│   │   │   ├── tasks.json      # Task definitions
│   │   │   ├── results.json    # Performance results
│   │   │   ├── benchmarks.json # Benchmark metadata
│   │   │   └── rankings.json   # Pre-computed rankings
│   │   ├── hooks/              # Custom React hooks (filtering, ranking, state)
│   │   ├── lib/                # Pure utility functions (charts, filters, formatting)
│   │   └── types/              # TypeScript definitions
│   └── package.json
│
├── scraper/                    # Python data collection (optional)
│
└── .github/workflows/          # CI/CD
    └── deploy.yml              # Deployment workflow
```

## Adding New Benchmarks

To add a new benchmark:

1. Add benchmark metadata to `frontend/src/data/benchmarks.json`
2. Add task definitions to `frontend/src/data/tasks.json`
3. Add model results to `frontend/src/data/results.json`
4. Compute and add rankings to `frontend/src/data/rankings.json`
5. Create a table component in `frontend/src/components/tables/`
6. Register the table component in `frontend/src/app/benchmarks/[id]/page.tsx`

The leaderboard and benchmarks index auto-update from `benchmarks.json` — no extra wiring needed. See [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for a full walkthrough.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — System overview, data model, component layers, design decisions
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** — How to add benchmarks, models, pages, hooks, and charts
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — Contribution guidelines and data source conventions

## Contributing

Contributions are welcome! Please feel free to:

- Report bugs or request features via [Issues](https://github.com/wearewaiv/histoboard/issues)
- Submit benchmark data updates via Pull Requests
- Suggest new models or benchmarks to integrate

## Citation

If you use Histoboard in your research, please cite:

```bibtex
@misc{histoboard2025,
  title={Histoboard: A Unified Dashboard for Pathology Foundation Model Benchmarks},
  author={Alexandre Filiot},
  year={2025},
  url={https://wearewaiv.github.io/histoboard}
}
```

## Acknowledgments

This project aggregates data from multiple benchmark sources. Please cite the original benchmark papers when using their data.
