# Visual Studio Code OpenShift Connector

[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/redhat.vscode-openshift-connector.svg)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector) [![Gitter](https://badges.gitter.im/redhat-developer/openshift-connector.svg)](https://gitter.im/redhat-developer/openshift-connector) [![Build Status](https://github.com/redhat-developer/vscode-openshift-tools/workflows/CI/badge.svg)](https://github.com/redhat-developer/vscode-openshift-tools/actions?query=workflow%3ACI) [![Unit Tests Code Coverage](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/master/graph/badge.svg)](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/master/graph/badge.svg) [![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://github.com/redhat-developer/vscode-openshift-tools/blob/master/LICENSE)

## Overview

OpenShift Connector extension provides an end-to-end developer experience for Red Hat® OpenShift®. Using this extension:
 - Developers can easily create, deploy and live debug applications running on OpenShift.
 - Run local instance of OpenShift 4.x using [Red Hat Code Ready Containers](https://cloud.redhat.com/openshift/install/crc/installer-provisioned).

### Demo: https://youtube.com/watch?v=m0wBKuKDYO0

[![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/vscode-openshift-tools.gif)](https://youtube.com/watch?v=m0wBKuKDYO0)

### Supported OpenShift Clusters

This extension can work with local or remote OpenShift clusters.

To provision local instance of OpenShift cluster, developers can use the following options:
* [CodeReadyContainers](https://cloud.redhat.com/openshift/install/crc/installer-provisioned) - run single node local OpenShift 4.x cluster
* [minishift](https://github.com/minishift/minishift/releases) / [CDK](https://developers.redhat.com/products/cdk/download/) - run single node local OpenShift 3.x cluster

For detail analysis of how to setup and run local OpenShift Cluster using minishift, please follow this [wiki](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Starting-Local-OpenShift-Instance).

If developers can't run OpenShift cluster locally, the extension can work with remote one provisioned with one of Red Hat products:
* [Red Hat OpenShift Container Platform](https://www.openshift.com/products/container-platform) - build, deploy and manage your applications across cloud- and on-premise infrastructure
* [Red Hat OpenShift Dedicated](https://www.openshift.com/products/dedicated/) - single-tenant, high-availability Kubernetes clusters in the public cloud
* [Microsoft Azure Red Hat OpenShift](https://www.openshift.com/products/azure-openshift) - fully managed Red Hat OpenShift service on Microsoft Azure
* [Red Hat OpenShift Online](https://www.openshift.com/products/online/) - the fastest way for developers to build, host and scale applications in the public cloud

When working with [OpenShift Online](https://www.openshift.com/products/online/) remote cluster only one component can be created for Starter plan and Pro plan with default 2GiB storage. If you want to create multi component application you could opt in for Pro plan with bigger persistence storage (up to 150GiB).

## Commands and Features

`vs-openshift-connector` supports a number of commands & actions for interacting with OpenShift clusters; these are accessible via the command menu (`Cmd+Shift+P` <kbd>⌘⇧P</kbd> on macOS or `Ctrl+Shift+P` <kbd>⌃⇧P</kbd> on Windows and Linux) and may be bound to keys in the normal way.

### Commands Available in OpenShift Application Explorer View

#### Commands for a Cluster

* `OpenShift: Log in to cluster` - Log in to your server and save login for subsequent use.
    * Credentials : Log in to the given server with the given credentials.
    * Token : Login using bearer token for authentication to the API server.
* `OpenShift: List catalog components` - List all available Component Types from OpenShift's Image Builder.
* `OpenShift: List catalog services` - Lists all available Services e.g. mysql-persistent.
* `OpenShift: New Project` - Create new project inside the OpenShift Cluster.
* `OpenShift: About` - Provides the information about the OpenShift tools.
* `OpenShift: Log out` - Logs out of the current OpenShift Cluster.
* `OpenShift: Show Output Channel` - Shows commands running under the hood and their output.
* `OpenShift: Open Console Dashboard` - Opens the OpenShift webconsole URL.
* `OpenShift: Create` - Creates an OpenShift resource using `.json` or `.yaml` file location from an active editor.
* `Set Active Project` - Changes active Project displayed in OpenShift Application View.

#### Commands for a Project

   * `New Component` - Create a new Component from the Project.
        * git - Use a git repository as a source for the Component.
        * binary - Use binary file as a source for the Component
        * local - Use local directory as a source for the Component.
   * `New Service` - Perform Service Catalog operations when it is enabled.
   * `Delete` - Delete an existing Project.
   * `Set Active Project` - Changes active Project displayed in OpenShift Application View.

#### Commands for an Application

   * `New Component` - Create a new Component inside the selected Application.
        * git - Use a git repository as a source for the Component.
        * binary - Use binary file as a source for the Component.
        * local - Use local directory as a source for the Component.
   * `New Service` - Perform Service Catalog operations when it is enabled.
   * `Describe` - Describe the given Application in terminal window.
   * `Delete` - Delete an existing Application.

#### Commands for a Component

Components can be in 3 stages:

   *  `pushed` - When the components are deployed into the cluster.
   *  `not pushed` - When the components are in local config but NOT deployed into the cluster.
   *  `no context` - When there is no context folder associated with the component in the workspace.

Components in different states have different set of commands available.

##### Commands for a `pushed` Component

   * `New URL` - Expose Component to the outside world. The URLs that are generated using this command, can be used to access the deployed Components from outside the Cluster. Push the component to reflect the changes on the cluster.
   * `New Storage` - Create Storage and mount to a Component. Push the component to reflect the changes on the cluster.
   * `Describe` - Describe the given Component in terminal window or inside a webview editor.
   * `Show Log` - Retrieve the log for the given Component or inside a webview editor
   * `Follow Log` - Follow logs for the given Component or inside a webview editor
   * `Link Component` - Link Component to another Component.
   * `Link Service` - Link Component to a Service.
   * `Unlink` - Unlink Component from Component/Service.
   * `Open in Browser` - Open the exposed URL in default browser.
   * `Push` - Push the source code to a Component.
   * `Watch` - Watch for changes, update Component on change. This is not supported for git based components.
   * `Undeploy` - Undeploys a Component from the cluster. The component still resides in the local config.
   * `Delete` - Delete existing Component from the cluster and removes the local config also.
   * `Debug` - Debug local Java or Node.js Component.

##### Commands for a `not pushed` Component

   * `New URL` - Expose Component to the outside world. The URLs that are generated using this command, can be used to access the deployed Components from outside the Cluster.
   * `New Storage` - Create Storage and mount to a Component. Push the component to reflect the changes on the cluster.
   * `Describe` - Describe the given Component in terminal window or inside a webview editor.
   * `Push` - Push the source code to a Component.
   * `Delete` - Delete existing Component the local configuration and remove context from workspace.

##### Commands for a `no context` Component

   * `Describe` - Describe the given Component in terminal window or inside a webview editor.
   * `Import` - If the component was created using old version of the extension (`<=0.0.23`), users can use the `Import` action to migrate to latest version and import the metadata changes.
   * `Delete` - Delete existing Component from the cluster.

##### Commands for a URL in a Component

   * `Delete` - Delete a URL from a Component.
   * `Open URL` - Click on the icon opens the specific URL in Browser.
   * `Describe` - Describe the given URL for the component in terminal window.

##### Commands for a Storage

   * `Delete` - Delete a Storage from a Component.

##### Commands for a Service

   * `Describe` - Describe a Service Type for a selected Component
   * `Delete` - Delete a Service from an Application

**NOTE:** Currently we support creation of one component per folder. Multiple components from a folder might be supported in future releases.

#### Debug Support

   * Supports Local Node.js and Java Components
   * Does not support git and binary based components

`OpenShift: Debug` command simplifies the way to start debugging for OpenShift Components pushed to a cluster. It is an experimental feature, because it is using experimental odo `debug` command under the hood and supports only local Java and Node.js components. The command is available from command palette and context menu for Component nodes in OpenShift Application Explorer view.

#### Debug Node.js Component

Default Visual Studio Code installation includes JavaScript/TypeScript Language Support and Debugger Extensions required to debug a Node.js Component. That means new `OpenShift: Debug` command can be used without installing any additional extensions.

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/debug-node.gif)

#### Debug Java Component

To debug a Java Component, [Java Language Support](https://marketplace.visualstudio.com/items?itemName=redhat.java) and [Java Debugger](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) Extensions are required. OpenShift Connector extension will prompt the user to install missing extension(s) before it starts Debugger for a Java Component.

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/debug-java.gif)

## Icons for OpenShift Application Explorer View Items

<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/title/readme/add-cluster.png" width="15" height="15" /><span style="margin: 20px">Add OpenShift Cluster</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/title/readme/icon-login.png" width="15" height="15" /><span style="margin: 20px">Log in to Cluster</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/title/readme/icon-refresh.png" width="15" height="15" /><span style="margin: 20px">Refresh Cluster</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/context/cluster-node.png" width="15" height="15" /><span style="margin: 20px">Cluster Resource Node</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/context/project-node.png" width="15" height="15" /><span style="margin: 20px">Project Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/context/application-node.png" width="15" height="15" /><span style="margin: 20px">Application Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/component/git.png" width="15" height="15" /><span style="margin: 20px">Git Component Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/component/workspace.png" width="15" height="15" /><span style="margin: 20px">Local Workspace Component Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/component/binary.png" width="15" height="15" /><span style="margin: 20px">Binary File Component Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/context/service-node.png" width="15" height="15" /><span style="margin: 20px">Service Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/context/storage-node.png" width="15" height="15" /><span style="margin: 20px">Storage Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/context/url-node.png" width="15" height="15" /><span style="margin: 20px">URL Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/context/url-node-open.png" width="15" height="15" /><span style="margin: 20px">Open URL</span></div>

## Extension Configuration Settings
   * `OpenShift Connector: Show Channel On Output` - Show OpenShift Connector output channel when new text added to output stream
   * `OpenShift Connector: Output verbosity level` - Output verbosity level (value between 0 and 9) for OpenShift Create, Push and Watch commands in output channel and terminal view
   * `OpenShift Connector: Search CLI tools in PATH locations before using included binaries` - Force extension to search for `oc` and `odo` CLI tools in PATH locations before using bundled binaries
   * `OpenShift Connector: Use Webview based editors to show 'Show Log', 'Follow Log' and 'Describe' commands output` - Use Webview based editors instead of Terminal view to show or follow logs
   * `Openshift Connector: CRC Binary Location` - Provide the path where the crc binary is present.
   * `Openshift Connector: CRC Pull Secret Path` - Provide the path where the pull secret file is present.
   * `Openshift Connector: CRC Cpu Cores` - Number of CPU cores to allocate to the OpenShift cluster as selected during the first run.
   * `Openshift Connector: CRC Memory Allocation` - MiB of memory to allocate to the OpenShift cluster as selected during the first run.

**NOTE:** CRC (Code Ready Containners) verrsion supported by the extension is `1.15.0` (OpenShift Version: `4.5.7`)

## Dependencies

### CLI Tools

This extension uses two CLI tools to interact with OpenShift cluster:
* OKD CLI client tool - [oc](https://mirror.openshift.com/pub/openshift-v4/clients/ocp/4.3.3)
* odo - [odo](http://mirror.openshift.com/pub/openshift-v4/clients/odo/v1.2.6/)

> `oc` and `odo` tools for Windows, Linux and macOS are included into extension package. Once the extension is installed it is ready to use.

### Extensions

This extension depends on Kubernetes Extension from Microsoft which is going to be installed automatically along with OpenShift Connector Extension. Latter is using Kubernetes Extension public API to show
OpenShift specific resources like Projects, Routes, Deployment Configs, Image Streams and Templates in Kubernetes Clusters View. Those resources are visible only for OpenShift clusters.

OpenShift Connector extension also provides ```Use Project``` command to switch between OpenShift Projects in Kubernetes Clusters View.

![ useproject ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/use-project.png)

**NOTE:** This extension is in Preview mode. The extension support for OpenShift is strictly experimental - assumptions may break, commands and behavior may change!

## Breaking Changes Between Previous Releases

### Updating from release `0.0.23` or earlier

* The Components created with previous versions(<=0.0.23) will no longer be visible in OpenShift Application Explorer view.
* The Extension will prompt the user to specify the context folder when creating new Components and then add selected folder to workspace.
* New Component, Url and Storage objects are created locally in context folder and not immediately pushed to the cluster.

> **Please follow the [migration](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0-or-higher) guide to resolve any possible issues.**

In case of any queries, please use the [Feedback & Question](#Feedback-&-Questions) section.

## Release Notes

See the [change log](CHANGELOG.md).

# Contributing

This is an open source project open to anyone. This project welcomes contributions and suggestions!

For information on getting started, refer to the [CONTRIBUTING instructions](CONTRIBUTING.md).

Download the most recent `openshift-connector-<version>.vsix` file from the [release](https://github.com/redhat-developer/vscode-openshift-tools/releases) and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix). Stable releases are archived [here](https://download.jboss.org/jbosstools/adapters/stable/vscode-openshift-tools/).

# Feedback & Questions

If you discover an issue please file a bug and we will fix it as soon as possible.
* File a bug in [GitHub Issues](https://github.com/redhat-developer/vscode-openshift-tools/issues).
* Chat with us on [Gitter](https://gitter.im/redhat-developer/openshift-connector).

# License

MIT, See [LICENSE](LICENSE) for more information.
