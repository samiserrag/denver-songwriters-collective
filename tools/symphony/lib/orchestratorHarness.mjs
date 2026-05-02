import { ingestAdapterResult } from "./orchestratorAdapterIngest.mjs";
import { reconcileOrchestratorState } from "./orchestratorReconcile.mjs";
import {
  createOrchestratorStateSnapshot,
  readOrchestratorStateManifest,
  validateOrchestratorStateSnapshot,
  writeOrchestratorStateManifest
} from "./orchestratorStateManifest.mjs";
import { STATE_RETRY_WAIT } from "./orchestratorState.mjs";

export async function runOrchestratorHarness({
  initialSnapshot = null,
  manifestPath = null,
  observedSequence = [],
  adapterResults = [],
  options = {}
} = {}) {
  const transcript = [];
  const snapshots = [];
  let currentSnapshot;

  try {
    assertArray(observedSequence, "observedSequence");
    assertArray(adapterResults, "adapterResults");
  } catch (error) {
    return failClosedHarness({
      stage: "validate_inputs",
      reason: "orchestrator_harness_invalid_inputs",
      error,
      transcript,
      snapshots
    });
  }

  try {
    currentSnapshot = initialSnapshot
      ? validateOrchestratorStateSnapshot(initialSnapshot)
      : await readSnapshotFromManifest(manifestPath, options);
  } catch (error) {
    return failClosedHarness({
      stage: "load_snapshot",
      reason: "orchestrator_harness_invalid_initial_snapshot",
      error,
      transcript,
      snapshots
    });
  }

  snapshots.push(currentSnapshot);

  const steps = Math.max(observedSequence.length, adapterResults.length);
  for (let index = 0; index < steps; index += 1) {
    const observed = observedSequence[index];
    const adapterResult = adapterResults[index];
    const step = {
      index,
      reconciliation: null,
      adapter_ingestion: null,
      adapter_ingestion_skipped: null,
      next_snapshot: null,
      actions: [],
      durableWrites: []
    };

    if (observed !== undefined && observed !== null) {
      const reconciliation = reconcileOrchestratorState(
        currentSnapshot,
        observed,
        {
          ...options.reconcileOptions,
          ...(observed.options || {}),
          now: observed.now ?? observed.options?.now ?? options.now ?? options.reconcileOptions?.now
        }
      );
      step.reconciliation = reconciliation;
      appendDecisionEffects(step, reconciliation.decisions || []);

      if (reconciliation.ok === false) {
        transcript.push(step);
        return failClosedHarness({
          stage: "reconcile",
          reason: reconciliation.reason,
          error: new Error(reconciliation.error || "reconciliation failed"),
          currentSnapshot,
          transcript,
          snapshots
        });
      }

      const transitionDecisions = (reconciliation.decisions || []).filter((decision) => decision.transition);
      for (const decision of transitionDecisions) {
        currentSnapshot = applyDecisionTransition(currentSnapshot, decision);
        snapshots.push(currentSnapshot);
      }

      if (transitionDecisions.length > 0 && adapterResult !== undefined && adapterResult !== null) {
        step.adapter_ingestion_skipped = {
          ok: true,
          reason: "reconciliation_transition_prevented_adapter_ingest",
          skipped_adapter_result: true
        };
      }
    }

    const canIngestAdapter = adapterResult !== undefined
      && adapterResult !== null
      && !step.adapter_ingestion_skipped;
    if (canIngestAdapter) {
      const ingestion = ingestAdapterResult(currentSnapshot, adapterResult, {
        ...options.adapterOptions,
        issueNumber: adapterResult.issueNumber ?? adapterResult.issue_number ?? options.issueNumber,
        now: adapterResult.now ?? options.now ?? options.adapterOptions?.now
      });
      step.adapter_ingestion = ingestion;
      appendDecisionEffects(step, [ingestion]);

      if (ingestion.ok === false) {
        transcript.push(step);
        return failClosedHarness({
          stage: "adapter_ingest",
          reason: ingestion.reason,
          error: new Error(ingestion.error || "adapter ingestion failed"),
          currentSnapshot,
          transcript,
          snapshots
        });
      }

      currentSnapshot = ingestion.next_snapshot;
      snapshots.push(currentSnapshot);
    }

    step.next_snapshot = currentSnapshot;
    transcript.push(step);
  }

  try {
    if (options.writeManifest === true) {
      await writeSnapshotManifest(manifestPath, currentSnapshot, options);
    }
  } catch (error) {
    return failClosedHarness({
      stage: "write_manifest",
      reason: "orchestrator_harness_manifest_write_failed",
      error,
      currentSnapshot,
      transcript,
      snapshots
    });
  }

  return {
    ok: true,
    dry_run: true,
    initial_snapshot: snapshots[0],
    final_snapshot: currentSnapshot,
    transcript,
    reconciliation_decisions: transcript
      .map((step) => step.reconciliation)
      .filter(Boolean),
    adapter_ingestion_decisions: transcript
      .map((step) => step.adapter_ingestion)
      .filter(Boolean),
    snapshots,
    actions: collectUnique(transcript.flatMap((step) => step.actions)),
    durableWrites: collectUnique(transcript.flatMap((step) => step.durableWrites))
  };
}

