/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Button, Card, InputLabel, Modal, TextField, ThemeProvider, Typography } from '@mui/material';
import React from 'react';
import clsx from 'clsx';
import { CardTheme } from '../../common/cardItem.style';
import '../../common/common.scss';
import { LoadScreen } from '../../common/loading';
import { Chart } from '../helmChartType';
import { VSCodeMessage } from '../vsCodeMessage';
import { DevFileProps } from './wrapperCardItem';

export class CardItem extends React.Component<DevFileProps, {
    displayName: string,
    versions: Chart[],
    selectedVersion: Chart,
    installName: string,
    installResponse: {
        loadScreen: boolean,
        error: boolean,
        errorMsg: string,
    }
}> {

    constructor(props: DevFileProps) {
        super(props);
        this.props.helmEntry.isExpand = false;
        this.state = {
            displayName: this.props.helmEntry.displayName,
            versions: this.props.helmEntry.chartVersions.reverse(),
            selectedVersion: this.props.helmEntry.chartVersions[this.props.helmEntry.chartVersions.length - 1],
            installName: '',
            installResponse: {
                loadScreen: false,
                error: undefined,
                errorMsg: ''
            }
        }
    }

    onCardClick = (): void => {
        this.props.helmEntry.isExpand = true;
        this.setState({
            selectedVersion: this.state.versions[0],
            installName: '',
            installResponse: {
                loadScreen: false,
                error: undefined,
                errorMsg: ''
            }
        });
    }

    onCloseClick = (event: any, reason: string): void => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            this.props.helmEntry.isExpand = false;
            this.setState({
                selectedVersion: this.state.versions[0],
                installName: '',
                installResponse: {
                    loadScreen: false,
                    error: undefined,
                    errorMsg: ''
                }
            });
        }
    };

    clickInstall = (): void => {
        const regx = new RegExp('^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$');
        if (!regx.test(this.state.installName)) {
            this.setState({
                installResponse: {
                    loadScreen: false,
                    error: true,
                    errorMsg: 'Chart name not matches \n^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$'
                }
            });
        } else {
            VSCodeMessage.postMessage(
                {
                    'action': 'install',
                    'name': this.state.installName,
                    'chartName': this.props.helmEntry.chartName,
                    'version': this.state.selectedVersion.version
                });
        }
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'loadScreen') {
                this.setState({
                    installResponse: {
                        loadScreen: message.data.show,
                        error: message.data.isError,
                        errorMsg: message.data.error || ''
                    }
                });
                if (message.data.isError === false) {
                    this.onCloseClick(undefined, 'backdropClick');
                } else if (message.data.isError) {
                    this.props.helmEntry.isExpand = message.data.chartName === this.state.selectedVersion.name ? true : false;
                }
            }
        });

    }

    textFieldChange = (value: string): void => {
        this.setState({
            installName: value,
            installResponse: {
                loadScreen: false,
                error: undefined,
                errorMsg: ''
            }
        })
    }

    setSelectedVersion = (version: any): void => {
        this.setState({
            selectedVersion: version
        });
    };

    handleDisable = (): boolean => {
        return this.state.installResponse.error || this.state.installName.trim().length === 0;
    }

    render(): React.ReactNode {
        const { selectedVersion, installName: installChartName, installResponse } = this.state;
        const versionCard =
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className={this.props.cardItemStyle.starterProjectCardBody}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', height: '2rem' }}>
                            <InputLabel required htmlFor='bootstrap-input'
                                style={{
                                    color: '#EE0000',
                                    paddingTop: '0.5rem',
                                    marginLeft: '1rem'
                                }}>
                                Chart Name:
                            </InputLabel>
                            <div>
                                <TextField
                                    helperText={installResponse.errorMsg}
                                    autoFocus
                                    focused
                                    inputProps={{
                                        style: {
                                            textAlign: 'left'
                                        }
                                    }}
                                    error={installResponse.error}
                                    id='bootstrap-input'
                                    value={installChartName}
                                    sx={{
                                        input: {
                                            color: 'var(--vscode-settings-textInputForeground)',
                                            backgroundColor: 'var(--vscode-settings-textInputBackground)',
                                            width: '10rem'
                                        }
                                    }} onChange={(e) => this.textFieldChange(e.target.value)}>
                                </TextField>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', width: '10rem' }}>
                        <InputLabel
                            style={{
                                color: '#EE0000',
                                paddingTop: '0.5rem',
                                marginLeft: '1rem'
                            }}>
                            Version:
                        </InputLabel>
                        <div
                            data-testid='projects-selector'
                            className={this.props.cardItemStyle.starterProjectSelect}
                        >
                            {this.state.versions.map((chart: Chart) => (
                                <div
                                    key={chart.version}
                                    data-testid={`projects-selector-item-${chart.version}`}
                                    onMouseDown={(): void => this.setSelectedVersion(chart)}
                                    className={
                                        selectedVersion.version === chart.version ? this.props.cardItemStyle.starterProjectSelected : this.props.cardItemStyle.project
                                    }
                                >
                                    {chart.version}
                                </div>
                            ))}
                        </div>
                    </div>
                    <Button
                        disabled={this.handleDisable()}
                        variant='contained'
                        className={this.props.cardItemStyle.button}
                        onClick={this.clickInstall}
                        style={{ marginLeft: '1rem' }}>
                        <Typography variant='body2'>
                            Install
                        </Typography>
                    </Button>
                </div>
                {
                    installResponse.loadScreen ?
                        <LoadScreen title='Installing the Chart' /> : undefined
                }
            </div>;

        const modalViewCard = <Modal
            open={this.props.helmEntry.isExpand}
            className={this.props.cardItemStyle.modal}
            aria-labelledby={`modal-${selectedVersion.name}`}
            onClose={this.onCloseClick}
            closeAfterTransition
            slotProps={{
                backdrop: {
                    timeout: 500
                }
            }}
            style={{
                width: '100%', height: '100%', marginTop: '5rem', border: '0px'
            }}>
            <Card data-testid='dev-page-yaml' className={this.props.cardItemStyle.helmCard}
                id={`modal-${selectedVersion.name}`}>
                <div className={this.props.cardItemStyle.helmCardHeader}>
                    <div className={this.props.cardItemStyle.devPageCardHeader}>
                        <div className={this.props.cardItemStyle.devPageTitle}>
                            <img
                                data-testid='icon'
                                src={this.state.selectedVersion.icon ? this.state.selectedVersion.icon : require('../../../../images/helm/helm.svg').default}
                                alt={this.state.selectedVersion.icon + ' logo'}
                                className={this.props.cardItemStyle.cardImage}
                                style={{ margin: '0rem' }} />
                            <div style={{ padding: '1rem', margin: '0rem' }}>
                                <Typography variant='subtitle1'>
                                    {
                                        capitalizeFirstLetter(this.props.helmEntry.displayName)
                                    }
                                </Typography>
                            </div>
                        </div>
                    </div>
                    {
                        versionCard
                    }
                </div>
                <div className={this.props.cardItemStyle.helmCardBody}>
                    <div className={this.props.cardItemStyle.helmCardDetails}>
                        <Typography variant='body2'>
                            Latest Chart Version:
                        </Typography>
                        <Typography variant='caption'>
                            {selectedVersion.version}
                        </Typography>
                    </div>
                    <div className={this.props.cardItemStyle.helmCardDetails}>
                        <Typography variant='body2'>
                            Description:
                        </Typography>
                        <Typography variant='caption' className={this.props.cardItemStyle.detailedDescription}>
                            {selectedVersion.description ? selectedVersion.description : 'N/A'}
                        </Typography>
                    </div>
                    <div className={this.props.cardItemStyle.helmCardDetails}>
                        <Typography variant='body2'>
                            Product Version:
                        </Typography>
                        <Typography variant='caption'>
                            {selectedVersion.appVersion}
                        </Typography>
                    </div>
                    <div className={this.props.cardItemStyle.helmCardDetails}>
                        <Typography variant='body2'>
                            Provider:
                        </Typography>
                        <Typography variant='caption'>
                            {selectedVersion.annotations['charts.openshift.io/providerType']}
                        </Typography>
                    </div>
                    <div className={this.props.cardItemStyle.helmCardDetails}>
                        <Typography variant='body2'>
                            Home Page:
                        </Typography>
                        <Typography variant='caption'>
                            {
                                selectedVersion.annotations['charts.openshift.io/supportURL'] ?
                                    <a href={selectedVersion.annotations['charts.openshift.io/supportURL']}>{selectedVersion.annotations['charts.openshift.io/supportURL']}</a> :
                                    'N/A'
                            }
                        </Typography>
                    </div>
                    <div className={this.props.cardItemStyle.helmCardDetails}>
                        <Typography variant='body2'>
                            Repository:
                        </Typography>
                        <Typography variant='caption'>
                            OpenShift Helm Charts
                        </Typography>
                    </div>
                    <div className={this.props.cardItemStyle.helmCardDetails}>
                        <Typography variant='body2'>
                            Maintainers:
                        </Typography>
                        <Typography variant='caption'>
                            {selectedVersion.maintainers ? selectedVersion.maintainers[0].name : 'N/A'}
                        </Typography>
                    </div>
                    <div className={this.props.cardItemStyle.helmCardDetails}>
                        <Typography variant='body2'>
                            Support:
                        </Typography>
                        <Typography variant='caption'>
                            {
                                selectedVersion.annotations['charts.openshift.io/supportURL'] ?
                                    <a href={selectedVersion.annotations['charts.openshift.io/supportURL']}>Get Support</a> :
                                    'N/A'
                            }
                        </Typography>
                    </div>
                </div>
            </Card>
        </Modal>;

        return (
            <>
                <ThemeProvider theme={CardTheme}>
                    <Card
                        className={clsx(this.props.cardItemStyle.card, this.props.cardItemStyle.helmHomeCard)}
                        onClick={this.onCardClick}
                        data-testid={`card-${selectedVersion.name.replace(/\.| /g, '')}`}
                    >
                        <div className={this.props.cardItemStyle.cardHeader}>
                            <div className={this.props.cardItemStyle.cardHeaderDisplay}>
                                <img
                                    src={selectedVersion.icon ? selectedVersion.icon : require('../../../../images/helm/helm.svg').default}
                                    alt={`${selectedVersion.name} icon`}
                                    className={this.props.cardItemStyle.cardImage} />
                            </div>
                        </div>
                        <div className={this.props.cardItemStyle.cardBody} style={{ margin: '1.5rem', height: '3rem' }}>
                            <Typography variant='subtitle1'>
                                {
                                    capitalizeFirstLetter(this.props.helmEntry.displayName)
                                }
                            </Typography>
                            {
                                selectedVersion.annotations['charts.openshift.io/provider'] && <Typography variant='caption'>Provided by {selectedVersion.annotations['charts.openshift.io/provider']}</Typography>
                            }
                        </div>
                        <div className={this.props.cardItemStyle.cardFooterTag}>
                            {
                                selectedVersion.version && (
                                    <><Typography variant='caption'>
                                        Version: {selectedVersion.version}
                                    </Typography><br /></>
                                )
                            }
                            <div style={{ height: '4rem' }}>
                                <Typography variant='caption'
                                    className={this.props.cardItemStyle.longDescription}>
                                    {selectedVersion.description}
                                </Typography>
                            </div>
                        </div>
                    </Card>
                    {
                        this.props.helmEntry.isExpand &&
                        <> {modalViewCard} </>
                    }
                </ThemeProvider>
            </>
        );
    }
}

function capitalizeFirstLetter(value: string): string {
    if (value.indexOf('-') === -1) {
        return value[0].toUpperCase() + value.substring(1);
    }
    return value
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
