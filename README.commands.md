### Core Concepts

* **Project**: A project is your source code, tests, and libraries organized in a separate single unit
* **Application**: An application is a program designed for end users. An application consists of multiple microservices or components that work individually to build the entire application. Examples of applications: e-Shop, Hotel Reservation System, Online Booking
* **Component**: A component is a set of Kubernetes resources which host code or data. Each component can be run and deployed separately. Examples of components: Warehouse API Backend, Inventory API, Web Frontend, Payment Backend
* **Service**: A service is software that your component links to or depends on. Examples of services: MariaDB, MySQL
* **Devfile**: A devfile is a portable YAML file containing the definition of a component and its related URLs, storages and services.

#### Commands in OpenShift Application Explorer View

* `Log in to cluster` - Log in to your cluster and save login for subsequent use.
    * Credentials : Log in to the given cluster with the given credentials.
    * Token : Login using bearer token for authentication to the API server.
* `Open Console Dashboard` - Open the OpenShift Developer Console in default browser.
* `New Project` - Create new Project inside the OpenShift Cluster.
* `Log out` - Log out of the current OpenShift Cluster.
* `About` - Provide the information about the OpenShift tools.
* `Show Output Channel` - Show commands running under the hood and their output.
* `Create` - Create an OpenShift resource using `.json` or `.yaml` file location from an active editor.

#### Commands for a Project in Application Explorer

   * `New Component` - Create a new Component in the Project.
   * `Delete` - Delete an existing Project.
   * `Change Active Project` - Change active Project displayed in OpenShift Application View.

#### Commands for a Component in Components View

Actions available in Components View

   * `Import from Git` - Deploy a git repository directly on OpenShift using a guided workflow
   * `New Component` - Create a component from the available registries.

Commands available in context for the compenent

   * `Start Dev` - The application has been built and deployed to the cluster and the application is port-forwarded for local accessibility. The extension will watch for changes in the current directory and rebuild the application when changes are detected.
   * `Stop Dev` - Stop the dev command workflow and resources are cleaned, hence the application is not running on the cluster
   * `Show Dev Terminal` - Directly opens the VSCode terminal where the dev command is running.
   * `Describe` - Describe the given Component in terminal window or inside a webview editor.
   * `Show Log` - Retrieve the log for the given Component in the terminal or inside a webview editor (can be changed in VSCode Settings)
   * `Follow Log` - Follow logs for the given Component in the terminal or inside a webview editor (can be changed in VSCode Settings)
   * `Open in Browser` - Open the exposed URL in default browser.
   * `Deploy` - Deploys a Component on the cluster by first building the images of the containers to deploy, then by deploying the Kubernetes resources necessary to deploy the components.
   * `Undeploy` - Undeploys a Component from the cluster. The component still resides in the local config.
   * `Debug` - Start the component in debug mode
   * `Reveal in Explorer` - Show Component's context folder in Explorer view

**NOTE:** Currently we support creation of one component per folder. Multiple components from a folder might be supported in
future releases.

## Extension Configuration Settings
   * `OpenShift Toolkit: Show Channel On Output` - Show OpenShift Toolkit output channel when new text added to output stream
   * `OpenShift Toolkit: Output verbosity level` - Output verbosity level (value between 0 and 9) for OpenShift Create, Push and Watch commands in output channel and terminal view
   * `OpenShift Toolkit: Search CLI tools in PATH locations before using included binaries` - Force extension to search for `oc` and `odo` CLI tools in PATH locations before using bundled binaries
   * `OpenShift Toolkit: Use Webview based editors to show 'Show Log', 'Follow Log' and 'Describe' commands output` - Use Webview based editors instead of Terminal view to show or follow logs
   * `OpenShift Toolkit: CRC Executable Location` - Provide the path where OpenShift Local is installed.
   * `OpenShift Toolkit: CRC Pull Secret Path` - Provide the path where the pull secret file is present.
   * `OpenShift Toolkit: CRC Cpu Cores` - Number of CPU cores to allocate to the OpenShift cluster as selected during the first run.
   * `OpenShift Toolkit: CRC Memory Allocation` - MiB of memory to allocate to the OpenShift cluster as selected during the first run.

## View OpenShift Resources

This Extension uses Kubernetes Extension API to show OpenShift specific resources like Projects, Routes, Deployment Configs, Image Streams, Templates and others in Kubernetes Clusters View.

OpenShift Toolkit extension provides ```Use Project``` command to switch between OpenShift Projects. It is available for Project items in Kubernetes Clusters View.
<details>
<summary>Reference image</summary>

![ useproject ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/use-project.png)
</details>

## Dependencies

### Extensions

When installing the extension directly from the VSCode marketplace all the dependencies are installed automatically. For disconnected environments,before installing the extension download and install dependencies in the order listed below:

* [Red Hat Authentication](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-redhat-account)
* [YAML Extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)
* [Kubernetes Extension](https://marketplace.visualstudio.com/items?itemName=ms-kubernetes-tools.vscode-kubernetes-tools)

### CLI Tools

This extension uses two CLI tools to interact with OpenShift cluster:
* OKD CLI client tool - [oc](https://mirror.openshift.com/pub/openshift-v4/clients/ocp/4.9.5/)
* odo - [odo](https://developers.redhat.com/content-gateway/rest/mirror/pub/openshift-v4/clients/odo/v3.0.0/)

> `oc` and `odo` tools for Windows, Linux and macOS are included into extension package. Once the extension is installed, it is ready to use.

Follow the links below for additional information:

* [Understanding odo](https://odo.dev/)
* [Devfile ecosystem](https://devfile.io/)
