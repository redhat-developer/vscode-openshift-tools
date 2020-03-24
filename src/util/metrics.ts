/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/


import * as vscode from 'vscode';

import segmentanalytics = require('analytics-node');

let odoVersionString:string;
let ocVersionString:string;
let ocClientVersionString:string;
let kubeVersionString:string;

const segmentToken = "zP4QDen55HVeYDdsHNCcULqfenB2NQDL";

export class Metrics {

  public static setODOVersionString(odoversion: string) {
    odoVersionString = odoversion;
  }

  public static setOCVersionString(ocversion: string) {
    ocVersionString = ocversion;
  }

  public static setOCClientVersionString(ocClientversion: string) {
    ocClientVersionString = ocClientversion;
  }

  public static setKubeVersionString(kubeVersion: string) {
    kubeVersionString = kubeVersion;
  }

  public static getODOVersionString() : string {
    return odoVersionString;
  }

  public static getOCVersionString() : string {
    return ocVersionString;
  }

  public static getOCClientVersionString() : string {
    return ocClientVersionString;
  }

  public static getKubeVersionString(): string {
    return kubeVersionString;
  }

  static shallSendMetrics()  {
    if (vscode.workspace.getConfiguration("openshiftConnector").get("collectTelemetryData")) {
        return true;
    }
    return false;
  }

  public static publishUsageMetrics(eventMessage: string) : boolean {
    const analytics = new segmentanalytics(segmentToken, { flushAt: 1 }); // Flush events to Segment with NO buffering

      if (Metrics.shallSendMetrics()) {
           analytics.track({
            userId: 'anonymous',
            event: eventMessage,
            properties: {
              odoVersion: Metrics.getODOVersionString(),
              ocServerVersion: Metrics.getOCVersionString(),
              ocClientVersion: Metrics.getOCClientVersionString(),
              kubeVersion: Metrics.getKubeVersionString()
            }
          }, function(error, batch) {
              if (error) {
                return false;
              }
          });
        }
        return true;
  }
  }
