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

# Running local OpenShift Cluster

## CodeReady Containers

TBD

## minishift

TBD


