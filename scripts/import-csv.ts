/**
 * T8.4 — bulk import of existing survey data.
 *
 * Always validates the whole file before writing anything. A half-imported
 * survey is worse than a rejected one: you cannot tell which rows landed
 * without diffing against the source, and re-running duplicates the good half.
 *
 *   pnpm import:csv survey.csv                 # dry run, reports every problem
 *   pnpm import:csv survey.csv --commit        # writes, only if the file is clean
 *   pnpm import:csv survey.csv --commit --force  # writes the valid rows anyway
 *
 * Expected columns (header row required):
 *   species_slug, latitude, longitude, condition, fruit_quality, reachability,
 *   age_band, age_years_estimate, notes, address_line, city, region,
 *   country_code
 */
import { readFileSync } from 'node:fs';
import {
  AgeBand,
  Condition,
  FruitQuality,
  GeocodeStatus,
  LocationSource,
  PrismaClient,
  Reachability,
  TreeStatus,
} from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

/** A CSV parser that handles quoted fields, embedded commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
}

const optional = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const rowSchema = z.object({
  species_slug: z.string().trim().min(1, 'species_slug is required'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  condition: z.enum(Condition).default(Condition.UNKNOWN),
  fruit_quality: z.enum(FruitQuality).default(FruitQuality.UNKNOWN),
  reachability: z.enum(Reachability).default(Reachability.UNKNOWN),
  age_band: z.enum(AgeBand).default(AgeBand.UNKNOWN),
  age_years_estimate: z.coerce.number().int().min(0).max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  address_line: z.string().trim().max(300).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(120).optional(),
  country_code: z.string().trim().length(2).optional(),
});

type Problem = { line: number; message: string };

async function main() {
  const [path, ...flags] = process.argv.slice(2);
  if (!path) {
    console.error('Usage: pnpm import:csv <file.csv> [--commit] [--force]');
    process.exitCode = 1;
    return;
  }

  const commit = flags.includes('--commit');
  const force = flags.includes('--force');

  const rows = parseCsv(readFileSync(path, 'utf8'));
  const header = rows.shift();
  if (!header) {
    console.error('The file is empty.');
    process.exitCode = 1;
    return;
  }

  const columns = header.map((name) => name.trim().toLowerCase());
  const species = await prisma.species.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(species.map((entry) => [entry.slug, entry.id]));

  const problems: Problem[] = [];
  const valid: Array<z.infer<typeof rowSchema> & { speciesId: string }> = [];

  rows.forEach((cells, index) => {
    const line = index + 2; // 1-based, plus the header
    const record: Record<string, string | undefined> = {};
    columns.forEach((name, column) => {
      record[name] = optional(cells[column]);
    });

    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push({ line, message: `${issue.path.join('.') || 'row'}: ${issue.message}` });
      }
      return;
    }

    const speciesId = bySlug.get(parsed.data.species_slug);
    if (!speciesId) {
      problems.push({
        line,
        message: `species_slug: no species with slug "${parsed.data.species_slug}"`,
      });
      return;
    }

    valid.push({ ...parsed.data, speciesId });
  });

  console.log(`Parsed ${rows.length} rows: ${valid.length} valid, ${problems.length} problems.`);
  for (const problem of problems.slice(0, 50)) {
    console.log(`  line ${problem.line} — ${problem.message}`);
  }
  if (problems.length > 50) console.log(`  … and ${problems.length - 50} more`);

  if (!commit) {
    console.log('\nDry run — nothing written. Re-run with --commit to import.');
    return;
  }

  if (problems.length > 0 && !force) {
    console.error(
      '\nRefusing to import a file with problems. Fix them, or pass --force to import only the valid rows.',
    );
    process.exitCode = 1;
    return;
  }

  const created = await prisma.tree.createMany({
    data: valid.map((row) => ({
      speciesId: row.speciesId,
      latitude: row.latitude,
      longitude: row.longitude,
      condition: row.condition,
      fruitQuality: row.fruit_quality,
      reachability: row.reachability,
      ageBand: row.age_band,
      ageYearsEstimate: row.age_years_estimate,
      notes: row.notes,
      addressLine: row.address_line,
      city: row.city,
      region: row.region,
      countryCode: row.country_code?.toUpperCase(),
      locationSource: LocationSource.IMPORT,
      // Imported rows carry whatever address the survey had; anything missing
      // is left for the backfill job rather than guessed at.
      geocodeStatus: row.address_line || row.city ? GeocodeStatus.MANUAL : GeocodeStatus.PENDING,
      status: TreeStatus.PUBLISHED,
    })),
  });

  console.log(`\nImported ${created.count} trees.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
