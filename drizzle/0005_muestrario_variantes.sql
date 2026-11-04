ALTER TABLE "product_variants" ADD COLUMN "fabric" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "variant_group" text;--> statement-breakpoint
CREATE INDEX "products_variant_group_idx" ON "products" USING btree ("variant_group");