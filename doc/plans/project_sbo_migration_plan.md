---
name: sbo-migration-plan
description: "Migration plan to replace SBO dependency with pure K8s API using Provisioned Service pattern (servicebinding.io) — resolves issue #4682"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2f419c0b-d7d8-4af3-be86-a2db189389cd
  modified: 2026-08-11T01:46:17.372Z
---

## Service Binding Migration Plan: SBO → servicebinding.io API

**Goal**: Replace Service Binding Operator (SBO) dependency with pure K8s API operations using the [Provisioned Service](https://servicebinding.io/spec/core/1.1.0/#provisioned-service) pattern. Resolves [#4682](https://github.com/redhat-developer/vscode-openshift-tools/issues/4682).

**Why:** SBO was deprecated Feb 2024. Its `BindableKinds` CRD does not auto-discover operators implementing the Provisioned Service pattern (e.g., CloudNativePG), making the current binding feature non-functional on most modern clusters. The old odo-based discovery worked around this, but odo dependency was removed in PR #6000.

**How to apply:** Follow the phases below sequentially. PR #6000 completed all prerequisites.

**Prerequisites** (completed in PR #6000):
- Removed odo dependency from binding flow
- Fixed stale KubeConfig singleton
- Fixed early return / wrong import / missing param bugs
- Restored unit, integration, and UI tests

---

### Phase 1: Replace Service Discovery (~2 days)

**Current**: `Oc.Instance.getBindableKinds()` queries SBO's `BindableKinds` CRD → doesn't auto-discover Provisioned Service operators like CNPG.

**Target**: Scan cluster for resources implementing the Provisioned Service pattern.

- **`src/k8s/servicebinding/bindableService.ts`** — rewrite `getBindableServices()`:
  1. List all CRDs via `ApiextensionsV1Api`
  2. For each CRD, check if `.spec.versions[].schema` defines `.status.binding.name` (Provisioned Service marker)
  3. For matching CRDs, list namespaced resources via `CustomObjectsApi`
  4. Filter to resources that actually have `.status.binding.name` pointing to an existing Secret
- **`src/oc/ocWrapper.ts`** — `getBindableKinds()` and `getApiResourceList()` become unused; remove or deprecate
- **`src/k8s/servicebinding/bindableTypes.ts`** — remove `BindableKinds` type if no longer needed

### Phase 2: Replace Binding Creation (~2 days)

**Current**: Creates a `ServiceBinding` custom resource via the SBO CRD.

**Target**: Patch Deployment directly to mount the binding secret.

- **`src/k8s/servicebinding/bindableService.ts`** — rewrite `addBinding()`:
  1. Read the binding secret name from the selected service's `.status.binding.name`
  2. Patch the component's Deployment to:
     - Add a volume referencing the binding secret
     - Add a volumeMount at `/bindings/<binding-name>/`
     - Set env var `SERVICE_BINDING_ROOT=/bindings` (if not already set)
  3. No SBO CRD dependency — pure `AppsV1Api` and `CoreV1Api`
- Remove `getServiceBindingResource()` and `build()` methods (SBO ServiceBinding construction)
- Remove `ServiceBindingResource`, `ServiceBindingReference` types from `bindableTypes.ts`

### Phase 3: Add Unbind Service (~1 day)

- Add `removeBinding()` to `BindableService`:
  1. Remove the volume and volumeMount from the Deployment
  2. Remove `SERVICE_BINDING_ROOT` env var if no other bindings remain
- Add "Unbind Service" command in `package.json` and `component.ts`
- Add context menu item (visible when component has bindings)

### Phase 4: Update CI & Tests (~1 day)

- Remove SBO installation from CI workflow (`.github/workflows/continuous-integration-workflow.yml`)
- Keep CloudNativePG only — it implements Provisioned Service natively
- Update integration test to verify `getBindableServices()` finds CNPG Cluster
- Update UI test to run the full bind flow (remove skip for no-services)
- Add unit tests for new discovery and binding logic

### Phase 5: Cleanup (~0.5 day)

- Remove all SBO-specific code: `BindableKinds` type, `getBindableKinds()`, `getApiResourceList()`, `getServiceBindingResource()`, `build()`
- Remove `binding.operators.coreos.com` API references
- Update webview if service display format changes

**Total estimate**: ~6.5 days
