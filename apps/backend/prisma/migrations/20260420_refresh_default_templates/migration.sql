-- Refresh seeded default page templates with improved structure (distinct
-- formats per template, inline italic hints, per-template emoji icons).
--
-- Strategy: delete the pristine seeded rows (createdAt = updatedAt means an
-- admin has never touched them) for the known seed titles. The next backend
-- boot triggers TemplatesService.seedDefaults() which recreates them with the
-- new contentJson/icon. Admin-edited rows are preserved.
--
-- Safety:
--   * `isDefault = true AND spaceId IS NULL` — only globals
--   * `createdAt = updatedAt` — only never-modified rows (Prisma sets both
--     equal at create-time; any update makes them diverge)
--   * `title IN (...)` — only the six titles we originally seeded; an admin
--     who created their own global default with one of these titles by hand
--     would still be at risk, but that's an extreme edge case and they can
--     restore from version history if needed.
DELETE FROM "PageTemplate"
WHERE "isDefault" = true
  AND "spaceId" IS NULL
  AND "createdAt" = "updatedAt"
  AND "title" IN (
    'Blank Page',
    'Meeting Notes',
    'Technical Spec',
    'Onboarding Guide',
    'Decision Record',
    'Retrospective'
  );
