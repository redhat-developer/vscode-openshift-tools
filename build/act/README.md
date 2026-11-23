# Act-based local CI runner

Runs the repository's real CI workflow (the Linux leg of
`.github/workflows/continuous-integration-workflow.yml`) inside a container
against the host's rootless podman — the same pipeline GitHub Actions runs,
but on your workstation and against code you have checked out.

Use it to validate a branch before pushing, or to reproduce a CI failure
locally with full logs and artifacts on the host.

## Prerequisites

- **[act](https://github.com/nektos/act)** — tested with v0.2.98. One way to
  install (adjust the destination to somewhere on your `PATH`):

  ```bash
  curl -Lo /tmp/act.tar.gz https://github.com/nektos/act/releases/latest/download/act_Linux_x86_64.tar.gz
  tar -xzf /tmp/act.tar.gz -C ~/.local/bin act && chmod +x ~/.local/bin/act
  ```

- **rootless podman** — the job container, the kind cluster nodes and the
  podman-based test pods all run on it
- **~10 GB disk** (runner image ~2 GB, kind node image ~1 GB, build tree,
  npm cache) and a reasonably idle machine (see *Caveats*)

One-time host setup:

- **inotify limit** — the kind node's systemd needs cgroup inotify watches;
  the kernel default of 128 instances is often exhausted by a desktop
  session alone. `run-ci.sh` checks this and fail-fasts with the fix
  printed. Persistent fix:

  ```bash
  echo fs.inotify.max_user_instances=1024 | sudo tee /etc/sysctl.d/99-inotify.conf
  sudo sysctl fs.inotify.max_user_instances=1024
  ```

- **SELinux** (Fedora/RHEL) — when enforcing, `run-ci.sh` relabels the repo
  tree as `container_file_t` (idempotent) so the job container can access
  the bind-mounted workspace. Revert at any time with `restorecon -R .`

## Usage

```bash
build/act/run-ci.sh
```

Focused integration run (only tests whose titles match the substring):

```bash
TEST_GREP="Bindable Services" build/act/run-ci.sh
```

What a run does:

1. regenerates `continuous-integration-workflow.act.yml` from the real
   workflow (see *Maintenance*), applying the act deltas
2. starts a dedicated docker-compatible podman service
   (`build/act/podman-docker.sock`) with `label = false` — containers
   created through it run unlabeled, matching the no-SELinux environment of
   GitHub-hosted runners
3. runs the job container with the repo **bind-mounted** (`--bind`) and
   `--rm`, on the host network, with `KIND_EXPERIMENTAL_PROVIDER=podman`
   (kind creates its node containers on the host podman)
4. restores `package.json`/`package-lock.json` (patched by the
   *Prepare UI Tests* step) and purges container-owned build artifacts on
   exit — also on Ctrl-C

Everything the run writes lands in the host tree: unit/UI/integration
results, coverage in `.nyc_output/`, extest artifacts (screenshots, VS Code
logs, chromedriver log) in `test-resources/`, run logs in
`build/act/artifacts/`.

## Caveats

- **Tests what is checked out.** The workflow runs against the working tree
  via the bind mount — including uncommitted changes. That is the point,
  but do not be surprised by it.
- **Container-owned files can block host builds.** Rootless podman maps
  container-root writes to your host user, but writes from non-root
  in-container uids land as unmapped subuid owners (e.g. `166536`) which
  the host user cannot overwrite. Two mitigations are built in: the job
  runs with `umask 0000` (world-writable artifacts) and the exit trap
  purges unowned files:
  `find out test-resources .nyc_output .vscode-test -nouser -delete`.
  For an interrupted run that bypassed the trap (or any leftover), run
  `npm run clean` or the `find` command manually. Deletion only needs
  directory ownership, which is always yours.
- **Interrupted runs may leave containers.** If a run is killed hard,
  check `podman ps` for leftover `act-*` job containers and
  `ci-control-plane` (kind node), and `podman rm -f` them. With a normal
  Ctrl-C the workflow's cleanup step still deletes the kind cluster.
- **Host-load sensitivity.** Pod-readiness timeouts across the cluster
  suites (dev.ts, clusterDevPlatform, …) are the signature of a starved
  kind node: busy machine, memory pressure, or image-pull slowness. The
  same tests pass on idle machines and GitHub runners.
- **Not covered:** the macos/windows matrix legs, codecov upload, action
  caches, and the dependency review.

## Maintenance

- **The CI workflow changed** (steps added/removed/renamed):
  `generate.js` derives the act workflow from
  `.github/workflows/continuous-integration-workflow.yml` and **fails
  loudly** when a step it patches disappears — update
  `DROP_STEPS`/`REQUIRED_STEPS`/the patch functions to match, then rerun.
  Steps that are merely added pass through untouched. The generated
  `continuous-integration-workflow.act.yml` is never committed;
  `run-ci.sh` regenerates it on every run, or run
  `node build/act/generate.js` manually to inspect the output.
- **The test set changed** (tests added/removed in
  `test/unit`, `test/integration`, `test/ui`): nothing to do — the
  workflow runs the same npm scripts as GitHub CI.
- **kind/runner versions**: the generator reads the kind version and node
  image from the real workflow's kind-action inputs, so those stay in sync
  automatically.
