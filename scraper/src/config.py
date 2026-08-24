"""
Configuration for Histoboard benchmark data sources.

This module defines the data sources that are monitored for changes.
Each source has a unique ID, display name, URL, type, and optional
section identifier for markdown-based sources.

Source types:
- csv: Raw CSV file
- json: Raw JSON file
- readme/markdown: Markdown file with optional section extraction
- html: HTML page
- binary: Binary file (e.g., Excel) - stored as hex
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DataSource:
    """Configuration for a single benchmark data source."""

    id: str
    """Unique identifier for the source (e.g., 'eva', 'pathbench')."""

    name: str
    """Human-readable display name."""

    url: str
    """URL to fetch the data from."""

    type: str
    """Source type: 'csv', 'json', 'readme', 'markdown', 'html', 'binary'."""

    section: Optional[str] = None
    """For markdown sources, the section anchor to extract (e.g., 'leaderboard')."""


# =============================================================================
# Data Source Definitions
# =============================================================================

DATA_SOURCES: list[DataSource] = [
    # CSV-based benchmarks
    DataSource(
        id="eva",
        name="EVA Benchmark",
        url="https://raw.githubusercontent.com/kaiko-ai/eva/main/tools/data/leaderboards/pathology.csv",
        type="csv",
    ),
    DataSource(
        id="stanford",
        name="Stanford PathBench",
        url="https://raw.githubusercontent.com/gevaertlab/benchmarking-path-models/main/data/benchmarking_updated_ncomm.csv",
        type="csv",
    ),
    # CRoMa publishes its results as committed CSVs: cross_benchmark.csv holds
    # the panel ranks and the per-cohort margin/tail pairs, and the three cohort
    # files hold the diagnostics (RI, MaRI, F(0), support) shown per cell.
    DataSource(
        id="croma",
        name="CRoMa",
        url="https://raw.githubusercontent.com/clemsgrs/croma/main/results/cross_benchmark.csv",
        type="csv",
    ),
    DataSource(
        id="croma_camelyon",
        name="CRoMa (Camelyon cohort)",
        url="https://raw.githubusercontent.com/clemsgrs/croma/main/results/camelyon.csv",
        type="csv",
    ),
    DataSource(
        id="croma_tcga_4x4",
        name="CRoMa (TCGA-4x4 cohort)",
        url="https://raw.githubusercontent.com/clemsgrs/croma/main/results/tcga-4x4.csv",
        type="csv",
    ),
    DataSource(
        id="croma_tolkach_esca",
        name="CRoMa (Tolkach-ESCA cohort)",
        url="https://raw.githubusercontent.com/clemsgrs/croma/main/results/tolkach-esca.csv",
        type="csv",
    ),
    # JSON-based benchmarks
    DataSource(
        id="pathbench",
        name="PathBench",
        url="https://raw.githubusercontent.com/birkhoffkiki/PathBench/master/src/data/performance.json",
        type="json",
    ),
    # Markdown README-based benchmarks (with section extraction)
    DataSource(
        id="hest",
        name="HEST Benchmark",
        url="https://raw.githubusercontent.com/mahmoodlab/HEST/main/README.md",
        type="readme",
        section="hest-benchmark-results",
    ),
    DataSource(
        id="sinai",
        name="Sinai SSL Benchmark",
        url="https://raw.githubusercontent.com/sinai-computational-pathology/SSL_tile_benchmarks/main/README.md",
        type="readme",
        section="leaderboard",
    ),
    DataSource(
        id="pathorob",
        name="PathoROB",
        url="https://raw.githubusercontent.com/bifold-pathomics/PathoROB/main/README.md",
        type="readme",
        section="leaderboard-robustness-index",
    ),
    DataSource(
        id="plism",
        name="Plismbench",
        url="https://raw.githubusercontent.com/owkin/plism-benchmark/main/README.md",
        type="readme",
        section="benchmark",
    ),
    DataSource(
        id="thunder",
        name="THUNDER Benchmark",
        url="https://raw.githubusercontent.com/MICS-Lab/thunder/main/docs/leaderboards.md",
        type="markdown",
        section="up-to-date-rank-sum-leaderboard",
    ),
    # HTML-based benchmarks
    DataSource(
        id="pathobench",
        name="Patho-Bench",
        url="https://arxiv.org/html/2601.05148",
        type="html",
    ),
    # Binary file benchmarks
    DataSource(
        id="stamp",
        name="STAMP Benchmark",
        url="https://static-content.springer.com/esm/art%3A10.1038%2Fs41551-025-01516-3/MediaObjects/41551_2025_1516_MOESM5_ESM.xlsx",
        type="binary",
    ),
]

# Create a lookup dict for easy access by ID
DATA_SOURCES_BY_ID: dict[str, DataSource] = {source.id: source for source in DATA_SOURCES}
