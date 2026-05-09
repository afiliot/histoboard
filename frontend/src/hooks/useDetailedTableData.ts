/**
 * Detailed Table Data Hook
 *
 * Shared data computations for all benchmark detail tables. Given models,
 * filtered tasks, and results, computes:
 *
 * - **resultsMap** — O(1) lookup: `resultsMap.get(modelId)?.get(taskId)`
 * - **taskStats** — Min/max per task for cell color scaling
 * - **modelAvgRanks** — Average rank across filtered tasks
 * - **modelAvgValues** — Average metric value across filtered tasks
 * - **sortedModels** — Models sorted by average rank (ascending)
 *
 * Supports generic result types via `<R extends Result>` and custom metric
 * extraction via `getMetricValue` (e.g., Stanford's multi-metric selector).
 *
 * @module hooks/useDetailedTableData
 */

import { useMemo } from "react";
import type { Model, Task, Result } from "@/types";
import type { TaskValueStats } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

/**
 * Extended result type that supports optional standard deviation.
 * Some benchmarks (PathBench, Sinai) include std values.
 */
export interface ResultWithStd extends Result {
  std?: number;
}

/**
 * Options for useDetailedTableData hook.
 */
export interface UseDetailedTableDataOptions<R extends Result = Result> {
  /** All models in the benchmark */
  models: Model[];
  /** Filtered tasks to display */
  filteredTasks: Task[];
  /** All results for this benchmark */
  results: R[];
  /** Optional function to extract the metric value from a result (default: r => r.value) */
  getMetricValue?: (result: R) => number | undefined;
  /** When true, use the pre-computed `rank` field from each result instead of deriving ranks from sorted values. Use when stored ranks handle ties correctly (e.g. shared rank for equal values). */
  useStoredRanks?: boolean;
}

/**
 * Result type for basic results (value only).
 */
export interface ResultsMapValue {
  value: number;
  ciLower?: number;
  ciUpper?: number;
}

/**
 * Result type for results with standard deviation.
 */
export interface ResultsMapValueWithStd {
  value: number;
  std?: number;
}

/**
 * Return type for useDetailedTableData hook.
 */
export interface UseDetailedTableDataReturn<T = ResultsMapValue> {
  /** Lookup map: modelId -> taskId -> result data */
  resultsMap: Map<string, Map<string, T>>;
  /** Min/max statistics per task for color scaling */
  taskStats: Map<string, TaskValueStats>;
  /** Average rank per model across filtered tasks */
  modelAvgRanks: Map<string, number>;
  /** Average metric value per model across filtered tasks */
  modelAvgValues: Map<string, number>;
  /** Models sorted by average rank (ascending) */
  sortedModels: Model[];
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for common detailed table computations.
 *
 * Provides memoized calculations that are shared across all benchmark
 * detailed tables, reducing code duplication and ensuring consistent
 * ranking/coloring logic.
 *
 * @example
 * const {
 *   resultsMap,
 *   taskStats,
 *   modelAvgRanks,
 *   modelAvgValues,
 *   sortedModels,
 * } = useDetailedTableData({
 *   models,
 *   filteredTasks,
 *   results,
 * });
 *
 * @example
 * // With custom metric extraction (e.g., Stanford with multiple metrics)
 * const { sortedModels } = useDetailedTableData({
 *   models,
 *   filteredTasks,
 *   results,
 *   getMetricValue: (r) => r.balancedAccuracy,
 * });
 */
export function useDetailedTableData<R extends Result = Result>({
  models,
  filteredTasks,
  results,
  getMetricValue = (r) => r.value,
  useStoredRanks = false,
}: UseDetailedTableDataOptions<R>): UseDetailedTableDataReturn {
  // Create a lookup map for results: modelId -> taskId -> value
  const resultsMap = useMemo(() => {
    const map = new Map<string, Map<string, ResultsMapValue>>();
    for (const result of results) {
      if (!map.has(result.modelId)) {
        map.set(result.modelId, new Map());
      }
      const value = getMetricValue(result);
      if (value !== undefined) {
        const entry: ResultsMapValue = { value };
        if (result.ciLower !== undefined) entry.ciLower = result.ciLower;
        if (result.ciUpper !== undefined) entry.ciUpper = result.ciUpper;
        map.get(result.modelId)!.set(result.taskId, entry);
      }
    }
    return map;
  }, [results, getMetricValue]);

  // Get min/max for each task for color scaling
  const taskStats = useMemo(() => {
    const stats = new Map<string, TaskValueStats>();
    for (const task of filteredTasks) {
      const values: number[] = [];
      for (const result of results) {
        if (result.taskId === task.id) {
          const value = getMetricValue(result);
          if (value !== undefined) {
            values.push(value);
          }
        }
      }
      if (values.length > 0) {
        stats.set(task.id, {
          min: Math.min(...values),
          max: Math.max(...values),
        });
      }
    }
    return stats;
  }, [filteredTasks, results, getMetricValue]);

  // Compute average rank per model (across filtered tasks)
  const modelAvgRanks = useMemo(() => {
    const avgRanks = new Map<string, number>();

    const taskRanks = new Map<string, Map<string, number>>();
    for (const task of filteredTasks) {
      const ranks = new Map<string, number>();
      if (useStoredRanks) {
        for (const r of results) {
          if (r.taskId === task.id) ranks.set(r.modelId, r.rank);
        }
      } else {
        const taskResults = results
          .filter((r) => r.taskId === task.id)
          .map((r) => ({ modelId: r.modelId, value: getMetricValue(r) ?? 0 }))
          .sort((a, b) => b.value - a.value);
        taskResults.forEach((r, idx) => ranks.set(r.modelId, idx + 1));
      }
      taskRanks.set(task.id, ranks);
    }

    for (const model of models) {
      const ranks: number[] = [];
      for (const task of filteredTasks) {
        const rank = taskRanks.get(task.id)?.get(model.id);
        if (rank !== undefined) ranks.push(rank);
      }
      if (ranks.length > 0) {
        avgRanks.set(model.id, ranks.reduce((a, b) => a + b, 0) / ranks.length);
      }
    }

    return avgRanks;
  }, [models, filteredTasks, results, getMetricValue, useStoredRanks]);

  // Compute average metric value per model (across filtered tasks)
  const modelAvgValues = useMemo(() => {
    const avgValues = new Map<string, number>();

    for (const model of models) {
      const values: number[] = [];
      for (const task of filteredTasks) {
        const mapValue = resultsMap.get(model.id)?.get(task.id);
        if (mapValue !== undefined) {
          values.push(mapValue.value);
        }
      }
      if (values.length > 0) {
        avgValues.set(model.id, values.reduce((a, b) => a + b, 0) / values.length);
      }
    }

    return avgValues;
  }, [models, filteredTasks, resultsMap]);

  // Sort models by average rank
  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      const rankA = modelAvgRanks.get(a.id) ?? 999;
      const rankB = modelAvgRanks.get(b.id) ?? 999;
      return rankA - rankB;
    });
  }, [models, modelAvgRanks]);

  return {
    resultsMap,
    taskStats,
    modelAvgRanks,
    modelAvgValues,
    sortedModels,
  };
}

