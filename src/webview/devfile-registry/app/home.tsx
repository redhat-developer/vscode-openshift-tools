/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { makeStyles } from '@material-ui/core';
import homeStyle from './home.style';
import { Devfile } from '../commands';
import { Link } from 'react-router-dom';
import {
    Brand,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    TextContent,
    Text,
    TextVariants,
    Gallery,
} from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';

const useStyles = makeStyles(homeStyle);

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    devFiles: Devfile[];
    homeStyleClass: any;
}

const HomeItem: React.FC<HomePageProps> = ({
    devFiles,
    homeStyleClass,
    onClick,
}: HomePageProps) => {
    const onCardClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
        onClick!(event);
    };

    return (
        <>
            <Gallery className={homeStyleClass.devfileGalleryGrid}>
                {devFiles.map((devfile) => (
                    <Link
                        key={serializeURL(devfile)}
                        to={`/devfiles/${serializeURL(devfile)}`}
                        className={homeStyleClass.textLink}
                    >
                        <Card
                            className={homeStyleClass.card}
                            isHoverable
                            onClick={onCardClick}
                            data-testid={`card-${devfile.name.replace(/\.| /g, '')}`}
                        >
                            <CardHeader className={homeStyleClass.cardHeader}>
                                <div className={homeStyleClass.cardHeaderDisplay}>
                                    <Brand
                                        src={devfile.icon}
                                        alt={`${devfile.name} icon`}
                                        className={homeStyleClass.cardImage}
                                    />
                                    <TextContent>
                                        <Text className={homeStyleClass.text}>
                                            {capitalizeFirstLetter(devfile.type)}
                                        </Text>
                                    </TextContent>
                                </div>
                            </CardHeader>
                            <CardTitle style={{ margin: '0.5rem' }}>
                                <TextContent>
                                    <Text component={TextVariants.h3}>{devfile.displayName}</Text>
                                </TextContent>
                            </CardTitle>
                            <CardBody className={homeStyleClass.cardBody}>
                                {devfile.version && (
                                    <TextContent>
                                        <Text component={TextVariants.small}>
                                            Version: {devfile.version}
                                        </Text>
                                    </TextContent>
                                )}
                                <TextContent>
                                    <Text component={TextVariants.small}>
                                        Language: {capitalizeFirstLetter(devfile.language)}
                                    </Text>
                                </TextContent>
                                <TextContent>
                                    <Text
                                        component={TextVariants.p}
                                        className={homeStyleClass.longDescription}
                                    >
                                        {devfile.description}
                                    </Text>
                                </TextContent>
                            </CardBody>
                        </Card>
                    </Link>
                ))}
            </Gallery>
        </>
    );
};

export function Home() {
    const homeStyle = useStyles();
    const [devFiles, setDevFiles] = useState();

    useEffect(() => {
        try {
            const headers = { 'Content-Type': 'text/plain' };
            fetch('https://registry.stage.devfile.io/index/all', { headers })
                .then((res) => res.json())
                .then((data) => setDevFiles(data));
        } catch (error) {
            console.error(error);
        }
    }, []);

    return <div>{devFiles && <HomeItem devFiles={devFiles} homeStyleClass={homeStyle} />}</div>;
}

function capitalizeFirstLetter(value: string): string {
    return value[0].toUpperCase() + value.substring(1);
}
function serializeURL(devfile: Devfile): string {
    return `${devfile.registry?.replace(/\+/g, '')}+${devfile.name.replace(/\+/g, '')}`;
}
