CREATE TYPE "public"."catalog_page_kind" AS ENUM('portada', 'separador', 'producto', 'telas', 'texto');--> statement-breakpoint
CREATE TABLE "catalog_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"catalog_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" "catalog_page_kind" NOT NULL,
	"product_id" integer,
	"title" text,
	"subtitle" text,
	"body" text,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalogs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "catalog_pages" ADD CONSTRAINT "catalog_pages_catalog_id_catalogs_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_pages" ADD CONSTRAINT "catalog_pages_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_pages_catalog_idx" ON "catalog_pages" USING btree ("catalog_id","position");