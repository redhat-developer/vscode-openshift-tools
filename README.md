<div align="center">

# <img src="https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/context/cluster-node.png" width="30" height="30" /><span style="margin: 5px">OpenShift Toolkit

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-openshift-connector?style=for-the-badge&label=VS%20Marketplace&logo=visual-studio-code&color=blue)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/redhat.vscode-openshift-connector?style=for-the-badge&color=purple)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)
[![Gitter](https://img.shields.io/gitter/room/redhat-developer/vscode-openshift-tools?style=for-the-badge&logo=gitter)](https://gitter.im/redhat-developer/openshift-connector)
[![Build Status](https://img.shields.io/github/actions/workflow/status/redhat-developer/vscode-openshift-tools/continuous-integration-workflow.yml?style=for-the-badge)](https://github.com/redhat-developer/vscode-openshift-tools/actions?query=workflow%3ACI)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg?style=for-the-badge)](https://github.com/redhat-developer/vscode-openshift-tools/blob/main/LICENSE)


[Getting Started](#getting-started) •
[Quick Start Guide](#quick-start---showcasing-component-creation) •
[Commands and Features](#commands-and-features) •
[Feedback](#feedback)
</div>

## Overview

The OpenShift Toolkit extends Visual Studio Code to provide all of the power and convenience of IDEs for developing cloud-native Kubernetes applications, without leaving the comfort of your IDE. For a developer to run the local code on an OpenShift instance, test & debug it and deploy it on production without worrying about the complexities around different K8s tools.

OpenShift Toolkit extension provides an end-to-end developer experience for Red Hat® OpenShift®. Using this extension:
 - Developers can easily create, deploy and live debug container applications running on OpenShift, podman and Hybrid cloud.
    - Convert local codebases and git repositories into components that can be debugged on OpenShift through the _Create Component_ guided workflow.
    - Create new [devfile](https://devfile.io) based components from a template project using the _Create Component_ or _Devfile Registries View_ guided workflows.
 - Browse & Install [Helm Charts](https://helm.sh/) on to the cluster directly from IDE.
 - Developers can view and edit Resources YAML manifests, and view logs for pods, deployments, and deployment configs.
 - Run local instance of OpenShift 4.x using [OpenShift Local](https://crc.dev/crc/) directly from IDE
 - Connect & Provision free [Developer Sandbox for Red Hat OpenShift](https://developers.redhat.com/developer-sandbox) instance without leaving the IDE

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/walkthrough/create-component-demo.gif)
## Getting Started

### Install

[Open this extension in the Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)

The OpenShift Toolkit extension provides multiple views to the user once it is launched.

<code>1. Application Explorer View</code>: Showcases the cluster connected to and the resources present in the cluster. The cluster URL, Project, Deployment and Deployment Configs are shown in the tree view.

<code>2. Components View</code>: Displays the components created and also the actions associated with the component based on the state in which it is (running or stopped). Allows user to create components from an existing local codebase, from an existing git repository, or from a template project.

<code>3. Devfile Registries View</code>: Contains the [Default Devfile Registry](https://registry.devfile.io/viewer) to browse and create components from the devfile stacks provided. Users can add their own custom registry to the view and create components.

<code>4. Debug Sessions View</code>: Once the debug session is active, the associate component is displayed in this view.

## Provision new OpenShift Cluster

The extension provides users with multiple ways to provision an instance of OpenShift to get started. Click on _Add OpenShift Cluster_ which opens webview to select the way to get connected with a new OpenShift instance.

<pre>Red Hat OpenShift Developer Sandbox</pre>

The extension allows users FREE access to the [Developer Sandbox for Red Hat OpenShift](https://developers.redhat.com/developer-sandbox/get-started). From `Add Cluster View`, users can provision and connect to dev sandbox instance using the guided workflow. The sandbox provides you with a private OpenShift environment in a shared, multi-tenant OpenShift cluster that is pre-configured with a set of developer tools.

<pre>Local instance of OpenShift</pre>

The extension allows the developers to provision a local instance of OpenShift cluster using the guided workfflow from the extension. It runs [OpenShift Local](https://crc.dev/crc/) which provides a single node local OpenShift 4.x cluster.

- Please follow this [guide](README.crc-workflow.md) to understand the guided workflow to provision OpenShift locally.

<pre>Provision Hybrid Cloud</pre>

To install OpenShift Container Platform 4 in the public cloud, in your datacenter or on your laptop please visit [Red Hat Hybrid Cloud console](https://console.redhat.com/openshift/create). Here are different scenarios to try OpenShift:

* [Red Hat OpenShift Cluster Manager](https://console.redhat.com/openshift/create/datacenter) - This 60-day, self-supported trial lets you install and run Red Hat OpenShift Container Platform on infrastructure you manage.
* [Red Hat OpenShift Dedicated](https://console.redhat.com/openshift/create/osdtrial) - Red Hat OpenShift Dedicated is a fully managed service of Red Hat OpenShift on Amazon Web Services (AWS) and Google Cloud.
* [Azure Red Hat OpenShift](http://red.ht/3oeVPjM) - Azure Red Hat OpenShift is a fully-managed service of Red Hat OpenShift on Azure, jointly engineered, managed and supported by Microsoft and Red Hat.
* [Red Hat OpenShift Service on AWS (ROSA)](https://console.redhat.com/openshift/create/rosa/wizard) - Build, deploy, and manage Kubernetes applications with Red Hat OpenShift running natively on AWS.

## Quick Start - Showcasing Component Creation

Users can create components in a faster and intuitive way in few clicks using the following workflows:
### **Create Component**

This guided workflow allows you to configure a project so that it can be run and debugged on OpenShift/Kubernetes.
You can use an existing local code base,
an existing code base on a remote git repository,
or create a new project from a template.
This workflow generates a file called `devfile.yaml` (a [Devfile](https://devfile.io/)) that contains instructions on how to deploy the project to OpenShift/Kubernetes based on the project's language or framework.
Once you have this set up, you can debug your project on OpenShift/Kubernetes by right clicking on the project in the Components in the OpenShift sidebar, then selecting 'Start Dev'.

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/gif/create-component-demo.gif)

### **Create component from devfile registry**

In the Devfile Registries view, there is an action to `Open Registry View` which opens a webview to browse devfile stacks consisting of supported registries. Users can create components directly from any selected stack and deploy on OpenShift

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/walkthrough/showRegistries.gif)

### **Install Helm Charts on cluster**

Browse the catalog to discover and install [Helm Charts](https://helm.sh/) on cluster, directly from VSCode.

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/walkthrough/helm.gif)
##  Commands and Features

The extension supports a number of commands to interact with OpenShift clusters and resources. The commands are accessible via the command palette (`Cmd+Shift+P` <kbd>⌘⇧P</kbd> on macOS or `Ctrl+Shift+P` <kbd>⌃⇧P</kbd> on Windows and Linux), Visual Studio Code View title buttons and tree context menus.

For more detail information around specific commands and dependencies, please read the [extension commands](README.commands.md) guide.
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

The Red Hat OpenShift Toolkit for Visual Studio Code collects anonymous [usage data](USAGE_DATA.md) and sends it to Red Hat servers to help improve our products and services. Read our [privacy statement](https://developers.redhat.com/article/tool-data-collection) to learn more. This extension respects the `redhat.telemetry.enabled` setting which you can learn more about at https://github.com/redhat-developer/vscode-redhat-telemetry#how-to-disable-telemetry-reporting.
Note that this extension also abides by Visual Studio Code's telemetry level: if `telemetry.telemetryLevel` is set to off, then no telemetry events will be sent to Red Hat, even if `redhat.telemetry.enabled` is set to true. If `telemetry.telemetryLevel` is set to `error` or `crash`, only events containing an error or errors property will be sent to Red Hat.
