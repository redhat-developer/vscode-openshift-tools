/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Card, CardHeader, CardBody, TextContent, Text } from '@patternfly/react-core';
import detailsPageStyle from './detailsPage.style';
import React, { useEffect, useState } from 'react';
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter';
import { VSCodeMessage } from '../vsCodeMessage';
import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles(detailsPageStyle);

export function DetailsPage() {
    const [devfileYAML, setDevFileYAML] = useState('');
    const detailsPageStyle = useStyles();
    useEffect(() => {
        return VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getYAML') {
                setDevFileYAML(message.data.devYAML)
            }
        }
        );
    });

    return (
        <Card data-testid='dev-page-yaml' className={detailsPageStyle.yamlCard}>
            <CardHeader className={detailsPageStyle.cardHeader}>
                <TextContent className={detailsPageStyle.text}>
                    <Text>devfile.yaml</Text>
                </TextContent>
            </CardHeader>
            <CardBody className={detailsPageStyle.cardBody}>
                <SyntaxHighlighter language='yaml' style={detailsPageStyle} useInlineStyles={false}
                    codeTagProps={{
                        style: {
                            fontFamily: 'inherit', color: 'inherit',
                            fontStyle: 'inherit', fontWeight: 'inherit'
                        }
                    }} className={detailsPageStyle.devYAML}>
                    {devfileYAML}
                </SyntaxHighlighter>
            </CardBody>
        </Card>
    )
}
