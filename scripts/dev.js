import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const nodeExec = process.execPath;
const viteJs = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const tsxJs = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');

console.log('\x1b[36m%s\x1b[0m', '⚡ Starting Taskiye Client and Server in parallel...');

// Spawn Client Dev Server (Vite) directly via node runtime
const client = spawn(nodeExec, [viteJs], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'inherit',
  env: process.env,
});

client.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `[CLIENT ERROR]: ${err.message}`);
});

// Spawn Backend Server (TSX watch) directly via node runtime
const server = spawn(nodeExec, [tsxJs, 'watch', 'src/index.ts'], {
  cwd: path.join(rootDir, 'server'),
  stdio: 'inherit',
  env: process.env,
});

server.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `[SERVER ERROR]: ${err.message}`);
});

// Clean up both processes on exit
const cleanup = () => {
  try {
    client.kill();
  } catch {}
  try {
    server.kill();
  } catch {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
