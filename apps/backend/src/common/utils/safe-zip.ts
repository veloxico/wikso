/**
 * Safe ZIP extraction.
 *
 * The previous import path shelled out to `unzip -o -q` which is vulnerable
 * to two well-known archive attacks:
 *
 *   1. Zip-slip — an entry named `../../etc/passwd` or `/etc/passwd` writes
 *      outside the intended destination directory.
 *   2. Zip-bomb — an entry that decompresses to many GB exhausts disk and
 *      kills the import worker (and possibly the whole host).
 *
 * `yauzl` exposes the parsed central directory entries before extracting, so
 * we can validate each entry name and enforce a running total-size cap before
 * any bytes are written. Anything that would escape the destination, exceed
 * the per-file limit, or push the running total over the bomb-cap aborts the
 * whole extract.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import * as yauzl from 'yauzl';

const pipelineAsync = promisify(pipeline);
const fromBuffer = promisify(yauzl.fromBuffer.bind(yauzl)) as unknown as (
  buffer: Buffer,
  options?: yauzl.Options,
) => Promise<yauzl.ZipFile>;
const open = promisify(yauzl.open.bind(yauzl)) as unknown as (
  path: string,
  options?: yauzl.Options,
) => Promise<yauzl.ZipFile>;

export interface SafeExtractOptions {
  /** Absolute max for the sum of uncompressed sizes. Default 2 GiB. */
  maxTotalUncompressedBytes?: number;
  /** Per-file uncompressed cap. Default 500 MiB. */
  maxFileBytes?: number;
  /** Reject archives with more than this many entries. Default 50,000. */
  maxEntries?: number;
}

const DEFAULTS: Required<SafeExtractOptions> = {
  maxTotalUncompressedBytes: 2 * 1024 * 1024 * 1024, // 2 GiB
  maxFileBytes: 500 * 1024 * 1024, // 500 MiB
  maxEntries: 50_000,
};

/**
 * Extract a ZIP file to a destination directory. Aborts on any sign of a
 * zip-slip / zip-bomb / oversize archive. Returns counters useful for logs.
 */
export async function safeExtractZip(
  zipPath: string,
  destDir: string,
  opts: SafeExtractOptions = {},
): Promise<{ entries: number; bytes: number }> {
  const limits = { ...DEFAULTS, ...opts };
  const zipfile = await open(zipPath, { lazyEntries: true });
  return extractFromZipFile(zipfile, destDir, limits);
}

async function extractFromZipFile(
  zipfile: yauzl.ZipFile,
  destDir: string,
  limits: Required<SafeExtractOptions>,
): Promise<{ entries: number; bytes: number }> {
  const resolvedDest = path.resolve(destDir) + path.sep;
  fs.mkdirSync(destDir, { recursive: true });

  let totalBytes = 0;
  let entryCount = 0;

  return new Promise((resolve, reject) => {
    const fail = (err: Error) => {
      try {
        zipfile.close();
      } catch {
        /* ignore */
      }
      reject(err);
    };

    zipfile.on('error', fail);
    zipfile.on('end', () => resolve({ entries: entryCount, bytes: totalBytes }));

    zipfile.on('entry', async (entry: yauzl.Entry) => {
      try {
        entryCount += 1;
        if (entryCount > limits.maxEntries) {
          throw new Error(`Archive has too many entries (> ${limits.maxEntries})`);
        }

        // 1. Reject obviously hostile entry names. yauzl already normalizes
        //    backslashes to forward slashes on POSIX.
        const fileName = entry.fileName;
        if (
          fileName.includes('\0') ||
          path.isAbsolute(fileName) ||
          fileName.split(/[\\/]/).some((seg) => seg === '..')
        ) {
          throw new Error(`Unsafe archive entry path: ${fileName}`);
        }

        const targetPath = path.resolve(destDir, fileName);
        if (!targetPath.startsWith(resolvedDest)) {
          throw new Error(`Archive entry escapes destination: ${fileName}`);
        }

        // 2. Directory entries (trailing slash) — make the dir, move on.
        if (/\/$/.test(fileName)) {
          fs.mkdirSync(targetPath, { recursive: true });
          zipfile.readEntry();
          return;
        }

        // 3. Per-file size cap based on header (uncompressedSize is uint32 on
        //    classic ZIPs / uint64 on ZIP64 — yauzl exposes the resolved value).
        if (entry.uncompressedSize > limits.maxFileBytes) {
          throw new Error(
            `Archive entry ${fileName} too large (${entry.uncompressedSize} > ${limits.maxFileBytes})`,
          );
        }

        // 4. Running total cap — abort before opening the read stream so a
        //    crafted bomb can't consume disk.
        if (totalBytes + entry.uncompressedSize > limits.maxTotalUncompressedBytes) {
          throw new Error(
            `Archive total uncompressed size exceeds limit (> ${limits.maxTotalUncompressedBytes})`,
          );
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });

        await new Promise<void>((res, rej) => {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err || !readStream) return rej(err || new Error('No read stream'));
            const writeStream = fs.createWriteStream(targetPath);
            // Stream-side guard: if the actual decompressed payload exceeds
            // the header-declared size (some tools lie), trip the limit.
            let written = 0;
            readStream.on('data', (chunk: Buffer) => {
              written += chunk.length;
              if (written > entry.uncompressedSize + 1024 || written > limits.maxFileBytes) {
                readStream.destroy(
                  new Error(`Stream for ${fileName} exceeded declared size`),
                );
              }
            });
            pipelineAsync(readStream, writeStream).then(
              () => {
                totalBytes += written;
                res();
              },
              rej,
            );
          });
        });

        zipfile.readEntry();
      } catch (err: any) {
        fail(err);
      }
    });

    zipfile.readEntry();
  });
}

/** Convenience for extracting from an in-memory buffer (used by tests). */
export async function safeExtractZipBuffer(
  buf: Buffer,
  destDir: string,
  opts: SafeExtractOptions = {},
): Promise<{ entries: number; bytes: number }> {
  const limits = { ...DEFAULTS, ...opts };
  const zipfile = await fromBuffer(buf, { lazyEntries: true });
  return extractFromZipFile(zipfile, destDir, limits);
}
