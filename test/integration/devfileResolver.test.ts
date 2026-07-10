/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DevfileResolver } from '../../src/devfile/devfileResolver';

const { expect } = chai;

suite('DevfileResolver resource inlining', function() {
    this.timeout(60000);

    const fixtureComponentPath = path.join(__dirname, '..', 'fixtures', 'components', 'comp-with-uris');
    let devfilePath: string;

    setup(async () => {
        devfilePath = path.join(fixtureComponentPath, 'devfile.yaml');

        // Verify fixture exists
        const exists = await fs.access(devfilePath).then(() => true).catch(() => false);
        if (!exists) {
            throw new Error(`Fixture component not found at ${fixtureComponentPath}`);
        }
    });

    test('inlineResources mode: inlines resources from local files', async function() {
        DevfileResolver.invalidateCache();

        const resolver = new DevfileResolver();

        // Load devfile
        const devfileContent = await fs.readFile(devfilePath, 'utf-8');
        const devfile = yaml.load(devfileContent);

        // Resolve with inlineResources - should read from component folder
        const resolved = await resolver.resolve(devfile, {
            inlineResources: true,
            devfilePath
        });

        // Verify resolution succeeded
        expect(resolved).to.exist;
        expect(resolved.components).to.exist;

        // Find components by name
        const imageBuildComp = resolved.components.find((c: any) => c.name === 'image-build');
        const k8sDeployComp = resolved.components.find((c: any) => c.name === 'kubernetes-deploy');

        // Verify image-build component has Dockerfile inlined
        expect(imageBuildComp, 'image-build component should exist').to.exist;
        expect(imageBuildComp.image.dockerfile.inlined, 'Dockerfile should be inlined').to.exist;
        expect(imageBuildComp.image.dockerfile.uri, 'URI should be removed after inlining').to.be.undefined;
        expect(imageBuildComp.image.dockerfile.inlined).to.include('FROM registry.access.redhat.com/ubi8/nodejs-18');
        expect(imageBuildComp.image.dockerfile.buildContext, 'buildContext should remain unchanged').to.equal('.');

        // Verify kubernetes-deploy component has deploy.yaml inlined
        expect(k8sDeployComp, 'kubernetes-deploy component should exist').to.exist;
        expect(k8sDeployComp.kubernetes.inlined, 'deploy.yaml should be inlined').to.exist;
        expect(k8sDeployComp.kubernetes.uri, 'URI should be removed after inlining').to.be.undefined;

        // Verify inlined content is valid Kubernetes YAML
        expect(k8sDeployComp.kubernetes.inlined).to.include('apiVersion: apps/v1');
        expect(k8sDeployComp.kubernetes.inlined).to.include('kind: Deployment');
        expect(k8sDeployComp.kubernetes.inlined).to.include('my-nodejs-app');
        expect(k8sDeployComp.kubernetes.inlined.length, 'Inlined content should not be empty').to.be.greaterThan(0);
    });

    test('no inlineResources option: URIs remain unchanged', async function() {
        DevfileResolver.invalidateCache();

        const resolver = new DevfileResolver();

        // Load devfile
        const devfileContent = await fs.readFile(devfilePath, 'utf-8');
        const devfile = yaml.load(devfileContent);

        // Resolve WITHOUT inlineResources option
        const resolved = await resolver.resolve(devfile, {
            devfilePath
        });

        // Verify resolution succeeded
        expect(resolved).to.exist;
        expect(resolved.components).to.exist;

        // Verify URIs are NOT inlined
        const imageBuildComp = resolved.components.find((c: any) => c.name === 'image-build');
        const k8sDeployComp = resolved.components.find((c: any) => c.name === 'kubernetes-deploy');

        expect(imageBuildComp.image.dockerfile.uri, 'Dockerfile URI should remain').to.equal('docker/Dockerfile');
        // Note: buildContext is a separate field (working directory), not the inlined content
        // The inlined Dockerfile content would replace the uri field

        expect(k8sDeployComp.kubernetes.uri, 'deploy.yaml URI should remain').to.equal('k8s/deploy.yaml');
        expect(k8sDeployComp.kubernetes.inlined, 'Should NOT be inlined').to.be.undefined;
    });
});
