/**
 * Scaling Laws visualization module for Histoboard
 *
 * This module computes data for the robustness vs. performance scatter plot.
 * Each model is represented as a point where:
 * - X-axis: Robustness score (normalized average across robustness benchmarks)
 * - Y-axis: Performance score (normalized average across selected benchmarks)
 * - Bubble size: Number of model parameters
 *
 * All metrics are normalized to [0, 1] for fair comparison across benchmarks
 * with different scales.
 *
 * @module lib/scalingLaws
 */

import type { Result, Task, Model } from "@/types";

// =============================================================================
// Types
// =============================================================================

/**
 * A data point for the scaling laws scatter plot.
 * Represents a single model's position in the robustness-performance space.
 */
export interface ScalingLawsDataPoint {
  /** Model identifier */
  modelId: string;
  /** Model display name */
  modelName: string;
  /** Organization that developed the model */
  organization: string;
  /** Normalized robustness score (0-1, higher is better) */
  robustness: number;
  /** Normalized performance score (0-1, higher is better) */
  performance: number;
  /** Number of parameters in millions */
  params: number;
  /** Number of benchmarks included in the performance average */
  benchmarkCount: number;
}

/**
 * Represents a selectable benchmark option in the UI.
 */
interface BenchmarkOption {
  /** Benchmark identifier */
  id: string;
  /** Display label */
  label: string;
}

/**
 * Min/max statistics for normalization.
 */
