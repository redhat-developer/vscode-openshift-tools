#!/usr/bin/env node
/*-----------------------------------------------------------------------------------------------
 *  Generates the act-tailored CI workflow for local runs (build/act/run-ci.sh)
 *  from the real GitHub workflow.
 *
 *  Run from the repository root:   node build/act/generate.js
 *
 *  Re-run whenever .github/workflows/continuous-integration-workflow.yml changes.
 *  The script FAILS LOUDLY when an expected step disappears upstream, so renames
 *  surface immediately instead of silently producing a broken local workflow.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(repoRoot, '.github', 'workflows', 'continuous-integration-workflow.yml');
const targetPath = path.join(__dirname, 'continuous-integration-workflow.act.yml');

const KIND_STEP = 'Start KinD cluster';
const PODMAN_STEP = 'Configure rootless podman for CI';
const ARTIFACTS_STEP = 'Upload test artifacts';
const INTEGRATION_STEP = 'Build and run integration tests';

// steps that require GitHub infrastructure and are dropped entirely
const DROP_STEPS = [
    'Dependency Review',
    'Restore cached tool binaries',
    'Save tool binaries cache',
    'Codecov',
    ARTIFACTS_STEP,
];

// steps the transformations below rely on
const REQUIRED_STEPS = [
    'Install dependencies',
    KIND_STEP,
    'Configure cluster',
    PODMAN_STEP,
    INTEGRATION_STEP,
    ARTIFACTS_STEP,
];

function fail(message) {
    console.error(`generate.js: ${message}`);
    console.error('Update this script to match the current workflow structure.');
    process.exit(1);
}

const doc = yaml.load(fs.readFileSync(sourcePath, 'utf8'));
const job = doc.jobs && doc.jobs.build;

if (!job || !Array.isArray(job.steps)) {
    fail('cannot find the "build" job or its steps in the source workflow.');
}

// js-yaml may parse the YAML 1.1 boolean-looking `on` key as `true`;
// act only needs a push trigger anyway
delete doc.true;
doc.on = { push: { branches: ['main'] } };

const stepNames = job.steps.map((step) => step.name).filter(Boolean);

for (const name of REQUIRED_STEPS) {
    if (!stepNames.includes(name)) {
        fail(`expected step "${name}" not found in the source workflow.`);
    }
}

// read the kind version and node image from kind-action's inputs, so the
// generated workflow stays in sync with what CI actually runs
const kindAction = job.steps.find((step) => step.name === KIND_STEP);
const kindVersion = kindAction && kindAction.with && kindAction.with.version;
const nodeImage = kindAction && kindAction.with && kindAction.with.node_image;

if (!kindVersion || !nodeImage) {
    fail(`${KIND_STEP} step: cannot read kind version / node image from its inputs.`);
}

const k8sMinor = (nodeImage.match(/v(\d+\.\d+)\.\d+/) || [])[1];

if (!k8sMinor) {
    fail(`${KIND_STEP} step: cannot parse the Kubernetes version from node image "${nodeImage}".`);
}

/**
 * Replaces kind-action. act runs job containers on the host network by
 * default, so the API server port kind publishes on localhost is reachable
 * from the job container exactly as on a GitHub runner — no kubeconfig
 * rewriting is needed. kind creates its node containers on the host runtime
 * through the socket act mounts. A dedicated cluster name and a fixed API
 * server port avoid collisions with any other local kind cluster.
 */
function makeKindStep(original) {
    return {
        name: `${KIND_STEP} (act)`,
        if: original.if,
        run: [
            'set -e',
            `# versions pinned to match the CI workflow (${kindVersion} / ${nodeImage})`,
            `curl -sLo /usr/local/bin/kind https://kind.sigs.k8s.io/dl/${kindVersion}/kind-linux-amd64`,
            'chmod +x /usr/local/bin/kind',
            `K8S_VERSION=$(curl -sL https://dl.k8s.io/release/stable-${k8sMinor}.txt)`,
            'curl -sLo /usr/local/bin/kubectl "https://dl.k8s.io/release/$K8S_VERSION/bin/linux/amd64/kubectl"',
            'chmod +x /usr/local/bin/kubectl',
            'cat > /tmp/kind-config.yaml <<EOF',
            'kind: Cluster',
            'apiVersion: kind.x-k8s.io/v1alpha4',
            'networking:',
            '  apiServerAddress: "127.0.0.1"',
            '  apiServerPort: 6443',
            'EOF',
            `kind create cluster --name ci --image ${nodeImage} --config /tmp/kind-config.yaml --wait 300s`,
        ].join('\n'),
    };
}

/**
 * Adapts the rootless podman step: podman is already installed by the tools
 * step and CONTAINER_HOST is set job-wide; this is only a warmup check that
 * the host runtime is reachable through the socket act mounts.
 */
function makePodmanStep(original) {
    return {
        name: `${PODMAN_STEP} (act)`,
        if: original.if,
        run: [
            'set -e',
            '# the act job container has no systemd: the loginctl part of the original',
            '# step does not apply — the host rootless podman service is already running',
            '# and reachable through the docker-compatible socket act mounts',
            '# (CONTAINER_HOST/DOCKER_HOST are set job-wide)',
            'podman info > /dev/null',
        ].join('\n'),
    };
}

/**
 * Replaces upload-artifact: extest artifacts are redirected into the workspace
 * via TEST_RESOURCES (landing on the host through the bind mount); this is a
 * defensive catch-all for anything still written to container-local paths.
 */
