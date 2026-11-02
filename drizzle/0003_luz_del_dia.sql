CREATE TABLE "product_light_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"hour" integer NOT NULL,
	"url" text NOT NULL,
	"thumb_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_light_images" ADD CONSTRAINT "product_light_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_light_images_product_hour_idx" ON "product_light_images" USING btree ("product_id","hour");