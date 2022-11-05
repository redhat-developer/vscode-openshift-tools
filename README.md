<div align="center">

# <img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/cluster-node.png" width="30" height="30" /><span style="margin: 5px">OpenShift Toolkit

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-openshift-connector?style=for-the-badge&label=VS%20Marketplace&logo=visual-studio-code&color=blue)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/redhat.vscode-openshift-connector?style=for-the-badge&color=purple)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)
[![Gitter](https://img.shields.io/gitter/room/redhat-developer/vscode-openshift-tools?style=for-the-badge&logo=gitter)](https://gitter.im/redhat-developer/openshift-connector)
[![Build Status](https://img.shields.io/github/workflow/status/redhat-developer/vscode-openshift-tools/CI?style=for-the-badge&logo=github)](https://github.com/redhat-developer/vscode-openshift-tools/actions?query=workflow%3ACI)
[![Unit Tests Code Coverage](https://img.shields.io/codecov/c/github/redhat-developer/vscode-openshift-tools?logo=codecov&style=for-the-badge)](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/main/graph/badge.svg)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=for-the-badge)](https://github.com/redhat-developer/vscode-openshift-tools/blob/main/LICENSE)


[Getting Started](#getting-started) •
[Quick Start Guide](#quick-start---showcasing-component-creation) •
[Commands and Features](#commands-and-features) •
[Feedback](#feedback)
</div>

## Overview

The OpenShift Toolkit extends Visual Studio Code to provide all of the power and convenience of IDEs for developing cloud-native Kubernetes applications, without leaving the comfort of your IDE. For a developer to run the local code on an OpenShift instance, test & debug it and deploy it on production without worrying about the complexities around different K8s tools.

OpenShift Toolkit extension provides an end-to-end developer experience for Red Hat® OpenShift®. Using this extension:
 - Developers can easily create, deploy and live debug container applications running on OpenShift.
 - Create [devfile](https://devfile.io) based components directly from Devfile Registries View
 - Deploy git repositories directly on OpenShift through Import from Git guided workflow
 - Developers can view and edit Resources YAML manifests, and view logs for pods, deployments, and deployment configs. The extension also allows users to view these resources in the cluster dashboard.
 - Run local instance of OpenShift 4.11.7 using [OpenShift Local](https://crc.dev/crc/) directly from IDE
 - Connect & Provision free [Developer Sandbox for Red Hat OpenShift](https://developers.redhat.com/developer-sandbox) instance from IDE

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/gif/vscode-openshift-tools.gif)

## Getting Started

### Install

[Open this extension in the Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)

The OpenShift Toolkit extension provides multiple views to the user once it is launched.

1. `Application Explorer View`: Showcases the cluster connected to and the resources present in the cluster. The cluster URL, Project, Deployment and Deployment Configs are shown in the tree view.

2. `Components View`: Displays the components created and also the actions associated with the component based on the state in which it is( running or stopped). Allows user to create components from local workspace or directly from git repository.

3. `Devfile Registries View`: Contains the [Default Devfile Registry](https://registry.devfile.io/viewer) to browse and create components from the devfile stacks provided. Users can their own custom registry to the view and create components.

4. `Debug Sessions View`: Once the debug session is active, the associate component is displayed in this view.
### Provision new OpenShift Cluster

The extension provides users with multiple ways to provision an instance of OpenShift to get started. Click on `Add OpenShif Cluster` which opens webview to select the way to get connected with a new OpenShift instance.

#### `Red Hat OpenShift Developer Sandbox`

The extension allows users free access to the [Developer Sandbox for Red Hat OpenShift](https://developers.redhat.com/developer-sandbox/get-started). From `Add Cluster View`, users can provision and connect to dev sandbox instance using the guided workflow. The sandbox provides you with a private OpenShift environment in a shared, multi-tenant OpenShift cluster that is pre-configured with a set of developer tools.

#### `Local instance of OpenShift`

The extension allows the developers to provision a local instance of OpenShift cluster using the guided workfflow from the extension. It runs [OpenShift Local](https://crc.dev/crc/) which provides a single node local OpenShift 4.x cluster.

Please follow this [guide](README.crc-workflow.md) to understand the guided workflow to provision OpenShift locally.
`
#### `Provision Hybrid Cloud`

To install OpenShift Container Platform 4 in the public cloud, in your datacenter or on your laptop please visit [Red Hat Hybrid Cloud console](https://console.redhat.com/openshift/create). Here are different scenarios to try OpenShift:

* [Red Hat OpenShift Cluster Manager](https://console.redhat.com/openshift/create/datacenter) - This 60-day, self-supported trial lets you install and run Red Hat OpenShift Container Platform on infrastructure you manage.
* [Red Hat OpenShift Dedicated](https://console.redhat.com/openshift/create/osdtrial) - Red Hat OpenShift Dedicated is a fully managed service of Red Hat OpenShift on Amazon Web Services (AWS) and Google Cloud.
* [Azure Red Hat OpenShift](http://red.ht/3oeVPjM) - Azure Red Hat OpenShift is a fully-managed service of Red Hat OpenShift on Azure, jointly engineered, managed and supported by Microsoft and Red Hat.
* [Red Hat OpenShift Service on AWS (ROSA)](https://console.redhat.com/openshift/create/rosa/wizard) - Build, deploy, and manage Kubernetes applications with Red Hat OpenShift running natively on AWS.

## Quick Start - Showcasing Component Creation

Users can create components in a faster and intuitive way in few clicks using the following workflows:
### `Import From Git`

Users can directly deploy the git repo code on top of OpenShift/Kubernetes cluster. The guided workflow allows them to provide git repository and the extension detects the files in the repo and recoommends a deployment strategy to deploy on cluster. Users can also provide their own custom deployment strategy and create a component directly from the webview. This provides a One-click deployment from Git to OpenShift

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/gif/git-import.gif)

### `Create component from devfile registry`

In the Devfile Registries view, there is an action to `Open Registry View` which opens a webview to browse devfile stacks consisting of supported registries. Users can create components directly from any selected stack and deploy on OpenShift

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/walkthrough/showRegistries.gif)
##  Commands and Features

The extension supports a number of commands to interact with OpenShift clusters and resources. The commands are accessible via the command palette (`Cmd+Shift+P` <kbd>⌘⇧P</kbd> on macOS or `Ctrl+Shift+P` <kbd>⌃⇧P</kbd> on Windows and Linux), Visual Studio Code View title buttons and tree context menus.
### Core Concepts

* `Project`: A project is your source code, tests, and libraries organized in a separate single unit
* `Application`: An application is a program designed for end users. An application consists of multiple microservices or components that work individually to build the entire application. Examples of applications: e-Shop, Hotel Reservation System, Online Booking
* `Component`: A component is a set of Kubernetes resources which host code or data. Each component can be run and deployed separately. Examples of components: Warehouse API Backend, Inventory API, Web Frontend, Payment Backend
* `Service`: A service is software that your component links to or depends on. Examples of services: MariaDB, MySQL
* `Devfile`: A devfile is a portable YAML file containing the definition of a component and its related URLs, storages and services.

#### Commands in OpenShift Application Explorer View

* `Log in to cluster` - Log in to your cluster and save login for subsequent use.
    * Credentials : Log in to the given cluster with the given credentials.
    * Token : Login using bearer token for authentication to the API server.
* `Open Console Dashboard` - Open the OpenShift Developer Console in default browser.
* `New Project` - Create new Project inside the OpenShift Cluster.
* `Log out` - Log out of the current OpenShift Cluster.
* `About` - Provide the information about the OpenShift tools.
* `Show Output Channel` - Show commands running under the hood and their output.
* `Create` - Create an OpenShift resource using `.json` or `.yaml` file location from an active editor.

#### Commands for a Project in Application Explorer

   * `New Component` - Create a new Component in the Project.
   * `Delete` - Delete an existing Project.
   * `Change Active Project` - Change active Project displayed in OpenShift Application View.

#### Commands for a Component in Components View

Actions available in Components View

   * `Import from Git` - Deploy a git repository directly on OpenShift using a guided workflow
   * `New Component` - Create a component from the available registries.

Commands available in context for the compenent

   * `Start Dev` - The application has been built and deployed to the cluster and the application is port-forwarded for local accessibility. The extension will watch for changes in the current directory and rebuild the application when changes are detected.
   * `Stop Dev` - Stop the dev command workflow and resources are cleaned, hence the application is not running on the cluster
   * `Show Dev Terminal` - Directly opens the VSCode terminal where the dev command is running.
   * `Describe` - Describe the given Component in terminal window or inside a webview editor.
   * `Show Log` - Retrieve the log for the given Component in the terminal or inside a webview editor (can be changed in VSCode Settings)
   * `Follow Log` - Follow logs for the given Component in the terminal or inside a webview editor (can be changed in VSCode Settings)
   * `Open in Browser` - Open the exposed URL in default browser.
   * `Deploy` - Deploys a Component on the cluster by first building the images of the containers to deploy, then by deploying the Kubernetes resources necessary to deploy the components.
   * `Undeploy` - Undeploys a Component from the cluster. The component still resides in the local config.
   * `Debug` - Start the component in debug mode
   * `Reveal in Explorer` - Show Component's context folder in Explorer view

**NOTE:** Currently we support creation of one component per folder. Multiple components from a folder might be supported in
future releases.
## Extension Configuration Settings
   * `OpenShift Toolkit: Show Channel On Output` - Show OpenShift Toolkit output channel when new text added to output stream
   * `OpenShift Toolkit: Output verbosity level` - Output verbosity level (value between 0 and 9) for OpenShift Create, Push and Watch commands in output channel and terminal view
   * `OpenShift Toolkit: Search CLI tools in PATH locations before using included binaries` - Force extension to search for `oc` and `odo` CLI tools in PATH locations before using bundled binaries
   * `OpenShift Toolkit: Use Webview based editors to show 'Show Log', 'Follow Log' and 'Describe' commands output` - Use Webview based editors instead of Terminal view to show or follow logs
   * `OpenShift Toolkit: CRC Executable Location` - Provide the path where OpenShift Local is installed.
   * `OpenShift Toolkit: CRC Pull Secret Path` - Provide the path where the pull secret file is present.
   * `OpenShift Toolkit: CRC Cpu Cores` - Number of CPU cores to allocate to the OpenShift cluster as selected during the first run.
   * `OpenShift Toolkit: CRC Memory Allocation` - MiB of memory to allocate to the OpenShift cluster as selected during the first run.

## View OpenShift Resources

This Extension uses Kubernetes Extension API to show OpenShift specific resources like Projects, Routes, Deployment Configs, Image Streams, Templates and others in Kubernetes Clusters View.

OpenShift Toolkit extension provides ```Use Project``` command to switch between OpenShift Projects. It is available for Project items in Kubernetes Clusters View.

![ useproject ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/use-project.png)

## Dependencies

### Extensions

When installing the extension directly from the VSCode marketplace all the dependencies are installed automatically. For disconnected environments,before installing the extension download and install dependencies in the order listed below:

* [Red Hat Authentication](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-redhat-account)
* [YAML Extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)
* [Kubernetes Extension](https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.vscode-kubernetes-tools)

### CLI Tools

This extension uses two CLI tools to interact with OpenShift cluster:
* OKD CLI client tool - [oc](https://mirror.openshift.com/pub/openshift-v4/clients/ocp/4.9.5/)
* odo - [odo](https://developers.redhat.com/content-gateway/rest/mirror/pub/openshift-v4/clients/odo/v3.0.0/)

> `oc` and `odo` tools for Windows, Linux and macOS are included into extension package. Once the extension is installed, it is ready to use.

Follow the links below for additional information:

* [Understanding odo](https://odo.dev/)
* [Devfile ecosystem](https://devfile.io/)

## Release Notes

See the [change log](CHANGELOG.md).

## Contributing

This is an open source project open to anyone. This project welcomes contributions and suggestions!

For information on getting started, refer to the [CONTRIBUTING instructions](CONTRIBUTING.md).

Download the most recent `openshift-toolkit-<version>.vsix` file from the [release](https://github.com/redhat-developer/vscode-openshift-tools/releases) and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix). Stable releases are archived [here](https://download.jboss.org/jbosstools/adapters/stable/vscode-openshift-tools/).

## Feedback

If you discover an issue please file a bug and we will fix it as soon as possible.
* File a bug in [GitHub Issues](https://github.com/redhat-developer/vscode-openshift-tools/issues).
* Chat with us on [Gitter](https://gitter.im/redhat-developer/openshift-connector).
* Open a [Discussion on GitHub](https://github.com/redhat-developer/vscode-openshift-tools/discussions).

## License

MIT, See [LICENSE](LICENSE) for more information.

## Data and telemetry

The Red Hat OpenShift Toolkit for Visual Studio Code collects anonymous [usage data](USAGE_DATA.md) and sends it to Red Hat servers to help improve our products and services. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) to learn more. This extension respects the `redhat.telemetry.enabled` setting which you can learn more about at https://github.com/redhat-developer/vscode-commons#how-to-disable-telemetry-reporting
