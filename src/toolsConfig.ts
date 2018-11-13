/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export const toolsConfig = {
    odo: {
        description: "OpenShift Do CLI tool",
        vendor: "Red Hat, Inc.",
        name: "odo",
        version: "0.0.15",
        dlFileName: "odo",
        cmdFileName: "odo",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.15/odo-windows-amd64.exe.gz",
                sha256sum: "66b5b05e7257611209f875782c83883b8a979770cd5e336338b397d70d631348",
                dlFileName: "odo-windows-amd64.exe.gz",
                cmdFileName: "odo.exe"
            },
            darwin: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.15/odo-darwin-amd64.gz",
                sha256sum: "fc705718ce34867f850d7f6ac639b58d207ac1a9801cfed93e760628bf0623c9",
                dlFileName: "odo-darwin-amd64.gz"
            },
            linux: {
                url: "https://github.com/redhat-developer/odo/releases/download/v0.0.15/odo-linux-amd64.gz",
                sha256sum: "ee74b8a301245b98fce94954739df10cf0fbf1220a1167d2614205393d63c01b",
                dlFileName: "odo-linux-amd64.gz"
            }
        }
    },
    oc: {
        description: "OKD CLI client tool",
        vendor: "Red Hat, Inc.",
        name: "oc",
        cmdFileName: "oc",
        version: "3.9.0",
        filePrefix: "",
        platform: {
            win32: {
                url: "https://github.com/openshift/origin/releases/download/v3.9.0/openshift-origin-client-tools-v3.9.0-191fece-windows.zip",
                sha256sum: "705eb110587fdbd244fbb0f93146a643b24295cfe2410ff9fe67a0e880912663",
                dlFileName: "oc.zip",
                cmdFileName: "oc.exe"
            },
            darwin: {
                url: "https://github.com/openshift/origin/releases/download/v3.9.0/openshift-origin-client-tools-v3.9.0-191fece-mac.zip",
                sha256sum: "32bdd9464866c8e93d8cf4a3a7718b0bc9fa0f2881f045b97997fa014b52a40b",
                dlFileName: "oc.zip",
            },
            linux: {
                url: "https://github.com/openshift/origin/releases/download/v3.9.0/openshift-origin-client-tools-v3.9.0-191fece-linux-64bit.tar.gz",
                sha256sum: "6ed2fb1579b14b4557e4450a807c97cd1b68a6c727cd1e12deedc5512907222e",
                fileName: "oc.tar.gz",
                dlFileName: "oc.tar.gz",
                filePrefix: "openshift-origin-client-tools-v3.9.0-191fece-linux-64bit"
            }
        }
    }
};