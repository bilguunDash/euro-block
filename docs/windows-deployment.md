# Windows deployment

This ZIP contains a completed Next.js standalone production build, static
assets, the Windows Prisma migration engine/CLI, migrations and server scripts.
It includes approval cancellation/deletion, owner return notifications and the
tested correction/reapproval flow.

For an existing installation at `C:\euroblock`, run PowerShell as Administrator:

1. Stop the existing service before replacing application files:

   ```powershell
   Set-Location C:\euroblock
   .\deploy-server.ps1 -AppDir C:\euroblock -Stop
   ```

2. Extract the new ZIP into `C:\euroblock`. Keep the server's existing
   `.env.local`, `public\uploads`, any external `UPLOADS_DIR`, and database.
   Real environment files and uploaded records are excluded from this ZIP.

3. Apply pending migrations and configure/start the service:

   ```powershell
   Set-Location C:\euroblock
   .\deploy-server.ps1 -AppDir C:\euroblock -Port 3010
   Invoke-RestMethod http://localhost:3010/api/health/db
   ```

The script stops before service installation if a migration fails. No `npm
install` or build is needed on the server. Use the same Node.js version as the
build machine (Node 24). Retain the existing IIS reverse-proxy configuration.
For a different installation folder, replace `C:\euroblock` in every command.

For a first installation, create `.env.local` from `.env.production.example`
and configure the server database, `NEXTAUTH_URL` and `NEXTAUTH_SECRET` before
running the setup script. This package targets an existing migrated database;
the historical migration chain does not initialize a completely empty database
(the device-permission migration references `users` before it is created).

After deployment, verify sign-in and an approval return notification with a
test record. Cancellation preserves the content for the original owner to edit
and resubmit. Deletion removes database records; physical upload/blob cleanup
is not implemented. Audit metadata is retained.
