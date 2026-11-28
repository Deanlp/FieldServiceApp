import type { Mailer } from "./index";

/** Sends through Resend (docs/research/email-provider.md). */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(email) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text }),
      });
      if (!res.ok) throw new Error(`Resend rejected the email: ${res.status} ${await res.text()}`);
    },
  };
}

/** Local development only: prints the email to the Wrangler console instead of sending it. */
export function consoleMailer(): Mailer {
  return {
    async send(email) {
      console.log(`[dev mail] to=${email.to.join(",")} subject=${email.subject}\n${email.text}`);
    },
  };
}
