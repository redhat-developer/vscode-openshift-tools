/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { DevFileProps } from './wrapperCardItem';
import { Backdrop, Button, Card, Modal, InputLabel } from '@material-ui/core';
import { CardActions, TextField, Typography } from '@mui/material';
import { VSCodeMessage } from '../vsCodeMessage';
import './cardItem.scss';

export class CardItem extends React.Component<DevFileProps, {
    isExpanded: boolean,
    selectedVersion: any,
    hoverVersion: null | any,
    installChartName: string,
}> {

    constructor(props: DevFileProps) {
        super(props);
        this.state = {
            isExpanded: false,
            selectedVersion: this.props.helmEntry[0],
            hoverVersion: null,
            installChartName: ''
        }
    }

    onCardClick = (): void => {
        const isExpanded = !this.state.isExpanded;
        console.log('Before::: ' + isExpanded);
        this.setState({
            isExpanded: isExpanded
        });
        console.log('After::: ' + this.state.isExpanded);
    }

    onCloseClick = (_event: any,reason: string): void => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            this.setState({
                isExpanded: false
            });
        }
    };

    clickInstall = (): void => {
        VSCodeMessage.postMessage(
            {
                'action': 'install',
                'name': this.state.installChartName,
                'chartName': this.state.selectedVersion.name,
                'version': this.state.selectedVersion.version
            });
        return;
    }

    textFieldChange = (value: string): void => {
        this.setState({
            installChartName: value
        })
    }

    setSelectedVersion = (version: any): void => {
        this.setState({
            selectedVersion: version
        });
    };

    handleDisable = (): boolean => {
        return this.state.installChartName.length === 0;
    }

    render(): React.ReactNode {
        const { isExpanded, selectedVersion, installChartName } = this.state;
        console.log('helmEntry::::', this.props.helmEntry);

        const versionCard =
            <div className={this.props.cardItemStyle.starterProjectCardBody}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', height: '2rem' }}>
                        <InputLabel required htmlFor='bootstrap-input'
                            style={{
                                color: '#EE0000',
                                paddingTop: '0.5rem'
                            }}>
                            Install Chart Name:
                        </InputLabel>
                        <div>
                            <TextField
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
                    <CardActions className={this.props.cardItemStyle.cardButton}>
                        <Button
                            disabled={this.handleDisable()}
                            color='default'
                            variant='contained'
                            component='span'
                            className={this.props.cardItemStyle.button}
                            onClick={this.clickInstall}
                            style={{ backgroundColor: this.handleDisable() ? 'var(--vscode-button-secondaryBackground)' : '#EE0000'}}>
                            <Typography variant='body2'>
                                Install
                            </Typography>
                        </Button>
                    </CardActions>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', width: '10rem' }}>
                    <InputLabel
                        style={{
                            color: '#EE0000',
                            paddingTop: '0.5rem'
                        }}>
                        Version:
                    </InputLabel>
                    <div
                        data-testid='projects-selector'
                        className={this.props.cardItemStyle.starterProjectSelect}
                    >
                        {this.props.helmEntry.map((entry: any) => (
                            <div
                                key={entry.version}
                                data-testid={`projects-selector-item-${entry.version}`}
                                onMouseDown={(): void => this.setSelectedVersion(entry)}
                                className={
                                    selectedVersion.version === entry.version ? this.props.cardItemStyle.starterProjectSelected : this.props.cardItemStyle.project
                                }
                            >
                                {entry.version}
                            </div>
                        ))}
                    </div>
                </div>
            </div>;

        const modalViewCard = <Modal
            open={isExpanded}
            className={this.props.cardItemStyle.modal}
            aria-labelledby={`modal-${selectedVersion.name}`}
            onClose={this.onCloseClick}
            closeAfterTransition
            BackdropComponent={Backdrop}
            disableAutoFocus
            BackdropProps={{
                timeout: 500,
            }}
            style={{
                width: '100%', height: '100%', marginTop: '5rem', border: '0px'
            }}>
            <Card data-testid='dev-page-yaml' className={this.props.cardItemStyle.helmCard}>
                <div className={this.props.cardItemStyle.helmCardHeader}>
                    <div className={this.props.cardItemStyle.devPageCardHeader}>
                        <div className={this.props.cardItemStyle.devPageTitle}>
                            <img
                                data-testid='icon'
                                src={this.props.helmEntry.icon ? this.props.helmEntry.icon : require('../../../../images/helm/helm.svg').default}
                                alt={this.props.helmEntry.icon + ' logo'}
                                className={this.props.cardItemStyle.cardImage}
                                style={{ margin: '0rem' }} />
                            <div style={{ padding: '1rem', margin: '0rem' }}>
                                <Typography variant='subtitle1'>
                                    {capitalizeFirstLetter(selectedVersion.name)}
                                </Typography>
                            </div>
                        </div>
                    </div>
                    {versionCard}
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
                <Card
                    className={this.props.cardItemStyle.card}
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
                        <Typography variant='subtitle1'>{capitalizeFirstLetter(selectedVersion.name)}</Typography>
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
                    isExpanded &&
                    <> {modalViewCard} </>
                }
            </>
        );
    }
}

function capitalizeFirstLetter(value: string): string {
    value = value.toLowerCase().replace('ibm', 'IBM');
    if (value.indexOf('-') === -1) {
        return value[0].toUpperCase() + value.substring(1);
    }
    return value
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
