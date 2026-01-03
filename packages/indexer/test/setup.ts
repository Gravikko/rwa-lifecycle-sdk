import { afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_DB_DIR = path.join(process.cwd(), 'test-dbs');

export function getTestDbPath(testName: string): string {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }
  return path.join(TEST_DB_DIR, `${testName}-${Date.now()}.db`);
}

export function cleanupTestDb(dbPath: string): void {
  try {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const walFile = `${dbPath}-wal`;
    const shmFile = `${dbPath}-shm`;
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
  } catch (error) {
    console.error('Failed to cleanup test db:', error);
  }
}

afterEach(() => {
  if (fs.existsSync(TEST_DB_DIR)) {
    const files = fs.readdirSync(TEST_DB_DIR);
    files.forEach((file) => {
      try {
        fs.unlinkSync(path.join(TEST_DB_DIR, file));
      } catch (err) {
        // Ignore
      }
    });
  }
});
