import { describe, expect, it } from "vitest";
import { claimPeriodContaining } from "../../src/domain/warranty-claim";

describe("claim period", () => {
  it.each([
    ["2026-11-05", "2026-10-06", "2026-11-05"],
    ["2026-11-06", "2026-11-06", "2026-12-05"],
    ["2026-12-20", "2026-12-06", "2027-01-05"],
    ["2027-01-03", "2026-12-06", "2027-01-05"],
  ])("%s falls in %s to %s", (date, start, end) => {
    expect(claimPeriodContaining(date)).toEqual({ start, end });
  });
});
