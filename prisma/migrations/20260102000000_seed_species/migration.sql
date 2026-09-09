-- The species list is reference data, not demo data: the capture form cannot be
-- used without it, so it belongs in a migration rather than in a seed script
-- somebody has to remember to run against production.
--
-- ON CONFLICT DO NOTHING makes it safe to re-run and, more importantly, safe on
-- a database where an admin has already renamed something — this inserts what
-- is missing and never overwrites a human's edit.

INSERT INTO "species" ("id", "slug", "name_en", "name_hy", "category", "is_active", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'apple', 'Apple', 'Խնձոր', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'pear', 'Pear', 'Տանձ', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'apricot', 'Apricot', 'Ծիրան', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'peach', 'Peach', 'Դեղձ', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'plum', 'Plum', 'Սալոր', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'cherry', 'Cherry', 'Կեռաս', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'sour-cherry', 'Sour cherry', 'Բալ', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'quince', 'Quince', 'Սերկևիլ', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'fig', 'Fig', 'Թուզ', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'pomegranate', 'Pomegranate', 'Նուռ', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'persimmon', 'Persimmon', 'Խուրմա', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'mulberry', 'Mulberry', 'Թութ', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'cornelian-cherry', 'Cornelian cherry', 'Հոն', 'FRUIT', true, now(), now()),
  (gen_random_uuid(), 'walnut', 'Walnut', 'Ընկույզ', 'NUT', true, now(), now()),
  (gen_random_uuid(), 'almond', 'Almond', 'Նուշ', 'NUT', true, now(), now()),
  (gen_random_uuid(), 'hazelnut', 'Hazelnut', 'Պնդուկ', 'NUT', true, now(), now()),
  (gen_random_uuid(), 'grape', 'Grape vine', 'Խաղող', 'BERRY', true, now(), now()),
  (gen_random_uuid(), 'raspberry', 'Raspberry', 'Ազնվամորի', 'BERRY', true, now(), now()),
  (gen_random_uuid(), 'blackberry', 'Blackberry', 'Մոշ', 'BERRY', true, now(), now()),
  (gen_random_uuid(), 'currant', 'Currant', 'Հաղարջ', 'BERRY', true, now(), now()),
  (gen_random_uuid(), 'sea-buckthorn', 'Sea buckthorn', 'Չիչխան', 'BERRY', true, now(), now()),
  (gen_random_uuid(), 'rosehip', 'Rosehip', 'Մասուր', 'BERRY', true, now(), now()),
  (gen_random_uuid(), 'oak', 'Oak', 'Կաղնի', 'ORNAMENTAL', true, now(), now()),
  (gen_random_uuid(), 'plane', 'Plane tree', 'Սոսի', 'ORNAMENTAL', true, now(), now()),
  (gen_random_uuid(), 'poplar', 'Poplar', 'Բարդի', 'ORNAMENTAL', true, now(), now()),
  (gen_random_uuid(), 'willow', 'Willow', 'Ուռենի', 'ORNAMENTAL', true, now(), now()),
  (gen_random_uuid(), 'linden', 'Linden', 'Լորենի', 'ORNAMENTAL', true, now(), now()),
  (gen_random_uuid(), 'maple', 'Maple', 'Թխկի', 'ORNAMENTAL', true, now(), now()),
  (gen_random_uuid(), 'ash', 'Ash', 'Հացենի', 'ORNAMENTAL', true, now(), now()),
  (gen_random_uuid(), 'pine', 'Pine', 'Սոճի', 'ORNAMENTAL', true, now(), now())
ON CONFLICT ("slug") DO NOTHING;
