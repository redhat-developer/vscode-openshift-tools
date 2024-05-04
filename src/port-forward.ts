/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { V1Pod, V1Container, V1Service, V1Deployment } from '@kubernetes/client-node';
import * as portFinder from 'portfinder';
import { QuickPickOptions, window } from 'vscode';
import { CommandText } from './base/command';
import { Oc } from './oc/ocWrapper';
import { OpenShiftTerminalManager } from './webview/openshift-terminal/openShiftTerminal';

export interface PortMapping {
    readonly localPort?: number;
    readonly targetPort: number;
}

interface ExtractedPort {
    readonly name: string;
    readonly port: number;
}

interface ValidationResult {
    readonly valid: boolean;
    readonly error?: string;
}

enum PortSpecifier {
    Required,
    AllowEmpty,
}

declare global {
    interface Array<T> {
        choose<U>(fn: (t: T) => U | undefined): U[];
    }
}

function choose<T, U>(this: T[], fn: (t: T) => U | undefined): U[] {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return this.map(fn).filter((u) => u !== undefined).map((u) => u!);
}

if (!Array.prototype.choose) {
    Object.defineProperty(Array.prototype, 'choose', {
        enumerable: false,
        value: choose
    });
}

/**
 * Builds a 'usable' port pair, containing a local port and a target port
 * Selects a local port if only the target port is provided
 * @param portPair PortMapping object
 * @returns PortMapping object containing all requisite ports
 */
export async function buildUsablePortPair(portPair: PortMapping): Promise<PortMapping> {
    const localPort = portPair.localPort;
    const targetPort = portPair.targetPort;
    let usedPort = localPort;

    if (!localPort) {
        // the port key/value is the `minimum` port to assign.
        usedPort = await portFinder.getPortPromise({
            port: 10000
        } as portFinder.PortFinderOptions);
    }

    return {
        targetPort,
        localPort: usedPort
    };
}

export class PortForward {

    private static instance: PortForward;

    static getInstance(): PortForward {
        if (!PortForward.instance) {
            PortForward.instance = new PortForward();
        }
        return PortForward.instance;
    }

    /**
     * Prompts the user on what port to port-forward to, and sets up the forwarding
     * if a valid input was provided.
     */
    public async promptAndForwardPort(kind: string, resourceName: string, namespace?: string): Promise<void> {
        const portMapping = await this.promptForPort(kind, resourceName, namespace);
        if (portMapping.length !== 0) {
            void this.portForwardToResource(kind, resourceName, portMapping, namespace);
        }
    }

    async portForwardToResource(kind: string, name: string, portMapping: PortMapping[], namespace?: string): Promise<number[]> {
        const usedPortMappings: PortMapping[] = await Promise.all(portMapping.map(buildUsablePortPair));

        usedPortMappings.forEach((usedPortPair) => {
            void window.showInformationMessage(`Forwarding from 127.0.0.1:${usedPortPair.localPort} -> ${kind}/${name}:${usedPortPair.targetPort}`);
        });

        const usedNamespace = namespace || 'default';
        const portPairStrings = usedPortMappings.map(
            (usedPortPair) => `${usedPortPair.localPort}:${usedPortPair.targetPort}`
        );

        void OpenShiftTerminalManager.getInstance().createTerminal(new CommandText('oc', `port-forward ${kind}/${name} ${portPairStrings.join(' ')} -n ${usedNamespace}`), 'Port-forward');
        return usedPortMappings.choose((usedPortPair) => usedPortPair.localPort);
    }

