import { unconfiguredAdapters } from "./adapters/unconfigured";
import { createApp } from "./app";
import type { Env } from "./env";

const app = createApp(unconfiguredAdapters());

export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
