# Visual Studio Code OpenShift Connector

[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/redhat.vscode-openshift-connector.svg)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector) [![Gitter](https://badges.gitter.im/redhat-developer/openshift-connector.svg)](https://gitter.im/redhat-developer/openshift-connector) [![Build Status](https://dev.azure.com/redhat-developer/vscode-openshift-tools/_apis/build/status/redhat-developer.vscode-openshift-tools?branchName=master)](https://dev.azure.com/redhat-developer/vscode-openshift-tools/_build/latest?definitionId=1&branchName=master) [![Build Status](https://travis-ci.org/redhat-developer/vscode-openshift-tools.svg?branch=master)](https://travis-ci.org/redhat-developer/vscode-openshift-tools) [![Unit Tests Code Coverage](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/master/graph/badge.svg)](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/master/graph/badge.svg) [![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://github.com/redhat-developer/vscode-openshift-tools/blob/master/LICENSE)

## Overview

OpenShift Connector extension provides an end-to-end developer experience for Red Hat OpenShift. Using this extension developers can easily create, deploy and live debug applications running on OpenShift.

* Demo: https://youtube.com/watch?v=m0wBKuKDYO0

[![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/vscode-openshift-tools.gif)](https://youtube.com/watch?v=m0wBKuKDYO0)

### Supported OpenShift Clusters

This extension can work with local or remote OpenShift clusters.

To start local instance of OpenShift cluster, developers can use the following options:
* [CodeReadyContainers](https://cloud.redhat.com/openshift/install/crc/installer-provisioned) - run single node local OpenShift 4.x cluster
* [minishift](https://github.com/minishift/minishift/releases) / [CDK](https://developers.redhat.com/products/cdk/download/) - run single node local OpenShift 3.x cluster 

For detail analysis of how to setup and run local OpenShift Cluster using minishift, please follow this [wiki](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Starting-Local-OpenShift-Instance).

If developers can not run local OpenShift cluster the extension can work with remote one from various Red Hat products:
* [Red Hat OpenShift Container Platform](https://www.openshift.com/products/container-platform) - build, deploy and manage your applications across cloud- and on-premise infrastructure
* [Red Hat OpenShift Dedicated](https://www.openshift.com/products/dedicated/) - single-tenant, high-availability Kubernetes clusters in the public cloud
* [Microsoft Azure Red Hat OpenShift](https://www.openshift.com/products/azure-openshift) - fully managed Red Hat OpenShift service on Microsoft Azure
* [Red Hat OpenShift Online](https://www.openshift.com/products/online/) - the fastest way for developers to build, host and scale applications in the public cloud

When working with [OpenShift Online](https://www.openshift.com/products/online/) remote cluster only one component can be created for Starter plan and Pro plan with default 2GiB storage. If you want to create multi component application you could opt in for Pro plan with bigger persistence storage (up to 150GiB).

## New and Noteworthy

## All Required CLI Tools Included

This release includes binaries for all required CLI tools:
* OKD CLI Client (`oc`)
* OpenShift Do (`odo`)
Once extension is installed it is ready to use. There is no additional configuration steps to download CLI tools binaries.

### Debug Support for Local Node.js and Java Components

This release provides new 'OpenShift: Debug' command to simplify the way to start debugging for OpenShift Components pushed to a cluster. It is an experimental feature, because it is using experimental OpenShift Do `debug` command under the hood and supports only local Java and Node.js components. The command is available from command palette and context menu for Component nodes in OpenShift Application Explorer view. 

#### Debug Node.js Component

Default Visual Studio Code installation includes JavaScript/TypeScript Language Support and Debugger Extensions required to debug a Node.js Component. That means new `OpenShift: Debug` command can be used without installing any additional extensions.

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/debug-node.gif)

#### Debug Java Component

To debug a Java Component, Java Language Support and Java Debugger Extensions are required. OpenShift Connector extension will prompt the user to install missing extension(s) before it starts Debugger for a Java Component.

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/debug-java.gif)

## Commands and Features

`vs-openshift-connector` supports a number of commands & actions for interacting with OpenShift clusters; these are accessible via the command menu (`Cmd+Shift+P` <kbd>⌘⇧P</kbd> on macOS or `Ctrl+Shift+P` <kbd>⌃⇧P</kbd> on Windows and Linux) and may be bound to keys in the normal way.

### General Commands

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

#### Actions Available for an OpenShift Cluster Project

   * `Project -> New Component` - Create a new Component from the Project.
        * git - Use a git repository as the source for the Component.
        * binary - Use binary file as a source for the Component
        * local - Use local directory as a source for the Component.
   * `Project -> New Service` - Perform Service Catalog operations when it is enabled.
   * `Project -> Delete` - Delete an existing Project.

#### Actions Available for an Application in a Project

   * `Application -> New Component` - Create a new Component inside the selected Application.
        * git - Use a git repository as the source for the Component.
        * binary - Use binary file as a source for the Component
        * local - Use local directory as a source for the Component.
   * `Application -> New Service` - Perform Service Catalog operations when it is enabled.
   * `Application -> Describe` - Describe the given Application in terminal window.
   * `Application -> Delete` - Delete an existing Application.

#### Actions Available for a Component in an Application

##### Components can be in 3 stages:

      pushed - When the components are deployed into the cluster.
      not pushed - When are the components are in local config but NOT deployed into the cluster.
      no context - When there is no context folder associated with the component in the workspace.

#### Actions for a Pushed Component

   * `Component -> New URL` - Expose Component to the outside world. The URLs that are generated using this command, can be used to access the deployed Components from outside the Cluster. Push the component to reflect the changes on the cluster.
   * `Component -> New Storage` - Create Storage and mount to a Component. Push the component to reflect the changes on the cluster.
   * `Component -> Describe` - Describe the given Component in terminal window.
   * `Component -> Show Log` - Retrieve the log for the given Component.
   * `Component -> Follow Log` - Follow logs for the given Component.
   * `Component -> Link Component` - Link Component to another Component.
   * `Component -> Link Service` - Link Component to a Service.
   * `Component -> Unlink` - Unlink Component from Component/Service.
   * `Component -> Open in Browser` - Open the exposed URL in browser.
   * `Component -> Push` - Push the source code to a Component.
   * `Component -> Watch` - Watch for changes, update Component on change. This is not supported for git based components.
   * `Component -> Undeploy` - Undeploys a Component from the cluster. The component still resides in the local config.
   * `Component -> Delete` - Delete an existing Component from the cluster and removes the local config also.
   * `Component -> Debug` - Debug local Java or Node.js Component.

#### Actions for a not Pushed Component

   * `Component -> New URL` - Expose Component to the outside world. The URLs that are generated using this command, can be used to access the deployed Components from outside the Cluster.
   * `Component -> Push` - Push the source code to a Component.
   * `Component -> Delete` - Delete an existing Component from the local config.

#### Actions for a no context Component

   * `Component -> Describe` - Describe the given Component in terminal window.
   * `Component -> Delete` - Delete an existing Component from the local config.
   * `Component -> Import` - If the component was created using old version of the extension (`<=0.0.23`), users can use the `Import` action to migrate to latest version and import the metadata changes.

#### Actions available for a URL in a Component

   * `URL -> Delete` - Delete a URL from a Component.
   * `URL -> Open URL` - Click on the icon opens the specific URL in Browser.
   * `URL -> Describe` - Describe the given URL for the component in terminal window.


#### Actions available for a Storage in a Component

   * `Storage -> Delete` - Delete a Storage from a Component.


#### Actions available for a Service in an Application

   * `Service -> Describe` - Describe a Service Type for a selected Component
   * `Service -> Delete` - Delete a Service from an Application

**NOTE:** Currently we support creation of one component per folder. Multiple components from a folder might be supported in future releases.

#### Icons Representation

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

### Extension Configuration Settings
   * `OpenShift Connector: Show Channel On Output` - Show OpenShift Connector output channel when new text added to output stream
   * `OpenShift Connector: Output verbosity level` - Output verbosity level (value between 0 and 9) for OpenShift Create, Push and Watch commands in output channel and terminal view

## Dependencies

### CLI Tools

This extension uses two CLI tools to interact with OpenShift cluster:
* OKD CLI client tool - [oc](https://github.com/openshift/origin/releases)
* OpenShift Do tool - [odo](https://mirror.openshift.com/pub/openshift-v4/clients/odo)

> `oc` and `odo` tools for Windows, Linux and macOS are included into extension package. Once the extension is installed it is ready to use.

### Extensions

This extension depends on Kubernetes Extension from Microsoft which is going to be installed automatically along with OpenShift Connector Extension. Latter is using Kubernetes Extension public API to show
OpenShift specific resources like Projects, Routes, Deployment Configs, Image Streams and Templates in Kubernetes Clusters View. Those resources are visible only for OpenShift clusters. 

OpenShift Connector extension also provides ```Use Project``` command to switch between OpenShift Projects in Kubernetes Clusters View.

![ useproject ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/use-project.png)

**NOTE:** This extension is in Preview mode. The extension support for OpenShift is strictly experimental - assumptions may break, commands and behavior may change!

## Breaking Changes Between Previous Releases

### Updating from release 0.0.23 or earlier

* The Components created with previous versions(<=0.0.23) will no longer be visible in OpenShift Application Explorer view.
* The Extension will prompt the user to specify the context folder when creating new Components and then add selected folder to workspace.
* New Component, Url and Storage objects are created locally in context folder and not immediately pushed to the cluster.

> **Please follow the [migration](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0) guide to resolve any possible issues.**

In case of any queries, please use the [Feedback & Question](#Feedback-&-Questions) section.

## Release Notes

See the [change log](CHANGELOG.md).

# Contributing

This is an open source project open to anyone. This project welcomes contributions and suggestions!

For information on getting started, refer to the [CONTRIBUTING instructions](CONTRIBUTING.md).

Download the most recent `openshift-connector-<version>.vsix` file and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix). Stable releases are archived [here](https://download.jboss.org/jbosstools/adapters/snapshots/vscode-openshift-tools/?C=M;O=D).

# Feedback & Questions

If you discover an issue please file a bug and we will fix it as soon as possible.
* File a bug in [GitHub Issues](https://github.com/redhat-developer/vscode-openshift-tools/issues).
* Chat with us on [Gitter](https://gitter.im/redhat-developer/openshift-connector).

# License

MIT, See [LICENSE](LICENSE) for more information.
