"use client";

/**
 * Benchmarks Index Page (/benchmarks)
 *
 * Overview of all supported benchmarks. Displays cards with benchmark metadata,
 * task counts, organ coverage, and links to the detailed results page. Supports
 * filtering by organ and task type category.
 */

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, FileText, Database, Search, Star, Trophy, Table } from "lucide-react";
import Link from "next/link";

import benchmarksData from "@/data/benchmarks.json";
import tasksData from "@/data/tasks.json";

import type { Benchmark, Task } from "@/types";

const benchmarks = benchmarksData as Benchmark[];
const tasks = tasksData as Task[];

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

// Parse GitHub URL to get owner/repo
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

// Format star count (e.g., 1234 -> "1.2k")
function formatStars(count: number): string {
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return count.toString();
}

export default function BenchmarksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [starCounts, setStarCounts] = useState<Record<string, number>>({});
  const [starsLoading, setStarsLoading] = useState(true);

  // Fetch GitHub stars for all benchmarks
  useEffect(() => {
    const fetchAllStars = async () => {
      const stars: Record<string, number> = {};
      const cacheExpiry = 1000 * 60 * 60; // 1 hour cache

      await Promise.all(
        benchmarks.map(async (benchmark) => {
          if (!benchmark.githubUrl) return;

          const parsed = parseGitHubUrl(benchmark.githubUrl);
          if (!parsed) return;

          const { owner, repo } = parsed;
          const cacheKey = `github-stars-${owner}-${repo}`;

          // Check localStorage cache first
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const { stars: cachedStars, timestamp } = JSON.parse(cached);
              if (Date.now() - timestamp < cacheExpiry) {
                stars[benchmark.id] = cachedStars;
                return;
              }
            } catch {
              // Invalid cache, continue to fetch
            }
          }

          // Fetch from GitHub API
          try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
            if (res.ok) {
              const data = await res.json();
              const starCount = data.stargazers_count;
              stars[benchmark.id] = starCount;
              // Cache the result
              localStorage.setItem(
                cacheKey,
                JSON.stringify({ stars: starCount, timestamp: Date.now() })
              );
            }
          } catch {
            // Silently fail for individual repos
          }
        })
      );

      setStarCounts(stars);
      setStarsLoading(false);
    };

    fetchAllStars();
  }, []);

  const tasksByBenchmark = tasks.reduce((acc, task) => {
    if (!acc[task.benchmarkId]) {
      acc[task.benchmarkId] = [];
    }
    acc[task.benchmarkId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Filter and sort benchmarks (by star count descending, then by name)
  const filteredBenchmarks = useMemo(() => {
    let filtered = benchmarks;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const queryWords = query.split(/\s+/);

      filtered = benchmarks.filter((benchmark) => {
        const benchmarkTasks = tasksByBenchmark[benchmark.id] || [];

        // Searchable fields
        const searchableText = [
          benchmark.name,
          benchmark.shortName,
          benchmark.description,
          ...(Array.isArray(benchmark.category) ? benchmark.category : [benchmark.category]),
          ...benchmark.organs,
          ...benchmarkTasks.map((t) => t.name),
          ...benchmarkTasks.map((t) => t.category as string),
          ...benchmarkTasks.map((t) => t.organ),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        // Match if all query words are found in searchable text
        return queryWords.every((word) => searchableText.includes(word));
      });
    }

    // Sort by star count (descending), benchmarks without stars go last
    return [...filtered].sort((a, b) => {
      const starsA = starCounts[a.id] ?? -1;
      const starsB = starCounts[b.id] ?? -1;
      if (starsA !== starsB) return starsB - starsA;
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, tasksByBenchmark, starCounts]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Benchmark Sources</h1>
        <p className="mt-2 text-muted-foreground">
          Data is aggregated from {benchmarks.length} benchmark sources covering
          multiple evaluation categories
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search benchmarks by name, organ, task, category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-muted-foreground">
            Showing {filteredBenchmarks.length} of {benchmarks.length} benchmarks
          </p>
        )}
      </div>

      <div className="grid gap-6">
        {filteredBenchmarks.map((benchmark) => (
            <Card key={benchmark.id} className="relative">
              {benchmark.githubUrl && starCounts[benchmark.id] !== undefined && (
                <a
                  href={benchmark.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-4 top-4 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  title={`${starCounts[benchmark.id]} GitHub stars`}
                >
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-medium">{formatStars(starCounts[benchmark.id])}</span>
                </a>
              )}
              {benchmark.githubUrl && starCounts[benchmark.id] === undefined && starsLoading && (
                <div className="absolute right-4 top-4 inline-flex items-center gap-1 text-muted-foreground">
                  <Star className="h-4 w-4" />
                  <span className="text-xs">...</span>
                </div>
              )}
              <CardHeader>
                <div className="pr-16">
                  <CardTitle className="flex items-center gap-2">
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
                  <CardDescription className="mt-2">
                    {benchmark.description}
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap mt-4">
                  <Link href={`/benchmarks/${benchmark.id}`}>
                    <Button>
                      <Trophy className="mr-2 h-4 w-4" />
                      View Rankings
                    </Button>
                  </Link>
                  {benchmark.paperUrl && (
                    <a
                      href={benchmark.paperUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline">
                        <FileText className="mr-2 h-4 w-4" />
                        Paper
                      </Button>
                    </a>
                  )}
                  {benchmark.resultsUrl && (
                    <a
                      href={benchmark.resultsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline">
                        <Table className="mr-2 h-4 w-4" />
                        Source
                      </Button>
                    </a>
                  )}
                  {benchmark.githubUrl && (
                    <a
                      href={benchmark.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Github
                      </Button>
                    </a>
                  )}
                  {benchmark.datasetUrl && (
                    <a
                      href={benchmark.datasetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline">
                        <Database className="mr-2 h-4 w-4" />
                        Dataset
                      </Button>
                    </a>
                  )}
                </div>
              </CardHeader>
            </Card>
        ))}
      </div>
    </div>
  );
}
