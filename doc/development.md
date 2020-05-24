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

## Running tests on Windows fails with error `Uncaught TypeError: Cannot read property 'phase' of null`

This is most likely related to run extension tests after installing extension from .vsix file.
On Windows the fix is to clean up `%USER_PROFILE%\AppData\Roaming\Code\CachedData` folder.

## Local cluster started with minishift v1.29.0+ has no access to images from registry.redhat.io

Before applying `xpaas` add-on run apply `redhat-registry-login` with this command

`minishift addon apply redhat-registry-login --addon-env REGISTRY_USERNAME=username --addon-env REGISTRY_PASSWORD=password`

where `username` and `password` are your credentials to access registry.redhat.io.
Then apply `xpaas` with the command below

`minishift addon apply xpaas`

# Running local OpenShift Cluster

## Code Ready Containers

TBD

## minishift

TBD


