#!/usr/bin/env node

import { runDoctor } from "./lib/doctor.mjs";
import { recoverStaleRunningIssues, runDaemon, runOnce } from "./lib/runner.mjs";

function parseArgs(argv) {
  const flags = {
    _: [],
    dryRun: false,
    execute: false,
    json: false,
    createLabels: false,
    mockIssues: null,
    intervalSeconds: 120
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--execute") {
      flags.execute = true;
    } else if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--create-labels") {
      flags.createLabels = true;
    } else if (arg === "--mock-issues") {
      flags.mockIssues = argv[index + 1];
      index += 1;
    } else if (arg === "--interval-seconds") {
      flags.intervalSeconds = Number(argv[index + 1]);
      index += 1;
    } else {
      flags._.push(arg);
    }
  }

  return flags;
}

function printHelp() {
  console.log(`Symphony Lite

Usage:
  node tools/symphony/cli.mjs doctor [--create-labels] [--json]
  node tools/symphony/cli.mjs once [--dry-run] [--execute] [--mock-issues path] [--json]
  node tools/symphony/cli.mjs recover-stale [--dry-run] [--execute] [--json]
  node tools/symphony/cli.mjs daemon [--dry-run] [--interval-seconds n]

Notes:
  - once defaults to dry-run unless --execute is passed.
  - --execute also requires SYMPHONY_EXECUTION_APPROVED=1.
  - daemon requires SYMPHONY_ENABLE_DAEMON=1.
`);
}

function printDoctor(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Symphony doctor: ${result.ok ? "pass" : "fail"}`);
  for (const check of result.checks) {
    const detail = check.detail ? ` - ${check.detail}` : "";
    console.log(`[${check.status}] ${check.name}${detail}`);
  }
}

function printOnce(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Symphony once: ${result.mode}`);
  if (result.reason) {
    console.log(result.reason);
  }
  if (result.runningCount > 0) {
    console.log(`Running issues: ${result.runningCount}`);
  }
  if (result.plans.length === 0) {
    console.log("No eligible issues planned.");
    return;
  }

  for (const plan of result.plans) {
    console.log(`#${plan.issue.number} ${plan.issue.title}`);
    console.log(`  branch: ${plan.branchName}`);
    console.log(`  worktree: ${plan.worktreePath}`);
    console.log(`  labels add: ${plan.transition.add.join(", ") || "(none)"}`);
    console.log(`  labels remove: ${plan.transition.remove.join(", ") || "(none)"}`);
  }
}

function printRecovery(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Symphony recover-stale: ${result.mode}`);
  if (result.reason) {
    console.log(result.reason);
  }
  if (result.stale.length > 0) {
    console.log("Stale running issues:");
    for (const item of result.stale) {
      const lastUpdated = item.lastUpdatedAt || "unknown";
      const finalState = item.finalState ? ` -> ${item.finalState}` : "";
      console.log(`#${item.issueNumber} ${item.title} (last updated ${lastUpdated})${finalState}`);
    }
  }
  if (result.active.length > 0) {
    console.log(`Active running issues: ${result.active.length}`);
  }
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  const repoRoot = process.cwd();

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "doctor") {
    const result = await runDoctor({
      repoRoot,
      createLabels: flags.createLabels,
      env: process.env
    });
    printDoctor(result, flags.json);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "once") {
    const result = await runOnce({
      repoRoot,
      dryRun: !flags.execute || flags.dryRun,
      execute: flags.execute,
      mockIssuesPath: flags.mockIssues,
      env: process.env
    });
    printOnce(result, flags.json);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "recover-stale") {
    const result = await recoverStaleRunningIssues({
      repoRoot,
      dryRun: !flags.execute || flags.dryRun,
      execute: flags.execute,
      env: process.env
    });
    printRecovery(result, flags.json);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === "daemon") {
    const result = await runDaemon({
      repoRoot,
      dryRun: !flags.execute || flags.dryRun,
      intervalSeconds: flags.intervalSeconds,
      env: process.env
    });
    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
