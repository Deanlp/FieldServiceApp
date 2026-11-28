import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    test: {
      projects: [
        {
          // Seam 1: the server interface, run inside the Workers runtime against a real local D1.
          plugins: [
            cloudflareTest({
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
            }),
          ],
          test: {
            name: "server",
            include: ["test/server/**/*.test.ts"],
            setupFiles: ["./test/support/apply-migrations.ts"],
          },
        },
        {
          // Seam 2: pure domain modules (e.g. the Warranty Claim builder), run in plain Node.
          test: {
            name: "modules",
            include: ["test/modules/**/*.test.ts"],
            environment: "node",
            passWithNoTests: true,
          },
        },
      ],
    },
  };
});
