# Change Log

## 0.0.21 (May 16, 2019)
* Add dependency to [Kubernetes extension from Microsoft](https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.vscode-kubernetes-tools)
* Extend Kubernetes Clusters tree view
    * [#853](https://github.com/redhat-developer/vscode-openshift-tools/issues/853) Show OpenShift icon for OpenShift clusters
    * [#851](https://github.com/redhat-developer/vscode-openshift-tools/issues/851) Show OpenShift resources
        * Projects
        * Templates
        * Deployment Configs
        * Image Streams
        * Routes
    * [#852](https://github.com/redhat-developer/vscode-openshift-tools/issues/852) Add `Use Project` command for switching between Projects

## 0.0.20 (May 2, 2019)
* URL management for a component in Application Explorer
    * Showcase URL names as child nodes inside a component in Application Explorer
    * Allow Delete and Open in Browser for an individual URL
    * Display hostname and port information when selecting the URL to open in browser
* Add `OpenShift Connector: Output verbosity level` setting. This helps to configure Output verbosity level (value between 0 and 9) for OpenShift Create, Push and Watch commands in output channel and terminal view
* Remove deprecated `opn` module with `open` npm module
* Nodes are sorted alphabetically in Explorer view
* `.vsix` files are added to the release builds

## 0.0.19 (April 10, 2019)
* Cache OpenShift Application Explorer nodes to avoid extra `odo` calls
* Reveal new created objects directly in the Explorer View
* Add `tags`, `branches` list for a git reference within QuickPick item
* Support `Open in browser` when a component has several routes configured
* Enable user to create multiple routes for a component
* Show progress for route creation for a component
* Add token to login into the cluster from oc command line
* Validation if git repository exists when creating component
* Update the icons for nodes representation for the cluster in Explorer View
* Represent component types with different icons

## 0.0.18 (March 21, 2019)
* Update to use `odo v0.0.20`
* Support `reference` option for creating components from git repository
* Add feature to store passwords in Credential Manager
* Use '-wait' flag when creating service to wait until it is provisioned 
* Add `OpenShift: Show Output Channel` to command palette
* Allow user to directly create components with 3 different options using command palette
* Split `OpenShift: Login into Cluster` to two commands

## 0.0.17 (February 27, 2019)
* Update to use `odo v0.0.19`
* Add duplicate resource name validation
* Implement `Describe Service` command for component
* Delete a Service from an Application

## 0.0.16 (February 5, 2019)
* Update to use `odo v0.0.18`
* Allow to create multiple components directly from workspace view
* Add few more commands(linking Service/Component) to command palette
* Add progress bar for delete operation (using `oc wait`)
* Show indeterminate progress bar for linking commands
* Allow extension to use `oc ^3.11.0` if detected

## 0.0.15 (January 23, 2019)
* Provide the flexibility to use `commands` using command palette [#269](https://github.com/redhat-developer/vscode-openshift-tools/issues/269)
* Remove kubernetes clusters view from OpenShift Views Container
* Fix security issues with `event-stream` module [#485](https://github.com/redhat-developer/vscode-openshift-tools/pull/485)
* Add login handling for when ~/.kube is empty
* Fix unhandled rejection errors in tests
* Increase unit tests code coverage

## 0.0.14 (December 5, 2018)
* Implement port selection when linking component with multiple ports
* Fix linking of components using `odo link`
* Add Coverage and Debug test launchers

## 0.0.13 (December 3, 2018)
* Add implementation of Linking component to a service or component [#425](https://github.com/redhat-developer/vscode-openshift-tools/pull/425)
* Add support to create component with binary file [#347](https://github.com/redhat-developer/vscode-openshift-tools/pull/347)
* Improve `push` command feature to show build log directly into vscode terminal [#416](https://github.com/redhat-developer/vscode-openshift-tools/issues/416)
* Improve progress representation for long running commands [#422](https://github.com/redhat-developer/vscode-openshift-tools/pull/422)
* Add fix to stop downloading odo/oc when cluster is down [#406](https://github.com/redhat-developer/vscode-openshift-tools/pull/406).
* Commands executed in vscode terminal always use odo from `~/.vs-openshift` directory [#305](https://github.com/redhat-developer/vscode-openshift-tools/pull/409)
* Update packages and transitive dependencies to fix security vulnerabilities
* Add more test scenarios and improve code coverage

## 0.0.12 (November 23, 2018)
* Add actions to command palette
* Fixed application name creation validation
* Commands migrated from explorer view to cluster context
* Activate extension on any command execution from UI
* Add --namespace option to all oc calls invoked by 'Open in Browser'
* Use `oc v3.9.0` and `odo v0.0.16`
* Fixed unit tests and increase code coverage

## 0.0.11 (October 22, 2018)
* Minor fixes in README

## 0.0.10 (October 22, 2018)
* Add support to Java components
* Support odo `v0.0.14` with supervisord fix
* Fix `create service` command based on odo `v0.0.14` output changes

## 0.0.9 (October 5, 2018)
* Add screencast for the features and commands

## 0.0.8 (October 5, 2018)
* Fix missing icon path in README

## 0.0.7 (October 5, 2018)
* Add support for interactions with Red Hat OpenShift cluster
* Supports only local OpenShift cluster via minishift/cdk
* Allows to configure projects/applications/components/services/storages for a cluster
* Interactive developer experience
