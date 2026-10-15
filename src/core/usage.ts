import type { UsagePeriod, UsageRecord, UsageSummary } from "../types.js";

// All cutoff calculations use local time — "today" means the user's local calendar day.
function cutoffForPeriod(now: Date, period: UsagePeriod): Date | null {
  if (period === "all") {
    return null;
  }

  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);

  if (period === "today") {
    return cutoff;
  }

  if (period === "week") {
    const weekday = cutoff.getDay();
    const delta = weekday === 0 ? 6 : weekday - 1;
    cutoff.setDate(cutoff.getDate() - delta);
    return cutoff;
  }

  cutoff.setDate(1);
  return cutoff;
}

/**
 * Single pass over `records` that produces every period at once. `list` needs
 * today/week/month/all, and the naive version re-scanned the whole history four
 * times per profile.
 */
export function summarizeUsagePeriods({
  now,
  records,
}: {
  now: string;
  records: UsageRecord[];
}): Record<UsagePeriod, UsageSummary> {
  const nowDate = new Date(now);
  const cutoffs: Array<[UsagePeriod, Date | null]> = [
    ["all", null],
    ["today", cutoffForPeriod(nowDate, "today")],
    ["week", cutoffForPeriod(nowDate, "week")],
    ["month", cutoffForPeriod(nowDate, "month")],
  ];

  const totals: Record<UsagePeriod, UsageSummary> = {
    today: { cost: 0, inputTokens: 0, outputTokens: 0 },
    week: { cost: 0, inputTokens: 0, outputTokens: 0 },
    month: { cost: 0, inputTokens: 0, outputTokens: 0 },
    all: { cost: 0, inputTokens: 0, outputTokens: 0 },
  };

  for (const record of records) {
    const ts = new Date(record.ts);
    for (const [period, cutoff] of cutoffs) {
      if (cutoff && ts < cutoff) continue;
      const total = totals[period];
      total.cost += record.cost;
      total.inputTokens += record.inputTokens;
      total.outputTokens += record.outputTokens;
    }
  }

  return totals;
}

export function summarizeUsage({
  now,
  period,
  records,
}: {
  now: string;
  period: UsagePeriod;
  records: UsageRecord[];
}): UsageSummary {
  const nowDate = new Date(now);
  const cutoff = cutoffForPeriod(nowDate, period);

  return records.reduce<UsageSummary>(
    (summary, record) => {
      const ts = new Date(record.ts);
      if (cutoff && ts < cutoff) {
        return summary;
      }

      return {
        cost: summary.cost + record.cost,
        inputTokens: summary.inputTokens + record.inputTokens,
        outputTokens: summary.outputTokens + record.outputTokens,
      };
    },
    { cost: 0, inputTokens: 0, outputTokens: 0 },
  );
}
