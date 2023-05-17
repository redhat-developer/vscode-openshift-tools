/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Autocomplete, Badge, Button, Card, InputLabel, Modal, TextField, ThemeProvider, Typography, darken, lighten, styled } from '@mui/material';
import React from 'react';
import clsx from 'clsx';
import { CardTheme } from '../../common/cardItem.style';
import '../app/cardItem.scss';
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

    setSelectedVersion = (event: any, value: Chart): void => {
        console.log('Value:::: ', value);
        this.setState({
            selectedVersion: value
        });
    };

    handleDisable = (): boolean => {
        return this.state.installResponse.error || this.state.installName.trim().length === 0;
    }

    GroupHeader = styled('div')(({ theme }) => ({
        position: 'sticky',
        top: '-8px',
        padding: '4px 10px',
        color: theme.palette.primary.main,
        backgroundColor:
            theme.palette.mode === 'light'
                ? lighten(theme.palette.primary.light, 0.85)
                : darken(theme.palette.primary.main, 0.8),
    }));

    GroupItems = styled('ul')({
        padding: 0,
    });

    render(): React.ReactNode {
        const { selectedVersion, installName: installChartName, installResponse } = this.state;
        const versionCard =
            <div className={this.props.cardItemStyle.helmCardBody} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ height: 'auto', display: 'flex', flexDirection: 'row', gap: '2rem', width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '5rem', maxHeight: '10rem', width: '70%' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem' }}>
                            <InputLabel required htmlFor='bootstrap-input'
                                style={{
                                    color: 'var(--vscode-foreground)',
                                    marginLeft: '20px'
                                }}>
                                Chart Name:
                            </InputLabel>
                            <TextField
                                autoFocus
                                className={this.props.cardItemStyle.helmInputBox}
                                value={installChartName}
                                onChange={(e) => this.textFieldChange(e.target.value)}
                                sx={{
                                    '& fieldset': { border: 'none' },
                                    input: {
                                        WebkitTextFillColor: this.props.themeKind <= 1 ? 'black' : 'white',
                                        '&:disabled': {
                                            WebkitTextFillColor: this.props.themeKind <= 1 ? 'black' : 'white'
                                        }
                                    }
                                }}
                                onClick={() => this.textFieldChange('')}
                                InputProps={{
                                    style: {
                                        textAlign: 'center',
                                        paddingLeft: '5px',
                                        cursor: 'text'
                                    }
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <InputLabel
                                style={{
                                    color: 'var(--vscode-foreground)',
                                    paddingTop: '0.5rem',
                                    marginLeft: '1rem'
                                }}>
                                Version:
                            </InputLabel>
                            <Autocomplete
                                id='grouped-folder'
                                options={this.state.versions}
                                autoHighlight
                                fullWidth
                                disableClearable
                                disabled={this.state.versions?.length <= 1}
                                value={selectedVersion}
                                getOptionLabel={(option) => option.appVersion || option.version}
                                renderInput={(params) => (
                                    <TextField
                                        sx={{
                                            input: {
                                                WebkitTextFillColor: this.props.themeKind <= 1 ? 'black' : 'white',
                                                '&:disabled': {
                                                    WebkitTextFillColor: this.props.themeKind <= 1 ? 'black' : 'white'
                                                },
                                                paddingLeft: '5px !important'
                                            }
                                        }}
                                        style={{ marginLeft: '10px' }}
                                        {...params}
                                        inputProps={{
                                            ...params.inputProps
                                        }} />
                                )}
                                renderGroup={(params) => (
                                    <li key={params.key}>
                                        <this.GroupHeader>{params.group}</this.GroupHeader>
                                        <this.GroupItems>{params.children}</this.GroupItems>
                                    </li>
                                )}
                                onChange={(e, v) => this.setSelectedVersion(e, v)} />
                        </div>
                    </div>
                    <div style={{ width: '50%', minHeight: '5rem', maxHeight: '10rem' }}>
                        {selectedVersion.description &&
                            <div className={this.props.cardItemStyle.detailedDescription}>
                                <Typography variant='body1' className={this.props.cardItemStyle.helmCardDetailItem}>Description</Typography>
                                <Typography variant='body2' className={this.props.cardItemStyle.helmCardDetailItemValue}>
                                    {selectedVersion.description}
                                </Typography>
                            </div>
                        }
                        {
                            selectedVersion.annotations['charts.openshift.io/providerType'] &&
                            <div className={this.props.cardItemStyle.detailedDescription}>
                                <Typography variant='body1' className={this.props.cardItemStyle.helmCardDetailItem}>Source</Typography>
                                <Typography variant='body2' className={this.props.cardItemStyle.helmCardDetailItemValue}>
                                    {capitalizeFirstLetter(selectedVersion.annotations['charts.openshift.io/providerType'])}
                                </Typography>
                            </div>
                        }
                        <div className={this.props.cardItemStyle.detailedDescription}>
                            <Typography variant='body1' className={this.props.cardItemStyle.helmCardDetailItem}>Product Version</Typography>
                            <Typography variant='body2' className={this.props.cardItemStyle.helmCardDetailItemValue}>
                                {selectedVersion.appVersion || selectedVersion.version}
                            </Typography>
                        </div>
                        {
                            selectedVersion.annotations['charts.openshift.io/supportURL'] &&
                            <div className={this.props.cardItemStyle.detailedDescription}>
                                <Typography variant='body1' className={this.props.cardItemStyle.helmCardDetailItem}>Home Page</Typography>
                                <Typography variant='body2' className={this.props.cardItemStyle.helmCardDetailItemValue}>
                                    <a className={this.props.cardItemStyle.helmCardDetailItemValue} href={selectedVersion.annotations['charts.openshift.io/supportURL']}>{selectedVersion.annotations['charts.openshift.io/supportURL']}</a>
                                </Typography>
                            </div>
                        }
                        {selectedVersion.maintainers &&
                            <div className={this.props.cardItemStyle.detailedDescription}>
                                <Typography variant='body1' className={this.props.cardItemStyle.helmCardDetailItem}>Maintainers</Typography>
                                <Typography variant='body2' className={this.props.cardItemStyle.helmCardDetailItemValue}>
                                    {selectedVersion.maintainers[0].name}
                                </Typography>
                            </div>
                        }
                        {
                            selectedVersion.annotations['charts.openshift.io/supportURL'] &&
                            <div className={this.props.cardItemStyle.detailedDescription}>
                                <Typography variant='body1' className={this.props.cardItemStyle.helmCardDetailItem}>Support</Typography>
                                <Typography variant='body2' className={this.props.cardItemStyle.helmCardDetailItemValue}>
                                    <a className={this.props.cardItemStyle.helmCardDetailItemValue} href={selectedVersion.annotations['charts.openshift.io/supportURL']}>Get Support</a>
                                </Typography>
                            </div>
                        }
                    </div>
                </div>
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
                        <div style={{ display: 'flex', flexDirection: 'row', width: '100%', position: 'fixed' }}>
                            <div className={this.props.cardItemStyle.devPageTitle} style={{ width: '70%', gap: '2rem' }}>
                                <img
                                    data-testid='icon'
                                    src={this.state.selectedVersion.icon ? this.state.selectedVersion.icon : require('../../../../images/helm/helm.svg').default}
                                    alt={this.state.selectedVersion.icon + ' logo'}
                                    className={this.props.cardItemStyle.cardImage}
                                    style={{ margin: '0rem' }} />
                                <div style={{ margin: '0rem' }}>
                                    <Typography variant='subtitle1'>
                                        {
                                            capitalizeFirstLetter(this.props.helmEntry.displayName)
                                        }
                                    </Typography>
                                </div>
                            </div>
                            <div>
                                <Button
                                    disabled={this.handleDisable()}
                                    variant='outlined'
                                    className={this.props.cardItemStyle.helmInstallBtn}
                                    onClick={this.clickInstall}
                                    style={{ right: '0', backgroundColor: this.handleDisable() ? 'var(--vscode-button-secondaryBackground)' : '#EE0000', textTransform: 'none', color: this.props.themeKind <= 1 ? 'black' : 'white' }}>
                                    <Typography variant='body2'>
                                        Install
                                    </Typography>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
                {
                    versionCard
                }
                {
                    installResponse.loadScreen ?
                        <LoadScreen title='Installing the Chart' /> : undefined
                }
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
                            <div className={this.props.cardItemStyle.cardHeaderDisplay} style={{ flexDirection: 'row' }}>
                                <img
                                    src={selectedVersion.icon ? selectedVersion.icon : require('../../../../images/helm/helm.svg').default}
                                    alt={`${selectedVersion.name} icon`}
                                    className={this.props.cardItemStyle.cardImage} style={{ margin: '0.5rem', width: '2.5rem', height: '2.5rem' }} />
                                {selectedVersion.version && <Badge key={`key-` + selectedVersion.version}
                                    className={this.props.cardItemStyle.badge}
                                    overlap='rectangular'
                                    variant='standard'
                                    style={{ float: 'right', margin: '0.5rem' }}
                                >
                                    {selectedVersion.version.split('-')[0]}
                                </Badge>
                                }
                            </div>
                        </div>
                        <div className={this.props.cardItemStyle.cardBody} style={{ margin: '1rem', height: 'auto'}}>
                            <Typography variant='subtitle1'>
                                {
                                    capitalizeFirstLetter(this.props.helmEntry.displayName)
                                }
                            </Typography>
                            {
                                selectedVersion.annotations['charts.openshift.io/provider'] && <Typography variant='caption'>Provided by {selectedVersion.annotations['charts.openshift.io/provider']}</Typography>
                            }
                        </div>
                        <div className={this.props.cardItemStyle.cardFooterTag} style={{ margin: '1rem' }}>
                            <div style={{ height: 'auto' }}>
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
