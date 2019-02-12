# Visual Studio Code OpenShift Connector

[![Build Status](https://travis-ci.org/redhat-developer/vscode-openshift-tools.svg?branch=master)](https://travis-ci.org/redhat-developer/vscode-openshift-tools)
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
* `OpenShift: List catalog components` - List all available component types from OpenShift's Image Builder.
* `OpenShift: List catalog services` - Lists all available services e.g. mysql-persistent.
* `OpenShift: New Project` - Create new project inside the cluster.
* `OpenShift: About` - Provides the information about the OpenShift tools.
* `OpenShift: Log out` - Logs out of the current OpenShift cluster.

#### Actions available inside an OpenShift Cluster Project

   * `Project -> New Application` - Create a new application inside the selected project.
   * `Project -> Delete` - Delete the selected project.

#### Actions available for an Application inside a Project

   * `Application -> New Component` - Create a new component inside the selected application.
        * git - Use a git repository as the source for the component.
        * binary - Use binary file as a source for the component
        * local - Use local directory as a source for the component.
   * `Application -> New Service` - Perform service catalog operations when it is enabled.
   * `Application -> Describe` - Describe the given application in terminal window.
   * `Application -> Delete` - Delete an existing application.

#### Actions available for a Component in an Application

   * `Component -> Create URL` - Expose component to the outside world. The URLs that are generated using this command, can be used to access the deployed components from outside the cluster.
   * `Component -> Create Storage` - Create storage and mount to a component.
   * `Component ->  Show Log` - Retrieve the log for the given component.
   * `Component ->  Follow Log` - Follow logs for the given component.
   * `Component ->  Link Service` - Link component to a service.
   * `Component ->  Link Component` - Link component to another component.
   * `Component -> Open in Browser` - Open the exposed URL in a browser.
   * `Component -> Push` - Push source code to a component.
   * `Component -> Watch` - Watch for changes, update component on change.
   * `Component -> Describe` - Describe the given component in terminal window.
   * `Component -> Delete` - Delete an existing component.

#### Actions available inside a storage for a component

   * `Storage -> Delete` - Delete storage from component.

#### Icons Representation
* ![Log in to cluster](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/dark/login.png) - Log in to Cluster
* ![Refresh Cluster](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/dark/refresh.png) - Refresh Cluster
* ![Cluster Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/cluster.png) - Cluster Resource
* ![Project Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/project.png) - Project Resource
* ![Application Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/application.png) - Application Resource
* ![Service Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/service.png) - Service Resource
* ![Component Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/component.png) - Component Resource
* ![Storage Resource](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/master/images/storage.png) - Storage Resource


### Extension Configuration Settings
   * `Openshift Connector: Show Channel On Output` - Show OpenShift Connector output channel when new text added to output stream.

### Dependencies

This extension uses two CLI tools to interact with OpenShift cluster:
* OKD CLI client tool - [oc](https://github.com/openshift/origin/releases)
* OpenShift Do tool - [odo](https://github.com/redhat-developer/odo/releases)

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
