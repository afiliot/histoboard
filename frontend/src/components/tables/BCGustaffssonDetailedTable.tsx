"use client";

import React from "react";
import Link from "next/link";
import type { Model, Task, Result } from "@/types";
import { cn, formatNumber, getValueColor } from "@/lib/utils";
import { useDetailedTableData } from "@/hooks/useDetailedTableData";

interface BCGustaffssonDetailedTableProps {
  models: Model[];
  tasks: Task[];
  results: Result[];
  modelRankings: { modelId: string; overallRank: number }[];
}

export function BCGustaffssonDetailedTable({
  models,
  tasks,
  results,
}: BCGustaffssonDetailedTableProps) {
  const { resultsMap, taskStats, modelAvgRanks, modelAvgValues, sortedModels } =
    useDetailedTableData({ models, filteredTasks: tasks, results });

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        C-index with 95% bootstrap confidence intervals across 4 evaluation
        settings (RFS/PFS × all patients / ER+ &amp; HER2− subgroup).
      </p>

      <div className="overflow-x-auto overflow-y-auto max-h-[70vh] border rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="border-b bg-muted">
              <th className="sticky left-0 z-30 bg-muted px-3 py-2 text-left font-semibold min-w-[150px]">
                Model
              </th>
              <th className="px-2 py-2 text-center font-semibold min-w-[70px] bg-muted/80">
                <div className="text-xs leading-tight">Average<br />rank</div>
              </th>
              <th className="px-2 py-2 text-center font-semibold min-w-[80px] bg-muted/80">
                <div className="text-xs leading-tight">Mean<br />C-index</div>
              </th>
              {tasks.map((task) => (
                <th
                  key={task.id}
                  className="px-2 py-2 text-center font-semibold min-w-[160px] bg-muted"
                >
                  <div className="text-xs whitespace-normal leading-tight">
                    {task.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-normal mt-0.5">
                    C-index (95% CI)
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedModels.map((model, sortIdx) => {
              const modelResults = resultsMap.get(model.id);
              const hasResults = tasks.some((task) => modelResults?.has(task.id));
              if (!hasResults) return null;

              return (
                <tr
                  key={model.id}
                  className="border-b hover:bg-muted/30 transition-colors"
                >
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 border-r">
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
                  <td className="px-2 py-2 text-center tabular-nums bg-muted/30 font-semibold">
                    {modelAvgRanks.get(model.id) !== undefined
                      ? formatNumber(modelAvgRanks.get(model.id)!, 2)
                      : "-"}
                  </td>
                  <td className="px-2 py-2 text-center tabular-nums bg-muted/30 font-semibold">
                    {modelAvgValues.get(model.id) !== undefined
                      ? formatNumber(modelAvgValues.get(model.id)!, 3)
                      : "-"}
                  </td>
                  {tasks.map((task) => {
                    const entry = modelResults?.get(task.id);
                    const value = entry?.value;
                    return (
                      <td
                        key={task.id}
                        className={cn(
                          "px-2 py-2 text-center tabular-nums",
                          value !== undefined &&
                            getValueColor(value, taskStats.get(task.id))
                        )}
                      >
                        {value !== undefined ? (
                          <div>
                            <span className="font-medium">
                              {formatNumber(value, 3)}
                            </span>
                            {entry?.ciLower !== undefined && entry?.ciUpper !== undefined && (
                              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                ({formatNumber(entry.ciLower, 3)}–{formatNumber(entry.ciUpper, 3)})
                              </div>
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
