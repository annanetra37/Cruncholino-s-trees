/**
 * T4.1 fallback 2 / T6.2 — pull GPS and timestamp out of a JPEG before the
 * image is resized, because resizing through a canvas discards every EXIF tag.
 *
 * This is a deliberately small reader: it walks the APP1/TIFF structure looking
 * for four tags and ignores everything else. A full EXIF library is ~40 kB of
 * JavaScript to answer one question on a page that is often loaded over a
 * field data connection.
 */
export type ExifLocation = {
  latitude: number;
  longitude: number;
  takenAt: Date | null;
};

const TAG_GPS_IFD = 0x8825;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const GPS_LAT_REF = 0x0001;
const GPS_LAT = 0x0002;
const GPS_LNG_REF = 0x0003;
const GPS_LNG = 0x0004;

export async function readExifLocation(file: File): Promise<ExifLocation | null> {
  if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;

  try {
    // EXIF lives at the front of the file; reading the first 256 kB is enough
    // and avoids pulling a 5 MB photo into memory twice.
    const head = await file.slice(0, 256 * 1024).arrayBuffer();
    return parseExif(new DataView(head));
  } catch {
    return null;
  }
}

function parseExif(view: DataView): ExifLocation | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1) {
      // APP1: "Exif\0\0" then a TIFF header.
      const tiffStart = offset + 10;
      if (tiffStart + 8 > view.byteLength) return null;
      return parseTiff(view, tiffStart);
    }
    if ((marker & 0xff00) !== 0xff00) return null;
    offset += 2 + size;
  }
  return null;
}

function parseTiff(view: DataView, start: number): ExifLocation | null {
  const byteOrder = view.getUint16(start);
  const little = byteOrder === 0x4949;
  if (!little && byteOrder !== 0x4d4d) return null;

  const ifd0 = start + view.getUint32(start + 4, little);
  const entries = readIfd(view, ifd0, start, little);

  const gpsOffset = entries.get(TAG_GPS_IFD);
  const exifOffset = entries.get(TAG_EXIF_IFD);

  let takenAt: Date | null = null;
  if (typeof exifOffset === 'number') {
    const exif = readIfd(view, start + exifOffset, start, little);
    const raw = exif.get(TAG_DATETIME_ORIGINAL);
    if (typeof raw === 'string') takenAt = parseExifDate(raw);
  }

  if (typeof gpsOffset !== 'number') return null;
  const gps = readIfd(view, start + gpsOffset, start, little);

  const latitude = toDecimal(gps.get(GPS_LAT), gps.get(GPS_LAT_REF));
  const longitude = toDecimal(gps.get(GPS_LNG), gps.get(GPS_LNG_REF));
  if (latitude === null || longitude === null) return null;

  return { latitude, longitude, takenAt };
}

type TagValue = number | string | number[] | undefined;

function readIfd(
  view: DataView,
  ifdStart: number,
  tiffStart: number,
  little: boolean,
): Map<number, TagValue> {
  const result = new Map<number, TagValue>();
  if (ifdStart + 2 > view.byteLength) return result;

  const count = view.getUint16(ifdStart, little);
  for (let index = 0; index < count; index += 1) {
    const entry = ifdStart + 2 + index * 12;
    if (entry + 12 > view.byteLength) break;

    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const length = view.getUint32(entry + 4, little);
    const valueOffset = entry + 8;

    if (type === 2) {
      // ASCII
      const dataStart = length > 4 ? tiffStart + view.getUint32(valueOffset, little) : valueOffset;
      let text = '';
      for (let i = 0; i < length - 1 && dataStart + i < view.byteLength; i += 1) {
        text += String.fromCharCode(view.getUint8(dataStart + i));
      }
      result.set(tag, text);
    } else if (type === 5 && length === 3) {
      // RATIONAL[3] — the degrees/minutes/seconds triple
      const dataStart = tiffStart + view.getUint32(valueOffset, little);
      const values: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const at = dataStart + i * 8;
        if (at + 8 > view.byteLength) return result;
        const numerator = view.getUint32(at, little);
        const denominator = view.getUint32(at + 4, little);
        values.push(denominator === 0 ? 0 : numerator / denominator);
      }
      result.set(tag, values);
    } else if (type === 4 || type === 3) {
      result.set(tag, type === 4 ? view.getUint32(valueOffset, little) : view.getUint16(valueOffset, little));
    }
  }

  return result;
}

function toDecimal(value: TagValue, ref: TagValue): number | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [degrees = 0, minutes = 0, seconds = 0] = value;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  if (!Number.isFinite(decimal)) return null;
  const reference = typeof ref === 'string' ? ref.trim().toUpperCase() : '';
  return reference === 'S' || reference === 'W' ? -decimal : decimal;
}

/** EXIF dates look like "2026:04:11 07:32:10" — not something Date can parse. */
function parseExifDate(raw: string): Date | null {
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}
