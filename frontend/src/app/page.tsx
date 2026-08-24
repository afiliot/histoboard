"use client";

/**
 * Home Page (/)
 *
 * Dashboard landing page showing summary statistics (model/benchmark/task counts),
 * champion podiums (top 3 models per benchmark), and an animated stat counter.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Database, BarChart3, Award, Globe } from "lucide-react";

import modelsData from "@/data/models.json";
import tasksData from "@/data/tasks.json";
import benchmarksData from "@/data/benchmarks.json";
import rankingsData from "@/data/rankings.json";

import type { Model, Task, Benchmark } from "@/types";
import { countUniqueOrgans } from "@/lib/organGroups";
import { computeBenchmarkRanks } from "@/lib/benchmarkConfig";
import { useEffect, useRef } from "react";

const models = modelsData as Model[];
const tasks = tasksData as Task[];
const benchmarks = benchmarksData as Benchmark[];
const rankings = rankingsData as Record<string, Record<string, { avgRank: number; taskCount: number }>>;

export default function HomePage() {
  const stats = {
    models: models.length,
    tasks: tasks.length,
    benchmarks: benchmarks.length,
    organs: countUniqueOrgans(tasks),
  };

  // Models to exclude from rankings (e.g., benchmark-specific baselines)
  const EXCLUDED_MODEL_IDS = new Set(["hest_uni_1_5"]);

  // Pre-compute benchmark ranks using the shared utility (respects avgScore and
  // scoreHigherIsBetter per benchmark, e.g. THUNDER uses official rank sum)
  const benchmarkRanks = computeBenchmarkRanks(rankings);

  // Get top N models for a benchmark, using pre-computed benchmark-aware ranks.
  // Returns at most maxDisplay models sorted by rank (ties preserved in rank order).
  const getTopModels = (benchmarkId: string, maxDisplay: number = 4) => {
    const rankData = benchmarkRanks[benchmarkId];
    if (!rankData) return [];
    return [...rankData.ranks.entries()]
      .filter(([modelId]) => !EXCLUDED_MODEL_IDS.has(modelId))
      .sort((a, b) => a[1] - b[1])
      .slice(0, maxDisplay)
      .map(([modelId, rank]) => ({
        modelId,
        rank,
        avgRank: rankings[benchmarkId]?.[modelId]?.avgRank ?? 0,
        model: models.find(m => m.id === modelId),
      }));
  };

  // Get top 4 for each benchmark, sorted A→Z by shortName
  const podiums = [...benchmarks]
    .sort((a, b) => a.shortName.localeCompare(b.shortName))
    .map(benchmark => ({
      benchmark,
      topModels: getTopModels(benchmark.id, 4),
    }));

  // Medals by unique-rank position: tied models share the same medal,
  // and the next distinct rank moves to the next medal slot.
  // e.g. THUNDER ranks [1,2,2,4] → unique slots [🥇,🥈,🥉] → rank4 gets 🥉
  // e.g. normal ranks [1,2,3,4] → unique slots [🥇,🥈,🥉,🍫]
  const SLOT_MEDALS: string[] = ["🥇", "🥈", "🥉", "🍫"];
  const getMedal = (rank: number, topModels: { rank: number }[]) => {
    const uniqueRanks = [...new Set(topModels.map(e => e.rank))];
    const slotIndex = uniqueRanks.indexOf(rank);
    return SLOT_MEDALS[slotIndex] ?? "🍫";
  };

  // Podium Card Component (shows top 3 with medals)
  const PodiumCard = ({ benchmark, topModels }: { benchmark: Benchmark; topModels: ReturnType<typeof getTopModels> }) => {
    if (topModels.length === 0) return null;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {benchmark.shortName}
            {(benchmark.id === "pathorob" ||
              benchmark.id === "plism" ||
              benchmark.id === "croma") && (
              <span className="ml-1 text-[10px]">(robustness)</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {topModels.map((entry) => (
            <div key={entry.modelId} className="flex items-center gap-2">
              <span className="text-base">{getMedal(entry.rank, topModels)}</span>
              <Link
                href={`/models/${entry.modelId}`}
                className="text-sm font-medium text-primary hover:underline truncate"
              >
                {entry.model?.name || entry.modelId}
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
          Pathology Foundation Model Leaderboard
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-base sm:text-lg text-muted-foreground">
          A centralized dashboard aggregating benchmark results to compare
          pathology foundation models
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/leaderboard">
            <Button size="lg">
              <Trophy className="mr-2 h-5 w-5" />
              View Full Leaderboard
            </Button>
          </Link>
          <Link href="/benchmarks">
            <Button variant="outline" size="lg">
              <Database className="mr-2 h-5 w-5" />
              Data Sources
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-12 grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Models</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.models}</div>
            <p className="text-xs text-muted-foreground">
              Foundation models evaluated
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tasks}</div>
            <p className="text-xs text-muted-foreground">
              Benchmark tasks tracked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Benchmarks</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.benchmarks}</div>
            <p className="text-xs text-muted-foreground">Data sources</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organs</CardTitle>
            <svg
              className="h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.organs}</div>
            <p className="text-xs text-muted-foreground">Tissue types covered</p>
          </CardContent>
        </Card>
      </section>

      {/* Champion Board */}
      <section className="mb-12">
        <div className="mb-6 text-center">
          <h2 className="inline-flex items-center gap-2 text-2xl font-bold">
            <Award className="h-5 w-5 text-yellow-500" />
            Champion Board
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {podiums.map(({ benchmark, topModels }) => (
            <PodiumCard key={benchmark.id} benchmark={benchmark} topModels={topModels} />
          ))}
        </div>
      </section>

      {/* Visitor Map */}
      <VisitorMap />
    </div>
  );
}

// The mapmyvisitors script uses document.write(), which only works during
// initial HTML parsing. An <iframe srcDoc> gives the script a fresh document
// that is being parsed, so document.write() works correctly.
// No sandbox attribute — sandbox was blocking script execution and navigation.

function VisitorMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.id = "mapmyvisitors";
    script.src =
      "https://mapmyvisitors.com/map.js?cl=7678b9&w=410&t=tt&d=dJDHJ3-hyo0XeVx6oc7STY3ihPbjvz2CHCOP4-j6XOo&co=ffffff&cmo=fa5b63&cmn=fa5b63&ct=0a0000";
    script.async = true;

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  return (
    <section className="mb-8">
      <h2 className="mb-6 text-center text-xl font-bold">
        Visitors from around the world
      </h2>

      <div
        ref={containerRef}
        className="flex justify-center"
      />
    </section>
  );
}