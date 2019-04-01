# Visual Studio Code OpenShift Connector

[![Build Status](https://travis-ci.org/redhat-developer/vscode-openshift-tools.svg?branch=master)](https://travis-ci.org/redhat-developer/vscode-openshift-tools)
[![Unit Tests Code Coverage](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/master/graph/badge.svg)](https://codecov.io/gh/redhat-developer/vscode-openshift-tools/branch/master/graph/badge.svg)
[![License](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://github.com/redhat-developer/vscode-openshift-tools/blob/master/README.md)
[![Chat](https://img.shields.io/badge/chat-on%20mattermost-brightgreen.svg)](https://chat.openshift.io/developers/channels/adapters)
[![Visual Studio Marketplace](https://vsmarketplacebadge.apphb.com/version/redhat.vscode-openshift-connector.svg)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector)


## Overview

A Visual Studio Code extension for interacting with Red Hat OpenShift cluster. This extension is currently in Preview Mode and supports only Java and Node.js components. We will be supporting other languages in the future releases.

To run the instance of OpenShift cluster locally, developers can use [minishift](https://github.com/minishift/minishift/releases) / [CDK](https://developers.redhat.com/products/cdk/download/). Currently all clusters are supported, but with some limitations for OpenShift Online Pro where additional storage might be required to create more than two components.

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

#### Actions available for an OpenShift Cluster Project

   * `Project -> New Application` - Create a new Application inside the selected Project.
   * `Project -> Delete` - Delete the selected Project.

#### Actions available for an Application in a Project

   * `Application -> New Component` - Create a new Component inside the selected Application.
        * git - Use a git repository as the source for the Component.
        * binary - Use binary file as a source for the Component
        * local - Use local directory as a source for the Component.
   * `Application -> New Service` - Perform Service Catalog operations when it is enabled.
   * `Application -> Describe` - Describe the given Application in terminal window.
   * `Application -> Delete` - Delete an existing Application.

#### Actions available for a Component in an Application

   * `Component -> New URL` - Expose Component to the outside world. The URLs that are generated using this command, can be used to access the deployed Components from outside the Cluster.
   * `Component -> New Storage` - Create Storage and mount to a Component.
   * `Component -> Show Log` - Retrieve the log for the given Component.
   * `Component -> Follow Log` - Follow logs for the given Component.
   * `Component -> Link Service` - Link a Component to a Service.
   * `Component -> Link Component` - Link Component to another Component.
   * `Component -> Open in Browser` - Open the exposed URL in a browser.
   * `Component -> Push` - Push source code to a Component.
   * `Component -> Watch` - Watch for changes, update Component on change.
   * `Component -> Describe` - Describe the given Component in terminal window.
   * `Component -> Delete` - Delete an existing Component.

#### Actions available for a Storage in a Component

   * `Storage -> Delete` - Delete a Storage from a Component.

#### Actions available for a Service in an Application

   * `Service -> Describe` - Describe a Service Type for a selected Component
   * `Service -> Delete` - Delete a Service from an Application

#### Actions available for a Folder in Explorer view

   * `New OpenShift Component` - Create an OpenShift component from selected folder

#### Icons Representation
* ![Log in to cluster](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/login.png) - Log in to Cluster
* ![Refresh Cluster](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/refresh.png) - Refresh Cluster
* ![Cluster Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/openshift-cluster.png) - Cluster Resource
* ![Project Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/project-node.png) - Project Resource
* ![Application Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/apps.png) - Application Resource
* ![Service Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/service.png) - Service Resource
* ![Git Component Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/git.png) - Git Component Resource
* ![Local Workspace Component Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/folder.png) - Git Component Resource
* ![Binary Component Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/binary.png) - Git Component Resource
* ![Storage Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/storage-node.png) - Storage Resource

### Extension Configuration Settings
   * `Openshift Connector: Show Channel On Output` - Show OpenShift Connector output channel when new text added to output stream.

### Dependencies

This extension uses two CLI tools to interact with OpenShift cluster:
* OKD CLI client tool - [oc](https://github.com/openshift/origin/releases)
* OpenShift Do tool - [odo](https://github.com/openshift/odo/releases)

> If `oc` and `odo` tools are located in a directory from `PATH` environment variable they will be used automatically. 
The extension will detect these dependencies and prompt the user to install if they are missing or have not supported version - choose `Download & Install` when you see an notification for the missing tool.

**NOTE:** This extension is in Preview mode. The extension support for OpenShift is strictly experimental - assumptions may break, commands and behavior may change!

## Release notes

See the [change log](CHANGELOG.md).

Contributing
============
This is an open source project open to anyone. This project welcomes contributions and suggestions!

For information on getting started, refer to the [CONTRIBUTING instructions](CONTRIBUTING.md).

Download the most recent `openshift-connector-<version>.vsix` file and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix). Stable releases are archived under http://download.jboss.org/jbosstools/adapters/snapshots/vscode-openshift-tools/

Feedback & Questions
====================
File a bug in [GitHub Issues](https://github.com/redhat-developer/vscode-openshift-tools/issues) or chat with us on [Mattermost](https://chat.openshift.io/developers/channels/adapters).

License
=======
MIT, See [LICENSE](LICENSE) for more information.
