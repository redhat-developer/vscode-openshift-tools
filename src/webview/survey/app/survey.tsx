/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import 'survey-core/defaultV2.css';
import { DefaultProps } from '../../common/propertyTypes';
import { json } from '../json';
import { VSCodeMessage } from './vsCodeMessage';

export const SurveyComponent: React.FC<DefaultProps> = ({ }) => {

    const survey = new Model(json);
    survey.onComplete.add((sender, options) => {
        options.showSaveInProgress();
        VSCodeMessage.postMessage({
            action: 'postSurvey',
            data: sender.data
        });
        options.showSaveSuccess();
    });
    return (
        <Survey model={survey} />
    );
}
