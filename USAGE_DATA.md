## [OpenShift Toolkit](https://github.com/redhat-developer/vscode-openshift-tools)

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

In addition to generic command's usage data (see above) `New Component` command and wizard also reports the following:

* `newComponentCreated` - sent when a new component is created, with the following properties:
    * `strategy` - indicates whether the component was created from an existing local codebase, an existing git repository, or a template project
    * `component_type` - name of the devfile used
    * `starter_project` - name of the template project used for components created from a template project
* `newComponentCreateFailed` - sent if there is an error during component creation, with the following properties:
    * `error` - the error that occurred during component creation
* `newComponentClosed` - sent when the create component UI is closed

#### OpenShift: Login

In addition to generic command's usage data (see above) `Login` command also reports:

* openshift_version - cluster's OpenShift version (if can be accessed by the current user)
* kubernetes_version - cluster's Kubernetes version

#### Bind Service

In addition to the generic command's usage data (see above), the `Bind Service` context menu option reports events when:

* the wizard to select the service to bind to is opened
* the wizard to select the service to bind to is submitted

### Add Cluster Editor

The editor reports selection made on first page:
* OpenShift Local cluster (identifier: `openshift.explorer.addCluster.openCrcAddClusterPage`)
* OpenShift Sandbox Cluster (identifier: `openshift.explorer.addCluster.openLaunchSandboxPage`)
* OpenShift cluster deployed in a public cloud (identifier: `openshift.explorer.addCluster.openCreateClusterPage`)

#### Code Ready Containers Cluster Page

As a user goes through a setting up process or using OpenShift Local, the editor reports calls of OpenShift Local CLI commands
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

### Openshift Welcome Page
The welcome page reports when the user unchecks/checks the show welcome page option.

Each telemetry event includes:
* Unique step identifier
* Error text in case of step's failure
* Duration of request in milliseconds
