# Cloudinary setup on a second PC

Requires Node **20.9+** (verified locally on Node 22) and pnpm **10.18.3**. The installed sharp 0.35.5 requires Node 20.9+. Cloudinary 2.11.0 and sharp are locked by pnpm; no global SDK or unsigned upload preset is needed.

1. Pull/copy this source on the second PC, then run `pnpm install --frozen-lockfile` from the repository root.
2. Copy the working `apps/api/.env` privately from the first PC, or create it from `apps/api/.env.example` and configure the API's existing database/auth/Redis settings. Preserve stable JWT/encryption keys when using existing data. Cloudinary needs these API-only entries:

   ```dotenv
   CLOUDINARY_THUMBNAILS_ENABLED=true
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_THUMBNAILS_FOLDER=course-thumbnails
   ```

   Use the same Cloudinary product environment on both PCs to share the uploaded artwork. The local credentials configured during this task were moved from `apps/web/.env.local` to the ignored `apps/api/.env`; they are not embedded in application source, tests or documentation.
3. Ensure the API's configured Redis and database are reachable. Thumbnail uploads fail closed if Redis is unavailable. This feature requires no database migration.
4. Set the web's `API_BASE_URL` to the intended local API URL (normally `http://localhost:3001/api/v1`) in `apps/web/.env.local`. Keep Cloudinary secrets in the API env.
5. Run `pnpm --filter @vetralink/shared-types build`, then start the API with `pnpm --filter @vetralink/api dev` and the web with `pnpm --filter @vetralink/web dev`. Restart the API when its environment changes.
6. Sign in as ADMIN/SUPER_ADMIN, create/edit a course, select/drop one JPEG/PNG/WebP up to 3 MiB, wait for upload acknowledgement, then save the course information. A completed upload alone does not save the course.

For a separately requested deployment, set the same five configuration names on the **API host**, plus its existing database/auth/Redis settings. Set the web's `API_BASE_URL` to that backend. Native sharp packaging, host request limits and deployed authentication/public delivery still need target-host acceptance. No deployment was performed in this task.

See [the plan and evidence](plan.md) and [acceptance specification](spec.md).