interface NormalizationStats {
  min: number;
  max: number;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Available robustness benchmarks.
 * These measure model stability under distribution shifts.
 */
export const ALL_ROBUSTNESS_BENCHMARKS: BenchmarkOption[] = [
  { id: "pathorob", label: "PathoROB" },
  { id: "plism", label: "Plismbench" },
  { id: "croma", label: "CRoMa" },
];

/**
 * Default selection for robustness benchmarks.
 */
export const DEFAULT_SELECTED_ROBUSTNESS = new Set(["pathorob", "plism"]);

/**
 * Mapping from robustness benchmark IDs to their task IDs.
 * These are hardcoded because robustness benchmarks have specific tasks
 * that need to be aggregated differently than performance benchmarks.
 */
const ROBUSTNESS_TASK_IDS: Record<string, string[]> = {
  pathorob: [
    "pathorob_tcga_2x2",
    "pathorob_camelyon",
    "pathorob_tolkach_esca",
  ],
  plism: [
    "plism_cosine_similarity",
    "plism_cross_scanner",
    "plism_cross_staining",
    "plism_cross_both",
  ],
  croma: [
    "croma_camelyon",
    "croma_tcga_4x4",
    "croma_tolkach_esca",
  ],
};

/**
 * Benchmarks where lower values are better.
 * For these, we invert the normalized score so that 1 always means "best".
 */
const INVERTED_BENCHMARKS = new Set(["thunder"]);

/**
 * Available performance benchmarks (excluding robustness-focused ones).
 */
export const ALL_PERFORMANCE_BENCHMARKS: BenchmarkOption[] = [
  { id: "eva", label: "EVA" },
  { id: "pathbench", label: "HKUST PathBench" },
  { id: "stanford", label: "Stanford PathBench" },
  { id: "hest", label: "HEST" },
  { id: "pathobench", label: "Patho-Bench" },
  { id: "pfm_densebench", label: "PFM-DenseBench" },
  { id: "sinai", label: "Sinai SSL" },
  { id: "stamp", label: "STAMP" },
  { id: "thunder", label: "THUNDER" },
  { id: "bc_survival_gustafsson", label: "BC Survival" },
];

/**
 * All benchmarks combined (performance + robustness) for the size vs performance chart.
 */
export const ALL_BENCHMARKS: BenchmarkOption[] = [
  // Performance benchmarks
  { id: "eva", label: "EVA" },
  { id: "pathbench", label: "HKUST PathBench" },
  { id: "stanford", label: "Stanford PathBench" },
  { id: "hest", label: "HEST" },
  { id: "pathobench", label: "Patho-Bench" },
  { id: "sinai", label: "Sinai SSL" },
  { id: "stamp", label: "STAMP" },
  { id: "thunder", label: "THUNDER" },
  { id: "bc_survival_gustafsson", label: "BC Survival" },
  // Segmentation benchmarks
  { id: "pfm_densebench", label: "PFM-DenseBench" },
  // Robustness benchmarks
  { id: "pathorob", label: "PathoROB" },
  { id: "plism", label: "Plismbench" },
  { id: "croma", label: "CRoMa" },
];

/**
 * Default selection for the model size vs performance chart.
 */
export const DEFAULT_SIZE_PERF_BENCHMARKS = new Set(["thunder", "pfm_densebench", "pathbench"]);

/**
 * Default selection for performance benchmarks.
 */
export const DEFAULT_SELECTED_BENCHMARKS = new Set(["thunder", "pfm_densebench", "pathbench"]);

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse model parameter count from string notation.
 * Handles both millions (M) and billions (B) notation.
 *
 * @param params - Parameter string (e.g., "632M", "1.1B")
 * @returns Number of parameters in millions
 *
 * @example
 * parseModelParams("632M")  // 632
 * parseModelParams("1.1B")  // 1100
 */
export function parseModelParams(params: string): number {
  const value = parseFloat(params);
  if (params.toUpperCase().includes("B")) {
    return value * 1000; // Convert billions to millions
  }
  return value; // Already in millions
}

/**
 * Normalize a value to the [0, 1] range given min/max bounds.
 *
 * @param value - The raw value to normalize
 * @param stats - Min and max values for normalization
 * @returns Normalized value in [0, 1], or 0.5 if min === max
 */
function normalizeValue(value: number, stats: NormalizationStats): number {
  if (stats.max === stats.min) {
    return 0.5; // No variance, return middle value
  }
  return (value - stats.min) / (stats.max - stats.min);
}

/**
 * Compute the arithmetic mean of an array of numbers.
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Get task IDs for selected robustness benchmarks.
 */
function getRobustnessTaskIds(selectedRobustness: Set<string>): string[] {
  const taskIds: string[] = [];
  for (const benchmarkId of selectedRobustness) {
    const ids = ROBUSTNESS_TASK_IDS[benchmarkId];
    if (ids) {
      taskIds.push(...ids);
    }
  }
  return taskIds;
}

// =============================================================================
// Score Computation
// =============================================================================

/**
 * Compute the average robustness score for a model.
 *
 * @param modelId - The model to compute the score for
 * @param results - All evaluation results
 * @param selectedRobustness - Set of selected robustness benchmark IDs
 * @returns Average robustness score, or null if no data available
 */
export function getRobustnessScore(
  modelId: string,
  results: Result[],
  selectedRobustness: Set<string>
): number | null {
  const taskIds = getRobustnessTaskIds(selectedRobustness);
  if (taskIds.length === 0) return null;

  const robustnessResults = results.filter(
    (r) => r.modelId === modelId && taskIds.includes(r.taskId)
  );

  if (robustnessResults.length === 0) return null;

  return mean(robustnessResults.map((r) => r.value));
}

/**
 * Compute min/max statistics for a benchmark across all models.
 * This is used for normalizing performance values.
 *
 * @param benchmarkId - The benchmark to compute stats for
 * @param results - All evaluation results
 * @param tasks - Task definitions
 * @returns Min/max of model average performances, or null if no data
 */
function getBenchmarkStats(
  benchmarkId: string,
  results: Result[],
  tasks: Task[]
): NormalizationStats | null {
  // Get task IDs for this benchmark
  const benchmarkTaskIds = new Set(
    tasks.filter((t) => t.benchmarkId === benchmarkId).map((t) => t.id)
  );

  // Get all results for this benchmark
  const benchmarkResults = results.filter((r) =>
    benchmarkTaskIds.has(r.taskId)
  );

  // Group results by model and compute averages
  const valuesByModel = new Map<string, number[]>();
  for (const r of benchmarkResults) {
    if (!valuesByModel.has(r.modelId)) {
      valuesByModel.set(r.modelId, []);
    }
    valuesByModel.get(r.modelId)!.push(r.value);
  }

  // Compute each model's average
  const modelAverages = Array.from(valuesByModel.values()).map((values) =>
    mean(values)
  );

  if (modelAverages.length === 0) return null;

  return {
    min: Math.min(...modelAverages),
    max: Math.max(...modelAverages),
  };
}

/**
 * Compute a model's average performance on a benchmark.
 *
 * @param modelId - The model to compute performance for
 * @param benchmarkId - The benchmark to measure
 * @param results - All evaluation results
 * @param tasks - Task definitions
 * @returns Average performance, or null if no data
 */
function getModelBenchmarkPerformance(
  modelId: string,
  benchmarkId: string,
  results: Result[],
  tasks: Task[]
): number | null {
  const benchmarkTaskIds = new Set(
    tasks.filter((t) => t.benchmarkId === benchmarkId).map((t) => t.id)
  );

  const modelResults = results.filter(
    (r) => r.modelId === modelId && benchmarkTaskIds.has(r.taskId)
  );

  if (modelResults.length === 0) return null;

  return mean(modelResults.map((r) => r.value));
}

// =============================================================================
// Main Data Builder
// =============================================================================

/**
 * Build scatter plot data points for the scaling laws visualization.
 *
 * For each model, computes:
 * 1. Normalized robustness (average across selected robustness benchmarks)
 * 2. Normalized performance (average across selected performance benchmarks)
 *
 * Models are only included if they have data for ALL selected benchmarks.
 *
 * @param models - All models to consider
 * @param tasks - Task definitions
 * @param results - All evaluation results
 * @param selectedBenchmarks - Set of performance benchmark IDs to include
 * @param selectedRobustness - Set of robustness benchmark IDs to include
 * @returns Array of data points for the scatter plot
 */
export function buildScalingLawsData(
  models: Model[],
  tasks: Task[],
  results: Result[],
  selectedBenchmarks: Set<string>,
  selectedRobustness: Set<string>
): ScalingLawsDataPoint[] {
  const benchmarkIds = Array.from(selectedBenchmarks);

  // Early exit if no benchmarks selected
  if (benchmarkIds.length === 0 || selectedRobustness.size === 0) {
    return [];
  }

  // Pre-compute benchmark stats for normalization
  const benchmarkStats = new Map<string, NormalizationStats>();
  for (const benchmarkId of benchmarkIds) {
    const stats = getBenchmarkStats(benchmarkId, results, tasks);
    if (stats) {
      benchmarkStats.set(benchmarkId, stats);
    }
  }

  // Compute robustness stats for normalization
  const robustnessTaskIds = getRobustnessTaskIds(selectedRobustness);
  const robustnessResults = results.filter((r) =>
    robustnessTaskIds.includes(r.taskId)
  );
  const robustnessModelIds = [...new Set(robustnessResults.map((r) => r.modelId))];

  const allRobustnessScores = robustnessModelIds
    .map((modelId) => getRobustnessScore(modelId, results, selectedRobustness))
    .filter((score): score is number => score !== null);

  const robustnessStats: NormalizationStats | null =
    allRobustnessScores.length > 0
      ? {
          min: Math.min(...allRobustnessScores),
          max: Math.max(...allRobustnessScores),
        }
      : null;

  // Process each model
  const dataPoints: ScalingLawsDataPoint[] = [];

  for (const model of models) {
    // Compute robustness score
    const rawRobustness = getRobustnessScore(
      model.id,
      results,
      selectedRobustness
    );
    if (rawRobustness === null || robustnessStats === null) continue;

    // Normalize robustness
    const robustness = normalizeValue(rawRobustness, robustnessStats);

    // Collect normalized performance across all selected benchmarks
    const normalizedPerformances: number[] = [];

    for (const benchmarkId of benchmarkIds) {
      const stats = benchmarkStats.get(benchmarkId);
      if (!stats) continue;

      const rawPerformance = getModelBenchmarkPerformance(
        model.id,
        benchmarkId,
        results,
        tasks
      );
      if (rawPerformance === null) continue;

      let normalizedPerformance = normalizeValue(rawPerformance, stats);

      // Invert for benchmarks where lower is better
      if (INVERTED_BENCHMARKS.has(benchmarkId)) {
        normalizedPerformance = 1 - normalizedPerformance;
      }

      normalizedPerformances.push(normalizedPerformance);
    }

    // Only include models with data for ALL selected benchmarks
    if (normalizedPerformances.length !== benchmarkIds.length) continue;

    dataPoints.push({
      modelId: model.id,
      modelName: model.name,
      organization: model.organization,
      robustness,
      performance: mean(normalizedPerformances),
      params: parseModelParams(model.params),
      benchmarkCount: normalizedPerformances.length,
    });
  }

  return dataPoints;
}

// =============================================================================
// Model Size vs Performance Chart
// =============================================================================

/**
 * A data point for the model size vs performance scatter plot.
 */
export interface SizePerformanceDataPoint {
  /** Model identifier */
  modelId: string;
  /** Model display name */
  modelName: string;
  /** Organization that developed the model */
  organization: string;
  /** Number of parameters in millions (x-axis) */
  params: number;
  /** Normalized performance score (0-1, higher is better) (y-axis) */
  performance: number;
  /** Number of benchmarks included in the performance average */
  benchmarkCount: number;
}

/**
 * Compute a model's average performance on a robustness benchmark.
 * This handles the special task structure of robustness benchmarks.
 */
function getModelRobustnessPerformance(
  modelId: string,
  benchmarkId: string,
  results: Result[]
): number | null {
  const taskIds = ROBUSTNESS_TASK_IDS[benchmarkId];
  if (!taskIds) return null;

  const modelResults = results.filter(
    (r) => r.modelId === modelId && taskIds.includes(r.taskId)
  );

  if (modelResults.length === 0) return null;

  return mean(modelResults.map((r) => r.value));
}

/**
 * Compute min/max statistics for a robustness benchmark across all models.
 */
function getRobustnessBenchmarkStats(
  benchmarkId: string,
  results: Result[]
): NormalizationStats | null {
  const taskIds = ROBUSTNESS_TASK_IDS[benchmarkId];
  if (!taskIds) return null;

  const benchmarkResults = results.filter((r) => taskIds.includes(r.taskId));

  // Group results by model and compute averages
  const valuesByModel = new Map<string, number[]>();
  for (const r of benchmarkResults) {
    if (!valuesByModel.has(r.modelId)) {
      valuesByModel.set(r.modelId, []);
    }
    valuesByModel.get(r.modelId)!.push(r.value);
  }

  // Compute each model's average
  const modelAverages = Array.from(valuesByModel.values()).map((values) =>
    mean(values)
  );

  if (modelAverages.length === 0) return null;

  return {
    min: Math.min(...modelAverages),
    max: Math.max(...modelAverages),
  };
}

/**
 * Check if a benchmark ID is a robustness benchmark.
 */
function isRobustnessBenchmark(benchmarkId: string): boolean {
  return benchmarkId in ROBUSTNESS_TASK_IDS;
}

/**
 * Build scatter plot data points for the model size vs performance visualization.
 *
 * For each model, computes:
 * 1. Model size in parameters (x-axis)
 * 2. Normalized performance (average across selected benchmarks) (y-axis)
 *
 * Models are only included if they have data for ALL selected benchmarks.
 *
 * @param models - All models to consider
 * @param tasks - Task definitions
 * @param results - All evaluation results
 * @param selectedBenchmarks - Set of benchmark IDs to include (can be performance or robustness)
 * @returns Array of data points for the scatter plot
 */
export function buildSizePerformanceData(
  models: Model[],
  tasks: Task[],
  results: Result[],
  selectedBenchmarks: Set<string>
): SizePerformanceDataPoint[] {
  const benchmarkIds = Array.from(selectedBenchmarks);

  // Early exit if no benchmarks selected
  if (benchmarkIds.length === 0) {
    return [];
  }

  // Pre-compute benchmark stats for normalization (both performance and robustness)
  const benchmarkStats = new Map<string, NormalizationStats>();
  for (const benchmarkId of benchmarkIds) {
    let stats: NormalizationStats | null;
    if (isRobustnessBenchmark(benchmarkId)) {
      stats = getRobustnessBenchmarkStats(benchmarkId, results);
    } else {
      stats = getBenchmarkStats(benchmarkId, results, tasks);
    }
    if (stats) {
      benchmarkStats.set(benchmarkId, stats);
    }
  }

  // Process each model
  const dataPoints: SizePerformanceDataPoint[] = [];

  for (const model of models) {
    // Skip models without params
    if (!model.params) continue;

    // Collect normalized performance across all selected benchmarks
    const normalizedPerformances: number[] = [];

    for (const benchmarkId of benchmarkIds) {
      const stats = benchmarkStats.get(benchmarkId);
      if (!stats) continue;

      let rawPerformance: number | null;
      if (isRobustnessBenchmark(benchmarkId)) {
        rawPerformance = getModelRobustnessPerformance(model.id, benchmarkId, results);
      } else {
        rawPerformance = getModelBenchmarkPerformance(
          model.id,
          benchmarkId,
          results,
          tasks
        );
      }
      if (rawPerformance === null) continue;

      let normalizedPerformance = normalizeValue(rawPerformance, stats);

      // Invert for benchmarks where lower is better
      if (INVERTED_BENCHMARKS.has(benchmarkId)) {
        normalizedPerformance = 1 - normalizedPerformance;
      }

      normalizedPerformances.push(normalizedPerformance);
    }

    // Only include models with data for ALL selected benchmarks
    if (normalizedPerformances.length !== benchmarkIds.length) continue;

    dataPoints.push({
      modelId: model.id,
      modelName: model.name,
      organization: model.organization,
      params: parseModelParams(model.params),
      performance: mean(normalizedPerformances),
      benchmarkCount: normalizedPerformances.length,
    });
  }

  return dataPoints;
}
