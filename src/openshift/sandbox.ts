/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';

 export interface SBStatus {
     ready: boolean;
     reason: 'Provisioned' | 'PendingApproval';
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

export function getSandboxAPIUrl(): string {
    return workspace.getConfiguration('openshiftConnector').get('sandboxAPIHostUrl');
}



export interface SandboxAPI {
    signup(): SBSignupResponse;
    requestVerificationCode(areaCode: string, phoneNumber: string);
    validateVerificationCode(code: string);
}

