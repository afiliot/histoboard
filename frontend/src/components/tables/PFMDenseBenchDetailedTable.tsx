"use client";

/**
 * PFM-DenseBench Detailed Table
 *
 * Renders per-dataset results for the PFM-DenseBench segmentation benchmark.
 * Values are averaged across 5 adaptation methods (CNN adapter, DoRA, frozen,
 * LoRA, Transformer adapter). Models are sorted by official average rank
 * (lower is better). Supports switching between 9 display modes:
 *   - mDice Rank (default): per-method mDice rank averaged across 5 methods ± SD
 *   - mDice, mIoU, Freq. Weighted IoU, Pixel Accuracy, Mean Accuracy,
 *     Mean Precision, Mean Recall, Mean F1 (all with 95% CI)
 *
 * Used by: app/benchmarks/[id]/page.tsx (benchmark ID "pfm_densebench")
 */

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Model, Task, Result } from "@/types";
import type { TaskValueStats } from "@/lib/utils";
import type { PFMDenseBenchResult } from "@/types/results";
import { cn, formatNumber, getValueColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaskFiltering } from "@/hooks/useTaskFiltering";
import { useDetailedTableData } from "@/hooks/useDetailedTableData";
import {
  buildOrganOptions,
  buildCategoryOptions,
  TD_MODEL_CLASSES,
  TD_AVG_CLASSES,
} from "@/lib/tableUtils";

// ---------------------------------------------------------------------------
// Metric types
// ---------------------------------------------------------------------------

type PFMMetric =
  | "mDiceRank"
  | "mDice"
  | "mIoU"
  | "frequencyWeightedIoU"
  | "pixelAccuracy"
  | "meanAccuracy"
  | "meanPrecision"
  | "meanRecall"
  | "meanF1";

const METRIC_OPTIONS: { value: PFMMetric; label: string }[] = [
  { value: "mDiceRank",            label: "mDICE rank" },
  { value: "mDice",                label: "mDice" },
  { value: "mIoU",                 label: "mIoU" },
  { value: "frequencyWeightedIoU", label: "Freq. Weighted IoU" },
  { value: "pixelAccuracy",        label: "Pixel Accuracy" },
  { value: "meanAccuracy",         label: "Mean Accuracy" },
  { value: "meanPrecision",        label: "Mean Precision" },
  { value: "meanRecall",           label: "Mean Recall" },
  { value: "meanF1",               label: "Mean F1" },
];

function getMetricLabel(metric: PFMMetric): string {
  return METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? metric;
}

/** True when lower values are better (rank metrics). */
const LOWER_IS_BETTER: Set<PFMMetric> = new Set(["mDiceRank"]);

/**
 * Invert TaskValueStats so getValueColor treats lower values as better.
 * Swapping min↔max reverses the normalization.
 */
function invertStats(
  stats: TaskValueStats | undefined
): TaskValueStats | undefined {
  if (!stats) return undefined;
  return { min: stats.max, max: stats.min };
}

/** Extract the primary numeric value for a result under the selected metric. */
function extractValue(
  result: PFMDenseBenchResult,
  metric: PFMMetric
): number | undefined {
  switch (metric) {
    case "mDiceRank":            return result.mDiceAvgRank;
    case "mDice":                return result.value;
    case "mIoU":                 return result.mIoU;
    case "frequencyWeightedIoU": return result.frequencyWeightedIoU;
    case "pixelAccuracy":        return result.pixelAccuracy;
    case "meanAccuracy":         return result.meanAccuracy;
    case "meanPrecision":        return result.meanPrecision;
    case "meanRecall":           return result.meanRecall;
    case "meanF1":               return result.meanF1;
  }
}

/**
 * Extract the secondary annotation for a cell:
 * - mDiceRank → ± SD of per-method ranks
 * - all others → [ciLower – ciUpper]
 */
type CellAnnotation =
  | { kind: "ci"; lower: number; upper: number }
  | { kind: "std"; std: number }
  | { kind: "none" };