    /**
     * Prompts the user on what port to port-forward to, and validates numeric input.
     * @returns An array of PortMapping objects.
     */
    async promptForPort(kind: string, resourceName: string, namespace?: string): Promise<PortMapping[]> {
        let portString: string | undefined;
        let extractedPorts = Array.of<ExtractedPort>();
        const ns = namespace || 'default';
        try {
            const result = await Oc.Instance.getKubernetesObject(kind, resourceName, ns);
            if (kind.toLowerCase() === 'pod') {
                extractedPorts = this.extractPodPorts(result);
            } else if (kind.toLowerCase() === 'service') {
                extractedPorts = this.extractServicePorts(result);
            } else if (kind.toLowerCase() === 'deployment') {
                extractedPorts = this.extractDeploymentPorts(result);
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.log(err);
        }

        let defaultValue: string | undefined = undefined;
        if (extractedPorts.length > 0) {
            const portPairs = extractedPorts.map(({ name, port }) => `${port}:${name || port}`);
            defaultValue = portPairs.join(' ');
        }

        try {
            portString = await window.showInputBox(<QuickPickOptions>{
                placeHolder: 'ex: 8888:5000 8889:5001',
                value: defaultValue,
                prompt: 'Port mappings in the format LOCAL:REMOTE. Separate multiple port mappings with spaces.',
                validateInput: (portMapping: string) => {
                    const validatedPortMapping = this.validatePortMapping(portMapping, extractedPorts);

                    if (validatedPortMapping && validatedPortMapping.error) {
                        return validatedPortMapping.error;
                    }

                    return undefined;
                }
            });
        } catch (e) {
            void window.showErrorMessage('Could not validate on input port');
        }

        if (!portString) {
            return [];
        }
        return this.buildPortMapping(portString, extractedPorts);
    }

    /**
     * Validates the user supplied port mapping(s)
     * @param portMapping The portMapping string captured from an input field
     * @param validPorts List of valid named ports
     * @returns A ValidationResult object describing the first error found.
     */
    validatePortMapping(portMapping: string, validPorts: ExtractedPort[] = []): ValidationResult | undefined {
        const portPairs = portMapping.split(' ');
        const validationResults = portPairs.map((pair) => this.validatePortPair(validPorts, pair));

        return validationResults.find((result) => !result.valid);
    }

    /**
     * Validates a single port mapping
     * @param validPorts List of valid named ports
     * @param portPair The port pair to validate
     * @returns An error to be displayed, or undefined
     */
    validatePortPair(validPorts: ExtractedPort[], portPair: string): ValidationResult {
        const splitMapping = portPair.split(':');

        // User provided only the target port
        if (!portPair.includes(':') && this.isPortValid(validPorts, portPair, PortSpecifier.Required)) {
            return {
                valid: true
            };
        }

        // User provided local:target port mapping
        if (splitMapping.length > 2) {
            return {
                valid: false,
                error: `Invalid port mapping: ${portPair}`
            };
        }

        const localPort = splitMapping[0];
        const targetPort = splitMapping[1];

        if (
            this.isPortValid(validPorts, localPort, PortSpecifier.AllowEmpty) &&
            this.isPortValid(validPorts, targetPort, PortSpecifier.Required)
        ) {
            return {
                valid: true
            };
        }

        return {
            valid: false,
            error: 'Invalid ports. Please enter a valid port mapping ie: 8888:5000 or 5000. Valid port range:  1 – 65535'
        };
    }

    /**
     * Validates if the port is a named port or withing the valid range
     * @param validPorts List of valid named ports
     * @param port The port to validate
     * @param portSpec Can the port be empty or zero
     * @returns Boolean identifying if the port is valid
     */
    isPortValid(validPorts: ExtractedPort[], port: string, portSpec: PortSpecifier): boolean {
        if (validPorts.map(({ name }) => name).includes(port)) {
            return true;
        }
        if (portSpec === PortSpecifier.AllowEmpty && ['', '0'].includes(port)) {
            return true;
        }
        return 0 < Number(port) && Number(port) <= 65535;
    }

    /**
     * Builds and returns multiple PortMapping objects
     * @param portString A validated, user provided string containing the port mappings
     * @param namedPorts List of valid named ports
     * @returns An array containing the requested PortMappings
     */
    buildPortMapping(portString: string, namedPorts: ExtractedPort[] = []): PortMapping[] {
        const portPairs = portString.split(' ');
        return portPairs.map((pair) => this.buildPortPair(namedPorts, pair));
    }

    /**
     * Builds a single PortMapping object from the captured user input
     * @param validPorts List of valid named ports
     * @param portPair The port string provided by the user
     * @returns PortMapping object
     */
    buildPortPair(validPorts: ExtractedPort[], portPair: string): PortMapping {
        // Only target port supplied.
        if (!portPair.includes(':')) {
            return {
                targetPort: this.buildPort(validPorts, portPair),
                localPort: undefined
            };
        }

        // Both local and target ports supplied.
        const splitString = portPair.split(':');
        const localPort = splitString[0];
        const targetPort = splitString[1];

        return {
            localPort: this.buildNullablePort(validPorts, localPort),
            targetPort: this.buildPort(validPorts, targetPort)
        };
    }

    /**
     * Builds a single numberic port for a PortMapping object from the captured user input allowing empty or zero value
     * @param validPorts List of valid named ports
     * @param port The port provided by the user
     * @returns The port provided by the user
     */
    buildNullablePort(validPorts: ExtractedPort[], port: string): number | undefined {
        if (['', '0'].includes(port)) {
            return undefined;
        }
        return this.buildPort(validPorts, port);
    }

    /**
     * Builds a single numberic port for a PortMapping object from the captured user input
     * @param validPorts List of valid named ports
     * @param port The port provided by the user
     * @returns numberic port number
     */
    buildPort(validPorts: ExtractedPort[], port: string): number {
        const validPort = validPorts.find(({ name }) => name === port);
        if (validPort) {
            return validPort.port;
        }
        return Number(port);
    }

    /**
     * Given a JSON representation of a Pod, extract the ports to suggest to the user
     * for port forwarding.
     */
    extractPodPorts(podJson: V1Pod): ExtractedPort[] {
        const containers = podJson.spec ? podJson.spec.containers : [];
        return this.extractContainerPorts(containers);
    }

    /**
     *  Given a JSON representation of a Service, extract the ports to suggest to the user
     * for port forwarding.
     */
    extractServicePorts(serviceJson: V1Service): ExtractedPort[] {
        const k8sPorts = serviceJson.spec ? (serviceJson.spec.ports || []) : [];
        return k8sPorts.map((k8sport) => ({
            name: k8sport.name || `port-${k8sport.port}`,
            port: k8sport.port,
        }));
    }

    /**
     * Given a JSON representation of a Deployment, extract the ports to suggest to the user
     * for port forwarding.
     */
    extractDeploymentPorts(deployment: V1Deployment): ExtractedPort[] {
        const spec = deployment.spec ? deployment.spec.template.spec : undefined;
        const containers = spec ? spec.containers : [];
        return this.extractContainerPorts(containers);
    }

    /**
     * Given a array of containers, extract the ports to suggest to the user
     * for port forwarding.
     */
    extractContainerPorts(containers: V1Container[]): ExtractedPort[] {
        const ports = Array.of<ExtractedPort>();
        containers.forEach((container) => {
            if (container.ports) {
                const containerPorts = container.ports.map(({ name, containerPort }) => ({
                    name: name || `port-${containerPort}`,
                    port: containerPort
                }));
                ports.push(...containerPorts);
            }
        });
        return ports;
    }

}
