import type { Adapters, OutgoingEmail } from "../../src/worker/adapters";
import type { Deps } from "../../src/worker/app";

/**
 * Recording fakes for every outside system. Tests inspect `.calls` to see what
 * the app tried to send, without anything leaving the machine.
 */
export function fakeAdapters(options: { roundTripKm?: number } = {}) {
  const sentEmails: OutgoingEmail[] = [];
  const distanceLookups: { from: string; to: string }[] = [];

  let now = Date.parse("2026-11-02T08:00:00Z");
  const clock = {
    now: () => now,
    advanceMinutes: (m: number) => void (now += m * 60_000),
    advanceDays: (d: number) => void (now += d * 86_400_000),
  };

  const adapters: Adapters = {
    mailer: {
      async send(email) {
        sentEmails.push(email);
      },
    },
    ledger: {},
    crm: {},
    distance: {
      async roundTripKm(from, to) {
        distanceLookups.push({ from, to });
        return options.roundTripKm ?? 20;
      },
    },
  };

  const deps: Deps = { ...adapters, clock };
  return Object.assign(deps, { clock, calls: { sentEmails, distanceLookups } });
}
