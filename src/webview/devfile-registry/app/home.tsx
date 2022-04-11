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
import { Devfile } from '../commands';

const useStyles = makeStyles(homeStyle);

interface HomePageProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    devFiles: Devfile[];
    homeStyleClass: any;
}

const HomeItem: React.FC<HomePageProps> = ({
    devFiles,
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
                        className={homeStyleClass.textLink}>
                        <CardItem devFile={devFile} style={homeStyleClass}/>
                    </Link>
                ))}
            </Gallery>
        </>
    );
};

export function Home() {
    const homeStyle = useStyles();
    const [devfiles, setDevFiles] = useState([]);

    //TODO: add loading screen until get the components json
    //TODO: odo call should happen instead of direct registry url hit
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

    return <div><HomeItem devFiles={devfiles} homeStyleClass={homeStyle}/></div>;
}

function serializeURL(devfile: Devfile): string {
    return `Community+${devfile.name.replace(/\+/g, '')}`;
}
