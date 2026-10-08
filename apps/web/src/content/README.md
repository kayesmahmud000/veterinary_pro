# Public doctor content

`doctors.json` is the curated frontend directory source, validated by
`src/lib/doctor-directory.ts`. The user requested two fictional demo profiles
on 2026-10-08. They are always marked as demos in list/detail UI; they are not
backend vet accounts and do not offer booking, availability or ratings.

To publish actual approved details, replace demo entries (or add an entry),
use a unique lowercase slug `id`, supply `bn` and `en` for `name`, `biography`,
`qualifications` and `location`, and explicitly set `published` and `isDemo`.
Use factual `yearsExperience`, `languages` (`bn`/`en`) and `specialties`
(`general`, `dairy`, `poultry`, `goat_sheep`, `pets`). Optional `photo` points to
an existing local portrait `/assets/doctors/<filename>.jpg` (also png/jpeg/webp).
Omit it to display the neutral person icon. Use details and portraits approved
for public display; keep email, phone, account IDs and private clinical data out.

Unpublished entries never appear in public list/detail lookup. Empty data
renders an empty directory. Invalid data fails validation rather than exposing
extra fields. Do not copy protected backend DTOs into this source. There is no
admin content editor or automatic API synchronization in this change.

Blog articles live in `src/lib/public-content.ts`, with editorial attribution,
an ISO publication timestamp and full Bangla/English copy. Dates render in
Asia/Dhaka. Keep article slugs stable when updating published copy.