function extractAnnotation(
  result: PFMDenseBenchResult,
  metric: PFMMetric
): CellAnnotation {
  if (metric === "mDiceRank") {
    return result.mDiceRankStd !== undefined
      ? { kind: "std", std: result.mDiceRankStd }
      : { kind: "none" };
  }
  let lower: number | undefined;
  let upper: number | undefined;
  switch (metric) {
    case "mDice":
      lower = result.ciLower; upper = result.ciUpper; break;
    case "mIoU":
      lower = result.mIoULower; upper = result.mIoUUpper; break;
    case "frequencyWeightedIoU":
      lower = result.frequencyWeightedIoULower;
      upper = result.frequencyWeightedIoUUpper;
      break;
    case "pixelAccuracy":
      lower = result.pixelAccuracyLower; upper = result.pixelAccuracyUpper; break;
    case "meanAccuracy":
      lower = result.meanAccuracyLower; upper = result.meanAccuracyUpper; break;
    case "meanPrecision":
      lower = result.meanPrecisionLower; upper = result.meanPrecisionUpper; break;
    case "meanRecall":
      lower = result.meanRecallLower; upper = result.meanRecallUpper; break;
    case "meanF1":
      lower = result.meanF1Lower; upper = result.meanF1Upper; break;
  }
  return lower !== undefined && upper !== undefined
    ? { kind: "ci", lower, upper }
    : { kind: "none" };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PFMDenseBenchDetailedTableProps {
  models: Model[];
  tasks: Task[];
  results: Result[];
  modelRankings: { modelId: string; overallRank: number }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PFMDenseBenchDetailedTable({
  models,
  tasks,
  results,
}: PFMDenseBenchDetailedTableProps) {
  // Cast to extended type — results.json includes all PFMDenseBenchResult fields
  const pfmResults = results as PFMDenseBenchResult[];

  // Separate the official avg-rank results from per-dataset results
  const datasetResults = useMemo(
    () => pfmResults.filter((r) => r.taskId !== "pfm_densebench_avgrank"),
    [pfmResults]
  );

  const avgRankMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of pfmResults) {
      if (r.taskId === "pfm_densebench_avgrank") map.set(r.modelId, r.value);
    }
    return map;
  }, [pfmResults]);

  // Metric selection — default to mDICE Rank (matches the official leaderboard)
  const [selectedMetric, setSelectedMetric] = useState<PFMMetric>("mDiceRank");

  const getMetricValue = useCallback(
    (r: PFMDenseBenchResult) => extractValue(r, selectedMetric),
    [selectedMetric]
  );

  // Search state
  const [search, setSearch] = useState("");

  // Task filtering: category (Nuclear / Gland / Tissue) + organ
  const {
    filteredTasks: baseFilteredTasks,
    organs,
    categories,
    availableOrgans,
    availableCategories,
  } = useTaskFiltering(tasks);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseFilteredTasks;
    return baseFilteredTasks.filter((t) => t.name.toLowerCase().includes(q));
  }, [baseFilteredTasks, search]);

  // Per-cell stats for color scaling and average column
  const { taskStats, modelAvgValues } = useDetailedTableData<PFMDenseBenchResult>({
    models,
    filteredTasks,
    results: datasetResults,
    getMetricValue,
  });

  // Full per-cell lookup (all metrics) for rendering
  const fullResultsMap = useMemo(() => {
    const map = new Map<string, Map<string, PFMDenseBenchResult>>();
    for (const r of datasetResults) {
      if (!map.has(r.modelId)) map.set(r.modelId, new Map());
      map.get(r.modelId)!.set(r.taskId, r);
    }
    return map;
  }, [datasetResults]);

  // Sort by official avg rank (lower is better)
  const sortedModels = useMemo(
    () =>
      [...models]
        .filter((m) => avgRankMap.has(m.id))
        .sort(
          (a, b) =>
            (avgRankMap.get(a.id) ?? 9999) - (avgRankMap.get(b.id) ?? 9999)
        ),
    [models, avgRankMap]
  );

  const organOptions = buildOrganOptions(availableOrgans);
  const categoryOptions = buildCategoryOptions(availableCategories);
  const lowerIsBetter = LOWER_IS_BETTER.has(selectedMetric);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Metric selector — first position */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="justify-between min-w-[160px]">
              <span className="truncate">{getMetricLabel(selectedMetric)}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={selectedMetric}
              onValueChange={(v) => setSelectedMetric(v as PFMMetric)}
            >
              {METRIC_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <MultiSelectDropdown
          label="Task Type"
          options={categoryOptions}
          selectedIds={categories.selected}
          onToggle={categories.toggle}
          onSelectAll={categories.selectAll}
          onClearAll={categories.clearAll}
        />
        <MultiSelectDropdown
          label="Indications"
          options={organOptions}
          selectedIds={organs.selected}
          onToggle={organs.toggle}
          onSelectAll={organs.selectAll}
          onClearAll={organs.clearAll}
        />
        <Input
          type="search"
          placeholder="Search datasets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-48"
        />
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        Showing {filteredTasks.length} of 18 segmentation datasets.{" "}
        {selectedMetric === "mDiceRank"
          ? "mDICE Rank is the per-method rank averaged across 5 adaptation methods (lower is better); ± SD reflects consistency across methods."
          : "Values are averaged across 5 adaptation methods (Frozen backbone, DoRA, LoRA, CNN adapter, Transformer adapter)."}{" "}
        The overall average rank is the official benchmark ranking (lower is
        better).
      </p>

      <div className="overflow-x-auto overflow-y-auto max-h-[65vh] border rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="border-b bg-muted">
              <th className="sticky left-0 z-30 bg-muted px-3 py-2 text-left font-semibold min-w-[150px]">
                Model
              </th>
              <th className="px-2 py-2 text-center font-semibold min-w-[90px] bg-muted/80">
                <div className="text-xs leading-tight">
                  Average
                  <br />
                  rank
                </div>
              </th>
              <th className="px-2 py-2 text-center font-semibold min-w-[90px] bg-muted/80">
                <div className="text-xs leading-tight">
                  Average
                  <br />
                  {getMetricLabel(selectedMetric)}
                </div>
              </th>
              {filteredTasks.map((task) => (
                <th
                  key={task.id}
                  className="px-2 py-2 text-center font-semibold min-w-[80px] max-w-[120px] bg-muted"
                >
                  <div className="text-xs whitespace-normal leading-tight">
                    {task.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    {getMetricLabel(selectedMetric)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedModels.map((model, sortIdx) => {
              const modelResults = fullResultsMap.get(model.id);
              const hasResults = filteredTasks.some((t) =>
                modelResults?.has(t.id)
              );
              if (!hasResults) return null;

              const avgRank = avgRankMap.get(model.id);
              const avgVal = modelAvgValues.get(model.id);

              return (
                <tr
                  key={model.id}
                  className="border-b hover:bg-muted/30 transition-colors"
                >
                  <td className={TD_MODEL_CLASSES}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {sortIdx + 1}
                      </span>
                      <Link
                        href={`/models/${model.id}`}
                        className="font-medium text-primary hover:underline whitespace-nowrap"
                      >
                        {model.name}
                      </Link>
                    </div>
                  </td>
                  <td className={TD_AVG_CLASSES}>
                    {avgRank !== undefined ? formatNumber(avgRank, 2) : "-"}
                  </td>
                  <td className={TD_AVG_CLASSES}>
                    {avgVal !== undefined
                      ? formatNumber(avgVal, lowerIsBetter ? 2 : 3)
                      : "-"}
                  </td>
                  {filteredTasks.map((task) => {
                    const result = modelResults?.get(task.id);
                    const value = result
                      ? extractValue(result, selectedMetric)
                      : undefined;
                    const annotation = result
                      ? extractAnnotation(result, selectedMetric)
                      : { kind: "none" as const };
                    const stats = lowerIsBetter
                      ? invertStats(taskStats.get(task.id))
                      : taskStats.get(task.id);
                    return (
                      <td
                        key={task.id}
                        className={cn(
                          "px-2 py-2 text-center tabular-nums",
                          value !== undefined && getValueColor(value, stats)
                        )}
                      >
                        {value !== undefined ? (
                          <div className="flex flex-col items-center leading-tight">
                            <span className="font-medium">
                              {formatNumber(value, lowerIsBetter ? 2 : 3)}
                            </span>
                            {annotation.kind === "std" && (
                              <span className="text-[9px] text-muted-foreground opacity-80">
                                ± {formatNumber(annotation.std, 2)}
                              </span>
                            )}
                            {annotation.kind === "ci" && (
                              <span className="text-[9px] text-muted-foreground opacity-80">
                                [{formatNumber(annotation.lower, 3)}–
                                {formatNumber(annotation.upper, 3)}]
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
