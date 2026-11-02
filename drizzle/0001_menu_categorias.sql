-- Nuevo menú: Productos › Seccionales, Modulares, Cuero, Poltronas, DecoHogar.
-- Renombra las categorías de ejemplo anteriores (si existen) y crea las nuevas.
UPDATE "categories" SET "name" = 'Seccionales', "slug" = 'seccionales', "position" = 1, "description" = 'Seccionales y sofás con chaise para livings amplios.'
  WHERE "slug" = 'sofas-seccionales' AND NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'seccionales');
--> statement-breakpoint
UPDATE "categories" SET "name" = 'Modulares', "slug" = 'modulares', "position" = 2
  WHERE "slug" = 'sofas-modulares' AND NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'modulares');
--> statement-breakpoint
UPDATE "categories" SET "name" = 'Cuero', "slug" = 'cuero', "position" = 3
  WHERE "slug" = 'sofas-de-cuero' AND NOT EXISTS (SELECT 1 FROM "categories" WHERE "slug" = 'cuero');
--> statement-breakpoint
-- Las categorías de ejemplo sin productos (Comedor, Dormitorio, Terraza) se eliminan
DELETE FROM "categories" c WHERE c."slug" IN ('comedor', 'dormitorio', 'terraza')
  AND NOT EXISTS (SELECT 1 FROM "products" p WHERE p."category_id" = c."id");
--> statement-breakpoint
INSERT INTO "categories" ("name", "slug", "description", "position") VALUES
  ('Poltronas', 'poltronas', 'Poltronas y sillones individuales.', 4),
  ('DecoHogar', 'decohogar', 'Decoración y complementos para el hogar.', 5)
ON CONFLICT ("slug") DO NOTHING;
