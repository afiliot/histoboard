"use client";

/**
 * CRoMa Detailed Table
 *
 * Renders per-cohort results for the CRoMa confounder-robustness benchmark,
 * which builds on PathoROB's Robustness Index and scores the same three tile
 * cohorts (Camelyon, TCGA-4×4, Tolkach-ESCA).
 *
 * Models are sorted by the official mean rank — the average of the CRoMa rank
 * (median margin) and the tail rank (LTM₁₀ severity), both kept in view beside
 * it because a strong median margin can hide a brittle tail.
 *
 * Supports switching between 9 display modes:
 *   - CRoMa (default): median signed margin at m=5, with LTM₁₀ underneath
 *   - LTM₁₀, RI, MaRI, Δ (MaRI−RI), F(0), support, bio bacc, conf bacc
 *
 * Used by: app/benchmarks/[id]/page.tsx (benchmark ID "croma")
 */

import React, { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Model, Task, Result } from "@/types";
import type { TaskValueStats } from "@/lib/utils";
import type { CromaResult } from "@/types/results";
import { cn, formatNumber, getValueColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MultiSelectDropdown } from "@/components/ui/multi-select-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSimpleTaskFiltering } from "@/hooks";
import { useDetailedTableData } from "@/hooks/useDetailedTableData";
import {
  buildOrganOptions,
  buildTaskNameOptions,
  TD_MODEL_CLASSES,
  TD_AVG_CLASSES,
} from "@/lib/tableUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Virtual task carrying the panel-level ranks and flags (not a cohort). */
const AGGREGATE_TASK_ID = "croma_aggregate";

// ---------------------------------------------------------------------------
// Metric types
// ---------------------------------------------------------------------------

type CromaMetric =
  | "croma"
  | "ltm10"
  | "ri"
  | "mari"
  | "delta"
  | "f0"
  | "support"
  | "bioBacc"
  | "confBacc";

const METRIC_OPTIONS: { value: CromaMetric; label: string }[] = [
  { value: "croma",    label: "CRoMa" },
  { value: "ltm10",    label: "LTM₁₀ (tail)" },
  { value: "ri",       label: "RI" },
  { value: "mari",     label: "MaRI" },
  { value: "delta",    label: "Δ (MaRI − RI)" },
  { value: "f0",       label: "F(0)" },
  { value: "support",  label: "Support" },
  { value: "bioBacc",  label: "Bio bacc" },
  { value: "confBacc", label: "Conf bacc" },
];

/** One-line reading note per metric, shown above the table. */
const METRIC_NOTES: Record<CromaMetric, string> = {
  croma:
    "CRoMa is the median signed margin at the headline radius m=5, in (-1, 1) and neutral at 0. Each cell shows it above its lower-tail mean LTM₁₀.",
  ltm10:
    "LTM₁₀ is the lower-tail mean: the mean of the lowest decile of the per-sample CRoMa distribution — how bad the worst tenth actually is.",
  ri: "RI is the pooled count-based Robustness Index in [0, 1], neutral at 0.5. Introduced by PathoROB and re-implemented here.",
  mari:
    "MaRI is the distance-weighted counterpart of RI, in [0, 1] and neutral at 0.5.",
  delta:
    "Δ is MaRI − RI: whether weighting the same evidence by distance helps or hurts. Read for its sign, not its size — so it is left uncoloured.",
  f0: "F(0) is the fraction of samples with CRoMa ≤ 0 — confounder-dominant neighbourhoods. Lower is better.",
  support:
    "Support is the fraction of samples contributing to RI/MaRI at all. A high index over a thin support is not a strong result.",
  bioBacc:
    "Balanced accuracy of a k-NN classifier predicting the biological label. A diagnostic, not a score.",
  confBacc:
    "Balanced accuracy of a k-NN classifier predicting the center. A diagnostic: high values mark a representation that encodes the center strongly.",
};

function getMetricLabel(metric: CromaMetric): string {
  return METRIC_OPTIONS.find((m) => m.value === metric)?.label ?? metric;
}

/** Metrics where lower values are better. */
const LOWER_IS_BETTER: Set<CromaMetric> = new Set(["f0", "confBacc"]);

/** Metrics that carry no ordering, so cells stay uncoloured. */
const UNORDERED: Set<CromaMetric> = new Set(["delta"]);

