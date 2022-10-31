/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { workspace } from 'vscode';
import fetch = require('make-fetch-happen');

// eslint-disable-next-line no-shadow
export enum SBAPIEndpoint {
  SIGNUP = '/api/v1/signup',
  VERIFICATION = '/api/v1/signup/verification'
}

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
  consoleURL: string;
  familyName: string;
  givenName: string;
  status: SBStatus;
  username: string;
}

export interface SBResponseData {
  status: string;
  code: number;
  message: string;
  details: string;
}

export interface VerificationCodeResponse{
  ok: boolean;
  json: SBResponseData;
}

export const OAUTH_SERVER_INFO_PATH = '.well-known/oauth-authorization-server';

export interface OauthServerInfo {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    scopes_supported: string[];
    response_types_supported: string[];
    grant_types_supported: string[];
    code_challenge_methods_supported: string[];
  }

export function getSandboxAPIUrl(): string {
    return workspace.getConfiguration('openshiftToolkit').get('sandboxApiHostUrl');
}

export function getSandboxAPITimeout(): number {
    return workspace.getConfiguration('openshiftToolkit').get('sandboxApiTimeout');
}

export interface SandboxAPI {
    getSignUpStatus(token: string): Promise<SBSignupResponse | undefined>;
    signUp(token: string): Promise<boolean>;
    requestVerificationCode(token: string, areaCode: string, phoneNumber: string): Promise<VerificationCodeResponse>;
    validateVerificationCode(token: string, code: string): Promise<boolean>;
    getOauthServerInfo(apiEndpointUrl: string): Promise<OauthServerInfo>;
}

export async function getSignUpStatus(token: string): Promise<SBSignupResponse | undefined> {
    const signupResponse = await fetch(`${getSandboxAPIUrl()}${SBAPIEndpoint.SIGNUP}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`
            },
            cache: 'no-cache',
            timeout: getSandboxAPITimeout()
        });
    return signupResponse.ok ? signupResponse.json() as Promise<SBSignupResponse> : undefined;
}

export async function signUp(token: string): Promise<boolean> {
    const signupResponse = await fetch(`${getSandboxAPIUrl()}${SBAPIEndpoint.SIGNUP}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`
            },
            timeout: getSandboxAPITimeout()
        });
    return signupResponse.ok;
}

export async function requestVerificationCode(token: string, countryCode: string, phoneNumber: string) : Promise<VerificationCodeResponse> {
    const verificationCodeRequestResponse = await fetch(`${getSandboxAPIUrl()}${SBAPIEndpoint.VERIFICATION}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`
        },
        timeout: getSandboxAPITimeout(),
        body: JSON.stringify({
            'country_code': countryCode,
            'phone_number': phoneNumber
        })
    });
    const responseText = await verificationCodeRequestResponse.text();
    return {
        ok: verificationCodeRequestResponse.ok,
        json: (responseText ? JSON.parse(responseText) : {}) as SBResponseData
    }
}

export async function validateVerificationCode(token: string, code: string): Promise<boolean> {
    const validationRequestResponse = await fetch(`${getSandboxAPIUrl()}${SBAPIEndpoint.VERIFICATION}/${code}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`
        },
        timeout: getSandboxAPITimeout()
    });

    return validationRequestResponse.ok;
}

export async function getOauthServerInfo(apiEndpointUrl: string): Promise<OauthServerInfo> {
    const oauthServerInfoResponse = await fetch(`${apiEndpointUrl}/${OAUTH_SERVER_INFO_PATH}`, {
        method: 'GET',
        timeout: getSandboxAPITimeout()
    });
    const oauthInfoText = await oauthServerInfoResponse.text();
    return (oauthInfoText ? JSON.parse(oauthInfoText) : {}) as OauthServerInfo;
}

export function createSandboxAPI(): SandboxAPI {
    return {
        getSignUpStatus,
        signUp,
        requestVerificationCode,
        validateVerificationCode,
        getOauthServerInfo
    };
}
