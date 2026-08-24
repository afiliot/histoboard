/**
 * Benchmark Configuration and Ranking Utilities
 *
 * Shared benchmark metadata (id + shortName pairs) for display contexts
 * where the full Benchmark type from data/benchmarks.json is not needed,
 * plus medal icons and rank computation helpers.
 *
 * @module lib/benchmarkConfig
 */

// =============================================================================
// Types
// =============================================================================

/** Lightweight benchmark reference for ranking display. */
export interface BenchmarkRef {
  id: string;
  name: string;
  /** When avgScore is used, whether higher is better. Defaults to true. */
  scoreHigherIsBetter?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Ordered list of benchmarks for ranking badges.
 * Kept separate from the full Benchmark data (benchmarks.json) because
 * these are used in static contexts where importing the full data
 * would be unnecessary.
 */
export const BENCHMARK_REFS: BenchmarkRef[] = [
  { id: "eva", name: "EVA" },
  { id: "pathbench", name: "HKUST PathBench" },
  { id: "stanford", name: "Stanford PathBench" },
  { id: "hest", name: "HEST" },
  { id: "pathobench", name: "Patho-Bench" },
  { id: "sinai", name: "Sinai SSL" },
  { id: "stamp", name: "STAMP" },
  { id: "thunder", name: "THUNDER", scoreHigherIsBetter: false },
  { id: "pathorob", name: "PathoROB" },
  { id: "croma", name: "CRoMa", scoreHigherIsBetter: false },
  { id: "plism", name: "Plismbench" },
  { id: "pfm_densebench", name: "PFM-DenseBench", scoreHigherIsBetter: false },
  { id: "bc_survival_gustafsson", name: "BC Survival" },
];

// =============================================================================
// Medal Helper
// =============================================================================

/**
 * Get medal emoji for a rank, or null if rank > 3.
 *
 * @param rank - Integer rank (1-based)
 * @returns Medal emoji string or null
 */
export function getMedal(rank: number): string | null {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

// =============================================================================
// Rank Computation
// =============================================================================

/** Shape of the rankings data from rankings.json. */
type RankingsData = Record<
  string,
  Record<string, { avgRank: number; avgScore?: number; taskCount: number }>
>;

/** Result of computeBenchmarkRanks for a single benchmark. */
export interface BenchmarkRankData {
  ranks: Map<string, number>;
  total: number;
}

/**
 * Compute integer ranks per benchmark from rankings data.
 *
 * When entries include `avgScore`, sorts by avgScore (descending by default;
 * ascending when `scoreHigherIsBetter` is explicitly `false` on the benchmark,
 * e.g. THUNDER rank sum where lower is better).
 * Otherwise falls back to sorting by `avgRank` ascending (computed per-task ranks).
 *
 * Models missing an `avgScore` in a score-based benchmark are pushed to the end
 * via ±Infinity sentinels rather than defaulting to 0.
 *
 * @param rankings - Rankings data: benchmarkId -> modelId -> { avgRank, avgScore?, taskCount }
 * @returns Per-benchmark rank maps keyed by benchmark ID
 */
export function computeBenchmarkRanks(
  rankings: RankingsData
): Record<string, BenchmarkRankData> {
  const result: Record<string, BenchmarkRankData> = {};

  for (const benchmark of BENCHMARK_REFS) {
    const benchmarkData = rankings[benchmark.id];
    if (!benchmarkData) continue;

    const entries = Object.entries(benchmarkData);
    const useAvgScore = entries.some(([, data]) => data.avgScore !== undefined);
    const higherIsBetter = benchmark.scoreHigherIsBetter !== false;

    const modelsWithRank = entries
      .map(([modelId, data]) => ({ modelId, avgRank: data.avgRank, avgScore: data.avgScore }))
      .sort((a, b) =>
        useAvgScore
          ? higherIsBetter
            ? (b.avgScore ?? Number.NEGATIVE_INFINITY) - (a.avgScore ?? Number.NEGATIVE_INFINITY)
            : (a.avgScore ?? Number.POSITIVE_INFINITY) - (b.avgScore ?? Number.POSITIVE_INFINITY)
          : a.avgRank - b.avgRank
      );

    // Assign tied ranks: models with the same score share the same rank position
    const rankMap = new Map<string, number>();
    modelsWithRank.forEach((item, index) => {
      if (index === 0) {
        rankMap.set(item.modelId, 1);
        return;
      }
      const prev = modelsWithRank[index - 1];
      const prevRank = rankMap.get(prev.modelId)!;
      const tied = useAvgScore
        ? item.avgScore === prev.avgScore
        : item.avgRank === prev.avgRank;
      rankMap.set(item.modelId, tied ? prevRank : index + 1);
    });

    result[benchmark.id] = {
      ranks: rankMap,
      total: modelsWithRank.length,
    };
  }

  return result;
}
