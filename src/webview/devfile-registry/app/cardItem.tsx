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
    Button,
    CardActions,
    Backdrop
} from '@patternfly/react-core';
import { DevFileProps } from './wrapperCardItem';
import { VSCodeMessage } from '../vsCodeMessage';

export class CardItem extends React.Component<DevFileProps, { numOfCall: number, isExpanded: boolean, devFileYAML: string }> {

    constructor(props: DevFileProps) {
        super(props);
        this.state = {
            numOfCall: 0,
            isExpanded: false,
            devFileYAML: ''
        };
    }

    onCardClick = (): void => {
        const isExpanded = !this.state.isExpanded;
        let numOfCall = this.state.numOfCall;
        if (isExpanded) {
            VSCodeMessage.postMessage({ 'action': 'getYAML', 'data': this.props.devFile });
            VSCodeMessage.onMessage((message) => {
                if (message.data.action === 'getYAML' && numOfCall === 0) {
                    numOfCall++;
                    const devFileYAML = message.data.devYAML;
                    this.setState({
                        numOfCall,
                        isExpanded,
                        devFileYAML
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
        VSCodeMessage.postMessage({ 'action': 'callCreateComponent', 'data': this.props.component });
        return;
    }

    render(): React.ReactNode {
        const { isExpanded, devFileYAML } = this.state;
        return (
            <>
                <Card
                    className={this.props.cardItemStyle.card}
                    onClick={this.onCardClick}
                    isHoverable
                    data-testid={`card-${this.props.devFile.metadata.name.replace(/\.| /g, '')}`}
                >
                    <CardHeader className={this.props.cardItemStyle.cardHeader}>
                        <div className={this.props.cardItemStyle.cardHeaderDisplay}>
                            <Brand
                                src={this.props.devFile.metadata.icon}
                                alt={`${this.props.devFile.metadata.name} icon`}
                                className={this.props.cardItemStyle.cardImage} />
                        </div>
                    </CardHeader>
                    <CardTitle style={{ margin: '1.5rem' }}>
                        <TextContent>
                            <Text component={TextVariants.h1}>{this.props.devFile.metadata.displayName}</Text>
                        </TextContent>
                    </CardTitle>
                    <CardBody className={this.props.cardItemStyle.cardBody}>
                        {
                            this.props.devFile.metadata.version && (
                                <TextContent>
                                    <Text component={TextVariants.small}>
                                        Version: {this.props.devFile.metadata.version}
                                    </Text>
                                </TextContent>
                            )
                        }
                        <TextContent>
                            <Text component={TextVariants.small}>
                                Project Type: {capitalizeFirstLetter(this.props.devFile.metadata.projectType)}
                            </Text>
                        </TextContent>
                        <TextContent>
                            <Text component={TextVariants.small}>
                                Language: {capitalizeFirstLetter(this.props.devFile.metadata.language)}
                            </Text>
                        </TextContent>
                        <TextContent>
                            <Text
                                component={TextVariants.p}
                                className={this.props.cardItemStyle.longDescription}>
                                {this.props.devFile.metadata.description}
                            </Text>
                        </TextContent>
                    </CardBody>
                </Card>
                {
                    devFileYAML.length > 0 && isExpanded &&
                    <>
                        <Backdrop className={this.props.cardItemStyle.backDrop}>
                            <Modal
                                isOpen={isExpanded}
                                className={this.props.cardItemStyle.modal}
                                variant={ModalVariant.small}
                                title='devfile.yaml'
                                onClose={this.onCloseClick}
                                style={{
                                    width: '100%', height: '100%'
                                }}>
                                <Card data-testid='dev-page-yaml' className={this.props.cardItemStyle.yamlCard}>
                                    <CardHeader className={this.props.cardItemStyle.yamlCardHeader}>
                                        <Card data-testid='dev-page-header' className={this.props.cardItemStyle.devPageCard}>
                                            <CardHeader className={this.props.cardItemStyle.devPageCardHeader}>
                                                <Brand
                                                    data-testid="icon"
                                                    src={this.props.devFile.metadata.icon}
                                                    alt={this.props.devFile.metadata.icon + ' logo'}/>
                                                <TextContent>
                                                    <Text component={TextVariants.h6}>
                                                        {capitalizeFirstLetter(this.props.devFile.metadata.displayName)}
                                                    </Text>
                                                </TextContent>
                                                <CardActions className={this.props.cardItemStyle.cardButton}>
                                                    <Button
                                                        color="default"
                                                        component="span"
                                                        className={this.props.cardItemStyle.button}
                                                        onClick={this.createComponent}>
                                                        <TextContent>
                                                            <Text component={TextVariants.h1}>
                                                                New Component
                                                            </Text>
                                                        </TextContent>
                                                    </Button>
                                                    <Button
                                                        color="default"
                                                        component="span"
                                                        className={this.props.cardItemStyle.button}
                                                        onClick={this.createComponent}>
                                                        <TextContent>
                                                            <Text component={TextVariants.h1}>
                                                                Clone Repository
                                                            </Text>
                                                        </TextContent>
                                                    </Button>
                                                    <Button
                                                        color="default"
                                                        component="span"
                                                        className={this.props.cardItemStyle.button}
                                                        onClick={this.createComponent}>
                                                        <TextContent>
                                                            <Text component={TextVariants.h1}>
                                                                Open in Browser
                                                            </Text>
                                                        </TextContent>
                                                    </Button>
                                                </CardActions>
                                            </CardHeader>
                                        </Card>
                                    </CardHeader>
                                    <CardBody className={this.props.cardItemStyle.yamlCardBody}>
                                        <SyntaxHighlighter language='yaml' style={this.props.cardItemStyle} useInlineStyles={false}
                                            wrapLines={true}
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
                            </Modal>
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
