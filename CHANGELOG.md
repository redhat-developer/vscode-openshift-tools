# Change Log

## 0.1.3 (January 16, 2020)

This release adds `OpenShift: Debug` command for Java and Node.js components. The command is available form command palette and OpenShift Application View context
menu for nodes representing Components. See issues [#1322](https://github.com/redhat-developer/vscode-openshift-tools/pull/1322) and 
[#1328](https://github.com/redhat-developer/vscode-openshift-tools/pull/1328) for details.

It also includes update for OpenShift Do CLI. Version 1.0.2 will be downloaded after extension is updated to this release.


## 0.1.2 (November 18, 2019)

This release brings to you: 
* [#1277](https://github.com/redhat-developer/vscode-openshift-tools/issues/1277) Latest v1.0.1 version of OpenShift Do CLI tool 
* [#1268](https://github.com/redhat-developer/vscode-openshift-tools/issues/1268) New `OpenShift: Create` command to create resources based on file from active editor
* Bugfixes for minor issues:
  - [#1262](https://github.com/redhat-developer/vscode-openshift-tools/issues/1262) Keep QuickInputs open after VSCode window lost focus
  - [#1261](https://github.com/redhat-developer/vscode-openshift-tools/issues/1261) 'Unlink' command for components does not work
  - [#1247](https://github.com/redhat-developer/vscode-openshift-tools/issues/1247) Open console command doesn't open the console web page
  - [#1260](https://github.com/redhat-developer/vscode-openshift-tools/issues/1260) Sometimes login does not work anymore
  - [#1284](https://github.com/redhat-developer/vscode-openshift-tools/issues/1284) With latest VSCode 1.40.0 release oc and odo download fails on sha256 verification


## 0.1.1 - 🎃Trick or Treat (November 1, 2019) 

Halloween Release 🎃

This release is built on top of 0.1.0. If any developer is migrating from `<=0.0.23` release, please follow the [Migration Guide](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0).

## Updates
* Extension uses [OpenShift Do(odo) 1.0.0 GA](https://github.com/openshift/odo/releases/tag/v1.0.0)
* Support [Red Hat Code Ready Containers 1.0](https://access.redhat.com/documentation/en-us/red_hat_codeready_containers/1.0/html/getting_started_guide/index) for OpenShift 4.x clusters
* Update download path for odo-v1.0.0 binary
* Icons for OpenShift Connector are working for Eclipse Che extension
* [Demo](https://youtube.com/watch?v=m0wBKuKDYO0) video and [blog](https://developers.redhat.com/blog/2019/10/31/openshift-connector-visual-studio-code-extension-for-red-hat-openshift/) updated for `0.1.1` release

## Changes
* [#1254](https://github.com/redhat-developer/vscode-openshift-tools/pull/1254) use vscode open command instead of open module for external links    
* [#1236](https://github.com/redhat-developer/vscode-openshift-tools/pull/1236) Show progress bar for credentials and token Login
* [#1229](https://github.com/redhat-developer/vscode-openshift-tools/pull/1229) support deep nesting for binary files 
* [#1243](https://github.com/redhat-developer/vscode-openshift-tools/pull/1243) remove flags from storage commands
* [#1211](https://github.com/redhat-developer/vscode-openshift-tools/pull/1211) Add json output for catalog list services
* [#1213](https://github.com/redhat-developer/vscode-openshift-tools/pull/1213) Added json output for catalog list components to determine component type and version
* [#1218](https://github.com/redhat-developer/vscode-openshift-tools/pull/1218) Provide information message to user to Push the components after success of component creation
* Increase Code Coverage and improve unit tests


## 0.1.0 (September 19, 2019)
This release involves *Breaking Changes* !!

* Components created with previous version will no longer be identified. Therefore after extension is updated to new version(`0.1.0`) all previously deployed components won't be visible in OpenShift Application View.
* For older versions, here is the [Migration Guide](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0).

### Added
* Every component/service needs to have a context folder. The extension will prompt the user to specify the context folder with the creation of component/service.
* The selected context folder will reside in the vscode workspace.
* `Create Component` creates a local component configuration within `./.odo/config.yaml` in the context folder selected, nothing is created on the cluster at this point.
* All component configurations are saved to ./.odo/config.yaml. You can commit this file to your repository to easily recreate component with the same configuration later, or to share it with someone else.
* To deploy the component to a cluster or to apply config changes, run `PUSH` command for the component.
    * `PUSH` will create component/urls/storage on the OpenShift cluster and push your local files to it.
* `Import` actions for components which were created using old versions of the extension.
* Support for OpenShift 4.x clusters.
* Update Actions to Navigation Item
    * Add Switch Contexts - This will help users to switch contexts from kubeconfig.
    * Add Issue tracker - Users can directly file extension issues/feedback.
* Added Multiple Actions to Kubernetes resources in Kubernetes View.
    * For Build Configs - Start Build, Rebuild, Show Logs, Follow Logs
    * For Deployment Configs - Deploy, Show Logs
    * Add `Open in Console` for k8s resources in Kubernetes View.

### Changes
* The openshift labels used internally by odo to identify its components, have been updated to match https://github.com/gorkem/app-labels/blob/master/labels-annotation-for-openshift.adoc.
* Components can be in 3 stages:
    * pushed - When the components are deployed into the cluster.
    * not pushed - When are the components are in local config but NOT deployed into the cluster.
    * no context - When there is no context folder associated with the component in the workspace.
* Extension uses [odo-v1.0.0-beta5](https://github.com/openshift/odo/releases/tag/v1.0.0-beta5).
* Remove Clusters view from OpenShift Views Container. Users can perform all the required action from Kubernetes extension Clusters view.

### Fixes
* [#1117](https://github.com/redhat-developer/vscode-openshift-tools/pull/1117) Import command for components without context
* [#1107](https://github.com/redhat-developer/vscode-openshift-tools/pull/1107) Add migration for component/services deployed in active cluster 
* [#1169](https://github.com/redhat-developer/vscode-openshift-tools/pull/1169) Fix clone the git repository while creating Component
* [#1158](https://github.com/redhat-developer/vscode-openshift-tools/pull/1158) Fix workflow for git + binary component
* [#1152](https://github.com/redhat-developer/vscode-openshift-tools/pull/1152) Fix list of urls in Open in Browser action
* [#1126](https://github.com/redhat-developer/vscode-openshift-tools/pull/1126) Migrarion to @types/vscode and vscode-test
* [#1115](https://github.com/redhat-developer/vscode-openshift-tools/pull/1115) Remove recursive search from binary component selection
* [#1113](https://github.com/redhat-developer/vscode-openshift-tools/pull/1113) Add binary file list from context folder in the quickPick
* [#950](https://github.com/redhat-developer/vscode-openshift-tools/pull/950) Provide context folder selection if no workspace present
* [#1046](https://github.com/redhat-developer/vscode-openshift-tools/pull/1046) Use users home folder as current directory when deleting service.
* `Open in Browser` commands should show only components in `pushed` state
* `Link/Unlink` commands and services should show only components in `pushed` state
* Remove circular dependencies introduced by extension context
* Differentiate between console urls for OpenShift 3.x and 4.x clusters

## 0.0.23 (July 4, 2019)
* [#920](https://github.com/redhat-developer/vscode-openshift-tools/pull/920) Fix odo CLI tool download checksum fail for all 3 OS variants
* [#903](https://github.com/redhat-developer/vscode-openshift-tools/pull/903) Add new login experience using k8 config
* [#901](https://github.com/redhat-developer/vscode-openshift-tools/pull/901) Fix for Deleting interlinked components breaks the application
* [#911](https://github.com/redhat-developer/vscode-openshift-tools/pull/911) Integrate Azure Pipelines to CI builds
* Move public chat discussion to [gitter](https://gitter.im/redhat-developer/openshift-connector) 

## 0.0.22 (June 18, 2019)
* [#888](https://github.com/redhat-developer/vscode-openshift-tools/pull/888) Prettify json in OpenShift Output Channel
* [#882](https://github.com/redhat-developer/vscode-openshift-tools/pull/882) Add BuildConfig and Builds to Clusters View
* [#835](https://github.com/redhat-developer/vscode-openshift-tools/pull/835) Provide keybinding for Login, push and refresh commands
* [#873](https://github.com/redhat-developer/vscode-openshift-tools/pull/873) Hide session token when used for log in to the cluster

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
