import { describe, expect, it } from 'vitest';
import { parseCoordinates } from '@/components/LocationStep';

/**
 * The parser decides whether typed text is a point or an address to look up, so
 * a false positive does not fail loudly — it silently drops the pin somewhere
 * wrong. These lean on the rejections for that reason.
 */
describe('parseCoordinates', () => {
  it('reads the forms a phone or a map actually produces', () => {
    const yerevan = { latitude: 40.18726, longitude: 44.5152 };
    expect(parseCoordinates('40.18726, 44.51520')).toEqual(yerevan);
    expect(parseCoordinates('40.18726 44.51520')).toEqual(yerevan);
    expect(parseCoordinates('40.18726; 44.51520')).toEqual(yerevan);
    expect(parseCoordinates('  40.18726 , 44.51520  ')).toEqual(yerevan);
    expect(parseCoordinates('40.18726°, 44.51520°')).toEqual(yerevan);
  });

  it('keeps negatives and whole numbers', () => {
    expect(parseCoordinates('-33.87, 151.21')).toEqual({ latitude: -33.87, longitude: 151.21 });
    expect(parseCoordinates('40, 44')).toEqual({ latitude: 40, longitude: 44 });
  });

  it('refuses an address that merely contains numbers', () => {
    // The failure this guards: "Abovyan 12" parsed as a point would put the pin
    // in the Gulf of Guinea and never reach the geocoder.
    expect(parseCoordinates('Abovyan 12')).toBeNull();
    expect(parseCoordinates('Abovyan 12, Yerevan')).toBeNull();
    expect(parseCoordinates('12 Abovyan')).toBeNull();
  });

  it('refuses a single number, or three', () => {
    expect(parseCoordinates('40.18726')).toBeNull();
    expect(parseCoordinates('40.18726, 44.51520, 12')).toBeNull();
  });

  it('refuses coordinates outside the earth', () => {
    expect(parseCoordinates('91, 44')).toBeNull();
    expect(parseCoordinates('40, 181')).toBeNull();
    expect(parseCoordinates('-90.1, 0')).toBeNull();
  });

  it('accepts the poles and the antimeridian exactly', () => {
    expect(parseCoordinates('90, 180')).toEqual({ latitude: 90, longitude: 180 });
    expect(parseCoordinates('-90, -180')).toEqual({ latitude: -90, longitude: -180 });
  });

  it('refuses empty and nonsense input', () => {
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('   ')).toBeNull();
    expect(parseCoordinates('near the school')).toBeNull();
  });
});
