/**
 * npm run admin:password -- --email=you@company.com --confirm=<databaseName> [--create] [--role=Admin|Manager]
 *
 * Sets a staff password (or creates the account with --create). The password is
 * read from the ADMIN_NEW_PASSWORD env var or typed at a hidden prompt — never
 * passed on the command line (shell history). Requires typing the database name.
 */
import readline from 'node:readline';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { setStaffPassword } from './dbTools.js';
import { args, connect, run } from './cli.js';

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '*');
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

run(async () => {
  const db = await connect();
  if (args.confirm !== db.databaseName) {
    throw new Error(`Re-run with --confirm=${db.databaseName} to confirm the target database.`);
  }
  let password = process.env.ADMIN_NEW_PASSWORD;
  if (!password) {
    password = await askHidden('New password (min 10 chars): ');
    const again = await askHidden('Repeat password: ');
    if (password !== again) throw new Error('Passwords do not match');
  }
  const result = await setStaffPassword(User, RefreshToken, {
    email: args.email,
    password,
    role: args.role || 'Admin',
    create: Boolean(args.create),
  });
  console.log(`✔ ${result === 'created' ? 'Created' : 'Updated'} ${args.role || 'Admin'} ${String(args.email).toLowerCase()} on database "${db.databaseName}". Log in to the admin panel with the new password.`);
});
