import type { Adapters } from "./index";

const notConfigured = (name: string) => () => {
  throw new Error(`${name} adapter is not configured yet`);
};

/** Production adapters until each real integration ticket lands. */
export function unconfiguredAdapters(): Adapters {
  return {
    mailer: { send: notConfigured("Mailer") },
    ledger: {},
    crm: {},
    distance: { roundTripKm: notConfigured("Distance") },
  };
}
