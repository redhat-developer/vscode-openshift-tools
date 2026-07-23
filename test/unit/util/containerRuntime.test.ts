/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import pq from 'proxyquire';
import { ChildProcessUtil } from '../../../src/util/childProcessUtil';

const { expect } = chai;
chai.use(sinonChai);

suite('util/containerRuntime.ts', () => {
    let sandbox: sinon.SinonSandbox;
    let whichStub: sinon.SinonStub;
    let platformStub: sinon.SinonStub;
    let executeStub: sinon.SinonStub;
    let ContainerRuntimeDetector: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        whichStub = sandbox.stub();
        platformStub = sandbox.stub();
        executeStub = sandbox.stub(ChildProcessUtil.prototype, 'execute');

        const mod = pq('../../../src/util/containerRuntime', {
            'shelljs': { which: whichStub },
            'os': { platform: platformStub },
        });
        ContainerRuntimeDetector = mod.ContainerRuntimeDetector;
    });

    teardown(() => {
        sandbox.restore();
    });

    suite('detectBuildRuntime()', () => {
        test('returns podman when podman is available', async () => {
            whichStub.withArgs('podman').returns('/usr/bin/podman');
            platformStub.returns('linux');

            const result = await ContainerRuntimeDetector.detectBuildRuntime();
            expect(result).to.equal('podman');
        });

        test('returns docker when only docker is available', async () => {
            whichStub.withArgs('podman').returns(null);
            whichStub.withArgs('docker').returns('/usr/bin/docker');
            executeStub.resolves({ stdout: 'docker info output', stderr: '', error: undefined });

            const result = await ContainerRuntimeDetector.detectBuildRuntime();
            expect(result).to.equal('docker');
        });

        test('returns buildah when only buildah is available', async () => {
            whichStub.withArgs('podman').returns(null);
            whichStub.withArgs('docker').returns(null);
            whichStub.withArgs('buildah').returns('/usr/bin/buildah');
            executeStub.resolves({ stdout: 'buildah version', stderr: '', error: undefined });

            const result = await ContainerRuntimeDetector.detectBuildRuntime();
            expect(result).to.equal('buildah');
        });

        test('returns null when no runtime is available', async () => {
            whichStub.returns(null);

            const result = await ContainerRuntimeDetector.detectBuildRuntime();
            expect(result).to.be.null;
        });

        test('prefers podman over docker when both available', async () => {
            whichStub.withArgs('podman').returns('/usr/bin/podman');
            whichStub.withArgs('docker').returns('/usr/bin/docker');
            platformStub.returns('linux');

            const result = await ContainerRuntimeDetector.detectBuildRuntime();
            expect(result).to.equal('podman');
        });
    });

    suite('isPodmanAvailable()', () => {
        test('returns true on Linux when podman is found', async () => {
            whichStub.withArgs('podman').returns('/usr/bin/podman');
            platformStub.returns('linux');

            const result = await ContainerRuntimeDetector.isPodmanAvailable();
            expect(result).to.be.true;
        });

        test('returns false when podman is not found', async () => {
            whichStub.withArgs('podman').returns(null);

            const result = await ContainerRuntimeDetector.isPodmanAvailable();
            expect(result).to.be.false;
        });

        test('on non-Linux returns true when podman machine is running', async () => {
            whichStub.withArgs('podman').returns('/usr/local/bin/podman');
            platformStub.returns('darwin');
            executeStub.resolves({
                stdout: JSON.stringify([{ Running: true }]),
                stderr: '',
                error: undefined,
            });

            const result = await ContainerRuntimeDetector.isPodmanAvailable();
            expect(result).to.be.true;
        });

        test('on non-Linux returns false when no podman machine running', async () => {
            whichStub.withArgs('podman').returns('/usr/local/bin/podman');
            platformStub.returns('darwin');
            executeStub.resolves({
                stdout: JSON.stringify([{ Running: false }]),
                stderr: '',
                error: undefined,
            });

            const result = await ContainerRuntimeDetector.isPodmanAvailable();
            expect(result).to.be.false;
        });
    });

    suite('isDockerAvailable()', () => {
        test('returns true when docker is found and daemon is running', async () => {
            whichStub.withArgs('docker').returns('/usr/bin/docker');
            executeStub.resolves({ stdout: 'docker info output', stderr: '', error: undefined });

            const result = await ContainerRuntimeDetector.isDockerAvailable();
            expect(result).to.be.true;
        });

        test('returns false when docker daemon is not running', async () => {
            whichStub.withArgs('docker').returns('/usr/bin/docker');
            executeStub.rejects(new Error('Cannot connect to Docker daemon'));

            const result = await ContainerRuntimeDetector.isDockerAvailable();
            expect(result).to.be.false;
        });

        test('returns false when docker is not found', async () => {
            whichStub.withArgs('docker').returns(null);

            const result = await ContainerRuntimeDetector.isDockerAvailable();
            expect(result).to.be.false;
        });
    });

    suite('isBuildahAvailable()', () => {
        test('returns true when buildah is found and works', async () => {
            whichStub.withArgs('buildah').returns('/usr/bin/buildah');
            executeStub.resolves({ stdout: 'buildah version 1.33', stderr: '', error: undefined });

            const result = await ContainerRuntimeDetector.isBuildahAvailable();
            expect(result).to.be.true;
        });

        test('returns false when buildah is not found', async () => {
            whichStub.withArgs('buildah').returns(null);

            const result = await ContainerRuntimeDetector.isBuildahAvailable();
            expect(result).to.be.false;
        });
    });

    suite('getBuildCommand()', () => {
        test('returns correct command for podman', () => {
            const cmd = ContainerRuntimeDetector.getBuildCommand(
                'podman', 'myimage:latest', '/path/to/Dockerfile', '/build/context',
            );
            expect(cmd).to.equal('podman build -t myimage:latest -f /path/to/Dockerfile /build/context');
        });

        test('returns correct command for docker', () => {
            const cmd = ContainerRuntimeDetector.getBuildCommand(
                'docker', 'myimage:latest', '/path/to/Dockerfile', '/build/context',
            );
            expect(cmd).to.equal('docker build -t myimage:latest -f /path/to/Dockerfile /build/context');
        });

        test('returns correct command for buildah', () => {
            const cmd = ContainerRuntimeDetector.getBuildCommand(
                'buildah', 'myimage:latest', '/path/to/Dockerfile', '/build/context',
            );
            expect(cmd).to.equal('buildah bud -t myimage:latest -f /path/to/Dockerfile /build/context');
        });

        test('throws for unsupported runtime', () => {
            expect(() => {
                ContainerRuntimeDetector.getBuildCommand(
                    'nerdctl', 'img', '/Dockerfile', '.',
                );
            }).to.throw('Unsupported container runtime: nerdctl');
        });
    });
});