function makeCollectArtifactsStep() {
    return {
        name: 'Collect test artifacts (act)',
        if: 'always()',
        run: [
            'mkdir -p build/act/artifacts',
            'if [ -d /tmp/test-resources ]; then',
            '  cp -r /tmp/test-resources build/act/artifacts/ || true',
            'fi',
            'ls -R build/act/artifacts || true',
        ].join('\n'),
    };
}

/**
 * Passes a host-side TEST_GREP through to the integration tests, enabling
 * focused runs:  TEST_GREP="Bindable Services" build/act/run-ci.sh
 */
function adaptIntegrationStep(original) {
    if (!process.env.TEST_GREP) {
        return original;
    }

    return {
        ...original,
        env: {
            ...(original.env ?? {}),
            TEST_GREP: process.env.TEST_GREP,
        },
    };
}

const transformed = [];

for (const step of job.steps) {
    if (DROP_STEPS.includes(step.name)) {
        if (step.name === ARTIFACTS_STEP) {
            transformed.push(makeCollectArtifactsStep());
        }
        continue;
    }

    if (step.name === KIND_STEP) {
        transformed.push(makeKindStep(step));
        continue;
    }

    if (step.name === PODMAN_STEP) {
        transformed.push(makePodmanStep(step));
        continue;
    }

    if (step.name === INTEGRATION_STEP) {
        transformed.push(adaptIntegrationStep(step));
        continue;
    }

    transformed.push(step);
}

transformed.unshift({
    name: 'Install CI tools (act)',
    run: [
        'set -e',
        '# container-side writes through the bind mount can land as unmapped',
        '# subuid owners; a permissive umask keeps every artifact overwritable',
        '# by the host user regardless of which in-container uid created it',
        'umask 0000',
        '# the act runner image lacks the tools GitHub-hosted runners provide:',
        '# - xvfb and the VS Code/Electron libraries for the headless UI/integration tests',
        '# - podman BEFORE the kind step: kind then uses its podman provider, whose',
        '#   cgroup-controller detection works against rootless podman (the docker',
        '#   provider would reject the podman docker-compat socket as undelegated)',
        'apt-get update -qq',
        'apt-get install -qq -y xvfb podman libgtk-3-0t64 libnss3 libasound2t64 libgbm1 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libcairo2 libpango-1.0-0 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libsecret-1-0',
    ].join('\n'),
});

transformed.push({
    name: 'Clean up KinD cluster (act)',
    if: 'always()',
    run: 'kind delete cluster --name ci || true',
});

job.steps = transformed;

// job-level environment for the containerized run:
// - Chromium cannot use its sandbox inside a (rootless) container
// - extest artifacts (screenshots, VS Code logs, crashes, driver logs) go into
//   the bind-mounted workspace instead of the ephemeral container /tmp
// - the npm cache persists in the workspace between runs
// - podman/docker point at the host rootless runtime through the socket act
//   mounts into the job container (kind's podman provider needs this too)
// - kind must use its podman provider: the docker provider rejects the podman
//   docker-compat socket as an undelegated rootless runtime
job.env = {
    ...(job.env || {}),
    ELECTRON_DISABLE_SANDBOX: 'true',
    TEST_RESOURCES: '${{ github.workspace }}/test-resources',
    npm_config_cache: '${{ github.workspace }}/build/act/.npm-cache',
    CONTAINER_HOST: 'unix:///var/run/docker.sock',
    DOCKER_HOST: 'unix:///var/run/docker.sock',
    KIND_EXPERIMENTAL_PROVIDER: 'podman',
};

const header = [
    '#',
    '# GENERATED FILE — DO NOT EDIT',
    '# Source: .github/workflows/continuous-integration-workflow.yml',
    '# Regenerate with: node build/act/generate.js',
    '#',
    '# act-tailored derivative for local CI runs (see build/act/run-ci.sh).',
    '# Deltas from the real workflow:',
    '#  - GitHub-infra steps dropped (caches, codecov, artifact upload, dependency review)',
    '#  - kind-action replaced by an in-container kind setup (act networking)',
    '#  - rootless-podman step adapted (no systemd in the job container)',
    '#  - test artifacts land in the workspace (TEST_RESOURCES) instead of upload-artifact',
    '#  - ELECTRON_DISABLE_SANDBOX set; npm cache redirected into the workspace',
    '#',
    '',
].join('\n');

const body = yaml.dump(doc, { lineWidth: -1, noRefs: true });

// round-trip check: the serialized workflow must preserve every run script
// byte-for-byte (folded-scalar wrapping has corrupted long lines before)
const reloaded = yaml.load(body);
const reloadedSteps = reloaded.jobs.build.steps;
const sourceSteps = job.steps.filter((step) => step.run && !DROP_STEPS.includes(step.name));

for (const step of sourceSteps) {
    const reloadedStep = reloadedSteps.find((candidate) => candidate.name === step.name);

    if (!reloadedStep || reloadedStep.run !== step.run) {
        fail(`run script of step "${step.name}" did not survive YAML round-tripping.`);
    }
}

fs.writeFileSync(targetPath, header + body + '\n');
console.log(`Generated ${path.relative(repoRoot, targetPath)} from ${path.relative(repoRoot, sourcePath)}`);
console.log(`  kind ${kindVersion}, node image ${nodeImage}, kubectl stable-${k8sMinor}`);
