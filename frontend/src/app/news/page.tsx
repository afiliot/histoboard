/**
 * News Page (/news)
 *
 * Chronological log of Histoboard updates: new models, benchmark refreshes,
 * feature additions, and data corrections.
 */

import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface NewsItem {
  date: string;
  entries: {
    text: string;
    links?: { label: string; href: string; suffix?: string }[];
  }[];
}

const NEWS: NewsItem[] = [
  {
    date: "2026-05-05",
    entries: [
      {
        text: "Added the BC Survival Benchmark (Gustafsson et al., arXiv:2604.24679), evaluating 13 pathology foundation models on breast cancer survival prediction (RFS & PFS) across 3 independent Swedish cohorts (N=5,434 patients). Results were provided by the first author. C-index values with 95% bootstrap confidence intervals are shown. Check the benchmark on",
        links: [
          { label: "BC Survival", href: "/benchmarks/bc_survival_gustafsson" },
        ],
      },
    ],
  },
  {
    date: "2026-04-15",
    entries: [
      {
        text: "Added PFM-DenseBench, a dense prediction benchmark evaluating 17 pathology foundation models across 18 segmentation datasets (nuclear, tissue, and gland segmentation). Also added PathOrchestra (AI4Pathology) to the Models catalogue. Check the benchmark on",
        links: [
          { label: "PFM-DenseBench", href: "/benchmarks/pfm_densebench", suffix: " and the model on" },
          { label: "the Models page", href: "/models/ai4pathology_pathorchestra" },
        ],
      },
    ],
  },
  {
    date: "2026-04-13",
    entries: [
      {
        text: "Updated Plismbench and THUNDER benchmark results with GenBio-PathFM. Check latest results for",
        links: [
          { label: "Plismbench", href: "/benchmarks/plism", suffix: " and" },
          { label: "THUNDER", href: "/benchmarks/thunder" },
        ],
      },
    ],
  },
  {
    date: "2026-04-05",
    entries: [
      {
        text: "Updated PathoROB benchmark results with two new models: H-Optimus-1 and GenBio-PathFM. Check latest results for",
        links: [
          { label: "PathoROB", href: "/benchmarks/pathorob" },
        ],
      },
      {
        text: "Added GenBio-PathFM to the Models catalogue (ViT-g/16, 1.1B params, trained with DinoV3 + JEPA on 177k+ WSIs). Check it on",
        links: [
          { label: "the Models page", href: "/models/genbio_ai_genbio_pathfm" },
        ],
      },
    ],
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function isExternal(href: string): boolean {
  return href.startsWith("http");
}

export default function NewsPage() {
  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">News</h1>
      <p className="text-muted-foreground mb-10">
        Latest updates to Histoboard — new models, benchmark refreshes, and feature additions.
      </p>

      <ol className="relative border-l border-border ml-3">
        {NEWS.map((item) => (
          <li key={item.date} className="mb-10 ml-6">
            {/* Timeline dot */}
            <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-background bg-hematoxylin-500" />

            <time className="mb-2 block text-sm font-semibold text-hematoxylin-600">
              {formatDate(item.date)}
            </time>

            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <ul className="list-disc list-inside space-y-2">
                {item.entries.map((entry, i) => (
                  <li key={i} className="text-sm text-foreground leading-relaxed">
                    {entry.text}
                    {entry.links && entry.links.length > 0 && (
                      <span className="ml-1 inline-flex flex-wrap gap-1">
                        {entry.links.map((link) =>
                          isExternal(link.href) ? (
                            <span key={link.href} className="inline-flex items-center gap-0.5">
                              <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-primary hover:underline"
                              >
                                {link.label}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              {link.suffix}
                            </span>
                          ) : (
                            <span key={link.href} className="inline-flex items-center gap-0.5">
                              <Link
                                href={link.href}
                                className="text-primary hover:underline"
                              >
                                {link.label}
                              </Link>
                              {link.suffix}
                            </span>
                          )
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
