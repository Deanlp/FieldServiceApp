declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    PHOTOS: R2Bucket;
    ASSETS: Fetcher;
  }
  interface GlobalProps {
    mainModule: typeof import("./index");
  }
}
