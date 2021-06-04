## [OpenShift Connector](https://github.com/redhat-developer/vscode-openshift-tools)

### Usage Data

* when extension is activated
* when a command contributed by extension is executed with following info
    * unique identifier
    * duration time
    * error message (in case of exception)
    * CLI command (if exception caused by cli command)
    * cancellation flag
    * command's specific data (see details below)
* when extension is deactivated

### Command's Specific Data Reported

#### OpenShift: New Component

In addition to command's usage data (see above) `New Component` command also reports:

* component_kind - devfile or S2I (Software to Image)
* component_type - name of the component type from devfile registry or catalog
* component_version - version (for S2I components)
* starter_project - name of a starter project used (for devfile components)
* use_existing_devfile - boolean attribute to indicate if an existing devfile was used rather than one from registry

#### OpenShift: Login

In addition to command's usage data (see above) `Login` command also reports:

* openshift_version - cluster's OpenShift version (if can be accessed by the current user)
* kubernetes_version - cluster's Kubernetes version