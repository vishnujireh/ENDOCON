import { createReadStream } from 'node:fs';
import { copyFile, mkdir, readFile, rename, stat, writeFile, unlink } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import path from 'node:path';
import { env } from '../../config/env.js';

/**
 * File storage abstraction (uploads, invoices). The local driver stores files outside any
 * public web root; files are only ever served through authorised API routes.
 * An S3 driver can implement the same interface for multi-server deployments.
 */
export interface Storage {
  write(key: string, data: Buffer): Promise<void>;
  /** Stores a file that is already on local disk (e.g. a large upload) without loading it into memory. The source is moved. */
  writeFromFile(key: string, sourcePath: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** Streams a stored file (downloads of large videos). */
  readStream(key: string): Promise<{ stream: Readable; size: number }>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

class LocalStorage implements Storage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async write(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async writeFromFile(key: string, sourcePath: string): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    try {
      await rename(sourcePath, full);
    } catch {
      // Different disk / volume: copy, then remove the source.
      await copyFile(sourcePath, full);
      await unlink(sourcePath).catch(() => undefined);
    }
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async readStream(key: string): Promise<{ stream: Readable; size: number }> {
    const full = this.resolve(key);
    const { size } = await stat(full);
    return { stream: createReadStream(full), size };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch {
      /* already gone */
    }
  }
}

let storage: Storage | null = null;
export function getStorage(): Storage {
  storage ??= new LocalStorage(path.resolve(env.STORAGE_LOCAL_DIR));
  return storage;
}
