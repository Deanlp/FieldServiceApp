/**
 * Outside systems the app talks to. Each sits behind an interface so tests can
 * swap in a recording fake and assert on what the app *tried* to do.
 * Operations are added by the tickets that need them.
 */

export interface OutgoingEmail {
  to: string[];
  subject: string;
  text: string;
}

/** Sends sign-in codes and Partner Updates (R4 chooses the provider). */
export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}

/** Zoho Books: the ledger of record (ADR 0002). R1 shapes the operations. */
export interface Ledger {}

/** Bigin: receives Contacts one way (ADR 0005). R2 shapes the operations. */
export interface Crm {}

/** Round-trip driving distance from base to a service address (R3 chooses the provider). */
export interface Distance {
  roundTripKm(from: string, to: string): Promise<number>;
}

export interface Adapters {
  mailer: Mailer;
  ledger: Ledger;
  crm: Crm;
  distance: Distance;
}
