/**
 * Runs once on server startup.
 *
 * Migrations happen here rather than as a separate deploy step because
 * self-hosters run `docker compose up` and nothing else — there is no deploy
 * hook of ours to attach to. The `./drizzle` folder is pulled into the
 * standalone output via `outputFileTracingIncludes` in next.config.ts.
 *
 * The actual migration/provisioning logic lives in `./instrumentation-node`,
 * a separate file imported only under the nodejs runtime. Next.js compiles
 * `register()` for both the Node.js and Edge runtimes; inlining
 * better-sqlite3-touching code directly in this file made webpack try (and
 * fail) to bundle that native addon into the edge-compatible variant, even
 * though it would never run there. This split is Next's own documented fix:
 * https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