/** Decimals per metric — the margins need more precision than the indices. */
function metricDecimals(metric: CromaMetric): number {
  return metric === "delta" ? 4 : 3;
}

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

/** Extract the numeric value for a result under the selected metric. */
function extractValue(
  result: CromaResult,
  metric: CromaMetric
): number | undefined {
  switch (metric) {
    case "croma":    return result.value;
    case "ltm10":    return result.ltm10;
    case "ri":       return result.ri;
    case "mari":     return result.mari;
    case "delta":    return result.delta;
    case "f0":       return result.f0;
    case "support":  return result.support;
    case "bioBacc":  return result.bioBacc;
    case "confBacc": return result.confBacc;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CromaDetailedTableProps {
  models: Model[];
  tasks: Task[];
  results: Result[];
  modelRankings: { modelId: string; overallRank: number }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CromaDetailedTable({
  models,
  tasks,
  results,
}: CromaDetailedTableProps) {
  // Cast to extended type — results.json includes all CromaResult fields
  const cromaResults = results as CromaResult[];

  // Split the panel-level row off from the per-cohort results
  const cohortResults = useMemo(
    () => cromaResults.filter((r) => r.taskId !== AGGREGATE_TASK_ID),
    [cromaResults]
  );

  const panelMap = useMemo(() => {
    const map = new Map<string, CromaResult>();
    for (const r of cromaResults) {
      if (r.taskId === AGGREGATE_TASK_ID) map.set(r.modelId, r);
    }
    return map;
  }, [cromaResults]);

  // Metric selection — default to CRoMa (matches the official panel)
  const [selectedMetric, setSelectedMetric] = useState<CromaMetric>("croma");

  const getMetricValue = useCallback(
    (r: CromaResult) => extractValue(r, selectedMetric),
    [selectedMetric]
  );

  // Shared filter hook for organs + task names
  const { filteredTasks, organs, taskNames, availableOrgans, availableTaskNames } =
    useSimpleTaskFiltering(tasks);

  // Per-cell stats for colour scaling and the average column
  const { taskStats, modelAvgValues } = useDetailedTableData<CromaResult>({
    models,
    filteredTasks,
    results: cohortResults,
    getMetricValue,
  });

  // Full per-cell lookup (all metrics) for rendering
  const fullResultsMap = useMemo(() => {
    const map = new Map<string, Map<string, CromaResult>>();
    for (const r of cohortResults) {
      if (!map.has(r.modelId)) map.set(r.modelId, new Map());
      map.get(r.modelId)!.set(r.taskId, r);
    }
    return map;
  }, [cohortResults]);

  // Sort by the official mean rank (lower is better)
  const sortedModels = useMemo(
    () =>
      [...models]
        .filter((m) => panelMap.has(m.id))
        .sort(
          (a, b) =>
            (panelMap.get(a.id)?.value ?? Infinity) -
            (panelMap.get(b.id)?.value ?? Infinity)
        ),
    [models, panelMap]
  );

  const organOptions = buildOrganOptions(availableOrgans);
  const taskOptions = buildTaskNameOptions(availableTaskNames);
  const lowerIsBetter = LOWER_IS_BETTER.has(selectedMetric);
  const unordered = UNORDERED.has(selectedMetric);
  const decimals = metricDecimals(selectedMetric);

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
              onValueChange={(v) => setSelectedMetric(v as CromaMetric)}
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
          label="Indications"
          options={organOptions}
          selectedIds={organs.selected}
          onToggle={organs.toggle}
          onSelectAll={organs.selectAll}
          onClearAll={organs.clearAll}
        />
        <MultiSelectDropdown
          label="All Tasks"
          options={taskOptions}
          selectedIds={taskNames.selected}
          onToggle={taskNames.toggle}
          onSelectAll={taskNames.selectAll}
          onClearAll={taskNames.clearAll}
        />
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        Showing {filteredTasks.length} of 3 tile cohorts.{" "}
        {METRIC_NOTES[selectedMetric]} Models are ordered by the mean of the
        CRoMa rank and the tail rank (lower is better) — a reading order, not a
        score.
      </p>

      <div className="overflow-x-auto overflow-y-auto max-h-[65vh] border rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="border-b bg-muted">
              <th className="sticky left-0 z-30 bg-muted px-3 py-2 text-left font-semibold min-w-[170px]">
                Model
              </th>
              <th className="px-2 py-2 text-center font-semibold min-w-[70px] bg-muted/80">
                <div className="text-xs leading-tight">
                  Mean
                  <br />
                  rank
                </div>
              </th>
              <th className="px-2 py-2 text-center font-semibold min-w-[70px] bg-muted/80">
                <div className="text-xs leading-tight">
                  CRoMa
                  <br />
                  rank
                </div>
              </th>
              <th className="px-2 py-2 text-center font-semibold min-w-[70px] bg-muted/80">
                <div className="text-xs leading-tight">
                  Tail
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
                  className="px-2 py-2 text-center font-semibold min-w-[100px] max-w-[150px] bg-muted"
                >
                  <div className="text-xs whitespace-normal leading-tight">
                    {task.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-normal whitespace-nowrap mt-0.5">
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

              const panel = panelMap.get(model.id);
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
                        className={cn(
                          "text-primary hover:underline whitespace-nowrap",
                          panel?.onFrontier ? "font-bold" : "font-medium"
                        )}
                      >
                        {model.name}
                      </Link>
                      {panel?.onFrontier && (
                        <span
                          className="text-[10px] text-muted-foreground"
                          title="On the Pareto frontier: no other encoder beats it on both rankings at once"
                        >
                          ★
                        </span>
                      )}
                      {panel?.tcgaExposed && (
                        <span
                          className="rounded bg-orange-100 px-1 text-[9px] font-medium text-orange-800"
                          title="Disclosed pretraining overlaps TCGA, one of the three cohorts"
                        >
                          TCGA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={TD_AVG_CLASSES}>
                    {panel !== undefined ? formatNumber(panel.value, 1) : "-"}
                  </td>
                  <td className={TD_AVG_CLASSES}>
                    {panel?.cromaRank !== undefined
                      ? formatNumber(panel.cromaRank, 1)
                      : "-"}
                  </td>
                  <td className={TD_AVG_CLASSES}>
                    {panel?.ltmRank !== undefined
                      ? formatNumber(panel.ltmRank, 1)
                      : "-"}
                  </td>
                  <td className={TD_AVG_CLASSES}>
                    {avgVal !== undefined ? formatNumber(avgVal, decimals) : "-"}
                  </td>
                  {filteredTasks.map((task) => {
                    const result = modelResults?.get(task.id);
                    const value = result
                      ? extractValue(result, selectedMetric)
                      : undefined;
                    const stats = lowerIsBetter
                      ? invertStats(taskStats.get(task.id))
                      : taskStats.get(task.id);
                    return (
                      <td
                        key={task.id}
                        className={cn(
                          "px-2 py-2 text-center tabular-nums",
                          value !== undefined &&
                            !unordered &&
                            getValueColor(value, stats)
                        )}
                      >
                        {value !== undefined ? (
                          <div className="flex flex-col items-center leading-tight">
                            <span className="font-medium">
                              {formatNumber(value, decimals)}
                            </span>
                            {selectedMetric === "croma" &&
                              result?.ltm10 !== undefined && (
                                <span className="text-[9px] text-muted-foreground opacity-80">
                                  tail {formatNumber(result.ltm10, 3)}
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

      <div className="mt-3 space-y-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">★</span> marks the Pareto frontier — the
          encoders no other pathology encoder beats on both the CRoMa rank and
          the tail rank at once. It is a set, not an order.
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="rounded bg-orange-100 px-1 text-[9px] font-medium text-orange-800">
            TCGA
          </span>{" "}
          marks encoders whose disclosed pretraining overlaps TCGA, one of the
          three cohorts behind these ranks.
        </p>
        <p className="text-xs text-muted-foreground">
          CRoMa also scores DINOv2-B as a natural-image calibration floor and
          PRISM/PRISM2/TITAN/MOOZY on a separate slide-level cohort. Neither
          takes part in the ranks above, and generic vision baselines are out of
          scope for Histoboard — see the{" "}
          <a
            href="https://clemsgrs.github.io/croma/results/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            full panel
          </a>
          .
        </p>
      </div>
    </div>
  );
}
