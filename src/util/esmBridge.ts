/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// This is just an experiment of using an ESM module from CommonJS
export class EsmBridge {
    private static INSTANCE = new EsmBridge();
    private _prettyBytes;
    private _clipboardyApi;

    private constructor() {
    }

    static get Instance() {
        return EsmBridge.INSTANCE;
    }

    public async prettyBytesApi(): Promise<any> {
      if (!this._prettyBytes) {
        this._prettyBytes = (await (async () => await import('pretty-bytes'))()).default;
      }
      return this._prettyBytes
    }

    public async clibboardyApi(): Promise<any> {
      if (!this._clipboardyApi) {
        this._clipboardyApi = (await (async () => await import('clipboardy'))()).default;
      }
      return this._clipboardyApi;
    }
}

// (async () => {
//   const esmModule = await import('pretty-bytes');
//   esmModule.default(); // or esmModule.someExportedFunction()
// })();