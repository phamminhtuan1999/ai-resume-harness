#!/usr/bin/env node
// Frees the local dev ports (web + api) by terminating whatever is listening.
import { execSync } from 'node:child_process';

const PORTS = [3000, 8000];

for (const port of PORTS) {
  let pids = [];
  try {
    pids = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' })
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  } catch {
    // lsof exits non-zero when nothing is listening on the port.
    console.log(`port ${port}: already closed`);
    continue;
  }

  if (!pids.length) {
    console.log(`port ${port}: already closed`);
    continue;
  }

  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM');
      console.log(`port ${port}: killed ${pid}`);
    } catch (err) {
      console.log(`port ${port}: could not kill ${pid} (${err.code ?? err.message})`);
    }
  }
}