async function readSnapshotFromManifest(manifestPath, options) {
  if (!manifestPath) {
    throw new Error("initialSnapshot or manifestPath is required");
  }
  const snapshot = await readOrchestratorStateManifest(manifestPath, options.manifestFs || {});
  if (!snapshot) {
    throw new Error(`orchestrator state manifest not found: ${manifestPath}`);
  }
  return snapshot;
}

async function writeSnapshotManifest(manifestPath, snapshot, options) {
  if (!manifestPath) {
    throw new Error("manifestPath is required when writeManifest is true");
  }
  await writeOrchestratorStateManifest(manifestPath, snapshot, options.manifestFs || {});
}

function applyDecisionTransition(snapshot, decision) {
  const issue = snapshot.issues[String(decision.issue_number)];
  if (!issue) {
    throw new Error(`issue ${decision.issue_number} was not found in orchestrator state snapshot`);
  }
  const now = decision.generated_at || snapshot.generated_at;
  const partial = createOrchestratorStateSnapshot({
    generatedAt: now,
    issueNumber: issue.issue_number,
    state: decision.transition.to,
    title: issue.title,
    branchName: issue.branch_name,
    worktreePath: issue.worktree_path,
    logPath: issue.log_path,
    manifestPath: issue.manifest_path,
    attempt: issue.attempt,
    reason: decision.transition.reason,
    terminalStatus: issue.terminal_status,
    terminalReason: issue.terminal_reason,
    adapterStateSnapshot: issue.adapter_state_snapshot ?? null,
    retry: decision.transition.to === STATE_RETRY_WAIT ? decision.transition.retry : null,
    retryAttempts: snapshot.retry_attempts,
    transition: decision.transition,
    stateTransitions: snapshot.state_transitions,
    codexTotals: snapshot.codex_totals,
    codexRateLimits: snapshot.codex_rate_limits,
    lastOutcome: snapshot.last_outcome,
    workflow: snapshot.workflow,
    repo: snapshot.repo,
    lock: snapshot.lock
  });

  const issueKey = String(issue.issue_number);
  const retryAttempts = {
    ...snapshot.retry_attempts,
    ...partial.retry_attempts
  };
  if (decision.transition.to !== STATE_RETRY_WAIT) {
    delete retryAttempts[issueKey];
  }

  return validateOrchestratorStateSnapshot({
    ...snapshot,
    generated_at: now,
    issues: {
      ...snapshot.issues,
      [issueKey]: partial.issues[issueKey]
    },
    retry_attempts: retryAttempts,
    state_transitions: partial.state_transitions
  });
}

function appendDecisionEffects(step, decisions) {
  for (const decision of decisions) {
    step.actions.push(...(decision.actions || []));
    step.durableWrites.push(...(decision.durableWrites || decision.durable_writes || []));
  }
}

function failClosedHarness({
  stage,
  reason,
  error,
  currentSnapshot = null,
  transcript,
  snapshots
}) {
  return {
    ok: false,
    dry_run: true,
    stage,
    reason,
    error: error instanceof Error ? error.message : String(error),
    initial_snapshot: snapshots[0] ?? null,
    final_snapshot: currentSnapshot,
    transcript,
    reconciliation_decisions: transcript
      .map((step) => step.reconciliation)
      .filter(Boolean),
    adapter_ingestion_decisions: transcript
      .map((step) => step.adapter_ingestion)
      .filter(Boolean),
    snapshots,
    actions: ["stop_orchestrator_harness", "require_manual_review"],
    durableWrites: ["orchestrator_harness_manifest_error"]
  };
}

function collectUnique(values) {
  return [...new Set(values)];
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
}
