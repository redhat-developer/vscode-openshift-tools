/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

declare module '*.scss';
declare module '*.css';
declare module '*.png';
declare module '*.svg';
declare module '*.jpg';

type VscodeAPI = any;

interface Window {
    vscodeApi: any;
}
