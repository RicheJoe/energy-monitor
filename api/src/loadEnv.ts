import fs from 'fs';
import path from 'path';

let loaded = false;

/** 仅在进程里还没有该变量时写入，容器注入的环境变量优先于 .env。 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  const file = path.resolve(__dirname, '../.env');
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
