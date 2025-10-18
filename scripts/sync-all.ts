import 'dotenv/config';
import { spawn } from 'child_process';

const cmds = [
  'npm run sync:customers',
  'npm run sync:users',
  'npm run sync:activities',
  'npm run sync:tags',
  'npm run sync:projects',
  'npm run sync:timesheets',
];

function run(cmd: string) {
  return new Promise<void>((resolve, reject) => {
    const [bin, ...args] = cmd.split(' ');
    const child = spawn(bin, args, { stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function main() {
  for (const c of cmds) {
    console.log('\n[sync:all] Running:', c);
    await run(c);
  }
  console.log('[sync:all] All syncs completed');
}

main().catch((e) => {
  console.error('[sync:all] Failed:', e?.message || e);
  process.exit(1);
});

