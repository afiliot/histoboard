/**
 * About Page (/about)
 *
 * Project overview, methodology description, benchmark summaries with links
 * to original publications, and contribution guidelines.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, BookOpen, Database, Trophy, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

import benchmarksData from "@/data/benchmarks.json";
import modelsData from "@/data/models.json";
import tasksData from "@/data/tasks.json";

import type { Benchmark, Model, Task } from "@/types";
import { getUniqueGroupedOrgans } from "@/lib/organGroups";

const benchmarks = benchmarksData as Benchmark[];
const models = modelsData as Model[];
const tasks = tasksData as Task[];

const groupedOrgans = getUniqueGroupedOrgans(tasks);

const stats = {
  benchmarkCount: benchmarks.length,
  taskCount: tasks.length,
  modelCount: models.length,
  organs: groupedOrgans,
};

const BENCHMARK_METHODOLOGY: Record<string, { metric: string; source: "official" | "computed"; lowerIsBetter?: boolean }> = {
  eva:             { metric: "Average metric across 13 tasks",                              source: "computed" },
  hest:            { metric: "Average Pearson's R across 9 different organs",              source: "official" },
  pathbench:       { metric: "Average task rank across 229 tasks",                         source: "computed", lowerIsBetter: true },
  pathobench:      { metric: "Average task rank across 53 tasks",                          source: "computed", lowerIsBetter: true },
  pathorob:        { metric: "Robustness index across 3 scenarios",                        source: "official" },
  pfm_densebench:  { metric: "Average rank across 18 segmentation datasets × 5 methods",  source: "official", lowerIsBetter: true },
  plism:           { metric: "Aggregate robustness score",                                 source: "official" },
  sinai:           { metric: "Average AUROC across 22 tasks",                              source: "official" },
  stamp:           { metric: "Average task rank across 31 tasks",                          source: "computed", lowerIsBetter: true },
  stanford:        { metric: "Average AUROC across 41 tasks",                              source: "official" },
  thunder:         { metric: "Rank sum across 6 tasks",                                    source: "official", lowerIsBetter: true },
  bc_survival_gustafsson: { metric: "Average C-index across 4 survival tasks",            source: "computed" },
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 text-center">About Histoboard</h1>

      {/* Motivation Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Why Histoboard?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-justify">
            The pathology foundation model landscape is growing fast, but comparing models across benchmarks remains
            fragmented and time-consuming. <strong>Histoboard</strong> aggregates results from published benchmarks
            into a single, accessible interface — giving the community a clear comparative view of existing models.
          </p>
          <div className="aspect-video w-full rounded-lg overflow-hidden">
            <iframe
              src="https://www.youtube.com/embed/s-y_r7jWFE8"
              title="Meet Histoboard"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <p className="text-muted-foreground text-justify">
            For the full story behind Histoboard, read our{" "}
            <a
              href="https://wearewaiv.com/blog/meet-histoboard-your-interactive-map-for-navigating-foundation-models-for-pathology"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              blog post
            </a>
            .
          </p>
        </CardContent>
      </Card>

      {/* What We Aggregate Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What We Aggregate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-justify">
            Histoboard currently aggregates results from <strong>{stats.benchmarkCount} published benchmarks</strong> covering:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>
              <strong>{stats.taskCount} evaluation tasks</strong> spanning classification, survival prediction, biomarker detection,
              and more
            </li>
            <li>
              <strong>{stats.modelCount} foundation models</strong> from academic and industry labs worldwide
            </li>
            <li>
              <strong>{stats.organs.length} organs</strong> including {stats.organs.slice(0, 5).join(", ")}, and others
            </li>
            <li>
              <strong>Robustness evaluation</strong> across domain shifts, scanners, and staining variations
            </li>
          </ul>
          <p className="text-muted-foreground text-justify">
            All data comes directly from official benchmark publications and repositories. See each{" "}
            <Link href="/benchmarks" className="text-primary hover:underline font-medium">
              benchmark card
            </Link>{" "}
            for exact data sources and evaluation protocols.
          </p>
        </CardContent>
      </Card>

      {/* How Rankings Work Section */}
      <Card id="how-rankings-work" className="mb-8">
        <CardHeader>
          <CardTitle>How Rankings Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-justify">
            The{" "}
            <Link href="/leaderboard" className="text-primary hover:underline font-medium">
              main leaderboard
            </Link>{" "}
            ranks models per benchmark using either the benchmark&rsquo;s own aggregate score or a metric we compute
            ourselves. When a benchmark provides an official aggregate (e.g. a robustness index or rank sum), we follow
            it directly. Otherwise, we average per-task ranks to compute an overall ranking metric for that benchmark.
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="px-3 py-2 text-left font-semibold">Benchmark</th>
                  <th className="px-3 py-2 text-left font-semibold">Ranking metric</th>
                  <th className="px-3 py-2 text-center font-semibold">Source</th>
                  <th className="px-3 py-2 text-center font-semibold">Direction</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks
                  .filter((b) => BENCHMARK_METHODOLOGY[b.id])
                  .sort((a, b) => a.shortName.localeCompare(b.shortName))
                  .map((benchmark, i) => {
                    const meta = BENCHMARK_METHODOLOGY[benchmark.id];
                    return (
                      <tr key={benchmark.id} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/30")}>
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/benchmarks/${benchmark.id}`} className="hover:underline text-primary">
                            {benchmark.shortName}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{meta.metric}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
                            meta.source === "official"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {meta.source === "official" ? "Official" : "Computed"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {meta.lowerIsBetter ? "↓ lower" : "↑ higher"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground text-justify">
            For detailed per-task results, visit the individual{" "}
            <Link href="/benchmarks" className="text-primary hover:underline font-medium">
              benchmark pages
            </Link>
            . Inside the{" "}
            <Link href="/arena" className="text-primary hover:underline font-medium">
              arena
            </Link>
            , we implement a metric-agnostic ranking system that enables you to compare models based on specific organs and tasks.
          </p>
        </CardContent>
      </Card>

      {/* Contributing Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Contributing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-justify">
            Histoboard is open source and welcomes contributions. If you notice missing models, incorrect data, or want
            to add a new benchmark, please:
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://github.com/wearewaiv/histoboard/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <GithubIcon className="mr-2 h-4 w-4" />
                Open an Issue
              </Button>
            </a>
            <a
              href="https://github.com/wearewaiv/histoboard"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Repository
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Key References Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Key References</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm">
                  Mahmood, F. (2025).{" "}
                  <a
                    href="https://www.nature.com/articles/s41591-025-03637-3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    A benchmarking crisis in biomedical machine learning
                  </a>
                  . <em>Nature Medicine</em>, 31, 1060.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm">
                  Zhang, A., Jaume, G., Vaidya, A., Ding, T., & Mahmood, F. (2025).{" "}
                  <a
                    href="https://arxiv.org/abs/2502.06750"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Accelerating Data Processing and Benchmarking of AI Models for Pathology
                  </a>
                  . <em>arXiv:2502.06750</em>.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/leaderboard">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Trophy className="h-8 w-8 text-primary mb-2" />
              <p className="font-medium">Leaderboard</p>
              <p className="text-sm text-muted-foreground">Overall model rankings</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/arena">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Swords className="h-8 w-8 text-primary mb-2" />
              <p className="font-medium">Arena</p>
              <p className="text-sm text-muted-foreground">Head-to-head comparison</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/benchmarks">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <BookOpen className="h-8 w-8 text-primary mb-2" />
              <p className="font-medium">Benchmarks</p>
              <p className="text-sm text-muted-foreground">Detailed per-task results</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/models">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Database className="h-8 w-8 text-primary mb-2" />
              <p className="font-medium">Models</p>
              <p className="text-sm text-muted-foreground">Browse all foundation models</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
