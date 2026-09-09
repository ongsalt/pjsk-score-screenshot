import ExifReader from "exifreader";

/**
 * When the screenshot was actually taken.
 *
 * `file.lastModified` is the wrong answer: copying 500 screenshots off a phone
 * rewrites it, so every record would land on the import date. We look at the
 * image's own metadata first, then the filename (android and ios both stamp the
 * capture time into it, and png screenshots often carry no exif at all), and
 * only fall back to the file timestamp.
 */
export async function capturedAt(
  file: File,
  /** the file's bytes, already read by the caller - avoids a second full read */
  bytes: ArrayBuffer,
): Promise<{ at: number; from: Source }> {
  const fromMetadata = await readMetadataDate(bytes);
  if (fromMetadata !== null) return { at: fromMetadata, from: "metadata" };

  const fromName = readFilenameDate(file.name);
  if (fromName !== null) return { at: fromName, from: "filename" };

  return { at: file.lastModified || Date.now(), from: "file" };
}

export type Source = "metadata" | "filename" | "file";

/** exif and xmp tags that mean "when the shutter fired", best first */
const DATE_TAGS = [
  "DateTimeOriginal",
  "DateCreated",
  "CreateDate",
  "DateTimeDigitized",
  "DateTime",
  "ModifyDate",
  "Creation Time",
];

async function readMetadataDate(bytes: ArrayBuffer): Promise<number | null> {
  let tags: ExifReader.Tags;
  try {
    // ArrayBuffer rather than the File: it skips exifreader's FileReader path
    // and reuses bytes the importer has already read
    tags = await ExifReader.load(bytes);
  } catch {
    // no metadata block at all, which is normal for a png screenshot
    return null;
  }

  const offset = textOf(tags["OffsetTimeOriginal"]) ?? textOf(tags["OffsetTime"]);

  for (const tag of DATE_TAGS) {
    const parsed = parseTimestamp(textOf(tags[tag as keyof typeof tags]), offset);
    if (parsed !== null) return parsed;
  }

  return null;
}

function textOf(tag: unknown): string | undefined {
  if (!tag || typeof tag !== "object") return undefined;
  const { description, value } = tag as { description?: unknown; value?: unknown };
  if (typeof description === "string" && description.trim()) return description;
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

/** exif writes "2026:09:09 21:04:12"; xmp writes ISO */
function parseTimestamp(value: string | undefined, offset?: string): number | null {
  if (!value) return null;

  const match = /(\d{4})[:-](\d{2})[:-](\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23) return null;

  // an explicit zone in the value itself wins, then OffsetTimeOriginal
  const zone = /(?:Z|[+-]\d{2}:\d{2})$/.exec(value.trim())?.[0] ?? offset;
  const minutesFromUtc = zoneOffsetMinutes(zone);

  return minutesFromUtc === null
    ? new Date(year, month - 1, day, hour, minute, second).getTime()
    : Date.UTC(year, month - 1, day, hour, minute, second) - minutesFromUtc * 60_000;
}

function zoneOffsetMinutes(zone: string | undefined): number | null {
  if (!zone) return null;
  if (zone === "Z") return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(zone.trim());
  if (!match) return null;
  return (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Screenshot_20260909-210412, PXL_20260909_210412123, IMG_20260909_210412,
 * "Screenshot 2026-09-09 at 21.04.12" and friends.
 */
function readFilenameDate(name: string): number | null {
  const match =
    /(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})[-_ T]?(?:at[-_ ])?(\d{2})[-_.:]?(\d{2})[-_.:]?(\d{2})/i.exec(
      name,
    );
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  const at = new Date(year, month - 1, day, hour, minute, second).getTime();
  // a filename date in the future is a false positive, not a play
  return at > Date.now() + 86_400_000 ? null : at;
}
