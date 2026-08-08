/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import pq from 'proxyquire';

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
        executeStub = sandbox.stub();

        const mod = pq('../../../src/util/containerRuntime', {
            'shelljs': { which: whichStub },
            'os': { platform: platformStub },
            './childProcessUtil': {
                ChildProcessUtil: {
                    Instance: { execute: executeStub },
                },
                '@noCallThru': true,
            },
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
            executeStub.resolves({
                stdout: JSON.stringify({ host: { remoteSocket: { exists: true } } }),
                stderr: '',
                error: undefined,
            });

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
            executeStub.resolves({
                stdout: JSON.stringify({ host: { remoteSocket: { exists: true } } }),
                stderr: '',
                error: undefined,
            });

            const result = await ContainerRuntimeDetector.detectBuildRuntime();
            expect(result).to.equal('podman');
        });
    });

    suite('isPodmanAvailable()', () => {
        test('returns true on Linux when podman is found and remoteSocket exists', async () => {
            whichStub.withArgs('podman').returns('/usr/bin/podman');
            platformStub.returns('linux');
            executeStub.resolves({
                stdout: JSON.stringify({ host: { remoteSocket: { exists: true } } }),
                stderr: '',
                error: undefined,
            });

            const result = await ContainerRuntimeDetector.isPodmanAvailable();
            expect(result).to.be.true;
        });

        test('returns false on Linux when remoteSocket does not exist', async () => {
            whichStub.withArgs('podman').returns('/usr/bin/podman');
            platformStub.returns('linux');
            executeStub.resolves({
                stdout: JSON.stringify({ host: { remoteSocket: { exists: false } } }),
                stderr: '',
                error: undefined,
            });

            const result = await ContainerRuntimeDetector.isPodmanAvailable();
            expect(result).to.be.false;
        });

        test('returns false on Linux when podman info fails', async () => {
            whichStub.withArgs('podman').returns('/usr/bin/podman');
            platformStub.returns('linux');
            executeStub.rejects(new Error('podman info failed'));

            const result = await ContainerRuntimeDetector.isPodmanAvailable();
            expect(result).to.be.false;
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

    suite('getLoginCommand()', () => {
        test('returns podman login with --password-stdin', () => {
            const cmd = ContainerRuntimeDetector.getLoginCommand('podman', 'quay.io', 'myuser');
            expect(cmd).to.equal('podman login -u myuser --password-stdin quay.io');
        });

        test('returns docker login with --password-stdin', () => {
            const cmd = ContainerRuntimeDetector.getLoginCommand('docker', 'docker.io', 'myuser');
            expect(cmd).to.equal('docker login -u myuser --password-stdin docker.io');
        });

        test('returns buildah login with --password-stdin', () => {
            const cmd = ContainerRuntimeDetector.getLoginCommand('buildah', 'ghcr.io', 'myuser');
            expect(cmd).to.equal('buildah login -u myuser --password-stdin ghcr.io');
        });

        test('never includes a password in the command string', () => {
            const cmd = ContainerRuntimeDetector.getLoginCommand('podman', 'quay.io', 'myuser');
            expect(cmd).not.to.include('-p ');
            expect(cmd).not.to.include('secret');
        });
    });

    suite('loginToRegistry()', () => {
        test('pipes password via stdin and resolves on success', async () => {
            executeStub.resolves({ stdout: 'Login Succeeded!', stderr: '', error: undefined });

            await ContainerRuntimeDetector.loginToRegistry('podman', 'quay.io', 'myuser', 'secret123');

            expect(executeStub).to.have.been.calledOnce;
            const [cmd, , stdin] = executeStub.firstCall.args;
            expect(cmd).to.include('--password-stdin');
            expect(cmd).not.to.include('secret123');
            expect(stdin).to.equal('secret123');
        });

        test('throws on login failure with stderr message', async () => {
            executeStub.resolves({
                stdout: '',
                stderr: 'Error: unauthorized: access denied',
                error: new Error('Exited with code 1'),
            });

            try {
                await ContainerRuntimeDetector.loginToRegistry('podman', 'quay.io', 'myuser', 'badpass');
                expect.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.include('Registry login failed');
                expect(err.message).to.include('unauthorized');
            }
        });

        test('includes error message when stderr is empty', async () => {
            executeStub.resolves({
                stdout: '',
                stderr: '',
                error: new Error('Exited with code 1'),
            });

            try {
                await ContainerRuntimeDetector.loginToRegistry('docker', 'docker.io', 'user', 'pass');
                expect.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.include('Registry login failed');
                expect(err.message).to.include('Exited with code 1');
            }
        });
    });

    suite('getPushCommand()', () => {
        test('returns correct command for podman', () => {
            const cmd = ContainerRuntimeDetector.getPushCommand('podman', 'quay.io/user/myimage:latest');
            expect(cmd).to.equal('podman push quay.io/user/myimage:latest');
        });

        test('returns correct command for docker', () => {
            const cmd = ContainerRuntimeDetector.getPushCommand('docker', 'docker.io/user/myimage:latest');
            expect(cmd).to.equal('docker push docker.io/user/myimage:latest');
        });

        test('returns correct command for buildah', () => {
            const cmd = ContainerRuntimeDetector.getPushCommand('buildah', 'ghcr.io/user/myimage:latest');
            expect(cmd).to.equal('buildah push ghcr.io/user/myimage:latest');
        });
    });

    suite('getRetagCommand()', () => {
        test('returns retag command for podman', () => {
            const cmd = ContainerRuntimeDetector.getRetagCommand('podman', 'myimage:latest');
            expect(cmd).to.equal('podman tag myimage:latest docker.io/library/myimage:latest');
        });

        test('returns retag command for buildah', () => {
            const cmd = ContainerRuntimeDetector.getRetagCommand('buildah', 'myimage:latest');
            expect(cmd).to.equal('podman tag myimage:latest docker.io/library/myimage:latest');
        });

        test('returns undefined for docker (no retag needed)', () => {
            const cmd = ContainerRuntimeDetector.getRetagCommand('docker', 'myimage:latest');
            expect(cmd).to.be.undefined;
        });
    });

    suite('getKindLoadCommand()', () => {
        test('returns kind load docker-image for docker runtime', () => {
            const cmd = ContainerRuntimeDetector.getKindLoadCommand('docker', 'myimage:latest');
            expect(cmd).to.equal('kind load docker-image myimage:latest');
        });

        test('returns podman save with docker.io prefix piped to kind load for podman runtime', () => {
            const cmd = ContainerRuntimeDetector.getKindLoadCommand('podman', 'myimage:latest');
            expect(cmd).to.equal('podman save docker.io/library/myimage:latest | kind load image-archive /dev/stdin');
        });

        test('includes --name flag when clusterName is provided', () => {
            const cmd = ContainerRuntimeDetector.getKindLoadCommand('docker', 'myimage:latest', 'chart-testing');
            expect(cmd).to.equal('kind load docker-image myimage:latest --name chart-testing');
        });

        test('includes --name flag for podman with clusterName', () => {
            const cmd = ContainerRuntimeDetector.getKindLoadCommand('podman', 'myimage:latest', 'chart-testing');
            expect(cmd).to.equal('podman save docker.io/library/myimage:latest | kind load image-archive /dev/stdin --name chart-testing');
        });
    });

    suite('getMinikubeLoadCommand()', () => {
        test('returns minikube image load for docker runtime', () => {
            const cmd = ContainerRuntimeDetector.getMinikubeLoadCommand('docker', 'myimage:latest');
            expect(cmd).to.equal('minikube image load myimage:latest');
        });

        test('returns podman save with docker.io prefix piped to minikube for podman runtime', () => {
            const cmd = ContainerRuntimeDetector.getMinikubeLoadCommand('podman', 'myimage:latest');
            expect(cmd).to.equal('podman save docker.io/library/myimage:latest | minikube image load -');
        });
    });

    suite('isRegistryLoggedIn()', () => {
        test('podman: returns true when get-login succeeds', async () => {
            whichStub.withArgs('podman').returns('/usr/bin/podman');
            platformStub.returns('linux');
            executeStub.resolves({ stdout: 'myuser', stderr: '', error: undefined });

            const result = await ContainerRuntimeDetector.isRegistryLoggedIn('podman', 'quay.io');
            expect(result).to.be.true;
            expect(executeStub).to.have.been.calledWith('podman login --get-login quay.io');
        });

        test('podman: returns false when get-login fails', async () => {
            whichStub.withArgs('podman').returns('/usr/bin/podman');
            platformStub.returns('linux');
            executeStub.rejects(new Error('not logged in'));

            const result = await ContainerRuntimeDetector.isRegistryLoggedIn('podman', 'quay.io');
            expect(result).to.be.false;
        });
    });
});
