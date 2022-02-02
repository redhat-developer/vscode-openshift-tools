## [OpenShift Connector](https://github.com/redhat-developer/vscode-openshift-tools)

### Usage Data Reported

#### Extension Activation/deactivation

* when extension is activated
* when extension is deactivated

### Command's Generic Data Reported

When a command contributed by extension is executed, telemetry event sent with following information:
* command's identifier
* duration time
* error message (in case of exception)
* CLI command (if exception caused by cli command)
* cancellation step name
* command's specific data (see details below for specific commands)

### Command Specific Data Reported

#### OpenShift: New Component

In addition to generic command's usage data (see above) `New Component` command also reports:

* cancellation_step - step name where New Component command was cancelled (value examples: ComponentName, ApplicationName, ContextFolder)
* component_kind - devfile or S2I (Software to Image)
* component_type - name of the component type from devfile registry or catalog
* component_version - version (for S2I components)
* starter_project - name of a starter project used (for devfile components)
* use_existing_devfile - boolean attribute to indicate if an existing devfile was used rather than one from registry

#### OpenShift: Login

In addition to generic command's usage data (see above) `Login` command also reports:

* openshift_version - cluster's OpenShift version (if can be accessed by the current user)
* kubernetes_version - cluster's Kubernetes version

### Add Cluster Editor

The editor reports selection made on first page:
* CRC cluster (identifier: `openshift.explorer.addCluster.openCrcAddClusterPage`)
* OpenShift Sandbox Cluster (identifier: `openshift.explorer.addCluster.openLaunchSandboxPage`)
* OpenShift cluster deployed in a public cloud (identifier: `openshift.explorer.addCluster.openCreateClusterPage`)

#### Code Ready Containers Cluster Page

As a user goes through a setting up process or using CRC, the editor reports calls of CRC CLI commands
and sends generic command telemetry data described above.

* Setup (identifier: `openshift.explorer.addCluster.crcSetup`)
* Start (identifier: `openshift.explorer.addCluster.crcStart`)
* Stop (identifier: `openshift.explorer.addCluster.crcStop`)

#### OpenShift Sandbox Cluster Page

As a user goes through Sandbox provisioning workflow the editor reports outcome of every step:
* Login into Red Hat account (identifier: `openshift.explorer.addCluster.sandboxLoginRequest`)
* Sign up for Sandbox (identifier: `openshift.explorer.addCluster.sandboxRequestSignup`)
* Status request for Sandbox (identifier: `openshift.explorer.addCluster.sandboxDetectStatus`)
* Request for a verification code (identifier: `openshift.explorer.addCluster.sandboxRequestVerificationCode`)
* Validation of a verification code (identifier: `openshift.explorer.addCluster.sandboxValidateVerificationCode`)
* Login into Sandbox cluster (identifier: `openshift.explorer.addCluster.sandboxLoginUsingDataInClipboard`)

Each telemetry event includes:
* Unique step identifier
* Error text in case of step's failure
* Duration of request in milliseconds