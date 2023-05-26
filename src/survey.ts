/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { vsCommand } from './vscommand';
import SurveyLoader from './webview/survey/surveyLoader';

export class Survey {

    @vsCommand('openshift.show.survey')
    static async openSurvey(): Promise<void> {
        await SurveyLoader.loadView('Survey');
    }

}
