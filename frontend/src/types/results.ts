/**
 * Specialized Result Types for Benchmark Tables
 *
 * Different benchmarks store results with varying levels of detail.
 * This module provides typed interfaces for these specialized result formats,
 * enabling type-safe access to benchmark-specific metrics.
 *
 * @module types/results
 */

import type { Result } from "./index";

/**
 * PFM-DenseBench result with all 8 segmentation metrics.
 * `value` / `ciLower` / `ciUpper` hold the primary Mean Dice metric
 * (inherited from Result). All other metrics are optional extras averaged
 * across the 5 adaptation methods (Frozen, DoRA, LoRA, CNN, Transformer).
 */
export interface PFMDenseBenchResult extends Result {
  /**
   * Average mDice rank across the 5 adaptation methods (rank 1 = best).
   * This is the primary metric shown on the official PFM-DenseBench leaderboard.
   */
  mDiceAvgRank?: number;
  /** Standard deviation of per-method mDice ranks (spread across methods). */
  mDiceRankStd?: number;
  /** Mean IoU */
  mIoU?: number;
  mIoULower?: number;
  mIoUUpper?: number;
  /** Per-pixel accuracy */
  pixelAccuracy?: number;
  pixelAccuracyLower?: number;
  pixelAccuracyUpper?: number;
  /** Mean per-class accuracy */
  meanAccuracy?: number;
  meanAccuracyLower?: number;
  meanAccuracyUpper?: number;
  /** Frequency-weighted IoU */
  frequencyWeightedIoU?: number;
  frequencyWeightedIoULower?: number;
  frequencyWeightedIoUUpper?: number;
  /** Mean per-class precision */
  meanPrecision?: number;
  meanPrecisionLower?: number;
  meanPrecisionUpper?: number;
  /** Mean per-class recall */
  meanRecall?: number;
  meanRecallLower?: number;
  meanRecallUpper?: number;
  /** Mean per-class F1 */
  meanF1?: number;
  meanF1Lower?: number;
  meanF1Upper?: number;
}

/**
 * Comprehensive result with multiple metric variants.
 * Used by Stanford PathBench which reports multiple metrics per task.
 */
export interface StanfordResult extends Result {
  /** AUROC score */
  auroc?: number;
  /** Lower confidence bound for AUROC */
  aurocLower?: number;
  /** Upper confidence bound for AUROC */
  aurocUpper?: number;
  /** Balanced accuracy */
  balancedAccuracy?: number;
  /** Lower confidence bound for balanced accuracy */
  balancedAccuracyLower?: number;
  /** Upper confidence bound for balanced accuracy */
  balancedAccuracyUpper?: number;
  /** Sensitivity (true positive rate) */
  sensitivity?: number;
  /** Lower confidence bound for sensitivity */
  sensitivityLower?: number;
  /** Upper confidence bound for sensitivity */
  sensitivityUpper?: number;
  /** Specificity (true negative rate) */
  specificity?: number;
  /** Lower confidence bound for specificity */
  specificityLower?: number;
  /** Upper confidence bound for specificity */
  specificityUpper?: number;
}

/**
 * CRoMa result for one (model, cohort) pair.
 *
 * `value` (inherited from Result) holds the median CRoMa margin at the
 * headline radius m=5 — a signed margin in (-1, 1), neutral at 0. The rest of
 * the columns published for the cohort come along as optional extras.
 *
 * Panel-level ranks and flags arrive on a separate virtual row whose taskId is
 * `croma_aggregate`: there, `value` is the mean rank and the rank/flag fields
 * below are populated. That row is filtered out of the per-cohort columns.
 */
export interface CromaResult extends Result {
  /** Lower-tail mean: mean of the lowest decile of the per-sample CRoMa. */
  ltm10?: number;
  /** Fraction of samples with CRoMa <= 0 (confounder-dominant). Lower is better. */
  f0?: number;
  /** Robustness Index: the pooled count-based index in [0, 1], neutral at 0.5. */
  ri?: number;
  /** Margin-aware Robustness Index: the distance-weighted counterpart of RI. */
  mari?: number;
  /** MaRI − RI. Read for its sign, not its size. */
  delta?: number;
  /** Support fraction: how many samples contribute to RI/MaRI at all. */
  support?: number;
  /** Balanced accuracy of a k-NN classifier predicting the biological label. */
  bioBacc?: number;
  /** Balanced accuracy of a k-NN classifier predicting the center. Diagnostic. */
  confBacc?: number;

  // --- `croma_aggregate` row only -----------------------------------------
  /** Mean rank across the three cohorts by median CRoMa. */
  cromaRank?: number;
  /** Mean rank across the three cohorts by tail severity (LTM10). */
  ltmRank?: number;
  /** On the Pareto frontier of the two rankings. */
  onFrontier?: boolean;
  /** Disclosed pretraining overlaps TCGA, one of the three cohorts. */
  tcgaExposed?: boolean;
}
