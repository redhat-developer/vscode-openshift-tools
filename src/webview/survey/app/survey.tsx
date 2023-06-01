/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { Icon, Stack, Typography } from '@mui/material';
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { DefaultProps } from '../../common/propertyTypes';
import { json } from '../json';
import { VSCodeMessage } from './vsCodeMessage';
import GitHubIcon from '@mui/icons-material/GitHub';
import 'survey-core/defaultV2.css';
import './survey.css'

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
        <div className='parentContainer'>
            <div className='headerContainer'>
                <header className='header__logo' style={{ width: '50%' }}>
                    <img className='image__logo' src={require('../../../../images/title/logo.svg').default} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ display: 'flex', flexDirection: 'row', textAlign: 'center' }}>
                            <Typography variant='h4' className='highlight'>OpenShift</Typography>
                            <Typography variant='h4' style={{ paddingLeft: '1rem' }} className='foreGroundColor'>Toolkit</Typography>
                        </label>
                        <Typography variant='caption' style={{ marginTop: '2px' }} className='foreGroundColor'>Your opinion matters to us!</Typography>
                    </div>
                </header>
                <div style={{ width: '50%' }}>
                    <label style={{ display: 'flex', flexDirection: 'row', gap: '1rem', textAlign: 'center', float: 'right', margin: '1rem' }}>
                        <a href='https://github.com/redhat-developer/vscode-openshift-tools'>
                            <div className='section__header-hint section__footer'>
                                <Stack direction='row' alignItems='center' gap={1}>
                                    <GitHubIcon style={{ fontSize: 25 }} />
                                    <Typography variant='body2' className='footerText'>Contact us on GitHub</Typography>
                                </Stack>
                            </div>
                        </a>
                        <a href='https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector&ssr=false#review-details' style={{ marginTop: '2px' }}>
                            <div className='section__header-hint section__footer'>
                                <Stack direction='row' alignItems='center' gap={1}>
                                    <Icon fontSize='small'>
                                        <img src={require('../../../../images/welcome/microsoft.svg').default} />
                                    </Icon>
                                    <Typography variant='body2' className='footerText'>Rate us on Marketplace</Typography>
                                </Stack>
                            </div>
                        </a>
                    </label>
                </div>
            </div>
            <Survey model={survey} />
        </div>
    );
}
