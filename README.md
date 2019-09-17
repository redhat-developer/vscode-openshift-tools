# Visual Studio Code OpenShift Connector
[![Build Status](https://dev.azure.com/redhat-developer/vscode-openshift-tools/_apis/build/status/redhat-developer.vscode-openshift-tools?branchName=master)](https://dev.azure.com/redhat-developer/vscode-openshift-tools/_build/latest?definitionId=1&branchName=master)
[![Build Status](https://travis-ci.org/redhat-developer/vscode-openshift-tools.svg?branch=master)](https://travis-ci.org/redhat-developer/vscode-openshift-tools)
[![Unit Tests Code Coverage](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/master/graph/badge.svg)](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/master/graph/badge.svg)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://github.com/redhat-developer/vscode-openshift-tools/blob/master/README.md)
[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/redhat.vscode-openshift-connector.svg)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)
[![Gitter](https://badges.gitter.im/redhat-developer/openshift-connector.svg)](https://gitter.im/redhat-developer/openshift-connector)


## Overview

A Visual Studio Code extension for interacting with Red Hat OpenShift cluster. This extension is currently in Preview Mode and supports only Java and Node.js components. We will be supporting other languages in the future releases.

To run the instance of OpenShift cluster locally, developers can use [minishift](https://github.com/minishift/minishift/releases) / [CDK](https://developers.redhat.com/products/cdk/download/). Currently all clusters are supported, but with some limitations for OpenShift Online Pro where additional storage might be required to create more than two components.

For detail analysis of how to setup and run local OpenShift Cluster using minishift, please follow this [wiki](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Starting-Local-OpenShift-Instance).

## WARNING !! Breaking Changes

This release(`0.1.0`) requires below mentioned changes. Use the migration guide mentioned below to resolve them.

* This breaks backward compatibility with older versions(`<=0.0.23`).
* Components created with previous version will no longer be identified. Therefore after extension is updated to new version(`0.1.0`) all previously deployed components won't be visible in OpenShift Application View.
* Every component/service needs to have a context folder. The extension will prompt the user to specify the context folder with the creation of component/service.

> **Please follow the [migration](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0) guide to resolve any possible issues.**

In case of any queries, please use the [Feedback & Question](#Feedback-&-Questions) section.

## Commands and features

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/vscode-openshift-tools.gif)

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

#### Actions available for an OpenShift Cluster Project

   * `Project -> New Component` - Create a new Component from the Project.
        * git - Use a git repository as the source for the Component.
        * binary - Use binary file as a source for the Component
        * local - Use local directory as a source for the Component.
   * `Project -> New Service` - Perform Service Catalog operations when it is enabled.
   * `Project -> Delete` - Delete an existing Project.

#### Actions available for an Application in a Project

   * `Application -> New Component` - Create a new Component inside the selected Application.
        * git - Use a git repository as the source for the Component.
        * binary - Use binary file as a source for the Component
        * local - Use local directory as a source for the Component.
   * `Application -> New Service` - Perform Service Catalog operations when it is enabled.
   * `Application -> Describe` - Describe the given Application in terminal window.
   * `Application -> Delete` - Delete an existing Application.

#### Actions available for a Component in an Application

##### Components can be in 3 stages:

      pushed - When the components are deployed into the cluster.
      not pushed - When are the components are in local config but NOT deployed into the cluster.
      no context - When there is no context folder associated with the component in the workspace.

#### Actions for a Pushed Component

   * `Component -> New URL` - Expose Component to the outside world. The URLs that are generated using this command, can be used to access the deployed Components from outside the Cluster.
   * `Component -> New Storage` - Create Storage and mount to a Component.
   * `Component -> Describe` - Describe the given Component in terminal window.
   * `Component -> Show Log` - Retrieve the log for the given Component.
   * `Component -> Follow Log` - Follow logs for the given Component.
   * `Component -> Link Component` - Link Component to another Component.
   * `Component -> Link Service` - Link Component to a Service.
   * `Component -> Unlink` - Unlink Component from Component/Service.
   * `Component -> Open in Browser` - Open the exposed URL in browser.
   * `Component -> Push` - Push the source code to a Component.
   * `Component -> Watch` - Watch for changes, update Component on change.
   * `Component -> Undeploy` - Undeploys a Component from the cluster. The component still resides in the local config.
   * `Component -> Delete` - Delete an existing Component from the cluster and removes the local config also.

#### Actions for a Not Pushed Component

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

### Dependencies

#### CLI Tools

This extension uses two CLI tools to interact with OpenShift cluster:
* OKD CLI client tool - [oc](https://github.com/openshift/origin/releases)
* OpenShift Do tool - [odo](https://github.com/openshift/odo/releases/tag/v1.0.0-beta5)

> If `oc` and `odo` tools are located in a directory from `PATH` environment variable they will be used automatically. 
The extension will detect these dependencies and prompt the user to install if they are missing or have not supported version - choose `Download & Install` when you see an notification for the missing tool.

#### Extensions

This extension depends on Kubernetes Extension from Microsoft which is going to be installed automatically along with OpenShift Connector Extension. Latter is using Kubernetes Extension public API to show
OpenShift specific resources like Projects, Routes, Deployment Configs, Image Streams and Templates in Kubernetes Clusters View. Those resources are visible only for OpenShift clusters. 

OpenShift Connector extension also provides ```Use Project``` command to switch between OpenShift Projects in Kubernetes Clusters View.

![ useproject ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/use-project.png)

**NOTE:** This extension is in Preview mode. The extension support for OpenShift is strictly experimental - assumptions may break, commands and behavior may change!

## Release notes

See the [change log](CHANGELOG.md).

Contributing
============
This is an open source project open to anyone. This project welcomes contributions and suggestions!

For information on getting started, refer to the [CONTRIBUTING instructions](CONTRIBUTING.md).

Download the most recent `openshift-connector-<version>.vsix` file and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix). Stable releases are archived [here] (https://download.jboss.org/jbosstools/adapters/snapshots/vscode-openshift-tools/?C=M;O=D)

Feedback & Questions
====================
If you discover an issue please file a bug and we will fix it as soon as possible.
* File a bug in [GitHub Issues](https://github.com/redhat-developer/vscode-openshift-tools/issues).
* Chat with us on [Gitter](https://gitter.im/redhat-developer/openshift-connector).

License
=======
MIT, See [LICENSE](LICENSE) for more information.
