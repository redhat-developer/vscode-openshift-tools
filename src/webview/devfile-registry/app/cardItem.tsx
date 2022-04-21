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
    CardActions
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
                    <Modal
                        isOpen={isExpanded}
                        title='devfile.yaml'
                        variant={ModalVariant.small}
                        onClose={this.onCloseClick}
                        style={{ border: '1px solid var(--vscode-focusBorder)', width: '100%' }}
                    >
                        <Card data-testid='dev-page-yaml' className={this.props.cardItemStyle.yamlCard}>
                            <CardHeader className={this.props.cardItemStyle.yamlCardHeader}>
                                <CardActions className={this.props.cardItemStyle.cardButton}>
                                    <Button
                                        color="default"
                                        component="span"
                                        className={this.props.cardItemStyle.button}
                                        onClick={this.createComponent}
                                    >
                                        New Component
                                    </Button>
                                </CardActions>
                            </CardHeader>
                            <CardBody className={this.props.cardItemStyle.yamlCardBody}>
                                <SyntaxHighlighter language='yaml' style={this.props.cardItemStyle} useInlineStyles={false}
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
                }
            </>
        );
    }
}

function capitalizeFirstLetter(value: string): string {
    return value[0].toUpperCase() + value.substring(1);
}
