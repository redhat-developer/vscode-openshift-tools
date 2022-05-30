/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import {
    Brand,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    TextContent,
    TextVariants,
    Text,
    Modal,
    ModalVariant,
    Backdrop,
    Button,
    CardActions,
    Tooltip,
    CardFooter
} from '@patternfly/react-core';
import clsx from 'clsx';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { DevFileProps } from './wrapperCardItem';
import { VSCodeMessage } from '../vsCodeMessage';
import { StarterProject } from '../../../odo/componentTypeDescription';
import { StarterProjectDisplay } from './starterProjectDisplay';
import CopyIcon from '@patternfly/react-icons/dist/esm/icons/copy-icon';
import { Badge } from '@material-ui/core';

export class CardItem extends React.Component<DevFileProps, {
    numOfCall: number,
    isExpanded: boolean,
    devFileYAML: string,
    selectedProject: StarterProject,
    copyClicked: boolean
    hoverProject: null | StarterProject,
}> {

    constructor(props: DevFileProps) {
        super(props);
        this.state = {
            numOfCall: 0,
            isExpanded: false,
            devFileYAML: '',
            selectedProject: this.props.compDescription.Devfile.starterProjects[0],
            copyClicked: false,
            hoverProject: null
        };
    }

    onCardClick = (): void => {
        const isExpanded = !this.state.isExpanded;
        let numOfCall = this.state.numOfCall;
        if (isExpanded) {
            VSCodeMessage.postMessage({ 'action': 'getYAML', 'data': this.props.compDescription.Devfile });
            VSCodeMessage.onMessage((message) => {
                if (message.data.action === 'getYAML' && numOfCall === 0) {
                    numOfCall++;
                    const devFileYAML = message.data.devYAML;
                    this.setState({
                        numOfCall,
                        isExpanded,
                        devFileYAML,
                        selectedProject: this.props.compDescription.Devfile.starterProjects[0]
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

    onCloseClick = (): void => {
        this.setState({
            numOfCall: 0,
            isExpanded: false,
            devFileYAML: ''
        });
    };

    createComponent = (): void => {
        VSCodeMessage.postMessage(
            {
                'action': 'createComponent',
                'devFile': this.props.compDescription.Devfile,
                'selectedProject': this.state.selectedProject,
                'registryName': this.props.compDescription.RegistryName
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
                    'devFile': this.props.compDescription.Devfile.metadata.name,
                    'copyClicked': isClicked
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
            <CardHeader className={this.props.cardItemStyle.starterProjectCardHeader}>
                <TextContent>
                    <Text component={TextVariants.h6}>
                        Starter Projects
                    </Text>
                </TextContent>
                <Badge key={this.props.compDescription.Devfile.metadata.name + '-badge'}
                    className={clsx(this.props.cardItemStyle.badge, this.props.cardItemStyle.headerBadge)}
                    overlap='rectangular'
                    variant='standard'
                    showZero={false}>
                    {this.props.compDescription.Devfile.starterProjects.length}
                </Badge>
            </CardHeader>
            <CardBody>
                <div className={this.props.cardItemStyle.starterProjectCardBody}>
                    <div
                        data-testid='projects-selector'
                        className={this.props.cardItemStyle.starterProjectSelect}
                        onMouseLeave={(): void => this.setCurrentlyHoveredProject(null)}
                    >
                        {this.props.compDescription.Devfile.starterProjects.map((project: StarterProject) => (
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
                                color='default'
                                component='span'
                                className={this.props.cardItemStyle.button}
                                onClick={this.createComponent}>
                                <TextContent>
                                    <Text component={TextVariants.h6}>
                                        New Component
                                    </Text>
                                </TextContent>
                            </Button>
                        </CardActions>
                        {this.props.hasGitLink && <><CardActions className={this.props.cardItemStyle.cardButton}>
                            <Button
                                color='default'
                                component='span'
                                className={this.props.cardItemStyle.button}
                                onClick={this.cloneToWorkSpace}>
                                <TextContent>
                                    <Text component={TextVariants.h6}>
                                        Clone to Workspace
                                    </Text>
                                </TextContent>
                            </Button>
                        </CardActions><CardActions className={this.props.cardItemStyle.cardButton}>
                                <Button
                                    color='default'
                                    component='span'
                                    className={this.props.cardItemStyle.button}
                                    onClick={this.openInBrowser}>
                                    <TextContent>
                                        <Text component={TextVariants.h1}>
                                            Open in Browser
                                        </Text>
                                    </TextContent>
                                </Button>
                            </CardActions></>}
                    </div>
                </div>
            </CardBody>
        </Card>;

        const modalViewCard = <Modal
            isOpen={isExpanded}
            className={this.props.cardItemStyle.modal}
            variant={ModalVariant.small}
            aria-labelledby={`modal-${this.props.compDescription.Devfile.metadata.name}`}
            showClose
            disableFocusTrap
            onClose={this.onCloseClick}
            style={{
                width: '100%', height: '100%'
            }}>
            <Card data-testid='dev-page-yaml' className={this.props.cardItemStyle.yamlCard}>
                <CardHeader className={this.props.cardItemStyle.yamlCardHeader}>
                    <Card data-testid='dev-page-header' className={this.props.cardItemStyle.devPageCard}>
                        <CardHeader className={this.props.cardItemStyle.devPageCardHeader}>
                            <div className={this.props.cardItemStyle.devPageTitle}>
                                <Brand
                                    data-testid='icon'
                                    src={this.props.compDescription.Devfile.metadata.icon}
                                    alt={this.props.compDescription.Devfile.metadata.icon + ' logo'}
                                    className={this.props.cardItemStyle.cardImage}
                                    style={{ margin: '0rem' }} />
                                <TextContent style={{ padding: '1rem', margin: '0rem' }}>
                                    <Text component={TextVariants.h6}>
                                        {capitalizeFirstLetter(this.props.compDescription.Devfile.metadata.displayName)}
                                    </Text>
                                </TextContent>
                            </div>
                        </CardHeader>
                        <CardBody className={this.props.cardItemStyle.devPageCardBody}>
                            {starterProjectCard}
                        </CardBody>
                    </Card>
                </CardHeader>
                <CardBody className={this.props.cardItemStyle.yamlCardBody}>
                    <CopyToClipboard text={devFileYAML}>
                        <CardActions className={this.props.cardItemStyle.copyButton}
                            onMouseLeave={(): void => this.copyClicked(false)}>
                            <Button
                                id='tooltip-selector'
                                component='span'
                                icon={<CopyIcon />}
                                style={{ cursor: 'pointer' }}
                                onClick={(): void => this.copyClicked(true)}
                            >
                            </Button>
                            <Tooltip
                                content={
                                    copyClicked ? 'Copied' : 'Copy'
                                }
                                position='bottom'
                                trigger='mouseenter click'
                                reference={() => document.getElementById('tooltip-selector')}
                            />
                        </CardActions>
                    </CopyToClipboard>
                    <SyntaxHighlighter language='yaml' useInlineStyles={false}
                        wrapLines
                        showLineNumbers
                        lineNumberStyle={{marginLeft: '0.5rem'}}
                        customStyle={{ marginLeft: '-1.5rem' }}
                        codeTagProps={{
                            style: {
                                fontFamily: 'inherit', color: 'inherit',
                                fontStyle: 'inherit', fontWeight: 'inherit'
                            }
                        }}>
                        {devFileYAML}
                    </SyntaxHighlighter>
                </CardBody>
            </Card>
        </Modal>;

        return (
            <>
                <Card
                    className={this.props.cardItemStyle.card}
                    onClick={this.onCardClick}
                    isHoverable
                    data-testid={`card-${this.props.compDescription.Devfile.metadata.name.replace(/\.| /g, '')}`}
                >
                    <CardHeader className={this.props.cardItemStyle.cardHeader}>
                        <div className={this.props.cardItemStyle.cardHeaderDisplay}>
                            <Brand
                                src={this.props.compDescription.Devfile.metadata.icon}
                                alt={`${this.props.compDescription.Devfile.metadata.name} icon`}
                                className={this.props.cardItemStyle.cardImage} />

                        </div>
                    </CardHeader>
                    <CardTitle style={{ margin: '1rem 1.5rem' }}>
                        <TextContent>
                            <Text component={TextVariants.h1}>{this.props.compDescription.Devfile.metadata.displayName}</Text>
                        </TextContent>
                        {this.props.compDescription.RegistryName.toLowerCase() !== 'defaultdevfileregistry' &&
                            <TextContent className={this.props.cardItemStyle.cardRegistryTitle}>
                                <Text component={TextVariants.p}>{this.props.compDescription.RegistryName}</Text>
                            </TextContent>}
                    </CardTitle>
                    <CardBody className={this.props.cardItemStyle.cardBody}>
                        {
                            this.props.compDescription.Devfile.metadata.version && (
                                <TextContent>
                                    <Text component={TextVariants.small}>
                                        Version: {this.props.compDescription.Devfile.metadata.version}
                                    </Text>
                                </TextContent>
                            )
                        }
                        <TextContent>
                            <Text component={TextVariants.small}>
                                Project Type: {capitalizeFirstLetter(this.props.compDescription.Devfile.metadata.projectType)}
                            </Text>
                        </TextContent>
                        <TextContent>
                            <Text component={TextVariants.small}>
                                Language: {capitalizeFirstLetter(this.props.compDescription.Devfile.metadata.language)}
                            </Text>
                        </TextContent>
                        <TextContent>
                            <Text
                                component={TextVariants.p}
                                className={this.props.cardItemStyle.longDescription}>
                                {this.props.compDescription.Devfile.metadata.description}
                            </Text>
                        </TextContent>
                    </CardBody>
                    <CardFooter className={this.props.cardItemStyle.cardFooterTag}>
                        {
                            this.props.compDescription.Devfile.metadata.tags?.map((tag: string, index: number) =>
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
                    </CardFooter>
                </Card>
                {
                    devFileYAML.length > 0 && isExpanded &&
                    <>
                        <Backdrop className={this.props.cardItemStyle.backDrop}>
                            {modalViewCard}
                        </Backdrop>
                    </>
                }
            </>
        );
    }
}

function capitalizeFirstLetter(value?: string): string {
    return value[0].toUpperCase() + value.substring(1);
}
