/**
 * Request validation for the tree endpoints (T3.1, T3.4).
 */
import { AgeBand, Condition, FruitQuality, LocationSource, TreeStatus } from '@prisma/client';
import { z } from 'zod';

/**
 * `z.coerce.number()` turns a missing value into NaN, whose default message
 * ("expected number, received NaN") tells a contributor nothing. These say what
 * is actually wrong.
 */
const coordinate = (name: string) =>
  z.coerce.number({
    error: (issue) =>
      issue.input === undefined || Number.isNaN(issue.input as number)
        ? `${name} is required`
        : `${name} must be a number`,
  });

export const latitudeSchema = coordinate('Latitude')
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90');

export const longitudeSchema = coordinate('Longitude')
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180');

export const createTreeSchema = z.object({
  speciesId: z.uuid('Pick a species'),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  locationSource: z.enum(LocationSource).default(LocationSource.MANUAL),
  accuracyM: z.coerce.number().nonnegative().max(100_000).optional(),
  ageBand: z.enum(AgeBand).default(AgeBand.UNKNOWN),
  ageYearsEstimate: z.coerce.number().int().min(0).max(2000).optional().nullable(),
  condition: z.enum(Condition).default(Condition.UNKNOWN),
  fruitQuality: z.enum(FruitQuality).default(FruitQuality.UNKNOWN),
  notes: z.string().trim().max(2000).optional().nullable(),
  /** Set when the contributor corrected the reverse-geocoded address (T4.3). */
  addressOverride: z
    .object({
      addressLine: z.string().trim().max(300).optional().nullable(),
      city: z.string().trim().max(120).optional().nullable(),
      district: z.string().trim().max(120).optional().nullable(),
      region: z.string().trim().max(120).optional().nullable(),
      country: z.string().trim().max(120).optional().nullable(),
      countryCode: z.string().trim().length(2).optional().nullable(),
      postalCode: z.string().trim().max(20).optional().nullable(),
    })
    .optional(),
  photos: z
    .array(
      z.object({
        storageKey: z.string().min(1).max(300),
        width: z.coerce.number().int().positive().optional(),
        height: z.coerce.number().int().positive().optional(),
        bytes: z.coerce.number().int().positive().optional(),
        takenAt: z.coerce.date().optional().nullable(),
      }),
    )
    .max(10)
    .optional(),
  /** Idempotency key from the offline queue, so a retried sync cannot double-post. */
  clientRef: z.string().trim().max(100).optional(),
});

export type CreateTreeInput = z.infer<typeof createTreeSchema>;

export const updateTreeSchema = createTreeSchema
  .partial()
  .extend({
    status: z.enum(TreeStatus).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export type UpdateTreeInput = z.infer<typeof updateTreeSchema>;
