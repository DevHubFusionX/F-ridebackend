import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import autocannon from 'autocannon';

const scenarios = [
  {
    name: 'health',
    options: {
      url: 'http://127.0.0.1:5000/api/health',
      duration: 15,
      connections: 50,
    },
  },
  {
    name: 'request-otp',
    options: {
      url: 'http://127.0.0.1:5000/api/auth/request-otp',
      method: 'POST',
      duration: 15,
      connections: 25,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+15550000001' }),
    },
  },
  {
    name: 'verify-otp',
    options: {
      url: 'http://127.0.0.1:5000/api/auth/verify-otp',
      method: 'POST',
      duration: 15,
      connections: 25,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+15550000001', otp: '123456' }),
    },
  },
];

function runAutocannon(options) {
  return new Promise((resolve, reject) => {
    autocannon(options, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}

function formatResult(result) {
  return {
    requestsPerSec: Number(result.requests.average.toFixed(2)),
    errors: result.errors,
    p50Ms: Number(result.latency.p50.toFixed(2)),
    p95Ms: Number(result.latency.p95.toFixed(2)),
    p99Ms: Number(result.latency.p99.toFixed(2)),
  };
}

function printRound(label, metrics) {
  console.log(`\n=== ${label} ===`);
  for (const [name, value] of Object.entries(metrics)) {
    console.log(
      `${name}: rps=${value.requestsPerSec}, errors=${value.errors}, p50=${value.p50Ms}ms, p95=${value.p95Ms}ms, p99=${value.p99Ms}ms`
    );
  }
}

function printDelta(baseline, retest) {
  console.log('\n=== Delta (retest - baseline) ===');
  for (const name of Object.keys(baseline)) {
    const base = baseline[name];
    const next = retest[name];
    console.log(
      `${name}: rps=${(next.requestsPerSec - base.requestsPerSec).toFixed(2)}, p95=${(next.p95Ms - base.p95Ms).toFixed(2)}ms, p99=${(next.p99Ms - base.p99Ms).toFixed(2)}ms, errors=${next.errors - base.errors}`
    );
  }
}

async function collectRound(roundName) {
  const metrics = {};

  for (const scenario of scenarios) {
    const result = await runAutocannon(scenario.options);
    metrics[scenario.name] = formatResult(result);
    await sleep(600);
  }

  printRound(roundName, metrics);
  return metrics;
}

async function main() {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PERF_LOG: 'false',
    PERF_SKIP_DB: 'true',
    PERF_USE_INMEMORY_AUTH: 'true',
  };

  const server = spawn('node', ['dist/index.js'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: process.cwd(),
  });

  server.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk.toString()));

  try {
    await sleep(3500);
    const baseline = await collectRound('Baseline');
    const retest = await collectRound('Retest');
    printDelta(baseline, retest);
  } finally {
    server.kill('SIGINT');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
