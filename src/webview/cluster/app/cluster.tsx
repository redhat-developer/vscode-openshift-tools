/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
    Button,
    Card,
    CardContent,
    CardActions,
    List,
    ListItem,
    ListItemText,
    Tooltip,
    Typography
} from '@material-ui/core';
import clsx from 'clsx';
import { CardBody, CardFooter } from '@patternfly/react-core';
import AddClusterView from './clusterView';
import AddSandboxView from './sandboxView';
import clusterStyle from './cluster.style';
import './images/logo.png';

const useStyles = makeStyles(clusterStyle);

const clusterTypes = [
  {
    heading: 'Deploy it locally on your laptop',
    description: 'Install on Laptop: Red Hat OpenShift Local (formerly Red Hat CodeReady Containers)',
    smallInfo: 'Create a minimal OpenShift 4 cluster on your desktop/laptop for local development and testing.',
    imageUrl: ['https://www.openshift.com/hubfs/images/icons/Icon-Red_Hat-Hardware-Laptop-A-Black-RGB.svg'],
    urlAlt: 'crc',
    redirectLink: '',
    buttonText: 'Create/Refresh cluster',
    tooltip: 'Create/Run local OpenShift 4 cluster using the guided workflow'
  },
  {
    heading: 'Launch Developer Sandbox',
    description: 'Free access to the Developer Sandbox for Red Hat OpenShift',
    smallInfo: 'If you are exploring how to run your code as containers in OpenShift, our free Developer Sandbox instantly gives you a way to try it out.',
    imageUrl: ['https://assets.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift-A-Standard-RGB.svg'],
    urlAlt: 'dev sandbox',
    redirectLink: '',
    buttonText: 'Start your OpenShift experience',
    tooltip: 'Launch your Developer Sandbox for Red Hat OpenShift'
  },
  {
    heading: 'Deploy it in your public cloud',
    description: 'Run OpenShift clusters on your own by installing from another cloud provider.',
    smallInfo: 'This includes Azure Red Hat Openshift, Red Hat OpenShift on IBM Cloud, Red Hat OpenShift Service on AWS, Google Cloud, AWS (x86_64), Azure.',
    imageUrl: ['https://www.openshift.com/hubfs/images/logos/logo_aws.svg', 'https://www.openshift.com/hubfs/images/logos/logo-try-cloud.svg', 'https://www.openshift.com/hubfs/images/logos/logo_google_cloud.svg'],
    urlAlt: 'public cloud',
    redirectLink: 'https://console.redhat.com/openshift/create',
    buttonText: 'Try it in your cloud',
    tooltip: 'For complete installation, follow the official documentation.'
  }
];

const vscodeApi = window.vscodeApi;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function Header() {
    const classes = useStyles();
    const [showWizard, setShowWizard] = React.useState('');

    window.onmessage = (event: any) => {
        if (['crc', 'sandbox'].includes(event.data.param)) {
            setShowWizard(event.data.param);
        }
    }

    const handleView = (index: number) => {
        switch (index) {
            case 0:
                setShowWizard('crc');
                vscodeApi.postMessage({
                    action: 'openCrcAddClusterPage',
                });
                break;
            case 1:
                setShowWizard('sandbox');
                vscodeApi.postMessage({
                    action: 'openLaunchSandboxPage',
                    params: {
                        url: clusterTypes[index].redirectLink
                    }
                });
                break;
            case 2:
                vscodeApi.postMessage({
                    action: 'openCreateClusterPage',
                    params: {
                        url: clusterTypes[index].redirectLink
                    }
                });
                break;
        }
    };

    const InfrastructureLayout = ({ clusterTypes }) => (
        <>
            {clusterTypes.map((list, index) => (
                <Card className={classes.cardTransform} key={index}>
                    <div className={classes.cardHeader}>
                        <Typography variant="caption" display="block" style={{ fontSize: '1.25em', color: 'white' }}>
                            {list.heading}
                        </Typography>
                    </div>
                    <CardContent style={{ height: 240 }}>
                        <Typography  className={index === 2 ? classes.cardImageTableContainer : classes.cardImageContainer}>
                            {list.imageUrl.map((url: string, index: string | number) => (
                                <img src={url} key={index} className={classes.image} style={{ marginLeft: '.625rem', marginRight: '.625rem', position: 'relative' }}></img>
                            ))}
                        </Typography>
                        <CardBody className={index === 2 ? clsx(classes.cardBody, classes.cardBodyMargin) : classes.cardBody}>
                            <List>
                                <ListItem>
                                    <ListItemText
                                        primary={list.description}
                                        secondary={list.smallInfo} />
                                </ListItem>
                            </List>
                        </CardBody>
                    </CardContent>
                    <CardFooter>
                        <CardActions className={classes.cardButton}>
                            <Tooltip title={list.tooltip} placement="top">
                                <div>
                                    <a onClick={() => handleView(index)} style={{ textDecoration: 'none' }} href={clusterTypes[index].redirectLink || '#'}>
                                        <Button
                                            variant="contained"
                                            color="default"
                                            component="span"
                                            className={classes.button}
                                        >
                                            {list.buttonText}
                                        </Button>
                                    </a>
                                </div>
                            </Tooltip>
                        </CardActions>
                    </CardFooter>
                </Card>
            ))}
        </>
    );

    return (
        <div className={classes.App}>
            <div className={classes.iconContainer}>
                <img className={classes.image} src='assets/logo.png' alt="redhat-openshift"></img>
            </div>
            { showWizard === 'crc' && (
                <div className={classes.rowBody}>
                    <Card className={classes.cardContent}>
                        <Typography variant="body2" component="p" style={{ padding: 20 }}>
                            Red Hat OpenShift Local brings a minimal OpenShift 4 cluster to your local computer.<br></br>You can use this guided workflow to create OpenShift cluster locally. Cluster take approximately 15 minutes to provision.
                        </Typography>
                        <AddClusterView vscode={vscodeApi} />
                    </Card>
                </div>
            )}
            { showWizard === 'sandbox' && (
                <div className={classes.rowBody}>
                    <Card className={classes.cardContent}>
                        <Typography variant="body2" component="p" style={{ padding: 20 }}>
                        The sandbox provides you with a private OpenShift environment in a shared, multi-tenant OpenShift cluster that is pre-configured with a set of developer tools. <br></br>Discover the rich capabilities of the full developer experience on OpenShift with the sandbox.
                        </Typography>
                        <Button variant="outlined" href='https://developers.redhat.com/developer-sandbox' className={classes.button} style={{ margin: 15, textTransform: 'none' }}>Learn More</Button>
                        <Button variant="outlined" href='mailto:devsandbox@redhat.com' className={classes.button} style={{ margin: 15, textTransform: 'none' }}>Contact Us</Button>
                        <Button variant="outlined" href='https://dn.dev/DevNationSlack'className={classes.button} style={{ margin: 15, textTransform: 'none' }}>Connect on Slack</Button>
                        <AddSandboxView/>
                    </Card>
                </div>
            )}
            { !showWizard && (
                <div className={classes.cardContainer}>
                    <InfrastructureLayout clusterTypes={clusterTypes}></InfrastructureLayout>
                </div>
            )}
        </div>
    );
}
