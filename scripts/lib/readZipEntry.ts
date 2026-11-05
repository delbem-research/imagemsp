/**
 * Reads one file out of a ZIP archive held in memory, with nothing but
 * `node:zlib` — the scripts need a single CSV from an archive, not a ZIP
 * dependency.
 *
 * Handles what the archives the scripts read use: stored and deflated
 * entries, without ZIP64 (every entry and the archive itself under 4 GB).
 */
import { inflateRawSync } from 'node:zlib';

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;

const STORED = 0;
const DEFLATED = 8;

/** Where the central directory starts and how many entries it lists. */
const findCentralDirectory = (
  zip: Buffer
): { offset: number; entries: number } => {
  // The end record is the last 22 bytes, followed by a comment of up to 64 KB.
  const earliest = Math.max(0, zip.length - 22 - 0xffff);

  for (let at = zip.length - 22; at >= earliest; at -= 1) {
    if (zip.readUInt32LE(at) === END_OF_CENTRAL_DIRECTORY) {
      return {
        offset: zip.readUInt32LE(at + 16),
        entries: zip.readUInt16LE(at + 10),
      };
    }
  }

  throw new Error(
    '[readZipEntry] not a ZIP archive: no end of central directory'
  );
};

/**
 * Extracts one entry of a ZIP archive.
 *
 * @param params.zip - The whole archive.
 * @param params.name - The entry's path inside the archive.
 * @returns The entry's bytes, decompressed.
 * @throws If the archive has no such entry, or stores it in a way this reader
 * does not handle.
 *
 * @example
 * const csv = readZipEntry({ zip, name: 'sinistros_2022-2024.csv' });
 */
export const readZipEntry = ({
  zip,
  name,
}: {
  zip: Buffer;
  name: string;
}): Buffer => {
  const directory = findCentralDirectory(zip);
  let at = directory.offset;

  for (let index = 0; index < directory.entries; index += 1) {
    if (zip.readUInt32LE(at) !== CENTRAL_DIRECTORY_HEADER) {
      throw new Error('[readZipEntry] corrupt central directory');
    }

    const method = zip.readUInt16LE(at + 10);
    const compressedSize = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const localHeader = zip.readUInt32LE(at + 42);
    const entryName = zip.toString('utf8', at + 46, at + 46 + nameLength);

    if (entryName === name) {
      if (zip.readUInt32LE(localHeader) !== LOCAL_FILE_HEADER) {
        throw new Error(`[readZipEntry] corrupt local header for ${name}`);
      }

      // The local header repeats the name and carries an extra field of its
      // own length, so the data starts after both.
      const dataStart =
        localHeader +
        30 +
        zip.readUInt16LE(localHeader + 26) +
        zip.readUInt16LE(localHeader + 28);
      const data = zip.subarray(dataStart, dataStart + compressedSize);

      if (method === STORED) return Buffer.from(data);
      if (method === DEFLATED) return inflateRawSync(data);

      throw new Error(
        `[readZipEntry] ${name} uses compression method ${method}, not stored or deflated`
      );
    }

    at += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`[readZipEntry] the archive has no entry ${name}`);
};
