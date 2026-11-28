import { consoleMailer, resendMailer } from "./adapters/mailer";
import { unconfiguredAdapters } from "./adapters/unconfigured";
import { createApp, type Deps } from "./app";
import type { Env } from "./env";

function depsFor(env: Env): Deps {
  const base = unconfiguredAdapters();
  const mailer =
    env.RESEND_API_KEY && env.MAIL_FROM
      ? resendMailer(env.RESEND_API_KEY, env.MAIL_FROM)
      : env.DEV_MAIL_TO_CONSOLE === "true"
        ? consoleMailer()
        : base.mailer;
  return { ...base, mailer, clock: { now: () => Date.now() } };
}

let app: ReturnType<typeof createApp> | undefined;

export default {
  fetch(request, env, ctx) {
    app ??= createApp(depsFor(env));
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
