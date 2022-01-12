/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

 export interface SBStatus {
     ready: boolean;
     reason: 'Provisioned' | '';
     verificationRequired: boolean;
 }

 export interface SBSignupResponse {
    apiEndpoint: string;
    cheDashboardURL: string;
    clusterName: string;
    company: string;
    compliantUsername: string;
    consoleUrl: string;
    familyName: string;
    givenName: string;
    status: SBStatus;
    username: string;
 }