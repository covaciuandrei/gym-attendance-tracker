import { Injectable, inject } from '@angular/core';
import { DiaryEntry, Profile, WeightLog } from '../models';
import { isDateKey } from '../utils/date';
import { isImageDataUrl } from '../utils/image';
import { normalizeEntry } from './entry-mapper';
import { NutritionDataService } from './nutrition-data.service';
import { NutritionProfileService } from './nutrition-profile.service';

// Same format as the standalone calorie tracker, so its backups can be imported here.
const FORMAT = 'calorie-tracker-backup';
const MAX_ROWS = 100_000;
const MAX_PHOTO_CHARS = 700_000;

export class BackupError extends Error {}

export interface BackupData {
  entries: unknown[];
  weights: unknown[];
  profile?: unknown;
}

interface BackupFile extends BackupData {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  profile: Profile;
}

function sanitizeWeight(raw: unknown): WeightLog {
  const r = (raw ?? {}) as Record<string, unknown>;
  const date = r['date'];
  const kg = r['kg'];
  if (typeof date !== 'string' || !isDateKey(date) || typeof kg !== 'number' || !Number.isFinite(kg) || kg < 20 || kg > 400) {
    throw new BackupError('invalid weight');
  }
  return { date, kg: Math.round(kg * 10) / 10 };
}

@Injectable({ providedIn: 'root' })
export class NutritionBackupService {
  private data = inject(NutritionDataService);
  private profile = inject(NutritionProfileService);

  async export(includePhotos: boolean): Promise<{ blob: Blob; filename: string; entries: number }> {
    const [entries, weights] = await Promise.all([this.data.allEntries(), this.data.weights()]);
    const photos = includePhotos ? await this.data.allPhotos() : new Map<string, string>();

    const serialised = entries.map(({ hasPhoto: _hasPhoto, ...rest }) => {
      const photo = photos.get(rest.id);
      return photo ? { ...rest, photo } : rest;
    });
    const file: BackupFile = {
      format: FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: this.profile.profile(),
      entries: serialised,
      weights,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      blob: new Blob([JSON.stringify(file)], { type: 'application/json' }),
      filename: `calorie-tracker-${stamp}.json`,
      entries: entries.length,
    };
  }

  async import(content: string): Promise<{ entries: number; weights: number }> {
    let parsed: Partial<BackupFile> | null;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new BackupError('not json');
    }
    if (parsed?.format !== FORMAT || !Array.isArray(parsed.entries) || !Array.isArray(parsed.weights)) {
      throw new BackupError('not a backup');
    }
    return this.importData({ entries: parsed.entries, weights: parsed.weights, profile: parsed.profile });
  }

  /**
   * Merges data into the account (a meal with the same id is overwritten). Everything is validated before the first
   * write, so a broken file changes nothing.
   */
  async importData(input: BackupData): Promise<{ entries: number; weights: number }> {
    if (input.entries.length > MAX_ROWS || input.weights.length > MAX_ROWS) throw new BackupError('too large');

    const entries: DiaryEntry[] = [];
    const photos = new Map<string, string>();
    for (const raw of input.entries) {
      const record = (raw ?? {}) as Record<string, unknown>;
      let entry: DiaryEntry;
      try {
        entry = normalizeEntry(String(record['id'] ?? ''), raw);
      } catch {
        throw new BackupError('invalid entry');
      }
      const photo = record['photo'];
      if (isImageDataUrl(photo) && photo.length <= MAX_PHOTO_CHARS) photos.set(entry.id, photo);
      entries.push(entry);
    }
    const weights = input.weights.map(sanitizeWeight);

    await this.data.importAll(entries, photos, weights);
    if (input.profile && typeof input.profile === 'object') await this.profile.replace(input.profile as Partial<Profile>);
    return { entries: entries.length, weights: weights.length };
  }

  async clearAll(): Promise<void> {
    await this.data.clearAll();
    this.profile.resetLocal();
  }
}
