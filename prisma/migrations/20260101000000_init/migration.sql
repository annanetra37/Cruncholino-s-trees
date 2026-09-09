-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "SpeciesCategory" AS ENUM ('FRUIT', 'NUT', 'BERRY', 'ORNAMENTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AgeBand" AS ENUM ('YOUNG', 'MID', 'OLD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('GOOD', 'FAIR', 'POOR', 'DEAD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FruitQuality" AS ENUM ('GOOD', 'FAIR', 'POOR', 'NONE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "GeocodeStatus" AS ENUM ('OK', 'FAILED', 'MANUAL', 'PENDING');

-- CreateEnum
CREATE TYPE "TreeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FLAGGED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('GPS', 'EXIF', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CONTRIBUTOR', 'REVIEWER', 'ADMIN');

-- CreateTable
CREATE TABLE "species" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_hy" TEXT,
    "category" "SpeciesCategory" NOT NULL DEFAULT 'OTHER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trees" (
    "id" UUID NOT NULL,
    "species_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "location_source" "LocationSource" NOT NULL DEFAULT 'MANUAL',
    "accuracy_m" DOUBLE PRECISION,
    "age_band" "AgeBand" NOT NULL DEFAULT 'UNKNOWN',
    "age_years_estimate" INTEGER,
    "condition" "Condition" NOT NULL DEFAULT 'UNKNOWN',
    "fruit_quality" "FruitQuality" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "address_line" TEXT,
    "city" TEXT,
    "district" TEXT,
    "region" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "postal_code" TEXT,
    "geocode_raw" JSONB,
    "geocode_status" "GeocodeStatus" NOT NULL DEFAULT 'PENDING',
    "status" "TreeStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "trees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_photos" (
    "id" UUID NOT NULL,
    "tree_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "taken_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tree_revisions" (
    "id" UUID NOT NULL,
    "tree_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tree_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocode_cache" (
    "key" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "address_line" TEXT,
    "city" TEXT,
    "district" TEXT,
    "region" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "postal_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CONTRIBUTOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "species_slug_key" ON "species"("slug");

-- CreateIndex
CREATE INDEX "species_is_active_category_idx" ON "species"("is_active", "category");

-- CreateIndex
CREATE INDEX "trees_species_id_idx" ON "trees"("species_id");

-- CreateIndex
CREATE INDEX "trees_condition_idx" ON "trees"("condition");

-- CreateIndex
CREATE INDEX "trees_age_band_idx" ON "trees"("age_band");

-- CreateIndex
CREATE INDEX "trees_fruit_quality_idx" ON "trees"("fruit_quality");

-- CreateIndex
CREATE INDEX "trees_city_idx" ON "trees"("city");

-- CreateIndex
CREATE INDEX "trees_region_idx" ON "trees"("region");

-- CreateIndex
CREATE INDEX "trees_status_idx" ON "trees"("status");

-- CreateIndex
CREATE INDEX "trees_created_at_idx" ON "trees"("created_at");

-- CreateIndex
CREATE INDEX "trees_created_by_id_idx" ON "trees"("created_by_id");

-- CreateIndex
CREATE INDEX "trees_geocode_status_idx" ON "trees"("geocode_status");

-- CreateIndex
CREATE INDEX "trees_status_deleted_at_species_id_condition_idx" ON "trees"("status", "deleted_at", "species_id", "condition");

-- CreateIndex
CREATE UNIQUE INDEX "tree_photos_storage_key_key" ON "tree_photos"("storage_key");

-- CreateIndex
CREATE INDEX "tree_photos_tree_id_sort_order_idx" ON "tree_photos"("tree_id", "sort_order");

-- CreateIndex
CREATE INDEX "tree_revisions_tree_id_changed_at_idx" ON "tree_revisions"("tree_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "trees" ADD CONSTRAINT "trees_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trees" ADD CONSTRAINT "trees_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_photos" ADD CONSTRAINT "tree_photos_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_revisions" ADD CONSTRAINT "tree_revisions_tree_id_fkey" FOREIGN KEY ("tree_id") REFERENCES "trees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tree_revisions" ADD CONSTRAINT "tree_revisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- PostGIS: derived spatial column (T2.2)
--
-- `geom` is GENERATED ALWAYS from longitude/latitude, so it is physically
-- impossible for the two representations to disagree, and the application only
-- ever writes plain coordinates. Prisma declares the column as
-- Unsupported("geography(Point, 4326)") purely so it does not report drift.
-- ---------------------------------------------------------------------------
ALTER TABLE "trees"
    ADD COLUMN "geom" geography(Point, 4326)
    GENERATED ALWAYS AS (
        ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
    ) STORED;

-- CreateIndex
CREATE INDEX "trees_geom_idx" ON "trees" USING GIST ("geom");

-- Coordinates must be real coordinates. A swapped lat/lng pair is the single
-- most common data-entry bug in a mapping app; refuse it at the storage layer.
ALTER TABLE "trees"
    ADD CONSTRAINT "trees_latitude_range" CHECK ("latitude" >= -90 AND "latitude" <= 90),
    ADD CONSTRAINT "trees_longitude_range" CHECK ("longitude" >= -180 AND "longitude" <= 180);

-- Partial index for the dashboard's hot path: live, published trees only.
CREATE INDEX "trees_live_created_at_idx"
    ON "trees" ("created_at" DESC)
    WHERE "deleted_at" IS NULL AND "status" = 'PUBLISHED';

CREATE INDEX "trees_live_geom_idx"
    ON "trees" USING GIST ("geom")
    WHERE "deleted_at" IS NULL AND "status" = 'PUBLISHED';

-- Free-text search (`q`) runs ILIKE '%…%' over notes and address, which no
-- B-tree can serve. Trigram GIN indexes can.
CREATE INDEX "trees_notes_trgm_idx" ON "trees" USING GIN ("notes" gin_trgm_ops);
CREATE INDEX "trees_address_line_trgm_idx" ON "trees" USING GIN ("address_line" gin_trgm_ops);

-- Idempotency key for the offline sync queue (T4.5). NULL for everything that
-- was created online, and unique when present, so a retried sync collides
-- rather than creating a second tree.
ALTER TABLE "trees" ADD COLUMN "client_ref" TEXT;
CREATE UNIQUE INDEX "trees_client_ref_key" ON "trees"("client_ref");
