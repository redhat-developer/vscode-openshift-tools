# NPM scripts description

## Print TODO/FIXME tasks

To mark a development task use comment that starts with TODO or FIXME keyword.
To print out TODO/FIXME comments throughout the code run `npm run todo`. The output for this script would look like one below.

``` todo
$ npm run todo

> vscode-openshift-connector@0.1.4 todo C:\p\vscode-openshift-tools
> leasot **/*.ts --ignore node_modules -x


src/cli.ts
  line 55   TODO  Refactor to OdoCli or OpenShiftCli class

src/odo.ts
  line 12   TODO  Review classes hierarchy
  line 717  TODO  load projects form workspace folders and add missing ones to the model even they

test/coverage.ts
  line 103  TODO  consider putting this under a conditional flag
  line 122  TODO  Allow config of reporting directory with

src/openshift/component.ts
  line 183  TODO  fix eslint rule violation

 × 6 todos/fixmes found
```

# Known Problems

## Trigger github-actions build after failure related to infrastructure

If build fails because it cannot download oc and odo binaries, there is no way to trigger new
build through github.com ui. To trigger new build just use

```
git commit --allow-empty -m "restart github-actions build"
git push
```

Then after build is green squash commit while releasing your PR changes to the master branch.

## Local cluster started with minishift v1.29.0+ has no access to images from registry.redhat.io

Before applying `xpaas` add-on run apply `redhat-registry-login` with this command

`minishift addon apply redhat-registry-login --addon-env REGISTRY_USERNAME=username --addon-env REGISTRY_PASSWORD=password`

where `username` and `password` are your credentials to access registry.redhat.io.
Then apply `xpaas` with the command below

`minishift addon apply xpaas`

### Could not open '...crc/cache/crc_libvirt_4.5.14/crc.qcow2': Permission denied'

Follow [this comment](https://github.com/code-ready/crc/issues/1578#issuecomment-706323186) before starting crc again.

### Error creating VM related to 'crc' domain

Error creating machine: Error creating the VM: Error creating machine: Error in driver during machine creation: virError(Code=9, Domain=20, Message='operation failed: domain 'crc' already exists with uuid 82555a58-9fae-47f9-aad9-e78b32a02308')

To resolve the problem delete 'crc' domain using

`virsh destroy crc`

### Error when `vrish destroy crc` domain 

```virsh # destroy crc
error: Failed to destroy domain crc
error: Requested operation is not valid: domain is not running
```

use

`vrish undefine crc`

# Running local OpenShift Cluster

## CodeReady Containers

1. Download form https://mirror.openshift.com/pub/openshift-v4/clients/crc/
2. Unpack
3. 'crc setup'
4. 'crc start -p /path/to/pull-secret.txt

## minishift

1. Download
2. Setup
3. Configure password for redhat registry
4. Install xpaas add-on
5. Enable server catalog

## Debug Developer Console (DC) frontend

# Build DC following documentation
# Add frontend subfolder into vscode
# Run the 'bridge`
# Add launch configuration to .vscode/launch.json

```
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome against localhost",
      "url": "http://localhost:9000",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```
# Run debugger from command pallet

## How to update dependencies

Use `npm run update-deps` or `npm-check-updates` package

# Release steps

Follow this steps to release:
1. Update version in package.json to next one
2. Add record for new release into CHANGELOG.md
3. Commit changes [1] and [2]
4. Kick the build on jenkins with 'publishToMarketplace' set
5. Wait until build gets to the point where approval is needed to push to marketplace
6. Download just built .vsix file form nightly releases here https://download.jboss.org/jbosstools/adapters/snapshots/vscode-tekton/?C=M;O=D
7. Install it and do smoke test
8. Approve release on jenkins if everything is fine
9. Create release on github and put in description record form [2]
10. (optional) Blog about it (edited) 
