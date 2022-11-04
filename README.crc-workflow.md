### Running OpenShift Locally

The extension provides a view to run local instance of OpenShift from IDE. To open the view use `Add OpenShift Cluster` button
![ addclusterbutton ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/add-cluster-button.gif)
from `OpenShift: Application Explorer` view title.

![ addcluster ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/add-cluster.gif)

The view provides a guided workflow to create and start OpenShift 4 single node cluster on your workstation
using OpenShift Local (formerly Red Hat CodeReady Containers):

   * Download & Install OpenShift Local
   * Set Virtual Machine parameters: number of CPUs and memory limit
   * Setup OpenShift Local
   * Run OpenShift Local commands to setup/start the cluster

The view provides following options to control cluster's state:

   * Start cluster
   * Stop cluster
   * Open OpenShift Developer Console for cluster
   * Refresh cluster's state

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-openshift-tools/main/images/gif/crc-webview.gif)