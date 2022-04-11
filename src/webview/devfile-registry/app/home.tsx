/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { makeStyles } from '@material-ui/core';
import { Link } from 'react-router-dom';
import {
    Gallery,
} from '@patternfly/react-core';
import React, { useEffect, useState } from 'react';
import { WrapperCardItem as CardItem } from './wrapperCardItem';
import homeStyle from './home.style';
import { Devfile, getRegistries } from '../commands';
import { Registry } from '../../../odo/componentType';

const useStyles = makeStyles(homeStyle);

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    devFiles: Devfile[];
    registries: Registry[];
    homeStyleClass: any;
}

const HomeItem: React.FC<HomePageProps> = ({
    devFiles,
    registries,
    homeStyleClass
}: HomePageProps) => {

    return (
        <>
            <Gallery className={homeStyleClass.devfileGalleryGrid}>
                {devFiles.map((devFile) => (
                    <Link
                        key={serializeURL(devFile)}
                        to={`/devfiles/${serializeURL(devFile)}`}
                        state={devFile}
                        className={homeStyleClass.textLink}
                    >
                        <CardItem devFile={devFile} style={homeStyleClass}/>
                    </Link>
                ))}
                {registries.map((registry) =>(
                    <div>{registry.URL}</div>
                ))}
            </Gallery>
        </>
    );
};

export function Home() {
    const homeStyle = useStyles();
    const [devFiles, setDevFiles] = useState();
    const [registries] = useState();

    useEffect(() => {
        try {
            const headers = { 'Content-Type': 'text/plain' };
            fetch('https://registry.stage.devfile.io/index/all', { headers })
                .then((res) => res.json())
                .then((data) => setDevFiles(data));
            getRegistries().then((registries));
        } catch (error) {
            console.error(error);
        }
    }, []);

    return <div>{devFiles && <HomeItem devFiles={devFiles} registries={registries} homeStyleClass={homeStyle} />}</div>;
}

function serializeURL(devfile: Devfile): string {
    return `Community+${devfile.name.replace(/\+/g, '')}`;
}
