# Repository publishing rules

Commit application source, Prisma schema and migrations, dependency lockfiles,
tests with synthetic data, documentation, and placeholder environment templates.
The root SQL files describe schema only; database exports containing records do
not belong in this repository.

Never commit real `.env` files, passwords, access tokens, private keys,
database dumps or backups, uploaded employee files, logs, deployment archives,
`node_modules`, `.next`, or TypeScript build caches. `.gitignore` protects these
paths, but it does not remove files already tracked in Git or in old commits.
Review `git diff --cached` and `git ls-files` before pushing. Do not bypass these
rules with `git add -f`.

The GitLab import uses the current source files without importing the previous
GitHub repository history. Historical deployment ZIPs contained a `.env` file
with a database connection string. Removing a ZIP in a later commit does not
remove its earlier contents. Keep the original repository local for reference;
do not push its old branches or tags to GitLab.

Treat credentials previously committed to the old repository as exposed and
rotate any still in use, including the database password, sync secrets, and
shared initial user passwords. Rotation must happen in the relevant service and
server configuration; changing source files alone cannot revoke credentials.

## Server configuration after import

Create a private `.env.local` using `.env.production.example`. Configure
`ERP_PASSWORD` and `ERP_SYNC_DEFAULT_PASSWORD` before enabling ERP sync. Set
`ERP_SYNC_SECRET` and `FIREBIRD_SYNC_SECRET` for the corresponding scheduled
scripts. The scripts stop when their secret is missing. ERP sync returns 503
when its required password configuration is missing; it has no built-in initial
password. Existing users' passwords are not changed by this source update.

Store CI/CD secrets in GitLab variables with appropriate protection and masking,
never in committed YAML. Keep the repository Private, restrict membership, and
protect `main` according to your team's access policy.

The publishing review checks repository contents and common credential
patterns. It is not a complete application or dependency security audit.
