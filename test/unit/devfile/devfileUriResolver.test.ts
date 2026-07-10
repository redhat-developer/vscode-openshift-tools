/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import { DevfileUriResolver } from '../../../src/devfile/devfileUriResolver';

const { expect } = chai;

suite('devfile/devfileUriResolver.ts', () => {

    suite('resolveUri()', () => {
        test('resolves absolute HTTP URL as-is', () => {
            const uri = 'https://example.com/kubernetes/deploy.yaml';
            const resolved = DevfileUriResolver.resolveUri(uri);
            expect(resolved).to.equal('https://example.com/kubernetes/deploy.yaml');
        });

        test('resolves absolute HTTPS URL as-is', () => {
            const uri = 'https://registry.devfile.io/resources/go/2.6.0/kubernetes/deploy.yaml';
            const resolved = DevfileUriResolver.resolveUri(uri);
            expect(resolved).to.equal('https://registry.devfile.io/resources/go/2.6.0/kubernetes/deploy.yaml');
        });

        test('resolves relative URI with devfileAbsPath', () => {
            const uri = 'kubernetes/deploy.yaml';
            const devfileAbsPath = '/home/user/project/devfile.yaml';
            const resolved = DevfileUriResolver.resolveUri(uri, undefined, devfileAbsPath);
            expect(resolved).to.equal('/home/user/project/kubernetes/deploy.yaml');
        });

        test('resolves relative URI with nested path and devfileAbsPath', () => {
            const uri = '../shared/kubernetes/deploy.yaml';
            const devfileAbsPath = '/home/user/project/myapp/devfile.yaml';
            const resolved = DevfileUriResolver.resolveUri(uri, undefined, devfileAbsPath);
            expect(resolved).to.equal('/home/user/project/shared/kubernetes/deploy.yaml');
        });

        test('resolves relative URI with devfileSourceUrl', () => {
            const uri = 'kubernetes/deploy.yaml';
            const devfileSourceUrl = 'https://registry.devfile.io/devfiles/go/2.6.0';
            const resolved = DevfileUriResolver.resolveUri(uri, devfileSourceUrl);
            expect(resolved).to.equal('https://registry.devfile.io/devfiles/go/2.6.0/kubernetes/deploy.yaml');
        });

        test('resolves relative URI with nested path and devfileSourceUrl', () => {
            const uri = 'docker/Dockerfile';
            const devfileSourceUrl = 'https://registry.devfile.io/devfiles/nodejs/3.0.0';
            const resolved = DevfileUriResolver.resolveUri(uri, devfileSourceUrl);
            expect(resolved).to.equal('https://registry.devfile.io/devfiles/nodejs/3.0.0/docker/Dockerfile');
        });

        test('handles devfileSourceUrl with trailing slash', () => {
            const uri = 'kubernetes/deploy.yaml';
            const devfileSourceUrl = 'https://registry.devfile.io/devfiles/go/2.6.0/';
            const resolved = DevfileUriResolver.resolveUri(uri, devfileSourceUrl);
            // Should normalize to not have double slashes
            expect(resolved).to.equal('https://registry.devfile.io/devfiles/go/2.6.0/kubernetes/deploy.yaml');
        });

        test('prefers devfileAbsPath over devfileSourceUrl when both provided', () => {
            const uri = 'kubernetes/deploy.yaml';
            const devfileSourceUrl = 'https://registry.devfile.io/devfiles/go/2.6.0';
            const devfileAbsPath = '/home/user/project/devfile.yaml';
            const resolved = DevfileUriResolver.resolveUri(uri, devfileSourceUrl, devfileAbsPath);
            // Should use devfileAbsPath (local file takes precedence)
            expect(resolved).to.equal('/home/user/project/kubernetes/deploy.yaml');
        });

        test('throws error when no context provided for relative URI', () => {
            const uri = 'kubernetes/deploy.yaml';
            expect(() => DevfileUriResolver.resolveUri(uri)).to.throw(
                /Cannot resolve URI.*no devfile source context available/
            );
        });

        test('throws error with helpful message when resolution fails', () => {
            const uri = 'kubernetes/deploy.yaml';
            expect(() => DevfileUriResolver.resolveUri(uri)).to.throw(
                /Provide either devfileSourceUrl or devfileAbsPath/
            );
        });
    });

    suite('downloadContent()', () => {
        test('throws error for non-existent local file', async () => {
            const resolvedUri = '/non/existent/file.yaml';
            try {
                await DevfileUriResolver.downloadContent(resolvedUri);
                expect.fail('Should have thrown error');
            } catch (err) {
                expect(err.message).to.match(/File not found/);
            }
        });

        // Note: HTTP download tests would require mocking got library
        // or running against a real server. These should be in integration tests.
    });
});
