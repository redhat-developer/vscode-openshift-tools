# How to contribute

Contributions are essential for keeping this extension great.
We try to keep it as easy as possible to contribute changes and we are
open to suggestions for making it even easier.
There are only a few guidelines that we need contributors to follow.

## First Time Setup
1. Install prerequisites:
   * latest [Visual Studio Code](https://code.visualstudio.com/)
   * [Node.js](https://nodejs.org/) v16.17.0 or higher
     * It is recommended to set up `nvm` to manage different versions of node, which can be installed by following the instructions [here](https://github.com/nvm-sh/nvm#installing-and-updating).
     * To use the current recommended version for this project (in`./nvmrc`), run `nvm use`.

2. Fork and clone the repository
3. `cd vscode-openshift-tools`
4. Install the dependencies:

	```bash
	$ npm install
	```
5. Open the folder in VS Code

## Run and debug the extension locally

1. Build with the following command at least once before running in debug mode:

   ```bash
   $ npm run build
   ```

   * This downloads the `oc` and `odo` binaries and compiles webviews.
2. The extension can now be launched with the `Extension` launch option in the Run and Debug tab (`Ctrl+Shift+D`) in VS Code.
   * Note: breakpoints in webview code will not work
3. After making any changes, consider the following before relaunching the extension to ensure the changes are recompiled:
   * Changes made to webviews in `src/webview/$WEBVIEW_NAME/app` can be compiled with the corresponding command:

      ```bash
      $ npm run dev:compile:$WEBVIEW_NAME
      ```

     * The list of commands to build the webviews can be found in `package.json` or by running `npm run`
   * Changes in version of one of the required tools in `src/tools.json`, run:

      ```bash
      $ npm run bundle-tools
      ```

   * Any other changes should be recompiled automatically by the VS Code prelaunch task.
     * The launch will be prevented if there are compilation errors.
4. Once the extension is installed and reloaded, there will be an OpenShift Icon on the View Container, on the lines of snap mentioned below.

![View Container OpenShift](images/view-container-icon.png)

## Running the Integration Test Suite

In order to run the integration test suite, you need access to an OpenShift cluster
where you can create and delete projects.
Unfortunately, this means that OpenShift Developer Sandbox instances won't work.
Also, non-OpenShift Kubernetes distributions, such as `minikube`, will not work, since we test many OpenShift-specific features.
One way to access such a cluster is by using [crc](https://crc.dev/crc/) to run an OpenShift cluster locally on your computer.
The tests will create and delete resources on the cluster,
so please make sure nothing important is running on the cluster.

First, set the following environment variables to point the tests to your cluster:
- `CLUSTER_URL`: the URL pointing to the API of the cluster, defaults to `https://192.168.130.11:6443` (the default `crc` IP address)
- `CLUSTER_USER`: the username to use to login to the cluster, defaults to `developer`
- `CLUSTER_PASSWORD`: the password to use to login to the cluster, default to `developer`

Then, run `npm run test-integration`.

If you would like to generate a coverage report of the integration test suite,
you can run `npm run test-integration:coverage`.

> If you have any questions or run into any problems, please post an issue - we'll be very happy to help.

### Certificate of Origin

By contributing to this project you agree to the Developer Certificate of
Origin (DCO). This document was created by the Linux Kernel community and is a
simple statement that you, as a contributor, have the legal right to make the
contribution. See the [DCO](DCO) file for details.
