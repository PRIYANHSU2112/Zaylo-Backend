/** npm run db:backup — export every collection to Backend/backups/<db>-<timestamp>/ (verified). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backupDatabase } from './dbTools.js';
import { connect, run } from './cli.js';

const BACKUP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backups');

run(async () => {
  const db = await connect();
  const { dir } = await backupDatabase(db, BACKUP_ROOT);
  console.log(`✔ Backup written and verified: ${dir}`);
});
