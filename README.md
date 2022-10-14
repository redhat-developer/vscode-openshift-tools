# OpenShift Connector

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-openshift-connector?style=for-the-badge&label=VS%20Marketplace&logo=visual-studio-code&color=blue)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/redhat.vscode-openshift-connector?style=for-the-badge&color=purple)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)
[![Gitter](https://img.shields.io/gitter/room/redhat-developer/vscode-openshift-tools?style=for-the-badge&logo=gitter)](https://gitter.im/redhat-developer/openshift-connector)
[![Build Status](https://img.shields.io/github/workflow/status/redhat-developer/vscode-openshift-tools/CI?style=for-the-badge&logo=github)](https://github.com/redhat-developer/vscode-openshift-tools/actions?query=workflow%3ACI)
[![Unit Tests Code Coverage](https://img.shields.io/codecov/c/github/redhat-developer/vscode-openshift-tools?logo=codecov&style=for-the-badge)](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/main/graph/badge.svg)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=for-the-badge)](https://github.com/redhat-developer/vscode-openshift-tools/blob/main/LICENSE)

## Overview

OpenShift Connector extension provides an end-to-end developer experience for Red Hat® OpenShift®. Using this extension:
 - Developers can easily create, deploy and live debug container applications running on OpenShift.
 - Create [devfile](https://devfile.io/docs/devfile/2.1.0/user-guide/) based components directly from DefaultRegistry View
 - Follow logs for the deployed applications on OpenShift
 - Run local instance of OpenShift 4.11.7 using [OpenShift Local](https://crc.dev/crc/) directly from IDE
 - Connect & Provision free [Developer Sandbox for Red Hat OpenShift](https://developers.redhat.com/developer-sandbox) instance from IDE

### Demo: https://www.youtube.com/watch?v=HEsYgDqD1rM

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/gif/vscode-openshift-tools.gif)

### Supported OpenShift Clusters

#### Developer Sandbox

The extension allows users free access to the [Developer Sandbox for Red Hat OpenShift](https://developers.redhat.com/developer-sandbox/get-started). From `Add Cluster View`, users can provision and connect to dev sandbox instance using the guided workflow. The sandbox provides you with a private OpenShift environment in a shared, multi-tenant OpenShift cluster that is pre-configured with a set of developer tools.

#### Local instance of OpenShift

This extension can work with local or remote OpenShift clusters.

To provision local instance of OpenShift cluster, developers can use the following options:
* [OpenShift Local](https://crc.dev/crc/) - run single node local OpenShift 4.x cluster

#### Public cloud providers

To install OpenShift Container Platform 4 in the public cloud, in your datacenter or on your laptop please visit [Red Hat Hybrid Cloud console](https://console.redhat.com/openshift/create). Here are different scenarios to try OpenShift:

* [Red Hat OpenShift Cluster Manager](https://console.redhat.com/openshift/create/datacenter) - This 60-day, self-supported trial lets you install and run Red Hat OpenShift Container Platform on infrastructure you manage.
* [Red Hat OpenShift Dedicated](https://console.redhat.com/openshift/create/osdtrial) - Red Hat OpenShift Dedicated is a fully managed service of Red Hat OpenShift on Amazon Web Services (AWS) and Google Cloud.
* [Microsoft Azure Red Hat OpenShift](http://red.ht/3oeVPjM) - Azure Red Hat OpenShift is a fully-managed service of Red Hat OpenShift on Azure, jointly engineered, managed and supported by Microsoft and Red Hat.

## Core Concepts

* `Project`: A project is your source code, tests, and libraries organized in a separate single unit
* `Application`: An application is a program designed for end users. An application consists of multiple microservices or components that work individually to build the entire application. Examples of applications: e-Shop, Hotel Reservation System, Online Booking
* `Component`: A component is a set of Kubernetes resources which host code or data. Each component can be run and deployed separately. Examples of components: Warehouse API Backend, Inventory API, Web Frontend, Payment Backend
* `Service`: A service is software that your component links to or depends on. Examples of services: MariaDB, MySQL
* `Devfile`: A devfile is a portable YAML file containing the definition of a component and its related URLs, storages and services.

##  Commands and Features

The extension supports a number of commands to interact with OpenShift clusters and resources. The commands are accessible via the command palette (`Cmd+Shift+P` <kbd>⌘⇧P</kbd> on macOS or `Ctrl+Shift+P` <kbd>⌃⇧P</kbd> on Windows and Linux), Visual Studio Code View title buttons and tree context menus.

### Commands Available in OpenShift Application Explorer View

#### Commands for a Cluster

* `Log in to cluster` - Log in to your cluster and save login for subsequent use.
    * Credentials : Log in to the given cluster with the given credentials.
    * Token : Login using bearer token for authentication to the API server.
* `List catalog components` - List all available Component Types.
* `List catalog services` - List all available Services e.g. mysql-persistent.
* `New Project` - Create new Project inside the OpenShift Cluster.
* `About` - Provide the information about the OpenShift tools.
* `Log out` - Log out of the current OpenShift Cluster.
* `Show Output Channel` - Show commands running under the hood and their output.
* `Open Console Dashboard` - Open the OpenShift Developer Console in default browser.
* `Create` - Create an OpenShift resource using `.json` or `.yaml` file location from an active editor.
* `Set Active Project` - Change active Project displayed in OpenShift Application View.

#### Commands for a Project

   * `New Component` - Create a new Component in the Project.
   * `New Service` - Perform Service Catalog operations when it is enabled.
   * `Delete` - Delete an existing Project.
   * `Set Active Project` - Change active Project displayed in OpenShift Application View.

#### Commands for an Application

   * `New Component` - Create a new Component inside the selected Application.
   * `New Service` - Perform Service Catalog operations when it is enabled.
   * `Describe` - Describe the given Application in terminal window.
   * `Delete` - Delete an existing Application.

#### Commands for a Component

Components can be in one of 3 states:

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
   * `Watch` - Watch for changes, update Component on change.
   * `Undeploy` - Undeploys a Component from the cluster. The component still resides in the local config.
   * `Debug` - Debug local Java, Node.js and Python Component.
   * `Test` - Run test for the Component in cluster.
   * `Reveal in Explorer` - Show Component's context folder in Explorer view
   * `Delete` - Delete existing Component from the cluster and removes the local config also.

##### Commands for a `not pushed` Component

   * `New URL` - Expose Component to the outside world. The URLs that are generated using this command, can be used to access the deployed Components from outside the Cluster.
   * `New Storage` - Create Storage and mount to a Component. Push the component to reflect the changes on the cluster.
   * `Describe` - Describe the given Component in terminal window or inside a webview editor.
   * `Push` - Push the source code to a Component.
   * `Delete` - Delete existing Component the local configuration and remove context from workspace.

##### Commands for a `no context` Component

   * `Describe` - Describe the given Component in terminal window or inside a webview editor.
   * `Delete` - Delete existing Component from the cluster.

##### Commands for a URL in a Component

   * `Delete` - Delete a URL from a Component.
   * `Open URL` - Open the specific URL in Browser.
   * `Describe` - Describe the given URL for the Component in terminal window.

##### Commands for a Storage

   * `Delete` - Delete a Storage from a Component.

##### Commands for a Service

   * `Describe` - Describe a Service Type for a selected Component
   * `Delete` - Delete a Service from an Application

**NOTE:** Currently we support creation of one component per folder. Multiple components from a folder might be supported in
future releases.

### Running OpenShift Locally

The extension provides a view to run local instance of OpenShift from IDE. To open the view use `Add OpenShift Cluster` button
![ addclusterbutton ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/add-cluster-button.gif)
from `OpenShift: Application Explorer` view title.

![ addcluster ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/add-cluster.gif)

The view provides a guided workflow to create and start OpenShift 4 single node cluster on your workstation
using OpenShift Local (formerly Red Hat CodeReady Containers):

   * Download & Install OpenShift Local
   * Set Virtual Machine parameters: number of CPUs and memory limit
   * Setup OpenShift Local
   * Run OpenShift Local commands to setup/start the cluster

The view provides following options to control cluster's state:

   * Start cluster
   * Stop cluster
   * Open OpenShift Developer Console for cluster
   * Refresh cluster's state

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/gif/crc-webview.gif)

### Debug Support

`OpenShift: Debug` command simplifies the way to start debugging for OpenShift Components pushed to a cluster. It supports following devfile components: Node.js, Java and Python (including Django)

### Debug Node.js Component

Default Visual Studio Code installation includes JavaScript/TypeScript Language Support and Debugger Extensions required to debug a Node.js Component. That means new `OpenShift: Debug` command can be used without installing any additional extensions.

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/gif/debug-node.gif)

### Debug Java Component

To debug a Java Component, [Java Language Support](https://marketplace.visualstudio.com/items?itemName=redhat.java) and [Java Debugger](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) Extensions are required. OpenShift Connector extension will prompt the user to install missing extension(s) before it starts Debugger for a Java Component.

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/gif/debug-java.gif)

## Icons for OpenShift Application Explorer View Items

<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/title/readme/add-cluster.png" width="15" height="15" /><span style="margin: 20px">Add OpenShift Cluster</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/title/readme/icon-login.png" width="15" height="15" /><span style="margin: 20px">Log in to Cluster</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/title/readme/icon-refresh.png" width="15" height="15" /><span style="margin: 20px">Refresh Cluster</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/cluster-node.png" width="15" height="15" /><span style="margin: 20px">Cluster Resource Node</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/project-node.png" width="15" height="15" /><span style="margin: 20px">Project Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/application-node.png" width="15" height="15" /><span style="margin: 20px">Application Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/component/git.png" width="15" height="15" /><span style="margin: 20px">Git Component Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/component/workspace.png" width="15" height="15" /><span style="margin: 20px">Local Workspace Component Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/component/binary.png" width="15" height="15" /><span style="margin: 20px">Binary File Component Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/service-node.png" width="15" height="15" /><span style="margin: 20px">Service Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/storage-node.png" width="15" height="15" /><span style="margin: 20px">Storage Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/url-node.png" width="15" height="15" /><span style="margin: 20px">URL Resource</span></div>
<div><img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/url-node-open.png" width="15" height="15" /><span style="margin: 20px">Open URL</span></div>

## Extension Configuration Settings
   * `OpenShift Connector: Show Channel On Output` - Show OpenShift Connector output channel when new text added to output stream
   * `OpenShift Connector: Output verbosity level` - Output verbosity level (value between 0 and 9) for OpenShift Create, Push and Watch commands in output channel and terminal view
   * `OpenShift Connector: Search CLI tools in PATH locations before using included binaries` - Force extension to search for `oc` and `odo` CLI tools in PATH locations before using bundled binaries
   * `OpenShift Connector: Use Webview based editors to show 'Show Log', 'Follow Log' and 'Describe' commands output` - Use Webview based editors instead of Terminal view to show or follow logs
   * `OpenShift Connector: CRC Executable Location` - Provide the path where OpenShift Local is installed.
   * `OpenShift Connector: CRC Pull Secret Path` - Provide the path where the pull secret file is present.
   * `OpenShift Connector: CRC Cpu Cores` - Number of CPU cores to allocate to the OpenShift cluster as selected during the first run.
   * `OpenShift Connector: CRC Memory Allocation` - MiB of memory to allocate to the OpenShift cluster as selected during the first run.

## OpenShift Resources

This Extension uses Kubernetes Extension API to show OpenShift specific resources like Projects, Routes, Deployment Configs, Image Streams, Templates and others in Kubernetes Clusters View.

OpenShift Connector extension provides ```Use Project``` command to switch between OpenShift Projects. It is available for Project items in Kubernetes Clusters View.

![ useproject ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/use-project.png)

**NOTE:** This extension is in Preview mode. The extension support for OpenShift is strictly experimental - assumptions may break, commands and behavior may change!

**NOTE:** OpenShift Local (formerly Red Hat CodeReady Containers) version supported by the extension is `2.4.1` (OpenShift Version: `4.10.14`)

## Dependencies

### Extensions

When installing the extension directly from the VSCode marketplace all the dependencies are installed automatically. For disconnected environments before installing the extension download and install dependencies in the order listed below:

* [Red Hat Commons](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-commons) ([download vsix](https://marketplace.visualstudio.com/_apis/public/gallery/publishers/redhat/vsextensions/vscode-commons/0.0.6/vspackage))
* [YAML Extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) ([download vsix](https://marketplace.visualstudio.com/_apis/public/gallery/publishers/redhat/vsextensions/vscode-yaml/1.1.0/vspackage))
* [Kubernetes Extension](https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.vscode-kubernetes-tools) ([download vsix](https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-kubernetes-tools/vsextensions/vscode-kubernetes-tools/1.3.3/vspackage))

### CLI Tools

This extension uses two CLI tools to interact with OpenShift cluster:
* OKD CLI client tool - [oc](https://mirror.openshift.com/pub/openshift-v4/clients/ocp/4.9.5/)
* odo - [odo](https://developers.redhat.com/content-gateway/rest/mirror/pub/openshift-v4/clients/odo/v2.5.1/)

> `oc` and `odo` tools for Windows, Linux and macOS are included into extension package. Once the extension is installed it is ready to use.

Follow the links below for additional information:

* [Understanding odo](https://odo.dev/docs/getting-started/features)
* [Devfile file reference](https://devfile.io/docs/devfile/2.1.0/user-guide/index.html)
## Breaking Changes Between Previous Releases

### Updating from release `0.0.23` or earlier

* The Components created with previous versions(<=0.0.23) will no longer be visible in OpenShift Application Explorer view.
* The Extension will prompt the user to specify the context folder when creating new Components and then add selected folder to workspace.
* New Component, Url and Storage objects are created locally in context folder and not immediately pushed to the cluster.

> **Please follow the [migration](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0-or-higher) guide to resolve any possible issues.**

In case of any queries, please use the [Feedback & Question](#Feedback-&-Questions) section.

## Release Notes

See the [change log](CHANGELOG.md).

## Contributing

This is an open source project open to anyone. This project welcomes contributions and suggestions!

For information on getting started, refer to the [CONTRIBUTING instructions](CONTRIBUTING.md).

Download the most recent `openshift-connector-<version>.vsix` file from the [release](https://github.com/redhat-developer/vscode-openshift-tools/releases) and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix). Stable releases are archived [here](https://download.jboss.org/jbosstools/adapters/stable/vscode-openshift-tools/).

## Feedback & Questions

If you discover an issue please file a bug and we will fix it as soon as possible.
* File a bug in [GitHub Issues](https://github.com/redhat-developer/vscode-openshift-tools/issues).
* Chat with us on [Gitter](https://gitter.im/redhat-developer/openshift-connector).

## License

MIT, See [LICENSE](LICENSE) for more information.

## Data and telemetry

The Red Hat OpenShift Connector for Visual Studio Code collects anonymous [usage data](USAGE_DATA.md) and sends it to Red Hat servers to help improve our products and services. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) to learn more. This extension respects the `redhat.telemetry.enabled` setting which you can learn more about at https://github.com/redhat-developer/vscode-commons#how-to-disable-telemetry-reporting
