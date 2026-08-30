import { spawn } from 'node:child_process';

const root = '/app';
const children = new Set();

function shutdown(code = 0) {
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(code);
  }, 10_000).unref();
}

function start(command, args, name) {
  const child = spawn(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
  children.add(child);
  child.on('exit', (code, signal) => {
    children.delete(child);
    console.error(`[codestra-runtime] ${name} exited`, { code, signal });
    shutdown(code || 1);
  });
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

// Runtime replicas never execute schema migrations. Release orchestration must
// invoke scripts/prisma-deploy.mjs once, as a separate migration job, and only
// start or replace application replicas after that migration job succeeds.
start('nginx', ['-g', 'daemon off;'], 'nginx');
start('node', [`${root}/dist/apps/backend/src/main.js`], 'backend');
start('node', [`${root}/dist/apps/orchestrator/src/main.js`], 'orchestrator');
start('node', [`${root}/node_modules/next/dist/bin/next`, 'start', '-p', '4200'], 'frontend');
