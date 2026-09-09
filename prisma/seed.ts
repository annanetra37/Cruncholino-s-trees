/**
 * T2.4 / T1.3 — species list and demo data.
 *
 * `pnpm db:seed` gives a fresh clone something to look at: ~30 trees across
 * Yerevan and Gyumri, a contributor and an admin. `SEED_TREES=50000 pnpm
 * db:seed` generates the load-test dataset for T10.7 instead.
 */
import { AgeBand, Condition, FruitQuality, GeocodeStatus, LocationSource, PrismaClient, Role, SpeciesCategory, TreeStatus } from '@prisma/client';

const prisma = new PrismaClient();

type SpeciesSeed = {
  slug: string;
  nameEn: string;
  nameHy: string;
  category: SpeciesCategory;
};

/**
 * The starting list. It is seed data, not a schema: `species` is a table
 * precisely so that adding "medlar" next spring is an INSERT, not a migration.
 */
const SPECIES: SpeciesSeed[] = [
  { slug: 'apple', nameEn: 'Apple', nameHy: 'Խնձոր', category: SpeciesCategory.FRUIT },
  { slug: 'pear', nameEn: 'Pear', nameHy: 'Տանձ', category: SpeciesCategory.FRUIT },
  { slug: 'apricot', nameEn: 'Apricot', nameHy: 'Ծիրան', category: SpeciesCategory.FRUIT },
  { slug: 'peach', nameEn: 'Peach', nameHy: 'Դեղձ', category: SpeciesCategory.FRUIT },
  { slug: 'plum', nameEn: 'Plum', nameHy: 'Սալոր', category: SpeciesCategory.FRUIT },
  { slug: 'cherry', nameEn: 'Cherry', nameHy: 'Կեռաս', category: SpeciesCategory.FRUIT },
  { slug: 'sour-cherry', nameEn: 'Sour cherry', nameHy: 'Բալ', category: SpeciesCategory.FRUIT },
  { slug: 'quince', nameEn: 'Quince', nameHy: 'Սերկևիլ', category: SpeciesCategory.FRUIT },
  { slug: 'fig', nameEn: 'Fig', nameHy: 'Թուզ', category: SpeciesCategory.FRUIT },
  { slug: 'pomegranate', nameEn: 'Pomegranate', nameHy: 'Նուռ', category: SpeciesCategory.FRUIT },
  { slug: 'persimmon', nameEn: 'Persimmon', nameHy: 'Խուրմա', category: SpeciesCategory.FRUIT },
  { slug: 'mulberry', nameEn: 'Mulberry', nameHy: 'Թութ', category: SpeciesCategory.FRUIT },
  { slug: 'cornelian-cherry', nameEn: 'Cornelian cherry', nameHy: 'Հոն', category: SpeciesCategory.FRUIT },
  { slug: 'walnut', nameEn: 'Walnut', nameHy: 'Ընկույզ', category: SpeciesCategory.NUT },
  { slug: 'almond', nameEn: 'Almond', nameHy: 'Նուշ', category: SpeciesCategory.NUT },
  { slug: 'hazelnut', nameEn: 'Hazelnut', nameHy: 'Պնդուկ', category: SpeciesCategory.NUT },
  { slug: 'grape', nameEn: 'Grape vine', nameHy: 'Խաղող', category: SpeciesCategory.BERRY },
  { slug: 'raspberry', nameEn: 'Raspberry', nameHy: 'Ազնվամորի', category: SpeciesCategory.BERRY },
  { slug: 'blackberry', nameEn: 'Blackberry', nameHy: 'Մոշ', category: SpeciesCategory.BERRY },
  { slug: 'currant', nameEn: 'Currant', nameHy: 'Հաղարջ', category: SpeciesCategory.BERRY },
  { slug: 'sea-buckthorn', nameEn: 'Sea buckthorn', nameHy: 'Չիչխան', category: SpeciesCategory.BERRY },
  { slug: 'rosehip', nameEn: 'Rosehip', nameHy: 'Մասուր', category: SpeciesCategory.BERRY },
  { slug: 'oak', nameEn: 'Oak', nameHy: 'Կաղնի', category: SpeciesCategory.ORNAMENTAL },
  { slug: 'plane', nameEn: 'Plane tree', nameHy: 'Սոսի', category: SpeciesCategory.ORNAMENTAL },
  { slug: 'poplar', nameEn: 'Poplar', nameHy: 'Բարդի', category: SpeciesCategory.ORNAMENTAL },
  { slug: 'willow', nameEn: 'Willow', nameHy: 'Ուռենի', category: SpeciesCategory.ORNAMENTAL },
  { slug: 'linden', nameEn: 'Linden', nameHy: 'Լորենի', category: SpeciesCategory.ORNAMENTAL },
  { slug: 'maple', nameEn: 'Maple', nameHy: 'Թխկի', category: SpeciesCategory.ORNAMENTAL },
  { slug: 'ash', nameEn: 'Ash', nameHy: 'Հացենի', category: SpeciesCategory.ORNAMENTAL },
  { slug: 'pine', nameEn: 'Pine', nameHy: 'Սոճի', category: SpeciesCategory.ORNAMENTAL },
];

