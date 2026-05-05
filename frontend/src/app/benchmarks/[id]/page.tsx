/**
 * Benchmark Detail Page (/benchmarks/[id])
 *
 * Renders a per-benchmark results page with metadata card and a custom table
 * component. Uses benchmarkTableMap to dispatch to the correct table component
 * for each benchmark ID. Pre-rendered at build time via generateStaticParams.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, FileText, Database, Table } from "lucide-react";

import { DetailedResultsTable } from "@/components/tables/DetailedResultsTable";
import { PathBenchDetailedTable } from "@/components/tables/PathBenchDetailedTable";
import { StanfordDetailedTable } from "@/components/tables/StanfordDetailedTable";
import { HESTDetailedTable } from "@/components/tables/HESTDetailedTable";
import { PathoBenchDetailedTable } from "@/components/tables/PathoBenchDetailedTable";
import { SinaiDetailedTable } from "@/components/tables/SinaiDetailedTable";
import { STAMPDetailedTable } from "@/components/tables/STAMPDetailedTable";
import { THUNDERDetailedTable } from "@/components/tables/THUNDERDetailedTable";
import { PathoROBDetailedTable } from "@/components/tables/PathoROBDetailedTable";
import { PLISMDetailedTable } from "@/components/tables/PLISMDetailedTable";
import { PFMDenseBenchDetailedTable } from "@/components/tables/PFMDenseBenchDetailedTable";

import modelsData from "@/data/models.json";
import tasksData from "@/data/tasks.json";
import resultsData from "@/data/results.json";
import benchmarksData from "@/data/benchmarks.json";
import rankingsData from "@/data/rankings.json";

import type { Model, Task, Result, Benchmark } from "@/types";

const models = modelsData as Model[];
const tasks = tasksData as Task[];
const results = resultsData as Result[];
const benchmarks = benchmarksData as Benchmark[];
const rankings = rankingsData as Record<string, Record<string, { avgRank: number; taskCount: number }>>;

const categoryColors: Record<string, string> = {
  "pathology": "bg-blue-100 text-blue-800",
  "radiology": "bg-cyan-100 text-cyan-800",
  "spatial-transcriptomics": "bg-purple-100 text-purple-800",
  "patch-level": "bg-blue-100 text-blue-800",
  "slide-level": "bg-purple-100 text-purple-800",
  survival: "bg-red-100 text-red-800",
  segmentation: "bg-green-100 text-green-800",
  retrieval: "bg-yellow-100 text-yellow-800",
  robustness: "bg-orange-100 text-orange-800",
  "H&E": "bg-pink-100 text-pink-800",
};

// Map benchmark ID to the correct table component
const benchmarkTableMap: Record<string, React.ComponentType<{
  models: Model[];
  tasks: Task[];
  results: Result[] | any[];
  modelRankings: { modelId: string; overallRank: number }[];
}>> = {
  eva: DetailedResultsTable,
  pathbench: PathBenchDetailedTable,
  stanford: StanfordDetailedTable,
  hest: HESTDetailedTable,
  pathobench: PathoBenchDetailedTable,
  sinai: SinaiDetailedTable,
  stamp: STAMPDetailedTable,
  thunder: THUNDERDetailedTable,
  pathorob: PathoROBDetailedTable,
  plism: PLISMDetailedTable,
  pfm_densebench: PFMDenseBenchDetailedTable,
};

export function generateStaticParams() {
  return benchmarks.map((benchmark) => ({
    id: benchmark.id,
  }));
}

export default async function BenchmarkDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const benchmark = benchmarks.find(b => b.id === id);

  if (!benchmark) {
    notFound();
  }

  // Get models that have rankings for this benchmark
  const benchmarkModels = models.filter(m => rankings[id]?.[m.id]);

  // Get tasks for this benchmark
  const benchmarkTasks = tasks.filter(t => t.benchmarkId === id);

  // Get results for this benchmark
  const benchmarkResults = results.filter(r => r.source === id);

  // Compute model rankings for this benchmark
  const modelsWithRanks = benchmarkModels
    .map(m => ({
      modelId: m.id,
      avgRank: rankings[id]?.[m.id]?.avgRank ?? Infinity
    }))
    .filter(r => r.avgRank !== Infinity)
    .sort((a, b) => a.avgRank - b.avgRank);

  const modelRankings = modelsWithRanks.map((r, index) => ({
    modelId: r.modelId,
    overallRank: index + 1
  }));

  const TableComponent = benchmarkTableMap[id];

  if (!TableComponent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>No detailed table available for this benchmark.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back link */}
      <Link
        href="/benchmarks"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Benchmarks
      </Link>

      {/* Benchmark header */}
      <Card className="mb-8">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2 text-2xl">
                {benchmark.name}
                {Array.isArray(benchmark.category) ? (
                  benchmark.category.map((cat) => (
                    <Badge key={cat} className={categoryColors[cat] || ""}>
                      {cat}
                    </Badge>
                  ))
                ) : (
                  <Badge className={categoryColors[benchmark.category] || ""}>
                    {benchmark.category}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                {benchmark.description}
              </CardDescription>
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground mt-3">
                <div>
                  <span className="font-medium text-foreground">{benchmarkModels.length}</span> models evaluated
                </div>
                <div>
                  <span className="font-medium text-foreground">{benchmarkTasks.length}</span> tasks
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Organs:</span>
                  <div className="flex flex-wrap gap-1">
                    {benchmark.organs.map((organ) => (
                      <Badge key={organ} variant="outline" className="capitalize text-xs">
                        {organ}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              {benchmark.paperUrl && (
                <a href={benchmark.paperUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    Paper
                  </Button>
                </a>
              )}
              {benchmark.datasetUrl && (
                <a href={benchmark.datasetUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Database className="mr-2 h-4 w-4" />
                    Dataset
                  </Button>
                </a>
              )}
              {benchmark.resultsUrl && (
                <a href={benchmark.resultsUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Table className="mr-2 h-4 w-4" />
                    Source
                  </Button>
                </a>
              )}
              {benchmark.githubUrl && (
                <a href={benchmark.githubUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Github
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Results</CardTitle>
        </CardHeader>
        <CardContent>
          <TableComponent
            models={benchmarkModels}
            tasks={benchmarkTasks}
            results={benchmarkResults}
            modelRankings={modelRankings}
          />
        </CardContent>
      </Card>
    </div>
  );
}
