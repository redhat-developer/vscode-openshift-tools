# Change Log

## 1.21.0 (September 22, 2025)

 * [#5361](https://github.com/redhat-developer/vscode-openshift-tools/pull/5361) Devfile Registries list needs not contain Default Devfile Registry
 * [#5215](https://github.com/redhat-developer/vscode-openshift-tools/issues/5215) Fixed Pod selector when loading Pods from Che Dev Space workspace


## 1.20.0 (July 17, 2025)

 * [#5086](https://github.com/redhat-developer/vscode-openshift-tools/issues/5086) Use the latest @kubernetes/client-node
 * [#4535](https://github.com/redhat-developer/vscode-openshift-tools/issues/4535) Fixed the VSCode OpenShift Toolkit extension activation
 * [#4472](https://github.com/redhat-developer/vscode-openshift-tools/issues/4472) Added the validation and save for a K8s resources loaded from cluster

## 1.19.0 (April 29, 2025)

 * [#4816](https://github.com/redhat-developer/vscode-openshift-tools/issues/4816) Multiple K8s configuration files are supported when configured in KUBECONFIG environment variable
 * [#4874](https://github.com/redhat-developer/vscode-openshift-tools/issues/4874) Fixed: Cluster is not accessible even if correct K8s configuration file is selected
 * [#1579](https://github.com/redhat-developer/vscode-openshift-tools/issues/1579) Fixed: Listen to changes in K8s configuration files configured in KUBECONFIG environment variable

## 1.18.0 (February 12, 2025)

 * [#4681](https://github.com/redhat-developer/vscode-openshift-tools/pull/4681) The "Bind Service" feature is **removed** due to the deprecation of the Service Binding Operator
 * [#4677](https://github.com/redhat-developer/vscode-openshift-tools/pull/4677) The extension activation is fixed for the cases when the 'KUBECONGIG' environment variable is misconfigured
 * [#4484](https://github.com/redhat-developer/vscode-openshift-tools/issues/4484) OpenShift Pipeline Tasks in Cluster View are added to the Application Explorer
 * [#3935](https://github.com/redhat-developer/vscode-openshift-tools/issues/3935) Fixed the failure with logging in to an existing cluster
 * [#3872](https://github.com/redhat-developer/vscode-openshift-tools/issues/3872) Fixed the failure with logging in to a cluster when Kube config doesn't exist

## 1.17.0 (November 27, 2024)

 * [#4226](https://github.com/redhat-developer/vscode-openshift-tools/issues/4226) The extension activation is improved by bundling and removing unnecessary files
 * [#3850](https://github.com/redhat-developer/vscode-openshift-tools/issues/3850) "Components" sidebar section loading is improved
 * [#4566](https://github.com/redhat-developer/vscode-openshift-tools/pull/4566) Removed the `odo log` command
 * [#4552](https://github.com/redhat-developer/vscode-openshift-tools/pull/4552) Port validation is fixed when create a Component from local codebase
 * [#4536](https://github.com/redhat-developer/vscode-openshift-tools/pull/4536) Fixed the Devfile Registry related views for the cases where the current Devfile Registry is removed
 * [#4459](https://github.com/redhat-developer/vscode-openshift-tools/issues/4459) Fixed the issue with not trimmed token value used when logging into sandbox using quick pick workflow with token
 * [#4439](https://github.com/redhat-developer/vscode-openshift-tools/pull/4439) Use SSO account to configure sandbox in one click
 * [#4426](https://github.com/redhat-developer/vscode-openshift-tools/issues/4426) Moved from `react-syntax-highlighter` to `codemirror` for YAML syntax highlighting
 * [#4425](https://github.com/redhat-developer/vscode-openshift-tools/issues/4425) The Helm UI Page is added with additional tag based filtering
 * [#4424](https://github.com/redhat-developer/vscode-openshift-tools/issues/4424) Add and delete helm repository.
 * [#4411](https://github.com/redhat-developer/vscode-openshift-tools/issues/4411) Fixed the CRC setup preferences reset after the wizard is closed
 * [#4189](https://github.com/redhat-developer/vscode-openshift-tools/issues/4189) The selection of devfile version is added to the Devfile Registry editor

## 1.16.0 (September 3, 2024)

 * [#4151](https://github.com/redhat-developer/vscode-openshift-tools/issues/4151) Added support for creating deployments using a BuildConfig
 * [#4297](https://github.com/redhat-developer/vscode-openshift-tools/issues/4297) Added the UI for changing the selection of builder image
 * [#2883](https://github.com/redhat-developer/vscode-openshift-tools/issues/2883) Allow options to configure Helm Chart with a build image and other details
 * [#4108](https://github.com/redhat-developer/vscode-openshift-tools/issues/4108) Introduced support for the devfile for .NET 9
 * [#4357](https://github.com/redhat-developer/vscode-openshift-tools/pull/4357) Enabled command compatibility with files using the `.yml` extension
 * [#3898](https://github.com/redhat-developer/vscode-openshift-tools/issues/3898) Added an informational message to the Openshift terminal when there were no operations performed yet
 * [#4344](https://github.com/redhat-developer/vscode-openshift-tools/issues/4344) Replaced the `odo analyze` command with the new Alizer tool
 * [#3911](https://github.com/redhat-developer/vscode-openshift-tools/issues/3911) Enhanced the workflow for entering a container image URL
 * [#4289](https://github.com/redhat-developer/vscode-openshift-tools/issues/4289) Resolved the slow tree loading issue in the Application Explorer
 * [#4349](https://github.com/redhat-developer/vscode-openshift-tools/issues/4349) Fixed the broken Helm Chart installation view
 * [#4298](https://github.com/redhat-developer/vscode-openshift-tools/issues/4298) Fixed the issue with duplicate deployment names displaying in the tree view
 * [#4253](https://github.com/redhat-developer/vscode-openshift-tools/issues/4253) Fixed the issue of missing images on the "Add OpenShift Cluster" page

## 1.15.0 (July 16, 2024)

 * [#4291](https://github.com/redhat-developer/vscode-openshift-tools/pull/4291) Fixed the issue preventing the opening of the Routes node in the OpenShift Explorer
 * [#4283](https://github.com/redhat-developer/vscode-openshift-tools/pull/4283) Added validation for container image to be deployed from an image URL
 * [#4255](https://github.com/redhat-developer/vscode-openshift-tools/issues/4255) Remove outdated method from the extension activation
 * [#4247](https://github.com/redhat-developer/vscode-openshift-tools/pull/4247) Remove dependency to 'make-fetch-happen' NPM module
 * [#4233](https://github.com/redhat-developer/vscode-openshift-tools/issues/4233) Cluster Webview: sandbox detection status never ends
 * [#4184](https://github.com/redhat-developer/vscode-openshift-tools/pull/4184) Use 'paste' icon for pasting from Clipboard
 * [#4183](https://github.com/redhat-developer/vscode-openshift-tools/issues/4183) ODO CLI binary stopped working after Devfile schema update to v.2.2.2
 * [#4172](https://github.com/redhat-developer/vscode-openshift-tools/issues/4172) There is no error/warning notification when Helm Chart cannot be installed
 * [#4166](https://github.com/redhat-developer/vscode-openshift-tools/pull/4166) Trim token value from Clipboard when logging in to DevSandbox
 * [#4165](https://github.com/redhat-developer/vscode-openshift-tools/issues/4165) Use the value saved in the clipboard when logging in using a token
 * [#4118](https://github.com/redhat-developer/vscode-openshift-tools/issues/4118) Migrate Kubernetes Resource Link Provider from Kubernetes VSCode Extension to OpenShift Toolkit
 * [#4033](https://github.com/redhat-developer/vscode-openshift-tools/issues/4033) Migrate to upstream version for Helm CLI binary
 * [#3823](https://github.com/redhat-developer/vscode-openshift-tools/issues/3823) Display status information for Deployments in Application Explorer tree

## 1.14.0 (May 29, 2024)

 * [#3906](https://github.com/redhat-developer/vscode-openshift-tools/issues/3906) Add a new UI for showing, adding, and removing port forwards
 * [#4086](https://github.com/redhat-developer/vscode-openshift-tools/issues/4086) Create a webview for creating routes from the extension
 * [#3849](https://github.com/redhat-developer/vscode-openshift-tools/issues/3849) Add progress indicator for Login, Switch context, and Change project actions
 * [#4109](https://github.com/redhat-developer/vscode-openshift-tools/pull/4109) Fix login to sandbox workflow
 * [#4101](https://github.com/redhat-developer/vscode-openshift-tools/issues/4101) Project not listed if it has a display name annotation
 * [#4092](https://github.com/redhat-developer/vscode-openshift-tools/issues/4092) Trying to create a serverless function using the Spring Boot template causes the webview to fail
 * [#4083](https://github.com/redhat-developer/vscode-openshift-tools/issues/4083) Helm charts may not load on Linux under certain conditions
 * [#3999](https://github.com/redhat-developer/vscode-openshift-tools/issues/3999) Support projects/namespaces on clusters where the listing of projects is restricted
 * [#3990](https://github.com/redhat-developer/vscode-openshift-tools/issues/3990) Remove dependence on VS Code Kubernetes extension and use 'oc' binary instead of relying on 'kubectl' binary provided by VS Code Kubernetes
 * [#3987](https://github.com/redhat-developer/vscode-openshift-tools/issues/3987) Prevent App. Explorer from hanging on extension loading if logged out from a cluster
 * [#3971](https://github.com/redhat-developer/vscode-openshift-tools/issues/3971) Fix bug where re-logging in does not ask for username and password under certain conditions
 * [#3925](https://github.com/redhat-developer/vscode-openshift-tools/issues/3925), [#4064](https://github.com/redhat-developer/vscode-openshift-tools/pull/4064)  Fixed 'stdout maxBuffer length exceeded' error, a proposal message is added to change the maximum buffer size of standard output in case of 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' error appearance
 * [#3845](https://github.com/redhat-developer/vscode-openshift-tools/issues/3845) Fix bug where opening deployment logs would fail if you switched projects while they loaded

## 1.13.0 (April 10, 2024)

 * [#4045](https://github.com/redhat-developer/vscode-openshift-tools/issues/4045) Bump minimum memory for CRC to 10752 MB
 * [#4013](https://github.com/redhat-developer/vscode-openshift-tools/issues/4013) Support deletion of Pod resources from extension UI
 * [#4004](https://github.com/redhat-developer/vscode-openshift-tools/issues/4004) Fix Extension Survey form
 * [#3991](https://github.com/redhat-developer/vscode-openshift-tools/issues/3991) Showcase all Workload resources in Application Explorer Tree view
 * [#3981](https://github.com/redhat-developer/vscode-openshift-tools/issues/3981) Migrate Functionality from Kubernetes VSCode Extension to OpenShift Toolkit
 * [#3947](https://github.com/redhat-developer/vscode-openshift-tools/issues/3947) Properly refresh the app explorer tree after logging into a Kind cluster
 * [#3919](https://github.com/redhat-developer/vscode-openshift-tools/issues/3919) Improve "Open Kuberbetes YAML file" to avoid accidental opens and duplicate files
 * [#3918](https://github.com/redhat-developer/vscode-openshift-tools/issues/3918) Use "namespaces" wording on kubernetes clusters and "projects" wording on OpenShift clusters

## 1.12.0 (February 28, 2024)
 * [#3880](https://github.com/redhat-developer/vscode-openshift-tools/pull/3880) Do not call getAllComponents() in activate
 * [#3112](https://github.com/redhat-developer/vscode-openshift-tools/issues/3112) Extension takes several minutes to start if the current `~/.kube/config` context is an inaccessible cluster
 * [#3931](https://github.com/redhat-developer/vscode-openshift-tools/issues/3931) New Serverless Function is not shown after creation
 * [#3928](https://github.com/redhat-developer/vscode-openshift-tools/issues/3928) Can't load Helm chart
 * [#3879](https://github.com/redhat-developer/vscode-openshift-tools/pull/3879) When turned to use a service account for a Sandbox a wrong warning message appears
 * [#3848](https://github.com/redhat-developer/vscode-openshift-tools/pull/3848) Stop trying to connect to a cluster when it doesn't appear to be available
 * [#3841](https://github.com/redhat-developer/vscode-openshift-tools/pull/3841) Update func CLI to 1.13.0
 * [#3838](https://github.com/redhat-developer/vscode-openshift-tools/issues/3838) New and Improved sign-in for Developer Sandbox Login experience
 * [#3822](https://github.com/redhat-developer/vscode-openshift-tools/issues/3822) Add Context menu item to scale OpenShift Deployments
 * [#3814](https://github.com/redhat-developer/vscode-openshift-tools/issues/3814) "Open in Console" context menu item appears for non-OpenShift clusters
 * [#3813](https://github.com/redhat-developer/vscode-openshift-tools/pull/3813) Force refresh App explorer on create project when new project name is the same as the one set in the current-context
 * [#3812](https://github.com/redhat-developer/vscode-openshift-tools/issues/3812) As a user I initially couldn't find "Change Active Project"
 * [#3804](https://github.com/redhat-developer/vscode-openshift-tools/pull/3804) Improve switch context workflow
 * [#3665](https://github.com/redhat-developer/vscode-openshift-tools/issues/3665) Enhance dev on podman experience
 * [#3640](https://github.com/redhat-developer/vscode-openshift-tools/issues/3640) Show context menu to Open in Terminal for the function created
 * [#3638](https://github.com/redhat-developer/vscode-openshift-tools/issues/3638) Show vscode notification message if docker is not started for Fn commands
 * [#3512](https://github.com/redhat-developer/vscode-openshift-tools/issues/3512) Add paste to the OpenShift terminal
 * [#3405](https://github.com/redhat-developer/vscode-openshift-tools/issues/3405) Fix podman detection prompt
 * [#2581](https://github.com/redhat-developer/vscode-openshift-tools/issues/2581) Cannot Start Dev action on quarkus component until an OpenShift Project is created
 * [#2418](https://github.com/redhat-developer/vscode-openshift-tools/issues/2418) Allow to deploy docker images to connected OpenShift cluster

## 1.11.0 (December 13, 2023)
 * [#3609](https://github.com/redhat-developer/vscode-openshift-tools/issues/3609) Manage helm repositories
 * [#3113](https://github.com/redhat-developer/vscode-openshift-tools/issues/3113) Show Helm charts from all Helm repos in the Helm chart explorer
 * [#3701](https://github.com/redhat-developer/vscode-openshift-tools/issues/3701) Update UX for Helm View
 * [#3636](https://github.com/redhat-developer/vscode-openshift-tools/issues/3636) Update UX for Devfile Registry View
 * [#3652](https://github.com/redhat-developer/vscode-openshift-tools/issues/3652) Open OpenShift resources in browser
 * [#3726](https://github.com/redhat-developer/vscode-openshift-tools/issues/3726) Command fails when expanding project in Application Explorer on crc
 * [#3723](https://github.com/redhat-developer/vscode-openshift-tools/issues/3723) CRC OpenShift status showed as green even though it was stopped
 * [#3720](https://github.com/redhat-developer/vscode-openshift-tools/issues/3720) Application Explorer is not refreshed when a component starts
 * [#3715](https://github.com/redhat-developer/vscode-openshift-tools/pull/3715) added 'FINDSTR' when windows machine instead of grep
 * [#3544](https://github.com/redhat-developer/vscode-openshift-tools/issues/3544) Create Service has empty dropdown on Sandbox
 * [#3643](https://github.com/redhat-developer/vscode-openshift-tools/issues/3643) Error popups on trying to delete a project on sandbox due to user limitation
 * [#3520](https://github.com/redhat-developer/vscode-openshift-tools/issues/3520) Error popup when expanding project in Application Explorer
 * [#3637](https://github.com/redhat-developer/vscode-openshift-tools/issues/3637) Terminal icon would be knative if it is a serverless function call and the title should be in camel case
 * [#3543](https://github.com/redhat-developer/vscode-openshift-tools/issues/3543) Ctrl+clicking a link in the OpenShift Terminal should open the URL
 * [#3622](https://github.com/redhat-developer/vscode-openshift-tools/issues/3622) Helm Chart search is stuck loading if you close then reopen it

## 1.10.2 (November 7, 2023)
 * [#3522](https://github.com/redhat-developer/vscode-openshift-tools/issues/3522) "Build and run" for Serverless Function fails

## 1.10.1 (November 6, 2023)
 * [#3336](https://github.com/redhat-developer/vscode-openshift-tools/pull/3519) Creating project into sandbox has user limitation
 * [#3525](https://github.com/redhat-developer/vscode-openshift-tools/issues/3525) func CLI not available in latest OpenShift toolkit v1.10.0 on windows
 * [#3527](https://github.com/redhat-developer/vscode-openshift-tools/issues/3527) Build cannot download func dependency, if the project is checked out to a directory with a dot character

## 1.10.0 (November 2, 2023)
 * [#3491](https://github.com/redhat-developer/vscode-openshift-tools/pull/3491) Deploy a serverless function using Tekton
 * [#3352](https://github.com/redhat-developer/vscode-openshift-tools/issues/3352) Support different build configurations for serverless functions
 * [#2873](https://github.com/redhat-developer/vscode-openshift-tools/issues/2873) CodeLenses to Apply/Delete a Kubernetes YAML file
 * [#3508](https://github.com/redhat-developer/vscode-openshift-tools/pull/3508) List Operator-backed services in the Application Explorer sidebar
 * [#3475](https://github.com/redhat-developer/vscode-openshift-tools/pull/3475) Add "OK" and "Cancel" buttons to cluster login input fields
 * [#3452](https://github.com/redhat-developer/vscode-openshift-tools/issues/3452) When creating a component, use the first workspace folder as an initial path value
 * [#3386](https://github.com/redhat-developer/vscode-openshift-tools/issues/3386) Fix creating a component from Git when a Devfile exists in git repo
 * [#3384](https://github.com/redhat-developer/vscode-openshift-tools/issues/3384) Fix scrolling section in welcome page for some display scaling settings
 * [#3357](https://github.com/redhat-developer/vscode-openshift-tools/issues/3357) Add possibility to "go back" when logging into a cluster
 * [#3354](https://github.com/redhat-developer/vscode-openshift-tools/issues/3354) Improve the Helm UI so that it resembles the "Create Component" > "From Template" UI
 * [#3353](https://github.com/redhat-developer/vscode-openshift-tools/issues/3353) Keybinding and context menu for copy and select all in terminal
 * [#3339](https://github.com/redhat-developer/vscode-openshift-tools/issues/3339) Use VSCode SecretStorage API instead of 'keytar'
 * [#3318](https://github.com/redhat-developer/vscode-openshift-tools/issues/3318) Refresh the components tree view when Devfiles are deleted
 * [#3294](https://github.com/redhat-developer/vscode-openshift-tools/issues/3294) Sanitize the suggested component name in the "Create Component" > "Import from Git" workflow
 * [#3138](https://github.com/redhat-developer/vscode-openshift-tools/issues/3138) In the terminal, if a command is rerun after exiting, close the old tab
 * [#3137](https://github.com/redhat-developer/vscode-openshift-tools/issues/3137) "Select All" functionality for OpenShift Terminal
 * [#3135](https://github.com/redhat-developer/vscode-openshift-tools/issues/3135) Add button to clear contents of terminal in OpenShift Terminal view
 * [#3134](https://github.com/redhat-developer/vscode-openshift-tools/issues/3134) Automatically create a component folder for manually typed in path in "Create Component" workflow
 * [#3081](https://github.com/redhat-developer/vscode-openshift-tools/issues/3081) Fix "Create Service" view
 * [#3040](https://github.com/redhat-developer/vscode-openshift-tools/issues/3040) Display Progress Information when cloning project during "Create Component" > "Import From Git"
 * [#2589](https://github.com/redhat-developer/vscode-openshift-tools/issues/2589) Add support for running 'odo dev' without watching resources for changes and instead rebuild when 'p' is pressed in the terminal
 * [#1803](https://github.com/redhat-developer/vscode-openshift-tools/issues/1803) Make it easier to select all "Watch log" content in the terminal, and remove the alternative editor
 * [#3382](https://github.com/redhat-developer/vscode-openshift-tools/issues/3382) Support `KUBECONFIG` environment variable
 * [#3492](https://github.com/redhat-developer/vscode-openshift-tools/pull/3492) Add repo URL in the Helm UI
 * [#3514](https://github.com/redhat-developer/vscode-openshift-tools/issues/3514) Fix error that prevents logging into a cluster using a token

## 1.9.1 (September 28, 2023)
 * [#3342](https://github.com/redhat-developer/vscode-openshift-tools/issues/3342) Sandbox page in `Add OpenShift Cluster` editor stays in 'Detecting' status forever
 * [#3356](https://github.com/redhat-developer/vscode-openshift-tools/issues/3356) Extension fails to activate when a deleted folder is in the workspace

## 1.9.0 (September 26, 2023)
 * [#3086](https://github.com/redhat-developer/vscode-openshift-tools/issues/3086) In Devfile search view, you can now filter by debug/deploy support and tags
 * [#2781](https://github.com/redhat-developer/vscode-openshift-tools/issues/2781) Add support for Devfile port and name detection
 * [#2819](https://github.com/redhat-developer/vscode-openshift-tools/issues/2819) Create a separate terminal pane for all vscode-openshift related commands to run in
 * [#3316](https://github.com/redhat-developer/vscode-openshift-tools/issues/3316) Fix bug where invoking "Cloud Events" functions didn't work
 * [#2854](https://github.com/redhat-developer/vscode-openshift-tools/issues/2854) Killing terminal from older start dev action stops current dev
 * [#3323](https://github.com/redhat-developer/vscode-openshift-tools/issues/3323) Prevent "Create Dev Sandbox" wizard from getting stuck at loading screen
 * [#3293](https://github.com/redhat-developer/vscode-openshift-tools/issues/3293) Trying "Create Component" with a mostly empty git repository doesn't work
 * [#3324](https://github.com/redhat-developer/vscode-openshift-tools/issues/3324) Remove "Connect on Slack" button in "Dev Sandbox" wizard, since the link no longer works

## 1.8.0 (September 14, 2023)
 * [#3128](https://github.com/redhat-developer/vscode-openshift-tools/issues/3128) Create Serverless Functions based on templates from configured template repositories
 * [#3251](https://github.com/redhat-developer/vscode-openshift-tools/issues/3251) Add a walkthrough for creating a Serverless Function from a template
 * [#3260](https://github.com/redhat-developer/vscode-openshift-tools/issues/3260) Improve README with content about Serverless Functions
 * [#3136](https://github.com/redhat-developer/vscode-openshift-tools/issues/3136) Fix newly created Serverless Functions not appearing in serverless functions view when they are created outside of the workspace
 * [#3154](https://github.com/redhat-developer/vscode-openshift-tools/issues/3154) Fix "No such file" error when opening "Create OpenShift Local Cluster"
 * [#3145](https://github.com/redhat-developer/vscode-openshift-tools/issues/3145) Don't show the current namespace in the Serverless Functions view
 * [#3268](https://github.com/redhat-developer/vscode-openshift-tools/issues/3268) Fix Developer Sandbox WebView font color not adapting when switching to a light theme
 * [#3272](https://github.com/redhat-developer/vscode-openshift-tools/issues/3272) Fix links to screencasts in READMEs
 * [#3091](https://github.com/redhat-developer/vscode-openshift-tools/issues/3091) Depend on vscode-kubernetes while developing and testing the extension
 * [#3239](https://github.com/redhat-developer/vscode-openshift-tools/pull/3239) Update crc to 2.26.0
 * [#3189](https://github.com/redhat-developer/vscode-openshift-tools/pull/3189) Check for and remove cycles in module dependencies
 * Update many of the extension dependencies
 * Remove many unused extension dependencies

## 1.7.0 (August 31, 2023)
 * [#3010](https://github.com/redhat-developer/vscode-openshift-tools/issues/3010) Create UI for invoking serverless functions
 * [#3056](https://github.com/redhat-developer/vscode-openshift-tools/issues/3056) Configure serverless function environment, labels, volumes, and git
 * [#3055](https://github.com/redhat-developer/vscode-openshift-tools/issues/3055) Manage repositories of serverless function templates
 * [#2811](https://github.com/redhat-developer/vscode-openshift-tools/issues/2811) View and run devfile commands on running components from the components view
 * [#2668](https://github.com/redhat-developer/vscode-openshift-tools/issues/2668) Support binding services to a component
 * [#3131](https://github.com/redhat-developer/vscode-openshift-tools/pull/3131) Update `odo` to 3.14.0
 * [#3119](https://github.com/redhat-developer/vscode-openshift-tools/pull/3119) Update `crc` to 2.25.0
 * [#3133](https://github.com/redhat-developer/vscode-openshift-tools/pull/3133) Background of "Create serverless function" UI respects the user's colour theme
 * [#3104](https://github.com/redhat-developer/vscode-openshift-tools/issues/3104) Import from git no longer fails if there is an existing Devfile
 * [#3127](https://github.com/redhat-developer/vscode-openshift-tools/issues/3127) Fixed "Create Component from Folder" doesn't trim suggested name to last portion of the path on Windows
 * [#3122](https://github.com/redhat-developer/vscode-openshift-tools/issues/3122) Fixed "Create Component From Folder" always uses first open folder, regardless of which one was right clicked on
 * [#3150](https://github.com/redhat-developer/vscode-openshift-tools/issues/3150) Attempt to sanitize the suggest name for the component in "Create Component from Folder"

## 1.6.0 (August 14, 2023)
 * [#2922](https://github.com/redhat-developer/vscode-openshift-tools/issues/2922) Combine different component creation strategies ("From Git", "From Local Folder", "From Template") into one, new UI
 * [#3039](https://github.com/redhat-developer/vscode-openshift-tools/issues/3039) Add `Create Component from Folder` context menu item to quickly create components from file explorer
 * [#2993](https://github.com/redhat-developer/vscode-openshift-tools/issues/2993) Create, build, and run KNative Serverless functions
 * [#3073](https://github.com/redhat-developer/vscode-openshift-tools/pull/3073) Deploy, redeploy, and undeploy KNative Serverless functions
 * [#3009](https://github.com/redhat-developer/vscode-openshift-tools/issues/3009) Add telemetry events for Serverless Functions view
 * [#2803](https://github.com/redhat-developer/vscode-openshift-tools/pull/2803) Support binding components to Operator-backed services
 * [#2962](https://github.com/redhat-developer/vscode-openshift-tools/pull/2962) Contribute "OpenShift Local" and "OpenShift Dev Sandbox" to the vscode-kubernetes' cloud explorer
 * [#3059](https://github.com/redhat-developer/vscode-openshift-tools/issues/3059) Migrate Jenkins release build to GitHub Actions
 * [#3021](https://github.com/redhat-developer/vscode-openshift-tools/issues/3021) Fix uninstalling Helm releases
 * [#3013](https://github.com/redhat-developer/vscode-openshift-tools/pull/3013) Update odo to 3.12.0
 * [#2878](https://github.com/redhat-developer/vscode-openshift-tools/issues/2878) Prompt to login to a cluster when attempting an action that requires access to a cluster
 * [#2979](https://github.com/redhat-developer/vscode-openshift-tools/issues/2979) Login with incorrect credentials no longer gives login successful notification
 * [#2977](https://github.com/redhat-developer/vscode-openshift-tools/issues/2977) Login to Devsandbox button workflow improvement
 * [#2976](https://github.com/redhat-developer/vscode-openshift-tools/issues/2976) Improve back button style for Add cluster page
 * [#2965](https://github.com/redhat-developer/vscode-openshift-tools/issues/2965) Prevent users from creating two devfile registries with the same URL
 * [#2964](https://github.com/redhat-developer/vscode-openshift-tools/issues/2964) Adding a new Devfile registry refreshes the Devfile registry UI
 * [#2940](https://github.com/redhat-developer/vscode-openshift-tools/issues/2940) During "Import from Git", remove the repo if cloning fails
 * [#2915](https://github.com/redhat-developer/vscode-openshift-tools/issues/2915) Fix validation of git URLs containing issue numbers during "Import from Git"
 * [#2910](https://github.com/redhat-developer/vscode-openshift-tools/issues/2910) "Describe Component" context menu now respects `openshiftToolkit.useWebviewInsteadOfTerminalView`
 * [#2840](https://github.com/redhat-developer/vscode-openshift-tools/issues/2840) Add OpenShift binaries to Dev Containers
 * [#2808](https://github.com/redhat-developer/vscode-openshift-tools/issues/2808) Prompt to install podman if it's not present on the system (when attempting to run "Dev on Podman")
 * [#2628](https://github.com/redhat-developer/vscode-openshift-tools/issues/2628) Open in Developer console fails for Kubernetes applications
 * [#2023](https://github.com/redhat-developer/vscode-openshift-tools/issues/2023) Request if components should be deleted when deleting Application or Project from Application explorer
 * [#1874](https://github.com/redhat-developer/vscode-openshift-tools/issues/1874) Simplify logging into crc from inside "Create Cluster" wizard

## 1.5.0 (June 07, 2023)

* [#2840](https://github.com/redhat-developer/vscode-openshift-tools/issues/2840) Add OpenShift binaries when running on Dev Containers
* [#2489](https://github.com/redhat-developer/vscode-openshift-tools/issues/2489) Feedback view for users to share extension feedback
* [#2921](https://github.com/redhat-developer/vscode-openshift-tools/issues/2921) Support odo 3.11.0 workflow
* [#2928](https://github.com/redhat-developer/vscode-openshift-tools/pull/2928) Support for crc 2.20.0 running OpenShift 4.13
* [#2930](https://github.com/redhat-developer/vscode-openshift-tools/issues/2930) UI fixes on welcome page
* [#2931](https://github.com/redhat-developer/vscode-openshift-tools/issues/2931) UI fixes on Helm chart view
* [#2799](https://github.com/redhat-developer/vscode-openshift-tools/issues/2799) Added additional test cases for improving the test coverage
* [#2927](https://github.com/redhat-developer/vscode-openshift-tools/issues/2927) Improve Delete component workflow
* [#2939](https://github.com/redhat-developer/vscode-openshift-tools/issues/2939) Improve import from git workflow
* [#2948](https://github.com/redhat-developer/vscode-openshift-tools/issues/2948) Fix running vsix locally with bundled binaries

## 1.4.0 (May 23, 2023)

* [#2798](https://github.com/redhat-developer/vscode-openshift-tools/issues/2798) Auto generation of tools.json file with updated cli version and sha256 checksums
* [#709](https://github.com/redhat-developer/vscode-openshift-tools/issues/709) Improve `Login to Cluster` command while checking if the cluster is started
* [#2861](https://github.com/redhat-developer/vscode-openshift-tools/pull/2861) Add 'Sign in with Red Hat' item to Accounts menu when extension activated
* [#2864](https://github.com/redhat-developer/vscode-openshift-tools/issues/2864) Fix 'OpenShift: Create' action with one project available
* [#2870](https://github.com/redhat-developer/vscode-openshift-tools/pull/2870) Support odo 3.10.0 workflow
* [#2869](https://github.com/redhat-developer/vscode-openshift-tools/issues/2869) New Improved Helm Chart workflow
* [#2891](https://github.com/redhat-developer/vscode-openshift-tools/issues/2891) Remove Experimental Features check from Components View
* [#2799](https://github.com/redhat-developer/vscode-openshift-tools/issues/2799) Integration tests to verify cli tool commands used in extension works with new version released

## 1.3.0 (April 26, 2023)

* [#2132](https://github.com/redhat-developer/vscode-openshift-tools/issues/2132) Add Helm Charts UI in extension
* [#2180](https://github.com/redhat-developer/vscode-openshift-tools/issues/2180) Namespace non existent should be handled
* [#2658](https://github.com/redhat-developer/vscode-openshift-tools/issues/2658) Fix npm install warnings for packages and their dependencies
* [#2788](https://github.com/redhat-developer/vscode-openshift-tools/issues/2788) Add Helm Workflow information in Walkthrough
* [#2790](https://github.com/redhat-developer/vscode-openshift-tools/issues/2790) Use odo analyze command to detect devfiles in Import From Git workflow
* [#2801](https://github.com/redhat-developer/vscode-openshift-tools/pull/2801) Hide commands that require selecting a component
* [#2806](https://github.com/redhat-developer/vscode-openshift-tools/issues/2806) Update the CRC version to latest in OpenShift Toolkit
* [#2809](https://github.com/redhat-developer/vscode-openshift-tools/issues/2809) Add reference of podman keyword in the extension keywords section
* [#2812](https://github.com/redhat-developer/vscode-openshift-tools/issues/2812) 'Show Logs' and 'Follow logs' commands doesn't work when dev is running on podman
* [#2823](https://github.com/redhat-developer/vscode-openshift-tools/issues/2823) Trying to load a helm chart fails
* [#2830](https://github.com/redhat-developer/vscode-openshift-tools/issues/2830) Changing the show/follow log output to webview based editor results in empty page
* [#2836](https://github.com/redhat-developer/vscode-openshift-tools/pull/2836) updated Node.js 16 in GH workflow actions
* [#2839](https://github.com/redhat-developer/vscode-openshift-tools/pull/2839) disable next button until user selects the installed location of local CRC
* [#2843](https://github.com/redhat-developer/vscode-openshift-tools/pull/2843) added null check for starter project
* [#2845](https://github.com/redhat-developer/vscode-openshift-tools/issues/2845) Helm charts view is loading indefinitely
* [#2848](https://github.com/redhat-developer/vscode-openshift-tools/issues/2848) Helm Charts doesn't appear in context menu until you switch namespaces
* [#2852](https://github.com/redhat-developer/vscode-openshift-tools/issues/2852) Add --forward-localhost on podman dev

## 1.2.0 (February 17, 2023)

* [#2553](https://github.com/redhat-developer/vscode-openshift-tools/issues/2553) Use 'workbench.action.openIssueReporter' to report issues for the extension
* [#2771](https://github.com/redhat-developer/vscode-openshift-tools/issues/2771) `Open in Browser` command does not work for components running in dev mode on podman
* [#2764](https://github.com/redhat-developer/vscode-openshift-tools/issues/2764) Update odo to v3.6.0 release
* [#2757](https://github.com/redhat-developer/vscode-openshift-tools/issues/2757) Quickly create component form the current workspace
* [#2755](https://github.com/redhat-developer/vscode-openshift-tools/issues/2755) Unknown flag --run-on when use `Start Dev on Podman`
* [#2745](https://github.com/redhat-developer/vscode-openshift-tools/issues/2745) Update Red Hat Authentication extension to v0.1.0
* [#2725](https://github.com/redhat-developer/vscode-openshift-tools/issues/2725) Active and disabled 'Create Component' buttons look the same
* [#2724](https://github.com/redhat-developer/vscode-openshift-tools/issues/2724) Incorrect error 'rate limit is exceeded' in case of connectivity issues
* [#2035](https://github.com/redhat-developer/vscode-openshift-tools/issues/2035) Check devfile version is 2.0.0 before using it in odo --devfile option

## 1.1.2 (January 25, 2023)

* [#2754](https://github.com/redhat-developer/vscode-openshift-tools/issues/2754) v0.2.9 is latest version available on windows arm64
* [#2736](https://github.com/redhat-developer/vscode-openshift-tools/issues/2736) Update odo to v3.5.0

## 1.1.1 (January 12, 2023)

* [#2738](https://github.com/redhat-developer/vscode-openshift-tools/issues/2738) Git repository validation never ends on Mac M1
* [#2737](https://github.com/redhat-developer/vscode-openshift-tools/issues/2737) VSCode offers to install extension v0.2.9 on Mac M1

## 1.1.0 (January 10, 2023)

* [#2700](https://github.com/redhat-developer/vscode-openshift-tools/issues/2700) Missing word in error message in Import from Git wizard
* [#2726](https://github.com/redhat-developer/vscode-openshift-tools/issues/2726) Changing git repository field after validation does not invalidate valid state of the form
* [#2718](https://github.com/redhat-developer/vscode-openshift-tools/issues/2718) Is it possible to change the colors of the YML keys?
* [#2711](https://github.com/redhat-developer/vscode-openshift-tools/issues/2711) Migrate to odo 3.4.0
* [#2710](https://github.com/redhat-developer/vscode-openshift-tools/issues/2710) remove patternfly dependencies from OpenShift Toolkit
* [#2709](https://github.com/redhat-developer/vscode-openshift-tools/issues/2709) Fix the GitHub Readme badge error
* [#2705](https://github.com/redhat-developer/vscode-openshift-tools/issues/2705) Devfile Registry View does not show errors for connectivity related issues and stays in 'Loading Registry View' mode forever
* [#2701](https://github.com/redhat-developer/vscode-openshift-tools/issues/2701) Show and Follow log is not shown when set to open in web view
* [#2700](https://github.com/redhat-developer/vscode-openshift-tools/issues/2700) Missing word in error message in Import from Git wizard
* [#2693](https://github.com/redhat-developer/vscode-openshift-tools/issues/2693) Login to cluster does not work
* [#2690](https://github.com/redhat-developer/vscode-openshift-tools/issues/2690) Support podman workflow using odo
* [#2689](https://github.com/redhat-developer/vscode-openshift-tools/issues/2689) Update @material-ui/core package
* [#2688](https://github.com/redhat-developer/vscode-openshift-tools/issues/2688) Update odo to v3.3.0
* [#2685](https://github.com/redhat-developer/vscode-openshift-tools/issues/2685) OpenShift Local workflow broken in Windows
* [#2682](https://github.com/redhat-developer/vscode-openshift-tools/issues/2682) Cannot create project with name of previously deleted project
* [#2681](https://github.com/redhat-developer/vscode-openshift-tools/issues/2681) Cancel git clone process if user exists Import from Git workflow
* [#2676](https://github.com/redhat-developer/vscode-openshift-tools/issues/2676) Enable odo telemetry based on current vscode telemetry opt-in status
* [#2674](https://github.com/redhat-developer/vscode-openshift-tools/issues/2674) Unable to select devfile registry in git import when multiple devfile registry configured
* [#2671](https://github.com/redhat-developer/vscode-openshift-tools/issues/2671) Unable to create component from Get started page view
* [#2667](https://github.com/redhat-developer/vscode-openshift-tools/issues/2667) Support odo 3.2.0 workflow
* [#2666](https://github.com/redhat-developer/vscode-openshift-tools/issues/2666) Typo: Component name spell error
* [#2608](https://github.com/redhat-developer/vscode-openshift-tools/issues/2608) Debug session failed to start
* [#2598](https://github.com/redhat-developer/vscode-openshift-tools/issues/2598) Manage Kubernetes Context Action
* [#2579](https://github.com/redhat-developer/vscode-openshift-tools/issues/2579) Add Browse actions in registry view
* [#2577](https://github.com/redhat-developer/vscode-openshift-tools/issues/2577) Registry view is empty by default when OpenShift extension is opened
* [#2562](https://github.com/redhat-developer/vscode-openshift-tools/issues/2562) Perform odo v3 migration testing
* [#2559](https://github.com/redhat-developer/vscode-openshift-tools/issues/2559) Enable telemetry for odo calls if user consents to telemetry request for the extension
* [#2465](https://github.com/redhat-developer/vscode-openshift-tools/issues/2465) Detect debugger ext for component using devfile's language tags in the registry
* [#1802](https://github.com/redhat-developer/vscode-openshift-tools/issues/1802) Provide a way to remove clusters from the list

## 1.0.0 (November 8, 2022)

* [#2651](https://github.com/redhat-developer/vscode-openshift-tools/issues/2651) Add analyze button in git import
* [#2646](https://github.com/redhat-developer/vscode-openshift-tools/issues/2646) Component creation success message still shows Push information
* [#2644](https://github.com/redhat-developer/vscode-openshift-tools/issues/2644) Deploy command is not shown even if deploy is true in odo describe
* [#2640](https://github.com/redhat-developer/vscode-openshift-tools/issues/2640) Update readme gifs and information with latest workflow
* [#2637](https://github.com/redhat-developer/vscode-openshift-tools/issues/2637) Components view refresh does not pickup changes from devfiles
* [#2636](https://github.com/redhat-developer/vscode-openshift-tools/issues/2636) Context folder quick pick list should exclude folders with components
* [#2632](https://github.com/redhat-developer/vscode-openshift-tools/issues/2632) Update Getting Started gifs with latest workflow
* [#2621](https://github.com/redhat-developer/vscode-openshift-tools/issues/2621) Add Undeploy command for the components
* [#2615](https://github.com/redhat-developer/vscode-openshift-tools/issues/2615) 'Add Registry' command always triggers 'Edit Registry' workflow after Registry item selected in view
* [#2607](https://github.com/redhat-developer/vscode-openshift-tools/issues/2607) Start dev results in stucked "dev starting" state
* [#2605](https://github.com/redhat-developer/vscode-openshift-tools/issues/2605) Cannot change active project under OS connection
* [#2604](https://github.com/redhat-developer/vscode-openshift-tools/issues/2604) Logging out of the cluster (crc) throws an error notification: All promises were rejected
* [#2603](https://github.com/redhat-developer/vscode-openshift-tools/issues/2603) Add parsing of kubeconfig file, empty kube config file throws an error: Cannot read properties of undefined (reading 'clusters')
* [#2597](https://github.com/redhat-developer/vscode-openshift-tools/issues/2597) Add Default kubeconfig File at the top of the cluster connected to
* [#2595](https://github.com/redhat-developer/vscode-openshift-tools/issues/2595) Change the icon of `change active project`
* [#2594](https://github.com/redhat-developer/vscode-openshift-tools/issues/2594) OpenShift welcome page layout breaks when zoomed in
* [#2593](https://github.com/redhat-developer/vscode-openshift-tools/issues/2593) Open .kubeconfig in editor
* [#2591](https://github.com/redhat-developer/vscode-openshift-tools/issues/2591) Update Readme with 1.0 changes and odov3 support
* [#2590](https://github.com/redhat-developer/vscode-openshift-tools/issues/2590) Follow logs commands fails with error
* [#2588](https://github.com/redhat-developer/vscode-openshift-tools/issues/2588) Odo logo output is missing in terminal when starting dev on k8s cluster
* [#2582](https://github.com/redhat-developer/vscode-openshift-tools/issues/2582) Show the application explorer using the cluster and project structure
* [#2580](https://github.com/redhat-developer/vscode-openshift-tools/issues/2580) Force stop dev fails with the following error
* [#2578](https://github.com/redhat-developer/vscode-openshift-tools/issues/2578) Created component notification says is should be pushed into cluster, wrong description
* [#2577](https://github.com/redhat-developer/vscode-openshift-tools/issues/2577) Registry view is empty by default when OpenShift extension is opened
* [#2576](https://github.com/redhat-developer/vscode-openshift-tools/issues/2576) Application Explorer options (buttons) are missing and only "loaded-context" item is present when no kubeconfig is set
* [#2574](https://github.com/redhat-developer/vscode-openshift-tools/issues/2574) Project creation does not do anything in Application Explorer
* [#2573](https://github.com/redhat-developer/vscode-openshift-tools/issues/2573) Show current context only if it is active
* [#2572](https://github.com/redhat-developer/vscode-openshift-tools/issues/2572) Change message for create component
* [#2571](https://github.com/redhat-developer/vscode-openshift-tools/issues/2571) start dev fails for any component created
* [#2568](https://github.com/redhat-developer/vscode-openshift-tools/pull/2568) Improve sandbox workflow and go directly to 'Copy Login Command' page

## 0.7.0 (September 28, 2022)

* [#2546](https://github.com/redhat-developer/vscode-openshift-tools/issues/2546) Support crc 2.9.0 in the extension
* [#2533](https://github.com/redhat-developer/vscode-openshift-tools/issues/2533) Card Modal should use more width and be bigger
* [#2532](https://github.com/redhat-developer/vscode-openshift-tools/issues/2532) Improve UX for devfile registry View
* [#2531](https://github.com/redhat-developer/vscode-openshift-tools/issues/2531) Fix starter project card layout
* [#2523](https://github.com/redhat-developer/vscode-openshift-tools/issues/2523) Registry Viewer: Selected item in starter projects list easily confused with buttons
* [#2522](https://github.com/redhat-developer/vscode-openshift-tools/issues/2522) Registry Viewer: Devfile details view has two scroll bars
* [#2521](https://github.com/redhat-developer/vscode-openshift-tools/issues/2521) Registry Viewer: White frame apperas when devfile selected
* [#2520](https://github.com/redhat-developer/vscode-openshift-tools/issues/2520) SandBox Workflow: Use theme colors in forms for PhoneInput and Button components
* [#2516](https://github.com/redhat-developer/vscode-openshift-tools/issues/2516) Add color labels to registry views added by the user
* [#2461](https://github.com/redhat-developer/vscode-openshift-tools/issues/2461) Java debug fails for any java based devfile
* [#2402](https://github.com/redhat-developer/vscode-openshift-tools/issues/2402) Design a new Welcome Page with Instructions and Feature sets

## 0.6.0 (August 25, 2022)

* [#2464](https://github.com/redhat-developer/vscode-openshift-tools/issues/2464) Debug command fails for python components due to issue with debug command in devfile
* [#2514](https://github.com/redhat-developer/vscode-openshift-tools/issues/2514) Sandbox: Verification code request form times out
* [#2510](https://github.com/redhat-developer/vscode-openshift-tools/issues/2510) Welcome View: `OpenShift: Welcome` command does not open Welcome View if 'Show Welcome Page' preference is not set
* [#2507](https://github.com/redhat-developer/vscode-openshift-tools/issues/2507) Cluster Editor: Buttons in Sandbox Workflow page are not centered
* [#2506](https://github.com/redhat-developer/vscode-openshift-tools/issues/2506) Cluster Editor: Images on infrastructure cards are not centered
* [#2497](https://github.com/redhat-developer/vscode-openshift-tools/issues/2497) update Registry View icon and change the text
* [#2496](https://github.com/redhat-developer/vscode-openshift-tools/issues/2496) Improve loading time for registry viewer
* [#2490](https://github.com/redhat-developer/vscode-openshift-tools/issues/2490) Devfile view registry is broken on vscode macOS
* [#2488](https://github.com/redhat-developer/vscode-openshift-tools/issues/2488) Add Back button when specific card is opened in Add Cluster view
* [#2487](https://github.com/redhat-developer/vscode-openshift-tools/issues/2487) CRC 2.5.1 does not support M1 based machines for OpenShift workflow
* [#2486](https://github.com/redhat-developer/vscode-openshift-tools/issues/2486) Fix UI responsiveness for Add Cluster screen
* [#2480](https://github.com/redhat-developer/vscode-openshift-tools/issues/2480) Activate basic UI tests in GitHub Actions workflow
* [#2474](https://github.com/redhat-developer/vscode-openshift-tools/issues/2474) Launching Developer Sandbox feature does not work
* [#2450](https://github.com/redhat-developer/vscode-openshift-tools/issues/2450) Migrate to latest CRC 2.4.1 release
* [#2421](https://github.com/redhat-developer/vscode-openshift-tools/issues/2421) Review telemetry events to eliminate not used ones
* [#2404](https://github.com/redhat-developer/vscode-openshift-tools/issues/2404) Change New Component workflow
* [#1477](https://github.com/redhat-developer/vscode-openshift-tools/issues/1477) 'OpenShift: Delete Storage' command should not delete storage from tree until it is pushed

## 0.5.0 (July 13, 2022)

* [#2414](https://github.com/redhat-developer/vscode-openshift-tools/issues/2414) Add Get Started page for OpenShift Walkthrough
* [#2392](https://github.com/redhat-developer/vscode-openshift-tools/issues/2392) Webview Based Registry Browser
* [#2432](https://github.com/redhat-developer/vscode-openshift-tools/issues/2432) Add telemetry event to capture Registry View UI
* [#2417](https://github.com/redhat-developer/vscode-openshift-tools/issues/2417) Implement UI changes in the Registry Webview
* [#2416](https://github.com/redhat-developer/vscode-openshift-tools/issues/2416) Add button for `Create Component from Workspace` in Application Explorer
* [#2415](https://github.com/redhat-developer/vscode-openshift-tools/issues/2415) Allow users to edit registries added
* [#2398](https://github.com/redhat-developer/vscode-openshift-tools/issues/2398) Update odo to v2.5.1
* [#2393](https://github.com/redhat-developer/vscode-openshift-tools/issues/2393) Using kubernetes context with user with valid certificate data does not show content of cluster in Application Explorer
* [#2437](https://github.com/redhat-developer/vscode-openshift-tools/issues/2437) Do not recognize not supported s2i components in workspace
* [#2470](https://github.com/redhat-developer/vscode-openshift-tools/issues/2470) Update OpenShift Local(CRC) to v2.5.1
* [#2459](https://github.com/redhat-developer/vscode-openshift-tools/issues/2459) Update gifs with latest workflow
* [#2446](https://github.com/redhat-developer/vscode-openshift-tools/issues/2446) `Create Component` workflow for `select context folder` step should not filter out workspace folders with s2i components

## 0.4.0 (April 18, 2022)

* [#2397](https://github.com/redhat-developer/vscode-openshift-tools/issues/2397) Fix jenkinsFile rsync issues for release
* [#2388](https://github.com/redhat-developer/vscode-openshift-tools/issues/2388) Not handled promise rejection reported in log when there is no active cluster
* [#2386](https://github.com/redhat-developer/vscode-openshift-tools/issues/2386) Sandbox error messages are not presented to the user when requesting verification code
* [#2372](https://github.com/redhat-developer/vscode-openshift-tools/issues/2372) Update crc version to support 1.40.0
* [#2369](https://github.com/redhat-developer/vscode-openshift-tools/issues/2369) `Open in Browser` command for Registry node in `Component Types View`
* [#2367](https://github.com/redhat-developer/vscode-openshift-tools/issues/2367) Login to sandbox error can be improved
* [#2324](https://github.com/redhat-developer/vscode-openshift-tools/issues/2324) Non odo components are not visible
* [#2307](https://github.com/redhat-developer/vscode-openshift-tools/issues/2307) Update ComponentKind concept to support Deployment Configs and Deployment resources reported as otherComponents by odo
* [#2299](https://github.com/redhat-developer/vscode-openshift-tools/issues/2299) Switch to main branch and make it as default
* [#2157](https://github.com/redhat-developer/vscode-openshift-tools/issues/2157) Show error message when 'odo watch' execution fails and give access to command's output
* [#1979](https://github.com/redhat-developer/vscode-openshift-tools/issues/1979) Show 'Create project' node item under cluster without projects
* [#1174](https://github.com/redhat-developer/vscode-openshift-tools/issues/1174) Add contextValue to every URL node in the tree view

## 0.3.0 (February 28, 2022)

* [#2361](https://github.com/redhat-developer/vscode-openshift-tools/issues/2361) SandBox code verification page shows all button on the same line for wide screens
* [#2359](https://github.com/redhat-developer/vscode-openshift-tools/issues/2359) OpenShift Sandbox Cluster has no active project after login
* [#2350](https://github.com/redhat-developer/vscode-openshift-tools/issues/2350) Sandbox view is broken after second click on `Add Cluster` Button
* [#2344](https://github.com/redhat-developer/vscode-openshift-tools/issues/2344) Error message appears for odo verbosity level values > 0
* [#2340](https://github.com/redhat-developer/vscode-openshift-tools/issues/2340) Can't create service on Red Hat Developer Sandbox
* [#2339](https://github.com/redhat-developer/vscode-openshift-tools/issues/2339) Implement 'Delete' command for component without context using `oc delete`
* [#2335](https://github.com/redhat-developer/vscode-openshift-tools/issues/2335) Add Timeout setting for Sandbox integration
* [#2331](https://github.com/redhat-developer/vscode-openshift-tools/issues/2331) Report telemetry for sandbox integration
* [#2329](https://github.com/redhat-developer/vscode-openshift-tools/issues/2329) 'odo storage list' item with the same name should be shown as one
* [#2325](https://github.com/redhat-developer/vscode-openshift-tools/issues/2325) Update odo to v2.5.0
* [#2304](https://github.com/redhat-developer/vscode-openshift-tools/issues/2304) Update odo to v2.4.2 release
* [#2297](https://github.com/redhat-developer/vscode-openshift-tools/issues/2297) Provide cache for https requests of swagger definition
* [#2293](https://github.com/redhat-developer/vscode-openshift-tools/issues/2293) Create Service command fails for CSV w/o olm-examples
* [#2287](https://github.com/redhat-developer/vscode-openshift-tools/issues/2287) Remove s2i components form Component Types View
* [#2285](https://github.com/redhat-developer/vscode-openshift-tools/issues/2285) Migrate to odo v2.4.1
* [#2254](https://github.com/redhat-developer/vscode-openshift-tools/issues/2254) Add Create Service Form support for user without access to service CRDs
* [#2246](https://github.com/redhat-developer/vscode-openshift-tools/issues/2246) Provide warning/info about kubeadmin user for service workflow
* [#2238](https://github.com/redhat-developer/vscode-openshift-tools/issues/2238) Remove info about Git Repository and Binary File component creation in readme
* [#2228](https://github.com/redhat-developer/vscode-openshift-tools/issues/2228) Are Git Repository and Binary File options removed when creating a component from Openshift Connector extension?
* [#2208](https://github.com/redhat-developer/vscode-openshift-tools/issues/2208) Remove service catalog support related commands
* [#2007](https://github.com/redhat-developer/vscode-openshift-tools/issues/2007) 'Open in Readme.md in Browser' for S2I Component Type
* [#1967](https://github.com/redhat-developer/vscode-openshift-tools/issues/1967) Add quickpick item 'Login using cluster URL and token from clipboard' to login command
* [#1788](https://github.com/redhat-developer/vscode-openshift-tools/issues/1788) Linking components & services for devfile
* [#1787](https://github.com/redhat-developer/vscode-openshift-tools/issues/1787) Support to create operator backed services

## 0.2.13 (January 11, 2022)

* [#2319](https://github.com/redhat-developer/vscode-openshift-tools/issues/2319) Fix full path with spaces when running CRC

## 0.2.12 (December 14, 2021)

* [#2316](https://github.com/redhat-developer/vscode-openshift-tools/issues/2316) ComponentAdapter kind field conflicts with VSCode 1.63.0 proposed API

## 0.2.11 (November 1, 2021)

* [#2269](https://github.com/redhat-developer/vscode-openshift-tools/issues/2269) Fix oc version name
* [#2267](https://github.com/redhat-developer/vscode-openshift-tools/issues/2267) Fix Readme for correct download links and names
* [#2261](https://github.com/redhat-developer/vscode-openshift-tools/issues/2261) Add debug configuration for django apps
* [#2256](https://github.com/redhat-developer/vscode-openshift-tools/issues/2256) Update oc binary to 4.9 release
* [#2255](https://github.com/redhat-developer/vscode-openshift-tools/issues/2255) Windows file paths that contain a space are not properly escaped
* [#2229](https://github.com/redhat-developer/vscode-openshift-tools/issues/2229) Component `Debug` command on Windows never results in starting debug session
* [#2120](https://github.com/redhat-developer/vscode-openshift-tools/issues/2120) Support CodeReady Containers 1.34.0 release

## 0.2.10 (October 18, 2021)

* [#2249](https://github.com/redhat-developer/vscode-openshift-tools/issues/2249) Update oc to latest release v4.8.15
* [#2248](https://github.com/redhat-developer/vscode-openshift-tools/issues/2248) `tools` directory size: only download/bundle right OS?
* [#2241](https://github.com/redhat-developer/vscode-openshift-tools/issues/2241) Welcome View for Application Explorer should not be available before extension is activated
* [#2237](https://github.com/redhat-developer/vscode-openshift-tools/issues/2237) Migrate to odo 2.3.1
* [#2235](https://github.com/redhat-developer/vscode-openshift-tools/issues/2235) Support Platform Specific vsix files
* [#2233](https://github.com/redhat-developer/vscode-openshift-tools/issues/2233) Debug command for NodeJS components is broken after VSCode update to v1.60.0
* [#2225](https://github.com/redhat-developer/vscode-openshift-tools/issues/2225) Push command should use current editor to detect component's context path
* [#2221](https://github.com/redhat-developer/vscode-openshift-tools/issues/2221) Add 'Operators' group node to k8s Clusters view
* [#2219](https://github.com/redhat-developer/vscode-openshift-tools/issues/2219) Create/Refresh Cluster button opens a page on browser
* [#2211](https://github.com/redhat-developer/vscode-openshift-tools/issues/2211) Update odo to v2.3.0
* [#2176](https://github.com/redhat-developer/vscode-openshift-tools/issues/2176) Components created out of s2i image builder have wrong component type
* [#2013](https://github.com/redhat-developer/vscode-openshift-tools/issues/2013) Import fails for devfile components

## 0.2.9 (July 29, 2021)

### New Features

* [#2005](https://github.com/redhat-developer/vscode-openshift-tools/issues/2005) Add/Remove/Update Registry commands for Component Types View and Command Palette

### Bug fixes

* [#2213](https://github.com/redhat-developer/vscode-openshift-tools/issues/2213) DevSandbox page fails
* [#2177](https://github.com/redhat-developer/vscode-openshift-tools/issues/2177) Objects deleted from App Explorer tree have not deleted from parent->children cache
* [#2167](https://github.com/redhat-developer/vscode-openshift-tools/issues/2167) Option to prevent removing project folder from workspace when deleting component

## 0.2.8 (July 13, 2021)

* [#2202](https://github.com/redhat-developer/vscode-openshift-tools/issues/2202) Sort components/services alphabetically under application node
* [#2197](https://github.com/redhat-developer/vscode-openshift-tools/issues/2197) Warning about 'redhat.telemetry.enabled' property with vscode 1.58.0 release
* [#2195](https://github.com/redhat-developer/vscode-openshift-tools/issues/2195) Add 'New Component' button to Components View title
* [#2193](https://github.com/redhat-developer/vscode-openshift-tools/issues/2193) Components View has no icons for components in workspace
* [#2191](https://github.com/redhat-developer/vscode-openshift-tools/issues/2191) Cannot delete component with odo v2.2.2
* [#2190](https://github.com/redhat-developer/vscode-openshift-tools/issues/2190) Migrate to odo v2.2.3
* [#2188](https://github.com/redhat-developer/vscode-openshift-tools/issues/2188) Report cancellation step name or number in telemetry event where is applicable
* [#2186](https://github.com/redhat-developer/vscode-openshift-tools/issues/2186) Update odo to v2.2.2
* [#2184](https://github.com/redhat-developer/vscode-openshift-tools/issues/2184) Extension fails to load if limit of FSWatchers is reached
* [#2181](https://github.com/redhat-developer/vscode-openshift-tools/issues/2181) Use context folder base name as default value for component's name input
* [#2168](https://github.com/redhat-developer/vscode-openshift-tools/issues/2168) crc message about new version availability force 'Add OpenShift Cluster' editor into error state
* [#2166](https://github.com/redhat-developer/vscode-openshift-tools/issues/2166) Remove vscode-common from extension dependencies
* [#2022](https://github.com/redhat-developer/vscode-openshift-tools/issues/2022) Do not delete context folders from workspace when deleting application
* [#1962](https://github.com/redhat-developer/vscode-openshift-tools/issues/1962) Add telemetry events for 'Add OpenShift Cluster' editor commands

## 0.2.7 (Jun 3, 2021)

* [#2154](https://github.com/redhat-developer/vscode-openshift-tools/issues/2154) Migrate to odo 2.2.1
* [#2153](https://github.com/redhat-developer/vscode-openshift-tools/issues/2153) Sort s2i and devfile component in Quickpick view for ComponentTypes
* [#2149](https://github.com/redhat-developer/vscode-openshift-tools/issues/2149) Add telemetry information for OpenShift cluster version
* [#2148](https://github.com/redhat-developer/vscode-openshift-tools/issues/2148) Show build log for 'OpenShift: Push' command
* [#2146](https://github.com/redhat-developer/vscode-openshift-tools/issues/2146) Creating new s2i component without version added as devfile kind
* [#2141](https://github.com/redhat-developer/vscode-openshift-tools/issues/2141) Multiple registries support: Use --registry option when creating component
* [#2137](https://github.com/redhat-developer/vscode-openshift-tools/issues/2137) `OpenShift: Watch` command fails to start
* [#2107](https://github.com/redhat-developer/vscode-openshift-tools/issues/2107) Test and fix `Deploy to OpenShift` command for Quarkus project

## 0.2.6 (May 10, 2021)

* [#2121](https://github.com/redhat-developer/vscode-openshift-tools/issues/2121) Open Welcome page in the active view column
* [#2130](https://github.com/redhat-developer/vscode-openshift-tools/pull/2130) Fix typo in Welcome page
* [#2131](https://github.com/redhat-developer/vscode-openshift-tools/pull/2131) Disable odo telemetry for commands executed from the extension

## 0.2.5 (May 7, 2021)

* [#2119](https://github.com/redhat-developer/vscode-openshift-tools/issues/2119) svg icons stopped working after vscode update to VSCode v1.56.0
* [#2117](https://github.com/redhat-developer/vscode-openshift-tools/issues/2117) `New Component` command does not support multiple registries
* [#2115](https://github.com/redhat-developer/vscode-openshift-tools/issues/2115) `New Component` command stopped asking to use starter project after migration to odo v2.1.0
* [#2110](https://github.com/redhat-developer/vscode-openshift-tools/issues/2110) OpenShift: welcome command does not activate the extension
* [#2105](https://github.com/redhat-developer/vscode-openshift-tools/issues/2105) Migrate Components View to odo v2.1.0
* [#2100](https://github.com/redhat-developer/vscode-openshift-tools/issues/2100) Update odo to v2.1.0
* [#2097](https://github.com/redhat-developer/vscode-openshift-tools/issues/2097) README.md should include itemized dependencies
* [#2093](https://github.com/redhat-developer/vscode-openshift-tools/issues/2093) `OpenShift: Welcome` command to open Welcome page
* [#2085](https://github.com/redhat-developer/vscode-openshift-tools/issues/2085) Nodejs devfile reports invalid arguments
* [#2074](https://github.com/redhat-developer/vscode-openshift-tools/issues/2074) `Cannot read property 'tags' of null` error in `openshift.component.createFromLocal` command
* [#2073](https://github.com/redhat-developer/vscode-openshift-tools/issues/2073) 'Add Cluster Editor' show cluster in 'Starting' state after successful start
* [#2062](https://github.com/redhat-developer/vscode-openshift-tools/issues/2062) `OpenShift: Push Component` command shows only 'not pushed' components
* [#2061](https://github.com/redhat-developer/vscode-openshift-tools/issues/2061) VSCode Commands called from navigation/inline group or with welcome page button don't report exceptions
* [#2044](https://github.com/redhat-developer/vscode-openshift-tools/issues/2044) Component Types view is empty when no kube config exists
* [#2036](https://github.com/redhat-developer/vscode-openshift-tools/issues/2036) Validation for component name should work even if `odo list` fails
* [#2034](https://github.com/redhat-developer/vscode-openshift-tools/issues/2034) Support single root workspace
* [#2027](https://github.com/redhat-developer/vscode-openshift-tools/issues/2027) New Component command called form App Explorer should create Local Component
* [#2011](https://github.com/redhat-developer/vscode-openshift-tools/issues/2011) Add `Reveal in Explorer` command for components in Application Explorer view
* [#1980](https://github.com/redhat-developer/vscode-openshift-tools/issues/1980) Ameliorate getting started experience
* [#1844](https://github.com/redhat-developer/vscode-openshift-tools/issues/1844) Commands called from palette fail when user is not logged into the cluster
* [#1219](https://github.com/redhat-developer/vscode-openshift-tools/issues/1219) Show Welcome page when the extension loads

## 0.2.4 (March 21, 2021)

* [#2046](https://github.com/redhat-developer/vscode-openshift-tools/issues/2046) Update Red Hat CodeReady Containers to 1.23.1 to use OpenShift 4.7.0
* [#2020](https://github.com/redhat-developer/vscode-openshift-tools/issues/2020) Add telemetry reporting for cluster selection in 'Add OpenShift Cluster' editor
* [#2016](https://github.com/redhat-developer/vscode-openshift-tools/issues/2016) Update odo to v2.0.7
* [#2015](https://github.com/redhat-developer/vscode-openshift-tools/issues/2015) New Component from Component Types view flow needs to be cancelled twice to close
* [#2010](https://github.com/redhat-developer/vscode-openshift-tools/issues/2010) Component Types View is not updated after cluster gets accessible and user logged in
* [#2009](https://github.com/redhat-developer/vscode-openshift-tools/issues/2009) Ask for project and application names when cluster is not accessible or user not logged in
* [#2008](https://github.com/redhat-developer/vscode-openshift-tools/issues/2008) 'Components View' to show components in current workspace
* [#2003](https://github.com/redhat-developer/vscode-openshift-tools/issues/2003) Component Types View structure and node names improvement
* [#1999](https://github.com/redhat-developer/vscode-openshift-tools/issues/1999) Add Current Cluster and Registry nodes to 'Component Types' View
* [#1997](https://github.com/redhat-developer/vscode-openshift-tools/issues/1997) Can't reuse saved kubeadmin username
* [#1995](https://github.com/redhat-developer/vscode-openshift-tools/issues/1995) Component Types view is empty if not logged in to a cluster or it is not accessible
* [#1990](https://github.com/redhat-developer/vscode-openshift-tools/issues/1990) 'LoggedIn` context set incorrectly to 'true' even if cluster is not accessible or user not logged in
* [#1988](https://github.com/redhat-developer/vscode-openshift-tools/issues/1988) Update oc CLI to latest stable 4.6 release
* [#1983](https://github.com/redhat-developer/vscode-openshift-tools/issues/1983) CRC status does not show any info like status, cache usage and etc.
* [#1978](https://github.com/redhat-developer/vscode-openshift-tools/issues/1978) Create welcome content for Application Explorer view
* [#1976](https://github.com/redhat-developer/vscode-openshift-tools/issues/1976) odo push --debug does not work for nodejs Devfile Components
* [#1974](https://github.com/redhat-developer/vscode-openshift-tools/issues/1974) Add 'Test' command to run default test for Devfile Component in OpenShift Application Explorer
* [#1972](https://github.com/redhat-developer/vscode-openshift-tools/issues/1972) Update odo to v2.0.5
* [#1970](https://github.com/redhat-developer/vscode-openshift-tools/issues/1970) TypeError: Cannot read property 'pushCmd' of undefined
* [#1931](https://github.com/redhat-developer/vscode-openshift-tools/issues/1931) Create 'Component Types' View
* [#1795](https://github.com/redhat-developer/vscode-openshift-tools/issues/1795) Already logged in message: which cluster?

## 0.2.3 (February 18, 2021)

  - [#1966](https://github.com/redhat-developer/vscode-openshift-tools/issues/1966) Print CRC commands to 'CRC Logs' channel
  - [#1959](https://github.com/redhat-developer/vscode-openshift-tools/issues/1959) Telemetry should report errors without user related info

## 0.2.2 (February 10, 2021)

New features and bugfixes:
  - [#1952](https://github.com/redhat-developer/vscode-openshift-tools/issues/1952) Fix OpenShift icon broken image
  - [#1953](https://github.com/redhat-developer/vscode-openshift-tools/issues/1953) Update to CodeReady Containers (CRC) `1.22.0` to use OpenShift `4.6.15`

## 0.2.1 (February 9, 2021)

New features and bugfixes:
  - [#1868](https://github.com/redhat-developer/vscode-openshift-tools/issues/1868) Telemetry Reporting
  - [#1855](https://github.com/redhat-developer/vscode-openshift-tools/issues/1855) Devfile Starter Projects support
  - [#1896](https://github.com/redhat-developer/vscode-openshift-tools/issues/1896) Developer Sandbox for Red Hat OpenShift
  - [#1907](https://github.com/redhat-developer/vscode-openshift-tools/issues/1907) Update to odo `2.0.4`
  - [#1912](https://github.com/redhat-developer/vscode-openshift-tools/issues/1912) Update CodeReady Containers (CRC) download link to v1.21.0

## 0.2.0 (September 30, 2020)

Noteworthy changes:
  - [#1507](https://github.com/redhat-developer/vscode-openshift-tools/issues/1507) - Support odo 2.0.0 devfile components
  - [#1771](https://github.com/redhat-developer/vscode-openshift-tools/issues/1771) - Describe command fails for components without context
  - [#1773](https://github.com/redhat-developer/vscode-openshift-tools/issues/1773) - Expanding component w/o context in Application Explorer fails to get storage list
  - [#1754](https://github.com/redhat-developer/vscode-openshift-tools/issues/1754) - Provide RedHat OpenShift logo in 'Add OpenShift Cluster' editor for dark and light color themes
  - [#1751](https://github.com/redhat-developer/vscode-openshift-tools/issues/1751) - Run CRC webview only in VSCode and not on Che/CRW instance
  - [#1740](https://github.com/redhat-developer/vscode-openshift-tools/issues/1740) - Migrate to Red Hat CodeReady Containers `0.1.16` release
  - [#1735](https://github.com/redhat-developer/vscode-openshift-tools/issues/1735) - Update Start CRC Editor to match 'Try OpenShift' page
  - [#1731](https://github.com/redhat-developer/vscode-openshift-tools/issues/1731) - Use `vscode-kubernetes-tools-api` v1.2.0
  - [#1729](https://github.com/redhat-developer/vscode-openshift-tools/issues/1729) - Components without context don't show up in application explorer
  - [#1762](https://github.com/redhat-developer/vscode-openshift-tools/issues/1762) - Publish extension to open-vsx.org registry

## 0.1.6 (August 31, 2020)

Noteworthy changes:
 - [#1235](https://github.com/redhat-developer/vscode-openshift-tools/issues/1235)
    - Add webview to run CodeReady Containers (CRC) `1.15.0` from extension. This allows to run a local instance of OpenShift `4.5.7` directly from the extension
    - Add Extension Settings for CRC binary location, pull secret, optional configurations
    - Provide CRC Start/Stop/Refresh actions in the webview
 - [#1707](https://github.com/redhat-developer/vscode-openshift-tools/issues/1707) Add Stop CRC action in Status Bar
 - [#1092](https://github.com/redhat-developer/vscode-openshift-tools/issues/1092) Deleting application only deletes components, not services
 - [#1332](https://github.com/redhat-developer/vscode-openshift-tools/issues/1332) Stop running 'odo debug' when component deleted or undeployed
 - [#1341](https://github.com/redhat-developer/vscode-openshift-tools/issues/1341) Starting debug twice on the same component should not be allowed
 - [#1559](https://github.com/redhat-developer/vscode-openshift-tools/issues/1559) Show resources only from current context in OpenShift Application Explorer view
 - [#1589](https://github.com/redhat-developer/vscode-openshift-tools/issues/1589) It is not easy to map commands to output in `OpenShift Output` channel
 - [#1596](https://github.com/redhat-developer/vscode-openshift-tools/issues/1596) 'New Service' command fails with odo v1.2.1 because of changes in json output
 - [#1608](https://github.com/redhat-developer/vscode-openshift-tools/issues/1608) Use '--client' option when detecting tool version to avoid server requests
 - [#1615](https://github.com/redhat-developer/vscode-openshift-tools/issues/1615) Show context location in tooltip for component nodes in OpenShift Application Explorer
 - [#1617](https://github.com/redhat-developer/vscode-openshift-tools/issues/1617) Create `Watch Sessions` View to provide control over running 'odo watch' commands
 - [#1619](https://github.com/redhat-developer/vscode-openshift-tools/issues/1619) Create Simple `Debug Sessions` View to show debug sessions started for components
 - [#1636](https://github.com/redhat-developer/vscode-openshift-tools/issues/1636) Add 'OpenShift: Set Active Project' command to change project visible in Application Explorer view
 - [#1647](https://github.com/redhat-developer/vscode-openshift-tools/issues/1647) Show application and component quickpick lists when command executed from palette
 - [#1653](https://github.com/redhat-developer/vscode-openshift-tools/issues/1653) OpenShift Icon missing for cluster in Kubernetes view
 - [#1697](https://github.com/redhat-developer/vscode-openshift-tools/issues/1697) 'New Component' command does not show component types for odo v1.2.5
 - [#1711](https://github.com/redhat-developer/vscode-openshift-tools/issues/1711) Update odo to v1.2.6

## 0.1.5 (May 18, 2020)

Noteworthy issues fixed in this release:
  - [#1505](https://github.com/redhat-developer/vscode-openshift-tools/issues/1505) Update odo to [v1.2.1](https://github.com/openshift/odo/releases/tag/v1.2.1)
  - [#1551](https://github.com/redhat-developer/vscode-openshift-tools/issues/1551) Command to migrate components created with v0.0.23 or earlier
  - [#1517](https://github.com/redhat-developer/vscode-openshift-tools/issues/1517) Configuration to switch between Terminal View and WebView based view to exec 'Show/Follow Log' and 'Describe' commands
  - [#1319](https://github.com/redhat-developer/vscode-openshift-tools/issues/1319) Use webview based editor to show or follow component's log
  - [#1495](https://github.com/redhat-developer/vscode-openshift-tools/issues/1495) Auto scrolling support in log viewer when following logs
  - [#1465](https://github.com/redhat-developer/vscode-openshift-tools/issues/1465) Support for creating 'https' URLs
  - [#1464](https://github.com/redhat-developer/vscode-openshift-tools/issues/1464) `Describe` command for 'not pushed' components
  - [#1463](https://github.com/redhat-developer/vscode-openshift-tools/issues/1463) `New Storage` command for 'not pushed' components
  - [#1458](https://github.com/redhat-developer/vscode-openshift-tools/issues/1458) `Describe` command for URLs
  - [#1438](https://github.com/redhat-developer/vscode-openshift-tools/issues/1438) The "Please log in to the cluster" button also should open the Login QuickPick
  - [#1404](https://github.com/redhat-developer/vscode-openshift-tools/issues/1404) Add command to open Route URL from Kubernetes Clusters View
  - [#148](https://github.com/redhat-developer/vscode-openshift-tools/issues/148) When executing command in terminal it should be named properly


## 0.1.4 (February 25, 2020)

Noteworthy changes:
  - [#1227](https://github.com/redhat-developer/vscode-openshift-tools/issues/1227) Include odo and oc binaries into extension package for all supported platforms macOS/Linux/Windows
  - [#1388](https://github.com/redhat-developer/vscode-openshift-tools/issues/1388) Update odo to latest release v1.1.0
  - [#1396](https://github.com/redhat-developer/vscode-openshift-tools/issues/1396) Allow to use compatible odo version available from PATH locations
  - [#1380](https://github.com/redhat-developer/vscode-openshift-tools/issues/1380) Absolute path should be used for commands when running in vscode terminal view


## 0.1.3 (January 16, 2020)

This release adds `OpenShift: Debug` command for Java and Node.js components. The command is available form command palette and OpenShift Application View context
menu for nodes representing Components. See issues [#1322](https://github.com/redhat-developer/vscode-openshift-tools/pull/1322) and
[#1328](https://github.com/redhat-developer/vscode-openshift-tools/pull/1328) for details

It also includes update for OpenShift Do CLI. Version 1.0.2 will be downloaded after extension is updated to this release


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

This release is built on top of 0.1.0. If any developer is migrating from `<=0.0.23` release, please follow the [Migration Guide](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0)

## Updates
* Extension uses [OpenShift Do(odo) 1.0.0 GA](https://github.com/openshift/odo/releases/tag/v1.0.0)
* Support [Red Hat CodeReady Containers 1.0](https://access.redhat.com/documentation/en-us/red_hat_codeready_containers/1.0/html/getting_started_guide/index) for OpenShift 4.x clusters
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

* Components created with previous version will no longer be identified. Therefore after extension is updated to new version(`0.1.0`) all previously deployed components won't be visible in OpenShift Application View
* For older versions, here is the [Migration Guide](https://github.com/redhat-developer/vscode-openshift-tools/wiki/Migration-to-v0.1.0)

### Added
* Every component/service needs to have a context folder. The extension will prompt the user to specify the context folder with the creation of component/service
* The selected context folder will reside in the vscode workspace.
* `Create Component` creates a local component configuration within `./.odo/config.yaml` in the context folder selected, nothing is created on the cluster at this point
* All component configurations are saved to ./.odo/config.yaml. You can commit this file to your repository to easily recreate component with the same configuration later, or to share it with someone else
* To deploy the component to a cluster or to apply config changes, run `PUSH` command for the component
    * `PUSH` will create component/urls/storage on the OpenShift cluster and push your local files to it
* `Import` actions for components which were created using old versions of the extension
* Support for OpenShift 4.x clusters
* Update Actions to Navigation Item
    * Add Switch Contexts - This will help users to switch contexts from kubeconfig
    * Add Issue tracker - Users can directly file extension issues/feedback
* Added Multiple Actions to Kubernetes resources in Kubernetes View
    * For Build Configs - Start Build, Rebuild, Show Logs, Follow Logs
    * For Deployment Configs - Deploy, Show Logs
    * Add `Open in Console` for k8s resources in Kubernetes View

### Changes
* The openshift labels used internally by odo to identify its components, have been updated to match https://github.com/gorkem/app-labels/blob/master/labels-annotation-for-openshift.adoc
* Components can be in 3 stages:
    * pushed - When the components are deployed into the cluster
    * not pushed - When are the components are in local config but NOT deployed into the cluster
    * no context - When there is no context folder associated with the component in the workspace
* Extension uses [odo-v1.0.0-beta5](https://github.com/openshift/odo/releases/tag/v1.0.0-beta5)
* Remove Clusters view from OpenShift Views Container. Users can perform all the required action from Kubernetes extension Clusters view

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
* [#1046](https://github.com/redhat-developer/vscode-openshift-tools/pull/1046) Use users home folder as current directory when deleting service
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
* Add fix to stop downloading odo/oc when cluster is down [#406](https://github.com/redhat-developer/vscode-openshift-tools/pull/406)
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
