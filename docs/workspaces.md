# Newsletter workspaces

The admin sidebar now has a workspace selector and a **Manage workspaces** page. The existing newsletter becomes **The Gist Decatur**. Creating another workspace starts an empty newsletter with separate subscribers, sources/articles, templates, Community Partners, sponsor bookings, events, polls, referrals, games, settings, sends, and analytics.

Admin URLs include the workspace (`/w/huntsville/admin`) and every client request keeps that prefix. Switching performs a full navigation, so client state does not carry into another newsletter. Compose drafts and game progress are also namespaced. Decatur's existing URLs and browser drafts still work.

The same admin account manages all workspaces. This release separates newsletter data; it does not introduce separate staff permissions or separate Stripe merchant accounts. Stripe infrastructure and file storage are shared, while records and payment metadata are scoped.

## Public websites and email

A new workspace gets a public signup page at `/w/<slug>`, along with its own issues, partner listings, games, and public API routes. Decatur keeps its existing homepage. Configure each new newsletter's email provider and sender in that workspace's Settings. Empty workspaces do not inherit Decatur's environment-based email credentials.

Set `NEXT_PUBLIC_APP_URL` to the deployment's canonical origin (for example `https://thegistdecatur.com`). Generated unsubscribe, tracking, referral, sponsor portal, and payment-return links include the workspace prefix. Old Decatur links remain valid. Custom-domain provisioning and a per-town website design editor are follow-up work. The optional Workspace.domain database field is reserved for a hostname already configured on the hosting provider; it is not exposed as a self-service domain setup UI.

The sponsor analytics cron iterates over all workspaces. An external daily-digest scheduler can target `/w/<slug>/api/admin/daily-digest` with the existing cron authentication. Never call workspace data code from a background job without `withWorkspace(...)`.

## Existing production database rollout

This repository previously used `prisma db push` and had no migration history. Do not run `db push` for this change: the workspace migration creates Decatur and backfills ownership while preserving existing row IDs and relationships.

1. Take a database snapshot and rehearse against a copy of production. Check the live schema against `20260921000000_baseline/migration.sql`. If it differs, reconcile the drift before baselining.
2. For an existing database matching that baseline, mark the baseline as already applied:

   ```sh
   npx prisma migrate resolve --applied 20260921000000_baseline
   ```

3. Stop writes from the previous app version during the migration and release cutover. In particular, old code must not keep importing subscribers, creating sponsors, or writing game schedules after the old global unique constraints have been replaced.
4. Apply the data-preserving migration:

   ```sh
   npm run db:migrate
   ```

5. Deploy the new application build, then check Decatur subscriber counts, source/template lists, sponsor records, compose/send history, and old public links against the pre-migration snapshot. Verify a newly created workspace starts empty.

The migration runs in a PostgreSQL transaction. Every existing newsletter record receives `workspaceId = 'decatur'`; it does not copy, delete, or send any newsletter data. Admin users remain shared. Email addresses, source URLs, article URLs, word dates, booking dates, and Match device/date uniqueness now apply within a workspace. Composite foreign keys prevent attaching another workspace's sponsor, send, poll, or other related record.

Do not roll back to old application code against the migrated database. Rollback requires restoring the pre-migration snapshot and old app together, with an explicit plan for writes made since the snapshot.

For a brand-new empty database, run `npm run db:migrate` normally (do not mark the baseline applied), then configure the admin via the existing setup flow. `db:seed` contains example sources and a default admin password; do not run it as production onboarding.

## Verification

```sh
npm ci
npm run typecheck
npm run test:workspaces
npm run build
```

The workspace tests use an embedded, disposable PostgreSQL database and a local socket on port 55439. They apply the original schema, insert legacy data, apply the migration, and exercise actual Prisma isolation and foreign-key constraints. They also cover parallel job contexts and mock email delivery to check sender credentials and links without sending mail.

For an interactive local preview, use separate terminals:

```sh
npm run dev:workspace-db
```

```sh
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55440/postgres?connection_limit=1&pgbouncer=true' \
NEXT_PUBLIC_APP_URL='http://localhost:3100' \
WATCHPACK_POLLING=true npm run dev -- -p 3100
```

The disposable preview account is `admin@example.test` / `workspace-preview`. The preview database contains one sample Decatur subscriber and an empty Huntsville preview workspace, and never reads production credentials. Stop the database process to discard its contents.

```sh
npm run test:workspaces:http
```

The HTTP check runs only against that localhost fixture. It tests authentication, creation/validation, same-email subscriptions in two towns, settings isolation, branded templates, CSV export, concurrent requests, spoofed scope headers, unknown workspaces, and public links. It creates local test workspaces.

## Development boundaries

Use `prisma` from `lib/db.ts` for newsletter data. It resolves the workspace from middleware-controlled request headers or an explicit async job context. It scopes reads, aggregates, deletes, updates, upserts, and bulk creates. New newsletter models must include workspace ownership; unsupported models and nested relation writes fail closed. Use explicit scoped writes instead of nested relation mutation.

`basePrisma` is reserved for authenticated workspace management, scope resolution, verified Stripe webhooks, and system job enumeration. Keep its imports narrow. Existing non-relational subscriber/recipient IDs are validated in batches before writes. If adding a new such reference, register it in `lib/workspace-references.ts` or create a composite foreign key.
