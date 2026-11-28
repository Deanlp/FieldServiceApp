declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    PHOTOS: R2Bucket;
    ASSETS: Fetcher;
    /** Secret used once to create the owner account (POST /api/setup). */
    SETUP_TOKEN?: string;
    /** Resend API key (secret) and the From address, e.g. "Happy Home <noreply@send.example.co.za>". */
    RESEND_API_KEY?: string;
    MAIL_FROM?: string;
    /** Local development: print emails (including sign-in codes) to the console instead of sending. */
    DEV_MAIL_TO_CONSOLE?: string;
  }
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
}
