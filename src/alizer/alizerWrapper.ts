/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CommandText } from '../base/command';
import { CliChannel } from '../cli';
import { Uri } from 'vscode';
import { CliExitData } from '../util/childProcessUtil';
import { AlizerAnalyzeResponse, AlizerDevfileResponse } from './types';

/**
 * A wrapper around the `alizer` CLI tool.
 *
 * This class is a stateless singleton.
 * This makes it easier to stub its methods than if it were a bunch of directly exported functions.
 */
export class Alizer {
    private static INSTANCE = new Alizer();

    static get Instance() {
        return Alizer.INSTANCE;
    }

    public async alizerDevfile(currentFolderPath: Uri): Promise<AlizerDevfileResponse> {
        const cliData: CliExitData = await CliChannel.getInstance().executeTool(
            new CommandText('alizer', `devfile ${currentFolderPath.fsPath}`), undefined, false
        );
        if (cliData.error || cliData.stderr.length > 0) {
            return {
                Name: '',
                Language: '',
                ProjectType: '',
                Tags: [],
                Versions: []
            };
        }
        const parse = JSON.parse(cliData.stdout) as AlizerDevfileResponse[];
        return parse[0];
    }

    public async alizerAnalyze(currentFolderPath: Uri): Promise<AlizerAnalyzeResponse[]> {
        const cliData: CliExitData = await CliChannel.getInstance().executeTool(
            new CommandText('alizer', `analyze ${currentFolderPath.fsPath}`), undefined, false
        );
        if (cliData.error || cliData.stderr.length > 0) {
            return undefined;
        }
        const parse = JSON.parse(cliData.stdout) as AlizerAnalyzeResponse[];
        return parse;
    }
}
