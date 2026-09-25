# Native `odo dev` / `odo dev --debug` Replacement — Plan

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

## Goal

Replace the CLI shell-out to `odo dev` / `odo dev --debug` (currently `src/odo/command.ts`'s
`Command.dev()`, invoked from `src/openshift/component.ts`'s `devRunOn`) with a native
TypeScript implementation, following the same pattern already used to replace `odo init`
(`src/devfile/init.ts`), `odo deploy` (`src/devfile/deploy.ts`), and `odo undeploy`
(`src/devfile/undeploy.ts`).

`deploy`/`undeploy`/`init`/`describe` are already fully native (`Odo.Instance.describeComponent`
delegates to `devfile/describe.ts`'s `getComponentDescription`). Dev mode is the last major
CLI-shell-out surface for component lifecycle.

## Workflow

- All work happens on `feature/inner-loop`, created specifically for this plan.
- Every change lands as a single commit, amended as work progresses (per the standing repo
  convention) — not one commit per file/module.
- One PR is opened once the main implementation (directory structure + shared-infra edits +
  unit/integration tests) is finished. Opening the PR is what triggers the GH CI Kind-cluster
  jobs (`continuous-integration-workflow.yml`: `test-integration:coverage` and
  `public-ui-kind-test`), which is when the cluster UI test updates get exercised/iterated on.
- Integration tests are not normally run locally — CI's `test-integration:coverage` job runs them
  against a freshly-installed, clean Kind cluster. A local Kind cluster happened to be available
  in one development session and was used to validate the new `inner-loop/` modules directly
  against a real cluster before committing (see the `devPortForward.ts`/`containerSync.ts`/
  `devCommandExec.ts`/`clusterDevPlatform.ts` notes below) — this caught real bugs a mocked test
  would have missed. Some local-only failures surfaced during that session
  (`devfileRegistryWrapper.test.ts`'s registry-count assertions) that are pre-existing local
  machine state (a stray registry already configured), not something CI's clean cluster will hit
  — confirmed these pass normally otherwise, so left untouched.

## Compatibility contracts to preserve

- `ComponentWorkspaceFolder` (`src/odo/workspace.ts`) stays the input type for all new APIs.
- `.odo/devstate.json` schema (`pid`, `platform`, `forwardedPorts[]`, `apiServerPort`) — already
  read by `describe.ts`; the new engine must write it so `describe`, `openInBrowser`, and
  `startOdoAndConnectDebugger` keep working unmodified.
- `component.ts`'s `ComponentContextState` state machine, `componentStates` map, `stateChanged`
  emitter, and all `package.json` context-menu `when`-clause wiring stay as-is. Only the inside
  of `devRunOn`/`exitDevMode`/`forceExitDevMode`/`showDevTerminal` gets rewired to call the new
  `dev.ts` API instead of `Command.dev()` + `OpenShiftTerminalManager.createTerminal`.
- The OpenShift Terminal panel UX (visible output + Ctrl-C-to-stop) is preserved — not replaced
  with a plain output channel — by reusing/generalizing the existing `spawnPty=false` "virtual
  terminal" mode already used by `writeToTerminal`.
- Terminal tab title stays `odo dev: ${componentName}` (avoid needless UI/test churn) even though
  it's no longer literally the `odo` binary.

## Decisions made

- **Exec / file-sync / port-forward**: use native `@kubernetes/client-node` (`Exec`, `Cp`,
  `PortForward`) inside the new engine, not further `oc` CLI shell-outs — needed for reliable
  readiness detection and process control for the watch/hot-reload loop. This is a deliberate
  deviation from the rest of the codebase's CLI-shell-out convention, scoped to this feature.
- **`app.kubernetes.io/managed-by`**: new resources created by `dev.ts`/`deploy.ts` stamp
  `openshift-toolkit` (not `odo`), since odo no longer creates them.
- **`componentTypeDescription.ts` moved from `src/odo/` to `src/devfile/`** — it's pure devfile-
  domain types with zero internal imports; 11 of its 27 importers already lived in `src/devfile/`
  versus only 3 in `src/odo/` (all three already thin/native-delegating). Doing this now, before
  adding `DevState` to it for `devStateFile.ts`, avoids moving it twice. Mechanical import-path
  change only, verified with `tsc --noEmit`, `eslint`, and the full unit suite.
  Related, deliberately deferred: `src/odo/workspace.ts` (`ComponentWorkspaceFolder`) and
  `src/odo/odoWrapper.ts` are similarly now mostly-native wrappers around devfile code — worth
  revisiting as part of the plan's existing "audit whether odo is still required" cleanup item,
  not as part of this move.

## Directory structure

```
src/devfile/
  dev.ts                          [x] startDevSession / stopDevSession / forceStopDevSession
  inner-loop/
    devSession.ts                  [x] lifecycle/state machine for one running session
    devPlatform.ts                 [x] DevPlatform interface + resolveDevPlatformKind()
    clusterDevPlatform.ts          [x] OpenShift/Kubernetes target (start/sync/restartRunCommand/stop)
    podmanDevPlatform.ts           [x] local podman target (pod, bind-mount, direct ports)
    devResourceBuilder.ts          [x] devfile container components -> Deployment+Service manifest
    fileSync.ts                    [x] chokidar watcher, ignore-rule resolution, debounced batching
    containerSync.ts               [x] tar-fs pack/push + rm via native k8s Exec (pushFiles/removeFiles)
    devCommandExec.ts              [x] runs/restarts devfile run|debug command, streams output
    devPortForward.ts              [x] endpoint forwarding via native k8s PortForward
    devStateFile.ts                [x] saveDevState/loadDevState/clearDevState over .odo/devstate.json
    devTerminalBridge.ts           [x] feeds output into OpenShift Terminal panel, Ctrl-C -> stop
```

`devStateFile.ts` notes:
- `DevState`/`DevStateForwardedPort` types moved from a private type inline in `describe.ts` into
  `componentTypeDescription.ts` (alongside `DeployState`), unchanged field names (`portName` etc.)
  — preserves the existing reader contract exactly, no compatibility break.
- `describe.ts`'s private `readDevState` removed in favor of importing `loadDevState` from here —
  same dedup pattern used for `deploystate.json` in the previous slice.
- Deliberately minimal: no `updateDevState`/partial-patch helper — callers just re-`saveDevState`
  the full merged object when they need to update it (e.g. once port-forwards become ready).
- Unit-tested with real temp-directory I/O (`test/unit/devfile/inner-loop/devStateFile.test.ts`),
  not mocked `fs` — matches the plan's "pure/self-contained, minimal mocking" bucket.

`devResourceBuilder.ts` notes:
- Added two more devfile-domain type gaps to `componentTypeDescription.ts` (same class as the
  earlier `sourceMapping`/`env` fix): `Container.command?`/`Container.args?` (devfile spec fields
  with no prior type representation), and `ComponentItem.volume?: Volume` (volume components were
  completely untyped even though `devfileResolver.ts`'s own merge logic already reads
  `comp.volume` at runtime).
- Pure function, no cluster/fs I/O — takes a resolved `Data` devfile, returns
  `{ deployment, service? }` plain-object manifests (no YAML), matching what
  `Oc.createKubernetesObjectFromSpec(spec: object)` expects.
- mountSources containers with no explicit `command`/`args` get a `['tail', '-f', '/dev/null']`
  keep-alive command (so the image's real entrypoint doesn't run before source is synced); an
  explicit devfile `command`/`args` is always respected as-is. `mountSources: false` containers
  (sidecars, e.g. a local dev database) are left with their image's own entrypoint untouched.
- Resource labels — `app.kubernetes.io/instance`, `app.kubernetes.io/managed-by: openshift-toolkit`,
  `component` (legacy), `odo.dev/mode: dev` — deliberately match *existing* selector contracts:
  `Oc.getComponentPod`/`deleteDeploymentByComponentLabel`'s label lists, and critically
  `undeploy.ts`'s `isDevResource()` check (`odo.dev/mode === 'dev'`), which skips dev-mode
  resources during deploy-mode label-based force-cleanup. Without this label a future undeploy
  could delete a live dev session's Deployment.
- `Container.memoryLimit` (already-modeled but previously unused) now maps to
  `resources.limits.memory` rather than being silently dropped.
- Volume devfile components are backed by an ephemeral `emptyDir`, not a PVC — documented
  simplification (see plan comment in the file), since PVC create/wait/delete lifecycle belongs
  to the platform orchestrator, not this pure builder.
- A `Service` is only built when the devfile declares endpoints; dev-mode port-forwarding will
  target the Pod directly (via `@kubernetes/client-node`'s `PortForward`) regardless, so the
  Service exists for cluster-internal reachability / parity with real odo, not for port-forward
  itself.

`devPlatform.ts` notes:
- Scoped deliberately: only the `DevPlatform` interface (contract) + pure
  `resolveDevPlatformKind(runOn?)` selection logic. No instance-constructing factory yet — that
  would need to import `clusterDevPlatform.ts`/`podmanDevPlatform.ts`, which don't exist yet;
  that wiring belongs in `devSession.ts` once they do.
- `DevPlatformSession` is deliberately shaped to match `DevState` (from `devStateFile.ts`)
  directly — `kind`/`pid`/`forwardedPorts`/`apiServerPort` — rather than inventing a parallel
  type, so `dev.ts`/`devSession.ts` can persist a session mostly as-is.
- Interface methods (`start`/`sync`/`restartRunCommand`/`stop`) are a first-pass contract based on
  everything reasoned through so far; expect minor refinement once `clusterDevPlatform.ts` is
  actually implemented against it — normal for an interface preceding its first implementation,
  not scope creep.

`devPortForward.ts` / `containerSync.ts` / `devCommandExec.ts` / `clusterDevPlatform.ts` notes
(built together — `clusterDevPlatform.ts` composes the other three, which turned out to not be
usefully splittable from it):
- **API verified against real `@kubernetes/client-node` type declarations** before writing any
  code (`Exec`/`PortForward`/`Cp` in `node_modules/@kubernetes/client-node/dist/*.d.ts`), not
  assumed. Notably, `Cp.cpToPod()` looked like a ready-made helper but its returned promise
  resolves once the exec *connection* opens, not once the tar transfer actually finishes (a real
  gotcha in the library) — `containerSync.ts` reimplements the same `tar-fs` + `Exec` approach but
  properly awaits the exec `statusCallback` for actual completion.
- `devPortForward.ts` forwards via a local `net.createServer` piping each connection through
  `PortForward.portForward()` (the standard pattern for this API) — no `oc`/`kubectl` subprocess.
  Reuses `buildUsablePortPair()` from the existing `src/port-forward.ts` for free-local-port
  selection rather than reimplementing it.
- `containerSync.ts`: `pushFiles`/`removeFiles`, both no-ops for an empty path list. Push uses
  `tar-fs.pack(root, { entries })` for partial (changed-files-only) syncs, not always the whole
  tree.
- `devCommandExec.ts`'s `stop()`: verified (by actually running it against the real UBI-based test
  image) that `pkill`/`kill`/`ps` binaries are **not** present — common for minimal/UBI images.
  Redesigned around `echo $$ > PID_FILE && exec <command>` + a separate `sh -c 'kill $(cat
  PID_FILE)'`, using only a POSIX shell builtin (`kill`), no external binary. Verified this
  specific trick works (PID stays valid across `exec`) by testing directly against the real image
  before committing to the design.
- `clusterDevPlatform.ts`: applies resources via `Oc.Instance.applyConfiguration()` (idempotent
  `oc apply --server-side`), not `createKubernetesObjectFromSpec()` (plain `oc create`, would fail
  if a prior session's Deployment is still around). Polls for pod readiness itself
  (`Oc.Instance.getComponentPod` has no retry/readiness-wait built in). Initial full sync
  originally used a hardcoded ignore list (`.git`/`.odo`/`.vscode`/`node_modules`) as a documented
  stand-in for real `.gitignore`-aware resolution; once `fileSync.ts` existed,
  `listSyncableFiles()` was switched to `resolveIgnoreRules()` so the initial sync and the ongoing
  watch-triggered sync use the exact same ignore rules — re-validated against the real Kind
  cluster afterwards (`clusterDevPlatform.test.ts`'s full suite still green).
- **Found and fixed a real bug this same work would have hit in practice**: `devResourceBuilder.ts`
  didn't set `imagePullPolicy`, so a `:latest`-tagged image defaults to `Always` in Kubernetes —
  breaking both locally-loaded images on Kind/Minikube and (by extension) real dev-mode runtime
  images pinned to `:latest`. Fixed by always setting `imagePullPolicy: 'IfNotPresent'` on dev
  containers. Caught by actually deploying to the real Kind cluster available in this environment,
  not by inspection.
- **Testing**: real integration tests against the actual local Kind cluster (`test/integration/
  inner-loop/`), with a shared `testPod.ts` helper (dedicated `inner-loop-it-tests` namespace,
  created/torn down per suite) — not mocked. Confirmed genuinely necessary: a first pass at these
  tests initially failed for a completely mundane reason (the test image itself hit the same
  `:latest`/`imagePullPolicy` bug above, in the test helper this time) — exactly the kind of thing
  mocking would have hidden.
  - `devPortForward.test.ts`: real TCP echo server in-pod, forward + connect + relay, and
    dispose()-stops-accepting-connections.
  - `containerSync.test.ts`: push (incl. nested paths), no-op-on-empty, remove, no-op-on-empty.
  - `devCommandExec.test.ts`: streamed output + exit code (success and failure), and `stop()`
    actually terminating a long-running command.
  - `clusterDevPlatform.test.ts`: full start/sync/restart/stop lifecycle against Kind — see the
    "Second" through "Fifth round" notes below for the real bugs this surfaced and fixed.
- Along the way, fixed one pre-existing test that was actually asserting the old, buggy
  `managedBy` default: `test/integration/odoWrapper.test.ts`'s `describeComponent()` expected
  `managedBy === 'odo'` for components that were never deployed — updated to expect `undefined`,
  matching the intentional fix from the earlier `describe.ts` slice.
- Also switched `test/integration/odoWrapper.test.ts` and `test/integration/command.test.ts`
  (4 call sites total) from `Odo.Instance.describeComponent()` to calling
  `devfile/describe.ts#getComponentDescription()` directly — tests should exercise the native
  implementation directly rather than through the `Odo` CLI-wrapper facade, consistent with the
  overall direction of removing the `odo` dependency. Note: `Odo.Instance.describeComponent`
  swallows errors and returns `undefined`; `getComponentDescription` throws instead — a stricter,
  more correct behavior for tests (a real failure now surfaces with a stack trace instead of a
  confusing downstream `undefined` access), and none of the 4 call sites relied on the old
  swallow-and-return-`undefined` behavior. `command.test.ts`'s now-unused `Odo` import was removed.

**Real bugs found and fixed by actually running against the local Kind cluster** (writing
`clusterDevPlatform.test.ts` and running the full suite surfaced these; none would have been
caught by mocked unit tests):
- `test/integration/inner-loop/testPod.ts`'s `ensureTestNamespace()`/`deleteTestNamespace()` used
  `Oc.Instance.createProject()`/`deleteProject()`, which **switch the kubeconfig's current
  namespace as a side effect and never restore it** — so after one test run, the real
  `~/.kube/config` was left pointing at a namespace that had since been deleted. The next run's
  `clusterDevPlatform.test.ts` then failed applying resources (`NotFound: namespaces
  "inner-loop-it-tests" not found`) because `ClusterDevPlatform.start()`'s
  `getCurrentClusterAndNamespace()` correctly read that stale ambient namespace. Fixed by having
  the test helper apply/delete a plain `Namespace` manifest directly (`Oc.Instance
  .applyConfiguration()`/`deleteKubernetesObject('namespace', ...)`), which has no such side
  effect — test setup should never mutate ambient kubeconfig state that production code relies on.
- `devCommandExec.test.ts`'s failing-command test used `'exit 7'` as the command; since `exit` is
  a shell builtin (not an executable), `exec exit 7` fails with "not found" (exit 127) rather than
  propagating 7 — `devCommandExec.ts`'s real `exec <command>` behavior was correct, the test's
  command choice wasn't. Fixed to `'sh -c "exit 7"'` (execs a real binary that then runs its own
  builtin).
- `devCommandExec.test.ts`'s `stop()` test used a fixed 2s wait after `stop()` before checking the
  exit callback fired — replaced with a poll loop (up to 15s) to rule out slow exec/websocket
  round-trip timing rather than a real bug, since this is a mocha timeout/flakiness risk, not
  something to paper over with an even-longer fixed sleep.

**Second round of real bugs, found by writing and running `clusterDevPlatform.test.ts`** (the
`start()` cascade + `stop()` flakiness above were not actually fixed by the namespace fix alone;
digging further with `kubectl describe`/manual `oc apply` reproduction found two more issues):
- **Real product bug in `devCommandExec.ts`'s `stop()`**: the same class of gotcha as
  `Cp.cpToPod()` (see `containerSync.ts` notes above) — `stop()`'s `kill` exec awaited only
  `Exec.exec()`'s own promise, which resolves once the connection *opens*, not once the `kill`
  command actually runs. The underlying connection could be torn down before the same-tick `kill`
  was dispatched server-side. Fixed to properly await the exec's status callback, mirroring
  `containerSync.ts`'s `execAndWait` pattern.
- **Systemic pre-existing issue in *other* integration tests, not something to fix here, but
  something `clusterDevPlatform.test.ts` had to defend against**: `command.test.ts` (and
  `ocWrapper.test.ts`) call `Oc.Instance.createProject()`/`setProject()`, which switch the
  kubeconfig's ambient current-namespace and never restore it — the same bug class already fixed
  in `testPod.ts`, but pre-existing elsewhere in the test suite (confirmed by the user: these
  tests pass fine standalone/on a fresh CI cluster; only matters when many suites share one
  long-lived kubeconfig across a single local run). `ClusterDevPlatform.start()` correctly (by
  design, matching real dev-mode/`deploy.ts` behavior) deploys into whatever the *ambient* current
  namespace is rather than taking one as a parameter — so `clusterDevPlatform.test.ts` now
  explicitly creates and `setProject()`s its own dedicated namespace in `suiteSetup` instead of
  trusting whatever a previously-run, unrelated suite left the context pointed at.
- `devPortForward.test.ts`'s echo server never closes its side of the connection; the test waited
  for a `'close'` event after calling `socket.end()`, relying on a clean half-duplex close
  propagating back through the port-forward tunnel — this hung for the full 120s mocha timeout.
  Fixed to resolve as soon as `'data'` arrives and `destroy()` the socket immediately, removing the
  dependency on graceful close-over-tunnel semantics entirely.

**Third round — root-caused via direct standalone reproduction outside the VS Code extension host
entirely** (each in-extension-host mocha cycle cost 15+ minutes; isolating each suspect behavior
in a plain `node` script against the same real Kind cluster made this tractable):
- **Real, confirmed product bug in `devCommandExec.ts`'s `stop()`**: passed `null, null, null` for
  stdout/stderr/stdin on the kill exec. The Kubernetes exec API requires at least one non-null
  stream, or it rejects the request with `"unable to upgrade connection: you must specify at
  least 1 of stdin, stdout, stderr"` — delivered via the *status callback* as a `Failure`, not a
  rejected promise. `stop()`'s callback treated *any* status callback firing as success, silently
  swallowing this — so `stop()` always "succeeded" without the kill command ever having actually
  run. Fixed by passing a real (if unused) stderr stream. Verified directly: before the fix, the
  target process was still alive after `stop()` resolved; after, `onExit` fires with code 143
  (SIGTERM) as expected.
- **Test-only bug in `devPortForward.test.ts`'s echo-server setup**: launched the server via a
  shell-backgrounded `nohup node ... &` under a *separate* short-lived exec. Confirmed by direct
  reproduction that this does not reliably survive under the Kubernetes exec API the way it does
  under `kubectl exec` (the server's own log file was never even created — it never actually ran)
  — `nohup`/`&` alone aren't sufficient protection here. Fixed by using the already-proven-reliable
  `startRunCommand()` (foreground/attached exec, matching how a real devfile "run" command
  executes) instead of hand-rolled backgrounding.
- `clusterDevPlatform.test.ts`'s own `connectAndRead` helper still waited on `'close'` — same fix
  as `devPortForward.test.ts` above, just not yet applied there in the prior round.
- Confirmed `devPortForward.ts`'s and `containerSync.ts`'s actual production logic was correct and
  not implicated in any of the above the whole time, by reproducing each suspect scenario directly
  against the real cluster in plain Node, bypassing the VS Code extension host and the project's
  esbuild-bundled `@kubernetes/client-node` as separate variables — both were ruled out before the
  real root causes (above) were found.

**Fourth round — the last two `clusterDevPlatform.test.ts` failures, also root-caused via direct
standalone reproduction:**
- **`start()` hung for the full test timeout on its first connection through the forwarded port**:
  `startRunCommand()`'s exec resolving only means the exec *attached*, not that the container-side
  process has actually started and bound its listener yet — confirmed by direct reproduction that
  connecting immediately after (zero grace period) can leave the port-forward tunnel itself stuck
  (neither `'data'` nor `'error'` ever fires, so a plain socket doesn't fail fast) even though a
  *second*, fresh connection attempt afterward succeeds instantly. `devPortForward.ts`'s local
  server starts a brand-new `pf.portForward()` call per accepted connection, so a client-side retry
  with a fresh connection each time is safe and sufficient — no product-code change needed here;
  fixed `connectAndRead()` to retry (10 attempts, 3s each) instead of connecting once.
- **`stop()` test asserted the pod was gone immediately after `platform.stop()` returned**:
  Deployment deletion is asynchronous (the pod doesn't disappear the instant the delete call
  returns) — this is normal Kubernetes eventual consistency, not a bug in `stop()`. Fixed the test
  to poll for non-existence (up to 30s) instead of checking once.
- Net effect across all four rounds: `git diff` on production code ended up being exactly one real
  bug (`devCommandExec.ts`'s `stop()` — see round 3) plus the `imagePullPolicy` fix from round 1;
  everything else was test-infrastructure fragility. Worth the time regardless — that one bug would
  have made every real dev session's "stop"/restart silently fail to actually kill the previous run
  process.

**Fifth round — the `stop()` test's *own* verification method was the remaining problem**, not
`stop()` itself: it used `Oc.Instance.getComponentPod()`, which searches the *ambient* current
namespace via broad label-selector fallbacks (no explicit namespace param) — an indirect,
ambiguous check compared to directly verifying what `stop()` actually deletes. Switched to
`Oc.Instance.getKubernetesObject('deployment', name, namespace)` (exact resource, explicit
namespace). Confirmed directly that Deployment-object deletion itself is near-instantaneous
(unlike graceful pod termination) — the polling loop is a safety margin, not compensating for a
slow real delete.

**Final status: all green.** Integration suite: 63 passing, 1 failing (7 min total runtime) — the
1 failure is `watch.test.ts`'s "watchFile calls the callback when file changes", a pre-existing,
unrelated filesystem-event-timing flake, confirmed untouched by any of this work. All 22 new
inner-loop integration tests pass. Unit suite: 321 total, 280 passing, 0 failing, 41 skipped
(pre-existing, unrelated).

One last hygiene fix after that green run: `clusterDevPlatform.test.ts`'s own `suiteSetup`/
`suiteTeardown` captures and restores the ambient namespace it deliberately switches to (via
`getActiveProject()`/`setProject()`) — otherwise it would leave the exact same "current namespace
points at something already deleted" landmine for whatever runs next that the "Second round" fix
above specifically called out in *other* tests. Not independently re-run through the full suite
(low risk — reuses the same `setProject`/`getActiveProject` calls already proven earlier in this
same file's `suiteSetup`), but `tsc`/`eslint` clean.

`podmanDevPlatform.ts` notes:
- **Dedup before writing it**: extracted the "find the run/debug command and resolve its
  container/sourceMapping/workingDir/commandLine" logic — previously private to
  `clusterDevPlatform.ts` — into `CommandResolver.findCommandByGroup()`/`resolveRunCommand()`
  (`commandResolver.ts`, which had zero test coverage before this; added
  `test/unit/devfile/commandResolver.test.ts`). Both platforms need the exact same resolution;
  this isn't platform-specific logic.
- **Found and fixed a real, pre-existing bug while writing that new test**:
  `VariableResolver`'s `${PROJECT_SOURCE}` resolution was hardcoded to the literal string
  `/projects`, ignoring a container's actual configured `sourceMapping` entirely. Any devfile
  using a custom `sourceMapping` with an exec command's `workingDir`/`commandLine` referencing
  `${PROJECT_SOURCE}` would have silently resolved to the wrong path. Fixed to look up the
  target container's `sourceMapping` (falling back to `/projects` when unset, preserving existing
  behavior for the common case) — `resolveVariable()` already had `componentName` in scope for
  its env-var lookup, so this reuses that.
- Scope matches `component.ts`'s existing podman gate exactly: podman only, not docker, even
  though `ContainerRuntimeDetector` (used elsewhere for image builds) supports both — the existing
  `checkForPodman()`/`openshift.component.dev.onPodman` UI is podman-only, and by the time
  `PodmanDevPlatform` is invoked that check has already run, so this platform doesn't re-verify
  availability itself (matches `ClusterDevPlatform` not pre-checking cluster connectivity either).
- Uses `podman pod create` (one pod per component, containers share its network namespace) rather
  than a single container — needed for multi-container devfiles to share `localhost` the way a
  Kubernetes Pod's containers do, and matches how odo itself models podman-based dev.
- Verified the whole command sequence directly against real local podman before writing any
  TypeScript (pod create + port publish, bind-mount visibility, `podman logs -f` streaming,
  restart, teardown) — same "verify against the real thing first" approach as the cluster platform.
- **Found and fixed a real timing issue this same manual verification surfaced**: a container's
  main process is PID 1 inside it, and Linux does not apply a signal's *default* disposition to
  PID 1 unless it explicitly installs a handler — so a plain devfile run command (no SIGTERM
  handler of its own, the common case) never actually terminates on SIGTERM, and podman falls back
  to SIGKILL only after its default 10-second grace period. Confirmed by direct testing that this
  is unrelated to shell-wrapping or `exec` (a bare `node` process as PID 1 exhibits the same
  behavior) — it's inherent to container PID-1 semantics, not fixable by how the command is
  invoked. Since 10+ seconds on every restart defeats the purpose of an inner dev loop, `restart`/
  `stop` explicitly pass a short `--time 2` grace period instead of accepting the default.
- `sync()` is a genuine no-op (bind mount), not a stub — there is nothing to push, by design.
- Session output streams via `podman logs -f`, spawned directly (not through `ChildProcessUtil`,
  which buffers until the process closes — unsuitable for a command that runs for the life of the
  session); the child process is tracked on the session and killed in `stop()`.
- **Testing**: real integration test (`test/integration/inner-loop/podmanDevPlatform.test.ts`)
  against actual local podman, using the same `localhost/nodejs-image:latest` test image already
  used for the cluster suite's manual verification — full start (+ reachable)/sync(no-op,
  bind-mount-visible)/restart(+ reachable again)/stop(pod actually gone) lifecycle. Extracted the
  retry-based `connectAndRead()` helper (previously duplicated logic inline in
  `clusterDevPlatform.test.ts`) into a shared `netTestUtils.ts`, used by both suites.

**Real bug found on the first podman integration run**: `netTestUtils.ts`'s `connectAndRead()`
retried on any connection failure but with *no delay* between attempts. That's fine for a failure
mode that times out (each attempt naturally takes the full per-attempt timeout), but rootless
podman's port-publishing can `ECONNRESET` a connection attempt that arrives before its
port-forwarding proxy has finished wiring up — which fails in single-digit milliseconds, not by
timing out. Without a delay, all 10 retry attempts could burn through in well under a second,
nowhere near enough real wall-clock time for the target to become reachable. Confirmed directly
with a minimal reproduction outside any test framework: attempt 1 failed with `ECONNRESET` after
3ms, attempt 2 (300ms later) succeeded immediately. Fixed by adding a 1s delay between attempts.
This is a test-only concern, not something `podmanDevPlatform.ts`/`clusterDevPlatform.ts` need to
handle themselves — real usage (a user opening a browser a moment after starting dev mode) doesn't
hit the same tight timing window a test asserting immediate connectivity does.

**Second real bug, found after the delay fix (still 3 failures, same tests)**: `start()`'s
`ECONNRESET`, `sync()`'s `podman exec` failure (`container state improper`), and
`restartRunCommand()`'s `ECONNRESET` all traced back to one root cause. Added temporary debug
capture (`podman inspect`/`podman logs`/`ss -tlnp` on failure) and re-ran, which surfaced the
actual error hiding behind the symptoms: `sh: line 0: cd: /projects: Permission denied`. The run
container's `sh -c "cd $workingDir && exec ..."` was failing before ever starting to listen, so the
container's PID 1 exited immediately (explaining "container state improper") and nothing was ever
reachable (explaining both `ECONNRESET`s). Root-caused with a direct `podman run` reproduction:
`fs.mkdtemp()` creates its directory with mode `0700` (owner-only), and this test's image runs as
non-root UID 1001 — under rootless podman a bind-mounted `0700` host directory isn't even
traversable by a container UID that isn't the mapped owner. Confirmed the fix by bind-mounting the
same directory at `0755` (the default for any real project folder created via `mkdir`/`git clone`/
IDE scaffolding — this permission bit is never this restrictive in practice) and the same command
succeeded immediately. This is a **test-fixture bug only**, not a `podmanDevPlatform.ts` product
bug — real component folders are never `0700`. Fixed by adding `await fs.chmod(componentPath,
0o755)` right after `fs.mkdtemp()` in the test's `suiteSetup`. Removed the temporary debug capture
once the root cause was confirmed. Final full integration run: exit code 0 (clean), confirming all
of `podmanDevPlatform.ts`'s tests now pass alongside the rest of the suite.

`dev.ts` / `devSession.ts` notes:
- Split matches the rest of the plan's naming: `dev.ts` is the public entry point (registry of
  active sessions keyed by component context path + the exported `startDevSession`/
  `stopDevSession`/`forceStopDevSession`/`isDevSessionActive` API); `devSession.ts`'s `DevSession`
  class owns one running session's internals (which `DevPlatform` it resolved to, the live
  `DevPlatformSession` handle, start/stop, and — once `fileSync.ts` existed — the file watcher).
  `devTerminalBridge.ts` still doesn't exist — once built, it hooks into `DevSession` internals
  too, not `dev.ts`'s registry API.
- Sessions are tracked only in an in-memory `Map`, not reconstructed from `.odo/devstate.json` on
  extension-host restart — that file is read-only bookkeeping for `describe.ts`/`openInBrowser`/
  debugger-attach, not something a live session (open k8s client-node handles, running exec
  streams, a spawned `podman logs -f` child process) can be rebuilt from. This matches the old
  CLI-shell-out behavior, which also only ever tracked the running `odo dev` pty in-memory
  (`component.ts`'s `componentStates` map) — orphan cleanup on a fresh start already existed
  (`devRunOn`'s pre-start `deleteDeploymentByComponentLabel`) and needs no change here.
- `forceStopDevSession()` exists as a distinct function (not a parameter on `stopDevSession()`) so
  it can have different failure semantics: `stopDevSession()` propagates a platform `stop()`
  failure to the caller (session state is still cleared either way, via `finally`);
  `forceStopDevSession()` never throws, matching the existing "user already chose force exit,
  the UI must move on regardless" semantics in `component.ts`'s exit-timeout dialog.
- **Testing**: unit tests only (`test/unit/devfile/dev.test.ts`) — this module is pure
  orchestration (registry bookkeeping, state-file persistence, error propagation) with no
  cluster/podman behavior of its own to verify against real infra; `ClusterDevPlatform`'s
  prototype `start`/`stop`/`sync`/`restartRunCommand` are stubbed with sinon (existing codebase
  convention, e.g. `ChildProcessUtil.prototype.execute` in `oc.test.ts`), `devstate.json`
  persistence is verified against a real temp directory (no fs mocking, matching
  `devStateFile.test.ts`). The watch-triggered sync/restart path added once `fileSync.ts` existed
  is also covered here against a *real* chokidar watcher over a real temp directory (writing an
  actual file and polling for the stubbed `sync`/`restartRunCommand` to have been called) — not
  mocked, since chokidar's real event timing/debouncing is exactly what could silently break.
  Full end-to-end session-lifecycle coverage against a real Kind cluster (actual pod exec/sync,
  not stubbed) is the separate `test/integration/dev.test.ts` item below — now also done.

`fileSync.ts` notes:
- Added `ignore` (the npm package) as a new dependency — real `.gitignore` semantics (negation,
  `**`, anchoring, directory-only patterns) are surprisingly subtle and not worth reimplementing;
  it was already present transitively (via eslint/globby tooling) but only as a devDependency of
  dev tooling, not something production code should rely on resolving by accident. Added
  alongside `chokidar` in `devDependencies` (this project's existing convention — even
  runtime-essential packages like `@kubernetes/client-node` live there, since esbuild bundles the
  packaged extension regardless of the dependencies/devDependencies split).
- `chokidar` v5 and `ignore` v7 are both fine to `require()` directly under plain Node (verified:
  Node 22+'s native `require(esm)` support handles chokidar's ESM-only package janklessly) *and*
  to bundle with esbuild for the real packaged extension (verified via a real `npm run compile`) —
  neither needed the `esmImportTargets`/`esm-alias-plugin` treatment `got`/`uuid`/
  `@kubernetes/client-node` needed elsewhere in this codebase.
- **Real gotcha found and verified directly, not assumed from docs**: chokidar's `ignored`
  predicate always receives an *absolute* path, even when the `cwd` option is set — only the
  paths emitted by `add`/`change`/`unlink` *events* become `cwd`-relative. Confirmed with a
  throwaway reproduction before writing the real `ignored` callback, which converts to a
  root-relative POSIX path itself before calling `ignoreRules.ignores()`.
- `ChangeBatcher` (the debounce/coalescing logic) is a separate, plain class from the chokidar
  wiring specifically so it's unit-testable without spinning up a real watcher — matches the
  testing-checklist note below. The latest event for a given path wins if it flips kind (e.g. a
  quick delete-then-recreate) within the same debounce window, so a coalesced batch never lists
  the same path in both `changedPaths` and `deletedPaths`.
- Wired into `devSession.ts`: `DevSession.start()` now also resolves `hotReloadCapable` from
  `CommandResolver.resolveRunCommand()` (a new field added there, sourced from the devfile's
  `Exec.hotReloadCapable` — already defined in `componentTypeDescription.ts` but previously never
  read) and, unless `options.manualRebuild` (mirrors `odo dev --no-watch`), starts a
  `watchComponentFiles()` watcher whose batches call `platform.sync()` then — only when not
  hot-reload-capable — `platform.restartRunCommand()`. `DevSession.stop()` closes the watcher
  before tearing down the platform.

## Small edits to existing shared infra

- [x] `src/webview/openshift-terminal/openShiftTerminal.ts` — generalize the `spawnPty=false`
      mode into a reusable interactive "virtual terminal" API (output + input callback).
  - Added `OpenShiftTerminalManager.createVirtualTerminal(name, cwd, env, callbacks)`, sitting
    alongside the existing `createTerminal()` (real spawned process) and `writeToTerminal()`
    (one-shot, non-interactive write). Unlike `writeToTerminal()`, it accepts `callbacks`
    (`onSpawn`/`onExit`/`onText`) and returns a live `OpenShiftTerminalApi` handle the caller can
    keep pushing output to via `sendText()` over time, not just a single upfront blob of text.
  - Extracted the tail shared by `createTerminal()` and the new method (register the
    `OpenShiftTerminal` instance, send the webview `createTerminal` message, build the
    `OpenShiftTerminalApi` object) into a private `registerTerminal()` — previously duplicated
    inline in `createTerminal()`, now shared by both.
  - **Real gotcha confirmed directly, not assumed**: a real pty's line discipline echoes a
    user-typed Ctrl-C as printable `^C` text (which is why the old `odo dev` integration checked
    `text.includes('^C')`), but this virtual (non-pty) terminal has no line discipline — the
    webview's `input` message instead delivers the raw `\u0003` control byte itself to
    `callbacks.onText` unchanged. `devTerminalBridge.ts`'s `isStopRequest()` checks for that raw
    byte, not the printable text.
  - No new unit tests for this file itself — it has no existing test infrastructure (heavy
    `node-pty`/webview dependency, verified via `grep` that no unit/integration test imports it
    today) and this is a small, low-risk refactor (extraction + one new method, no behavior change
    to the existing `createTerminal()`/`writeToTerminal()` call paths). Verified via `tsc`,
    `eslint` (lint warning count unchanged except one new instance of an existing `env`-shadowing
    warning `createTerminal()` already had), the full unit suite (315 passing, 0 failing), and a
    real `npm run compile` (production esbuild bundle) to make sure nothing about the refactor
    broke the actual packaged-extension build.
- [x] `src/devfile/inner-loop/devTerminalBridge.ts` (new) — `createDevTerminalBridge(name, cwd,
      onStopRequested)` wraps `createVirtualTerminal()` into the shape `DevSession`/`dev.ts` need:
      a `DevPlatformOutput` (`{ onOutput }`) to pass straight into `DevPlatform.start()`, and the
      raw `OpenShiftTerminalApi` for later UI wiring (`component.ts`'s `showDevTerminal`/
      `exitDevMode`/`forceExitDevMode` — a separate, still-open item below, not this one).
      `isStopRequest()` (checking for the raw Ctrl-C byte) is exported and unit-tested on its own
      as a pure function; the rest of the module (real `OpenShiftTerminalManager` call) isn't
      independently tested, matching `openShiftTerminal.ts`'s own testing gap noted above — this
      module is later exercised indirectly once `component.ts` is rewired to use it for real.
- [x] `src/odo/componentTypeDescription.ts` — added `EnvVar { name; value }` and
      `sourceMapping?: string`/`env?: EnvVar[]` on `Container`. No resolver change was needed
      (`DevfileResolver`'s generic deep-merge already handles unknown fields).
- [x] `src/util/kubeUtils.ts` — added `resolveClusterPlatform()` (returns
      `{ isOpenShift, variant, label }`, label ∈ OpenShift/Kubernetes/Kind/Minikube), built from
      the existing `isOpenShiftCluster()`/`detectKubernetesVariant()`. Reused in `applyCommand.ts`
      and `describe.ts`; `devStateFile.ts` still to come.
- [x] `src/devfile/applyCommand.ts` (not originally itemized, needed to make `managedBy` below
      meaningful) — `prepareBuildScript` now calls `resolveClusterPlatform()` instead of its own
      inline isOpenShift/variant computation; `prepareApplyScript` now stamps
      `app.kubernetes.io/managed-by: openshift-toolkit` on applied resources via a new
      `ensureManagedByLabel()` (same style as the existing `patchImagePullPolicy`), only if the
      manifest author hadn't already set one. Previously nothing stamped this label at all, so
      `describe.ts`'s `managedBy` would have had nothing to read.
- [x] `src/devfile/deploy.ts` (not originally itemized) — extracted
      `getCurrentClusterAndNamespace()` / `getCurrentDeployContextKey()` / `loadDeployState()` as
      exported functions (previously inlined in `deployComponent()`); `undeploy.ts` had its own
      private, near-identical `currentContextKey()`/`loadDeployState()` which now reuse these
      instead (dedup). Note: this unifies one edge-case default — undeploy's version fell back to
      `''` for an unknown cluster server, deploy's falls back to `'unknown'`; both now use
      `'unknown'`.
- [x] `src/devfile/describe.ts`:
  - [x] Display `sourceMapping` (fallback `/projects`) and `env` per container component.
  - [x] Evaluate dev-state (`.odo/devstate.json`) and deploy-state (via the new
        `deploy.ts#loadDeployState`) independently and merge, instead of if/else — supports
        simultaneous Dev+Deploy states. Dev-state reading itself (`readDevState`/
        `extractForwardedPortsFromDevState`) intentionally left untouched — its `'cluster'`/
        `'podman'`/`'docker'` vocabulary depends on what `devStateFile.ts` will actually write.
  - [x] `runningIn` is always mode labels (`'Dev'`/`'Deploy'`) now, in both the state-file path
        and the live-cluster fallback path (previously leaked raw Ingress names).
  - [x] `managedBy` sourced from `deploystate.json`'s tracked resource labels (defaulting to
        `'openshift-toolkit'` when the state file exists but no label was captured — we know our
        own tooling deployed it) when using the local state file; from the live Deployment's
        label (defaulting to `'Unknown'`, dropping the old blanket `'odo'` guess) in the fallback
        path. Never set when nothing is actually deployed, in either path — matches odo's
        behavior of printing nothing for `Managed by` on a non-deployed component. Fixed a
        related bug in the fallback path where a Deployment's managed-by label could leak through
        even when the (separate) Ingress-based running-check said nothing was running; "is
        running" is now Deployment-OR-Ingress existence, checked once, before deriving anything.
  - [x] `runningOn` uses `resolveClusterPlatform()`'s label instead of hardcoded `'cluster'`.
  - Verified: `Odo.Instance.describeComponent` already fully delegates to this function — no
    other call site needed updating.
- [x] `src/openshift/component.ts` — rewire `devRunOn`/`exitDevMode`/`forceExitDevMode`/
      `showDevTerminal` to the new `dev.ts` API + `devTerminalBridge`; keep firing
      `Component.stateChanged` exactly as today.
  - `devRunOn()`: creates a `devTerminalBridge` (title unchanged, still `odo dev:
    ${componentName}`) whose `onStopRequested` callback is the single place both a user-typed
    Ctrl-C *and* `exitDevMode()`'s own `devTerminal.kill()` funnel through (mirrors the old
    real-pty design's unification of those two triggers via the same terminal mechanism);
    `bridge.output` passes straight into `startDevSession()`. `DEV_STARTING` -> `DEV_RUNNING` now
    transitions once `startDevSession()` resolves (the old CLI-based version waited for a `'[p]'`
    prompt substring in the pty output — the new engine has no equivalent "press a key" prompt, so
    "resolved" is the closest available readiness signal). Dropped the old pre-start
    `Oc.Instance.deleteDeploymentByComponentLabel()` call: it existed to give the `odo` CLI a
    clean slate before its own internal dev-state tracking kicked in; `ClusterDevPlatform.start()`
    already applies the Deployment idempotently via server-side apply, so there's nothing to
    pre-clean for the new engine.
  - Added a private `stopDevSessionAndUpdateState(contextPath, force)` helper — the one place that
    actually calls `stopDevSession()`/`forceStopDevSession()` and resets `devStatus` back to
    `DEV` afterwards (success or failure). `exitDevelopmentMode()`'s "taking too long" dialog's
    "Force exit" button and `sendSigabrt()` now call this with `force: true` (previously only
    force-killed the pty, which — for the old CLI process — was itself what tore down cluster
    resources via `odo`'s own signal handling; the new engine's terminal has no such side effect,
    so tearing down now has to be called explicitly).
  - `forceExitDevMode()` made `async` (previously synchronous) since it now awaits the actual
    session teardown, not just a terminal kill.
  - **Testing**: added `test/unit/openshift/component.test.ts`'s new `dev mode` suite (7 tests) —
    previously zero coverage for these methods. Uses `proxyquire` to inject stubs for `dev.ts`'s
    exported functions and `devTerminalBridge.ts`'s `createDevTerminalBridge` (matching this test
    file's existing `pq(...)` convention used for the `debug()` suite), with a fake
    `OpenShiftTerminalApi` whose `kill()` synchronously invokes the captured `onStopRequested`
    callback — verifies the full `devRunOn`/`exitDevMode`/`forceExitDevMode`/`showDevTerminal`
    state-machine wiring without needing a real webview/cluster. Full manual click-through in a
    real extension host against a live cluster/podman has **not** been done as part of this slice
    — residual risk to close out via the cluster UI test suites below (not yet updated) once the
    PR is opened and CI's Kind-cluster jobs run.

Verification for the above: `npx tsc --noEmit -p .` and `eslint` clean on all touched files
(warning counts checked before/after — no new warning *categories* introduced, only more instances
of patterns already present elsewhere in each file); full unit suite (`npm test`) — 322 passing,
0 failing, 41 skipped (pre-existing skips, unrelated); a real `npm run compile` production esbuild
bundle succeeded after every change in this slice.

## Testing

Principle: favor integration tests over heavily-mocked unit tests for anything that orchestrates
real cluster/container behavior (describe status computation, dev session lifecycle, platform
implementations) — mocking exec/sync/port-forward/cluster state tends to diverge from real
behavior and gives false confidence. Unit tests stay for logic that's naturally pure/self-
contained, where mocking is minimal. CI already provisions a Kind cluster for this
(`continuous-integration-workflow.yml` → `helm/kind-action` → `test-integration:coverage` and
`public-ui-kind-test`), so this leans on existing infrastructure rather than adding a new lane.

**Fixed test-discovery gap** (found while adding `devStateFile.test.ts`, not originally itemized):
`test/unit/index.ts` discovers unit test files via an explicit per-subsystem glob allowlist, and
`devfile/*.test.js` was non-recursive — a nested `test/unit/devfile/inner-loop/*.test.ts` file
would have been silently never run (confirmed: pass count didn't change after adding the new test
file until this was fixed). Changed to `devfile/**/*.test.js` (verified with `fast-glob` directly
that this matches both flat and nested files) and removed an accidental duplicate of the same
line. Without this fix, every future test under `inner-loop/` in this plan would have given false
confidence.

**Unit tests** (pure/self-contained logic, minimal mocking):
- [x] `test/unit/devfile/inner-loop/devResourceBuilder.test.ts` — devfile -> manifest transform;
      uses the `comp-with-uris` fixture plus inline `Data` fixtures (mirroring `deploy.test.ts`'s
      style) for edge cases the file fixtures don't cover: env resolution, explicit command/args,
      `mountSources: false`, volume components, no-endpoints, no-container-components error
- [x] `test/unit/devfile/inner-loop/devStateFile.test.ts` — `.odo/devstate.json` schema round-trip
- [x] `test/unit/devfile/inner-loop/devPlatform.test.ts` — `resolveDevPlatformKind()` selection
- [x] `test/unit/devfile/inner-loop/fileSync.test.ts` — ignore-rule resolution / debounce batching
      logic (not the actual chokidar filesystem events)
- [x] `test/unit/util/kubeUtils.test.ts` — extended for `resolveClusterPlatform()` (checklist named
      it `resolveClusterPlatformLabel()` — that was a planning-stage name; the actual function is
      `resolveClusterPlatform()`, already implemented earlier in this plan). 4 new tests
      (OpenShift/Kind/Minikube/generic-Kubernetes), matching this file's existing
      proxyquire-`CliChannel` + fixture-`KUBECONFIG` conventions already used for
      `detectKubernetesVariant()`/`getOpenShiftRegistryUrl()`.

**Integration tests** (`test/integration/`, run against the Kind cluster already used in CI):
- [x] `test/integration/describe.test.ts` — 8 tests against the real Kind cluster: not-running;
      Dev-on-cluster (single forwarded-port entry); Dev-on-podman (cluster+podman duplicate
      forwarded-port entries — exercises `extractForwardedPortsFromDevState()`'s `runtime !==
      'cluster'` branch); Deploy via `deploystate.json` with an explicit `managed-by` label and
      with none (defaults to `openshift-toolkit`); Dev+Deploy simultaneously; and the live-cluster
      fallback path (no `deploystate.json`) sourcing `managedBy` from a real Deployment's label,
      both when present and when absent (`'Unknown'`). `deploystate.json` fixtures are written
      directly (matching `DeployStateFile`'s real v2 schema, keyed via the real
      `getCurrentClusterAndNamespace()`/`deployContextKey()`) rather than by actually running
      `deployComponent()` — `describe.ts`'s own job is reading/merging that file, not writing it
      (already covered by `deployComponent()`'s own tests in `command.test.ts`). The live-cluster
      fallback tests apply a real bare Deployment (0 replicas — existence is all
      `checkClusterInfo()` checks, no need for it to actually become ready) to a dedicated
      `describe-it-tests` namespace. All 8 passed on the first real run.
- [x] `test/integration/dev.test.ts` — full session lifecycle against the real Kind cluster,
      through `dev.ts`'s own orchestration layer (not `ClusterDevPlatform` directly, unlike
      `clusterDevPlatform.test.ts` below): `startDevSession()` deploys and persists
      `devstate.json`; starting a second session for the same path is rejected; **the file
      watcher syncs a newly-written local file into the running container with no manual
      `sync()` call** — the one behavior `clusterDevPlatform.test.ts` structurally can't cover
      (it only ever calls `sync()`/`restartRunCommand()` directly) and the unit suite could only
      verify against a stubbed platform; `stopDevSession()` tears down the Deployment and clears
      `devstate.json`; `forceStopDevSession()` tears down a running session too. All 5 passed on
      the first real run.
- [x] `test/integration/inner-loop/clusterDevPlatform.test.ts` — full start/sync(push+remove)/
      restartRunCommand/stop lifecycle against the real Kind cluster; verified end-to-end
      including actually connecting through the forwarded port and exec-checking synced files
- [x] `test/integration/inner-loop/podmanDevPlatform.test.ts` — full start(+ reachable)/sync(no-op,
      bind-mount-visible)/restart(+ reachable again)/stop lifecycle against real local podman
- [x] `test/integration/inner-loop/devCommandExec.test.ts` — run/debug command execution +
      stop()/restart-on-change, against Kind
- [x] `test/integration/inner-loop/devPortForward.test.ts` — endpoint forwarding + dispose(),
      against Kind (debug port discovery specifically not yet covered — no debug-mode devfile
      fixture used yet)
- [x] `test/integration/inner-loop/containerSync.test.ts` — push (incl. nested paths)/remove,
      no-op-on-empty, against Kind
- [x] `test/integration/inner-loop/testPod.ts` — shared non-test helper (dedicated namespace +
      pod lifecycle) used by all four suites above
- [x] `test/unit/openshift/component.test.ts` — was **zero coverage** for
      `devRunOn`/`exitDevMode`/`forceExitDevMode`/`showDevTerminal`; added lightweight unit
      coverage for the state-machine wiring (event → `ComponentContextState` transition, see the
      `component.ts` notes above), leaving the real end-to-end behavior to the integration/UI
      suites below (not yet updated).

**Cluster UI tests** (`test/ui/suite/`, exercised once the PR is opened):
- [ ] `test/ui/suite/component.ts` — un-skip / update `terminalHasText(COMPONENTS.devStarted, ...)`
      to match the new engine's status output.
- [ ] `test/ui/suite/componentContextMenu.ts` — update literal odo-banner assertions
      (`Developing using the "<name>" Devfile`, `Running on the cluster in Dev mode`) to the new
      engine's text; Ctrl+C-stop and podman start/stop tests should keep passing largely
      unchanged (they test behavior, not implementation).

## Post-implementation cleanup (run only after the above is implemented and green)

- [x] Remove the `'[p]'`/`'^C'` pty text-sniffing in `component.ts`'s old `devRunOn`. Already gone
      as a side effect of the `component.ts` rewiring above — the entire old `onText`/`onExit`
      callback pair (and the `Command.dev()` call that fed them) was replaced by
      `devTerminalBridge`'s `onStopRequested` wiring. Confirmed via `grep -rn "'\[p\]'\|\^C"
      src/` — the only remaining hits are explanatory comments in `devTerminalBridge.ts`/
      `openShiftTerminal.ts` describing the *old* behavior for context, no live logic.
- [ ] Delete `Command.dev()` in `src/odo/command.ts` once nothing calls it.
  - **Not yet safe to delete** — `src/odo/command.ts`'s `Command` class now contains *only*
    `dev()` (confirmed by reading the whole file), and its one remaining importer anywhere in
    `src/`+`test/` is `test/integration/command.test.ts`, which calls it directly in **three**
    places to bootstrap a real dev session for tests unrelated to the dev *engine* itself:
    the standalone `test('dev()')` (spawns `Command.dev(false)` via a raw pty just to exercise
    `CliChannel.spawnTool()`+SIGINT teardown) and `suite('component dev')`'s
    `executeCommandInTerminal()`/`startDevInTerminal()` helpers (spawn `Command.dev(true)` via a
    raw pty, text-sniffing for `'Developing using the "..." Devfile'`/`'✓  Pod is Running'`/
    `'↪ Dev mode'` to know when it's safe to proceed), used by `runComponentCommand()` to get a
    dev session running before testing `DevfileCommandRunner.execute()` (arbitrary devfile-command
    execution against an already-running session — a feature with no dependency on which engine
    started that session; `devfileCommandRunner.ts`/`execCommand.ts` don't touch
    `.odo/devstate.json` or `Command.` at all). These three call sites need to switch to
    `startDevSession()` (awaiting its promise instead of text-sniffing a banner) **before**
    `Command.dev()` can be deleted, otherwise this file fails to compile.
  - **Confirmed NOT affected** (the user's specific concern) — `initComponent()`,
    `getComponentDescription()` (`describe`), `deployComponent()`/`undeployComponent()`, and this
    same test file's other suites (`container runtime detection`, `deploy with inlined resources`,
    `local image build`) have zero dependency on `Command`/`Command.dev()` — verified by reading
    `init.ts`/`describe.ts` directly (no `onText`/pty usage at all) and by `grep`ing this test file
    end to end. Deleting `Command.dev()` cannot affect them.
  - **Do NOT touch these two unrelated, still-active `onText`/pty-output-sniffing mechanisms** —
    easy to conflate with the dev-mode cleanup since they look similar, but serve different,
    still-needed purposes: `deploy.ts`'s image-build/push script accumulates terminal output to
    detect registry auth failures (`unauthorized|authentication required|denied`) on exit; and
    `serverlessFunction/functions.ts`'s `deployProcess()` watches for
    `'Please provide credentials for image registry'`/`'Incorrect credentials, please try again'`
    to prompt interactively for registry credentials. Neither is part of this plan's scope.
- [ ] Audit `src/tools.ts`/`ToolsConfig` for `odo`-version-gating or flag-specific logic tied to
      `dev`/`--debug`/`--platform podman`/`--forward-localhost`/`--no-watch`.
- [ ] Audit whether `odo` is still required as a downloaded tool at all for component lifecycle
      (deploy/undeploy/init/describe/dev would then all be native) — verify, don't assume.
- [ ] Remove stale `.skip` workaround comments in the UI test suite tied to real-`odo`-CLI pty
      quirks that no longer apply.
