/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { FileCopy } from '@mui/icons-material';
import { Badge, Button, Card, CardActions, Modal, ThemeProvider, Tooltip, Typography } from '@mui/material';
import { CardTheme } from './cardItem.style';
import clsx from 'clsx';
import React from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { monokai, qtcreatorLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { StarterProject } from '../../../odo/componentTypeDescription';
import { VSCodeMessage } from '../vsCodeMessage';
import { StarterProjectDisplay } from './starterProjectDisplay';
import { DevFileProps } from './wrapperCardItem';

export class CardItem extends React.Component<DevFileProps, {
    numOfCall: number,
    isExpanded: boolean,
    devFileYAML: string,
    selectedProject: StarterProject,
    copyClicked: boolean
    hoverProject: null | StarterProject
}> {

    constructor(props: DevFileProps) {
        super(props);
        this.state = {
            numOfCall: 0,
            isExpanded: false,
            devFileYAML: '',
            selectedProject: this.props.compDescription.devfileData.devfile.starterProjects[0],
            copyClicked: false,
            hoverProject: null
        };
    }

    onCardClick = (): void => {
        const isExpanded = !this.state.isExpanded;
        let numOfCall = this.state.numOfCall;
        if (isExpanded) {
            VSCodeMessage.postMessage({ 'action': 'getYAML', 'data': this.props.compDescription.devfileData.devfile });
            VSCodeMessage.onMessage((message) => {
                if (message.data.action === 'getYAML' && numOfCall === 0) {
                    numOfCall++;
                    const devFileYAML = message.data.devYAML;
                    this.setState({
                        numOfCall,
                        isExpanded,
                        devFileYAML,
                        selectedProject: this.props.compDescription.devfileData.devfile.starterProjects[0]
                    });
                }
            });
        } else {
            this.setState({
                numOfCall: 0,
                isExpanded,
                devFileYAML: ''
            });
        }
    };

    onCloseClick = (event, reason): void => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            this.setState({
                numOfCall: 0,
                isExpanded: false,
                devFileYAML: ''
            });
        }
    };

    createComponent = (): void => {
        VSCodeMessage.postMessage(
            {
                'action': 'createComponent',
                'devFile': this.props.compDescription.devfileData.devfile,
                'selectedProject': this.state.selectedProject,
                'registryName': this.props.compDescription.registry.name
            });
        return;
    }

    cloneToWorkSpace = (): void => {
        VSCodeMessage.postMessage(
            {
                'action': 'cloneToWorkSpace',
                'selectedProject': this.state.selectedProject
            });
        return;
    }

    openInBrowser = (): void => {
        VSCodeMessage.postMessage(
            {
                'action': 'openInBrowser',
                'selectedProject': this.state.selectedProject
            });
        return;
    }

    setSelectedProject = (project: StarterProject): void => {
        this.setState({
            selectedProject: project
        });
    };

    setCurrentlyHoveredProject = (project: StarterProject): void => {
        this.setState({
            hoverProject: project
        });
    };

    copyClicked = (isClicked: boolean): void => {
        if (isClicked) {
            VSCodeMessage.postMessage(
                {
                    'action': 'telemeteryCopyEvent',
                    'devFileName': this.props.compDescription.devfileData.devfile.metadata.name
                }
            )
        }
        this.setState({
            copyClicked: isClicked
        });
    }

    render(): React.ReactNode {
        const { isExpanded, devFileYAML, selectedProject, hoverProject, copyClicked } = this.state;
        const starterProjectCard = <Card data-testid='dev-page-starterProject' className={this.props.cardItemStyle.starterProjectCard}>
            <div className={this.props.cardItemStyle.starterProjectCardHeader}>
                <Typography variant='body1'>
                    Starter Projects
                </Typography>
                <Badge key={this.props.compDescription.devfileData.devfile.metadata.name + '-badge'}
                    className={clsx(this.props.cardItemStyle.badge, this.props.cardItemStyle.subBadge, this.props.cardItemStyle.headerBadge)}
                    overlap='rectangular'
                    variant='standard'
                    showZero={false}>
                    {this.props.compDescription.devfileData.devfile.starterProjects.length}
                </Badge>
            </div>
            <div>
                <div className={this.props.cardItemStyle.starterProjectCardBody}>
                    <div
                        data-testid='projects-selector'
                        className={this.props.cardItemStyle.starterProjectSelect}
                        onMouseLeave={(): void => this.setCurrentlyHoveredProject(null)}
                    >
                        {this.props.compDescription.devfileData.devfile.starterProjects.map((project: StarterProject) => (
                            <div
                                key={project.name}
                                data-testid={`projects-selector-item-${project.name}`}
                                onMouseDown={(): void => this.setSelectedProject(project)}
                                onMouseEnter={(): void => this.setCurrentlyHoveredProject(project)}
                                className={
                                    selectedProject.name === project.name ? this.props.cardItemStyle.starterProjectSelected : this.props.cardItemStyle.project
                                }
                            >
                                {project.name}
                            </div>
                        ))}
                    </div>
                    <div className={this.props.cardItemStyle.display}>
                        <StarterProjectDisplay project={selectedProject || hoverProject} projectDisplayStyle={this.props.projectDisplayStyle} />
                        <CardActions className={this.props.cardItemStyle.cardButton}>
                            <Button
                                variant='contained'
                                component='span'
                                className={this.props.cardItemStyle.button}
                                onClick={this.createComponent}>
                                <Typography variant='body2'>
                                    New Component
                                </Typography>
                            </Button>
                            {this.props.hasGitLink &&
                                <><Button
                                    variant='contained'
                                    component='span'
                                    className={this.props.cardItemStyle.button}
                                    onClick={this.cloneToWorkSpace}>
                                    <Typography variant='body2'>
                                        Clone to Workspace
                                    </Typography>
                                </Button><Button
                                    variant='contained'
                                    component='span'
                                    className={this.props.cardItemStyle.button}
                                    onClick={this.openInBrowser}>
                                        <Typography variant='body2'>
                                            Open in Browser
                                        </Typography>
                                    </Button></>}
                        </CardActions>
                    </div>
                </div>
            </div>
        </Card>;

        const modalViewCard = <Modal
            open={isExpanded}
            className={this.props.cardItemStyle.modal}
            aria-labelledby={`modal-${this.props.compDescription.devfileData.devfile.metadata.name}`}
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
            <Card data-testid='dev-page-yaml' className={this.props.cardItemStyle.yamlCard}
                id={`modal-${this.props.compDescription.devfileData.devfile.metadata.name}`}>
                <div className={this.props.cardItemStyle.yamlCardHeader}>
                    <Card data-testid='dev-page-header' className={this.props.cardItemStyle.devPageCard}>
                        <div className={this.props.cardItemStyle.devPageCardHeader}>
                            <div className={this.props.cardItemStyle.devPageTitle}>
                                <img
                                    data-testid='icon'
                                    src={this.props.compDescription.devfileData.devfile.metadata.icon}
                                    alt={this.props.compDescription.devfileData.devfile.metadata.icon + ' logo'}
                                    className={this.props.cardItemStyle.cardImage}
                                    style={{ margin: '0rem' }} />
                                <div style={{ padding: '1rem', margin: '0rem' }}>
                                    <Typography variant='subtitle1'>
                                        {capitalizeFirstLetter(this.props.compDescription.devfileData.devfile.metadata.displayName)}
                                    </Typography>
                                </div>
                            </div>
                        </div>
                        {starterProjectCard}
                    </Card>
                </div>
                <div className={this.props.cardItemStyle.yamlCardBody}>
                    <CopyToClipboard text={devFileYAML}>
                        <CardActions className={this.props.cardItemStyle.copyButton}
                            onMouseLeave={(): void => this.copyClicked(false)}>
                            <Tooltip
                                title={copyClicked ? 'Copied' : 'Copy'} children={
                                    <Button
                                        id='tooltip-selector'
                                        component='span'
                                        style={{ cursor: 'pointer', backgroundColor: 'var(--vscode-button-background)' }}
                                        onClick={(): void => this.copyClicked(true)}
                                    >
                                        <FileCopy style={{ color: 'white' }} fontSize='small' />
                                    </Button>} />
                        </CardActions>
                    </CopyToClipboard>
                    <SyntaxHighlighter language='yaml' useInlineStyles
                        style={this.props.themeKind <= 1 ? qtcreatorLight : monokai}
                        wrapLines
                        showLineNumbers
                        lineNumberStyle={{ marginLeft: '-1.5rem' }}
                        customStyle={{ marginLeft: '-1.5rem', background: 'inherit !important', color: 'inherit' }}
                        codeTagProps={{
                            style: {
                                fontFamily: 'inherit',
                                fontStyle: 'inherit', fontWeight: 'inherit'
                            }
                        }}>
                        {devFileYAML}
                    </SyntaxHighlighter>
                </div>
            </Card>
        </Modal>;

        return (
            <>
                <ThemeProvider theme={CardTheme}>
                <Card
                    className={this.props.cardItemStyle.card}
                    onClick={this.onCardClick}
                    data-testid={`card-${this.props.compDescription.devfileData.devfile.metadata.name.replace(/\.| /g, '')}`}
                >
                    <div className={this.props.cardItemStyle.cardHeader}>
                        <div className={this.props.cardItemStyle.cardHeaderDisplay}>
                            <img
                                src={this.props.compDescription.devfileData.devfile.metadata.icon}
                                alt={`${this.props.compDescription.devfileData.devfile.metadata.name} icon`}
                                className={this.props.cardItemStyle.cardImage} />
                            {this.props.compDescription.registry.name.toLowerCase() !== 'defaultdevfileregistry' &&
                                <div className={this.props.cardItemStyle.cardRegistryTitle}>
                                    <Typography variant='caption'>{this.props.compDescription.registry.name}</Typography>
                                </div>}
                        </div>
                    </div>
                    <div style={{ margin: '1.5rem' }}>
                        <Typography variant='subtitle1'>{this.props.compDescription.devfileData.devfile.metadata.displayName}</Typography>
                    </div>
                    <div className={this.props.cardItemStyle.cardBody}>
                        {
                            this.props.compDescription.devfileData.devfile.metadata.version && (
                                <><Typography variant='caption'>
                                    Version: {this.props.compDescription.devfileData.devfile.metadata.version}
                                </Typography><br /></>
                            )
                        }
                        <Typography variant='caption'>
                            Project Type: {capitalizeFirstLetter(this.props.compDescription.devfileData.devfile.metadata.projectType)}
                        </Typography><br />
                        <Typography variant='caption'>
                            Language: {capitalizeFirstLetter(this.props.compDescription.devfileData.devfile.metadata.language)}
                        </Typography><br />
                    </div>
                    <div className={this.props.cardItemStyle.cardFooterTag}>
                        <div style={{ height: '4rem' }}>
                            <Typography variant='caption'
                                className={this.props.cardItemStyle.longDescription}>
                                {this.props.compDescription.devfileData.devfile.metadata.description}
                            </Typography>
                        </div>
                        <div>
                            {
                                this.props.compDescription.devfileData.devfile.metadata.tags?.map((tag: string, index: number) =>
                                    index <= 2 &&
                                    <Badge key={index}
                                        className={index === 0 ?
                                            clsx(this.props.cardItemStyle.badge, this.props.cardItemStyle.firstBadge)
                                            : this.props.cardItemStyle.badge}
                                        overlap='rectangular'
                                        variant='standard'
                                    >
                                        {tag}
                                    </Badge>
                                )
                            }
                        </div>
                    </div>
                </Card>
                {
                    devFileYAML.length > 0 && isExpanded &&
                    <>
                        {modalViewCard}
                    </>
                }
                </ThemeProvider>
            </>
        );
    }
}

function capitalizeFirstLetter(value?: string): string {
    return value[0].toUpperCase() + value.substring(1);
}