// =============================================================================
// Specialized Hook for Results with Std
// =============================================================================

/**
 * Options for useDetailedTableDataWithStd hook.
 */
export interface UseDetailedTableDataWithStdOptions
  extends Omit<UseDetailedTableDataOptions<ResultWithStd>, "getMetricValue"> {}

/**
 * Return type for useDetailedTableDataWithStd hook.
 */
export interface UseDetailedTableDataWithStdReturn
  extends Omit<UseDetailedTableDataReturn<ResultsMapValueWithStd>, "resultsMap"> {
  /** Lookup map: modelId -> taskId -> { value, std? } */
  resultsMap: Map<string, Map<string, ResultsMapValueWithStd>>;
}

/**
 * Specialized hook for detailed tables that include standard deviation values.
 *
 * Used by benchmarks like PathBench and Sinai that report mean ± std.
 *
 * @example
 * const { resultsMap, sortedModels } = useDetailedTableDataWithStd({
 *   models,
 *   filteredTasks,
 *   results,
 * });
 *
 * // Access std value
 * const result = resultsMap.get(modelId)?.get(taskId);
 * if (result?.std !== undefined) {
 *   console.log(`${result.value} ± ${result.std}`);
 * }
 */
export function useDetailedTableDataWithStd({
  models,
  filteredTasks,
  results,
}: UseDetailedTableDataWithStdOptions): UseDetailedTableDataWithStdReturn {
  // Create a lookup map for results: modelId -> taskId -> { value, std }
  const resultsMap = useMemo(() => {
    const map = new Map<string, Map<string, ResultsMapValueWithStd>>();
    for (const result of results) {
      if (!map.has(result.modelId)) {
        map.set(result.modelId, new Map());
      }
      map.get(result.modelId)!.set(result.taskId, {
        value: result.value,
        std: result.std,
      });
    }
    return map;
  }, [results]);

  // Use the base hook for other computations
  const baseResult = useDetailedTableData({
    models,
    filteredTasks,
    results,
  });

  return {
    resultsMap,
    taskStats: baseResult.taskStats,
    modelAvgRanks: baseResult.modelAvgRanks,
    modelAvgValues: baseResult.modelAvgValues,
    sortedModels: baseResult.sortedModels,
  };
}