const CITIES = [
  { city: 'Yerevan', region: 'Yerevan', lat: 40.1872, lng: 44.5152, spread: 0.045 },
  { city: 'Gyumri', region: 'Shirak', lat: 40.7894, lng: 43.8475, spread: 0.03 },
];

const AGE_BANDS = [AgeBand.YOUNG, AgeBand.MID, AgeBand.OLD, AgeBand.UNKNOWN];
const CONDITIONS = [Condition.GOOD, Condition.GOOD, Condition.FAIR, Condition.POOR, Condition.DEAD];
const FRUIT = [FruitQuality.GOOD, FruitQuality.FAIR, FruitQuality.POOR, FruitQuality.NONE, FruitQuality.UNKNOWN];

/** Deterministic PRNG so re-seeding produces the same map, not a new one. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const pick = <T>(random: () => number, list: readonly T[]): T =>
  list[Math.floor(random() * list.length)]!;

async function main() {
  const treeCount = Number.parseInt(process.env.SEED_TREES ?? '30', 10);

  for (const species of SPECIES) {
    await prisma.species.upsert({
      where: { slug: species.slug },
      update: { nameEn: species.nameEn, nameHy: species.nameHy, category: species.category },
      create: species,
    });
  }
  console.log(`seeded ${SPECIES.length} species`);

  const contributor = await prisma.user.upsert({
    where: { email: 'contributor@example.org' },
    update: {},
    create: {
      email: 'contributor@example.org',
      name: 'Demo Contributor',
      role: Role.CONTRIBUTOR,
      emailVerified: new Date(),
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.org' },
    update: { role: Role.ADMIN },
    create: {
      email: 'admin@example.org',
      name: 'Demo Admin',
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
  });

  const speciesRows = await prisma.species.findMany({ select: { id: true, slug: true } });
  const random = makeRandom(20260101);

  // Re-seeding should replace the demo set, not pile a second one on top of it.
  await prisma.tree.deleteMany({ where: { createdById: { in: [contributor.id, admin.id] } } });

  const rows = Array.from({ length: treeCount }, (_, index) => {
    const place = CITIES[index % CITIES.length]!;
    const species = pick(random, speciesRows);
    const condition = pick(random, CONDITIONS);

    return {
      speciesId: species.id,
      latitude: place.lat + (random() - 0.5) * place.spread,
      longitude: place.lng + (random() - 0.5) * place.spread,
      locationSource: LocationSource.IMPORT,
      accuracyM: Math.round(4 + random() * 12),
      ageBand: pick(random, AGE_BANDS),
      ageYearsEstimate: Math.round(3 + random() * 60),
      condition,
      // A healthy tree can bear bad fruit and a struggling one can bear well;
      // the two fields are deliberately independent (T2.1).
      fruitQuality: condition === Condition.DEAD ? FruitQuality.NONE : pick(random, FRUIT),
      notes: random() > 0.7 ? 'Seeded demo record.' : null,
      city: place.city,
      region: place.region,
      country: 'Armenia',
      countryCode: 'AM',
      addressLine: `${place.city} demo street ${index + 1}`,
      geocodeStatus: GeocodeStatus.OK,
      status: TreeStatus.PUBLISHED,
      createdById: index % 5 === 0 ? admin.id : contributor.id,
    };
  });

  // createMany in chunks: a single 50k-row INSERT overruns the parameter limit.
  const CHUNK = 1000;
  for (let index = 0; index < rows.length; index += CHUNK) {
    await prisma.tree.createMany({ data: rows.slice(index, index + CHUNK) });
    if (rows.length > CHUNK) console.log(`  ${Math.min(index + CHUNK, rows.length)}/${rows.length}`);
  }

  console.log(`seeded ${rows.length} trees across ${CITIES.length} cities`);
  console.log('demo accounts: admin@example.org (ADMIN), contributor@example.org (CONTRIBUTOR)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
