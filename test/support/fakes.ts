import type { Adapters, OutgoingEmail } from "../../src/worker/adapters";

/**
 * Recording fakes for every outside system. Tests inspect `.calls` to see what
 * the app tried to send, without anything leaving the machine.
 */
export function fakeAdapters(options: { roundTripKm?: number } = {}) {
  const sentEmails: OutgoingEmail[] = [];
  const distanceLookups: { from: string; to: string }[] = [];

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

  return Object.assign(adapters, { calls: { sentEmails, distanceLookups } });
}
