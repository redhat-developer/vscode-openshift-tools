/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import BugReportIcon from '@mui/icons-material/BugReport';
import ChatIcon from '@mui/icons-material/Chat';
import GitHubIcon from '@mui/icons-material/GitHub';
import HelpIcon from '@mui/icons-material/Help';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { Box, Checkbox, FormControlLabel, Icon, Stack, SvgIcon, Typography } from '@mui/material';
import React from 'react';
import ScrollToTop from 'react-scroll-to-top';
import OpenShiftExtensionIcon from '../../../../images/openshift_extension.png';
import OpenShiftLogo from '../../../../images/title/logo.svg';
import OpenShiftBranding from '../../../../images/welcome/OpenShift-Branding-box.png';
import CloudBranding from '../../../../images/welcome/cloud.svg';
import ComponentBranding from '../../../../images/welcome/component.png';
import OpenShhiftLocal from '../../../../images/openshift-local.png';
import MicrosoftLogo from '../../../../images/welcome/microsoft.svg';
import OdoLogo from '../../../../images/welcome/odo.png';
import { VSCodeMessage } from './vsCodeMessage';
import './welcome.scss';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export class Welcome extends React.Component<DefaultProps, {
    lastRelease: string,
    isChecked: boolean
}> {

    constructor(props) {
        super(props);
        this.state = {
            lastRelease: '',
            isChecked: true
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getOpenShiftVersion') {
                this.setState({ lastRelease: message.data.param })
            } else if (message.data.action === 'getShowWelcomePageConfig') {
                this.setState({ isChecked: message.data.param })
            }
        });
    }

    openGetStarted = (name: string): void => {
        VSCodeMessage.postMessage({
            action: 'callGetStartedPage',
            method: name
        });
        return;
    }

    openExternalPage = (url: string): void => {
        VSCodeMessage.postMessage({
            'action': 'open',
            'param': url
        });
        return;
    }

    openCluster = (value: string): void => {
        VSCodeMessage.postMessage({
            'action': 'openCluster',
            'param': value
        });
        return;
    }

    openDevfileRegistry = (): void => {
        VSCodeMessage.postMessage({
            'action': 'openDevfileRegistry'
        });
        return;
    }

    updateShowWelcomePageConfig = e => {
        this.setState({ isChecked: e.target.checked })
        VSCodeMessage.postMessage({
            'action': 'updateShowWelcomePageConfig',
            'param': e.target.checked
        });
        return;
    }

    footer = <footer id='footer'>
        <div className='foot-col-1' >
            <div className='setting__input setting__input--big footer__input' style={{ width: '30%' }}>
                <label style={{
                    display: 'flex', flexDirection: 'row'
                }}>
                    <Typography variant='h2' className='highlight'>Additional</Typography>
                    <Typography variant='h2' style={{ paddingLeft: '1rem' }} className='foreGroundColor'>Resources</Typography>
                </label>
            </div>
            <div className='foot-col-2'>
                <div className='help'>
                    <ul>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://developers.redhat.com/products/openshift-local/overview')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <LaptopMacIcon style={{ fontSize: 25 }} />
                                        <Typography variant='h6' className='footerText'>OpenShift Local</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
                <div className='help'>
                    <ul>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://developers.redhat.com/developer-sandbox')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <Icon fontSize='large'>
                                            <img src={OpenShiftExtensionIcon} />
                                        </Icon>
                                        <Typography variant='h6' className='footerText'>Developer Sandbox for Red Hat OpenShift</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
                <div className='documentation'>
                    <ul>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://odo.dev')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <Icon fontSize='large'>
                                            <img src={OdoLogo} />
                                        </Icon>
                                        <Typography variant='h6' className='footerText'>odo</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div className='foot-col-1' style={{ marginTop: '2rem' }}>
            <div className='setting__input setting__input--big footer__input' style={{ width: '30%' }}>
                <label style={{
                    display: 'flex', flexDirection: 'row'
                }}>
                    <Typography variant='h2' className='highlight'>Help</Typography>
                    <Typography variant='h2' style={{ paddingLeft: '1rem' }} className='foreGroundColor'>&#38; Documentation</Typography>
                </label>
            </div>
            <div className='foot-col-2'>
                <div className='help'>
                    <ul>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector&ssr=false#qna')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <HelpIcon style={{ fontSize: 25 }} />
                                        <Typography variant='h6' className='footerText'>Ask a Question</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/issues')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <BugReportIcon style={{ fontSize: 25 }} />
                                        <Typography variant='h6' className='footerText'>File issues  /  Request a feature</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
                <div className='help'>
                    <ul>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/discussions')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <ChatIcon style={{ fontSize: 25 }} />
                                        <Typography variant='h6' className='footerText'>Start a Discussion</Typography>
                                    </Stack>
                                </div>

                            </a>
                        </li>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/releases')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <RocketLaunchIcon style={{ fontSize: 25 }} />
                                        <Typography variant='h6' className='footerText'>Look out for the Releases</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
                <div className='documentation'>
                    <ul>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <GitHubIcon style={{ fontSize: 25 }} />
                                        <Typography variant='h6' className='footerText'>Star the Repository</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                        <li>
                            <a href='#!' onClick={() => this.openExternalPage('https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <SvgIcon component={MicrosoftLogo} style={{ fontSize: 25 }} inheritViewBox />
                                        <Typography variant='h6' className='footerText'>View in Marketplace</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>

    render(): React.ReactNode {
        const { lastRelease, isChecked } = this.state;
        return <>
            <header className='header__logo'>
                <OpenShiftLogo className='image__logo' />
                <label style={{ display: 'flex', flexDirection: 'row', textAlign: 'center' }}><Typography variant='h1' className='highlight'>OpenShift</Typography><Typography variant='h1' style={{ paddingLeft: '1rem' }} className='foreGroundColor'>Toolkit</Typography></label>
            </header>
            <div className='container' id='con'>
                <div className='content__area'>
                    <section className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <p className='section__header-hint'>
                                    OpenShift Toolkit for VS Code brings the power and convenience of Kubernetes and Red Hat OpenShift to developers. The extension allows developers to create, test, debug and deploy cloud-native applications on OpenShift in simple steps.
                                    With the extension, users can provision a new OpenShift cluster, either using <a>OpenShift Local</a> or using a free(30 days) <a>Red Hat Developer Sandbox</a> instance.
                                </p>
                                <div className='setting__input setting__input--big' style={{ paddingBottom: '0px', borderBottom: '0px', marginBottom: '0px' }}>
                                    <label style={{ display: 'flex', flexDirection: 'row' }}>
                                        <Typography variant='h2' className='foreGroundColor'>Welcome to</Typography>
                                        <Typography variant='h2' style={{ paddingLeft: '1rem' }} className='highlight'>OpenShift</Typography>
                                        <Typography variant='h2' style={{ paddingLeft: '1rem' }} className='foreGroundColor'>Toolkit</Typography>
                                    </label>
                                </div>
                                <div className='section__whatsnew foreGroundColor'>
                                    <a
                                        title='Watch the OpenShift Getting Started video'
                                        href='#' />
                                    <a
                                        className='button button--flat'
                                        title='See Whats New'
                                        onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/releases/' + `${lastRelease}`)}
                                    >See What's New in OpenShift Toolkit</a>
                                    <a
                                        className='button button--flat'
                                        title='Open the Get Started with OpenShift Toolkit walkthrough'
                                        onClick={() => this.openGetStarted('openshiftWalkthrough')}
                                    >Get Started Walkthrough</a>
                                    <a
                                        className='button button--flat'
                                        title='Open the Get Started with OpenShift Toolkit Serverless Functions walkthrough'
                                        onClick={() => this.openGetStarted('serverlessFunctionWalkthrough')}
                                    >OpenShift Serverless Function Walkthrough</a>
                                </div>
                            </div>
                        </div>
                        <div className='section__brand__preview'>
                            <img
                                className='brand'
                                src={OpenShiftBranding}
                                loading='lazy' />
                        </div>
                    </section>
                    <section className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label style={{ display: 'flex', flexDirection: 'row' }}><Typography variant='h2' className='highlight'>Hybrid Cloud</Typography><Typography variant='h2' style={{ paddingLeft: '1rem' }} className='foreGroundColor'> Flexibility</Typography></label>
                                </div>
                                <p className='section__header-hint subtitle-hint'>
                                    Open hybrid cloud is Red Hat's recommended strategy for architecting, developing, and operating a hybrid mix of applications. This extension allows the developers to connect to any OpenShift cluster, be it running locally or on any hybrid cloud. Using the extension, developers can use the streamlined experience for the easy creation of clusters hosted on OpenShift
                                </p>
                                <ul className='foreGroundColor'>
                                    <li style={{ marginTop: '3rem' }}>
                                        <label>Local OpenShift running on the laptop</label>
                                        <a
                                            className='button button--flat list--button'
                                            title='Open CRC'
                                            onClick={(): void => this.openCluster('crc')}
                                        >OpenShift Local</a>
                                    </li>
                                    <li style={{ marginTop: '3rem' }}>
                                        <label>Provision a free tier version of OpenShift Developer Sandbox</label>
                                        <a
                                            className='button button--flat list--button'
                                            title='Open Developer Sandnox'
                                            onClick={(): void => this.openCluster('sandbox')}
                                        >Developer Sandbox</a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className='section__brand__preview'
                            style={{ margin: '0rem' }}>
                            <CloudBranding className='content__image__preview' />
                        </div>
                    </section>
                    <section className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label style={{ display: 'flex', flexDirection: 'row' }}><Typography variant='h2' className='highlight'>Component</Typography><Typography variant='h2' style={{ paddingLeft: '1rem' }} className='foreGroundColor'>Creation Simplicity</Typography></label>
                                </div>
                                <p className='section__header-hint subtitle-hint'>
                                    Developers can quickly get started with application development using devfile based sample code. This allows them to built from the ground up with application development on Kubernetes in mind. Users can create, develop, debug and deploy applications on OpenShift within few clicks.
                                </p>
                                <ul className='foreGroundColor'>
                                    <li style={{ marginTop: '3rem' }}>
                                        <label>
                                            The extension supports Java, NodeJS, Python, .NET, Go, Quarkus, etc.
                                            <a
                                                className='button button--flat list--button'
                                                title='Component Registry View'
                                                onClick={this.openDevfileRegistry}
                                                style={{ marginLeft: '1rem' }}
                                            >Registry View</a>
                                        </label>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className='section__brand__preview'
                            style={{ margin: '0rem' }}>
                            <img className='content__image__preview' src={ComponentBranding} />
                        </div>
                    </section>
                    <section className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label style={{ display: 'flex', flexDirection: 'row' }}><Typography variant='h2' className='highlight'>Push</Typography><Typography variant='h2' style={{ paddingLeft: '1rem' }} className='foreGroundColor'>code fast and debug on remote</Typography></label>
                                </div>
                                <p className='section__header-hint subtitle-hint'>
                                    Developers can quickly check out the code, make changes and do fast deployment on the remote cluster. Once deployed, they can Debug the changes directly in the remote environment. There is a separate view for applications running in Debug Mode.
                                </p>
                            </div>
                        </div>
                        <div className='section__brand__preview'
                            style={{ margin: '0rem' }}>
                            <img className='content__image__preview' src={OpenShhiftLocal} />
                        </div>
                    </section>
                    <Stack direction='row' width='100%' alignItems='stretch' justifyContent='center' gap='1em 2em' margin='1em' padding='1em' flexWrap='wrap'>
                        <Stack alignSelf='stretch' flexShrink='1' marginY={1}>
                            <Box position='sticky' top='calc(50vh - 37.5px)'>
                                <Typography variant='h2' className='highlight' textAlign='right'>OpenShift extension</Typography>
                            </Box>
                        </Stack>
                        <Stack direction='column' width='max(50%, 500px)' gap='1em'>
                            <div>
                                <p>Allows developers to easily <b>create, deploy and live debug</b> container applications running on OpenShift &#38; Kubernetes. Thus enhancing the development inner loop workflow through One-click actions right from IDE.</p>
                            </div>
                            <div>
                                <p>Allows developers to <b>Push code fast and often.</b> Spend less time maintaining your deployment infrastructure and more time coding. Immediately have your application running each time you compile.</p>
                            </div>
                            <div>
                                <p><b>Import your code from git</b> and deploy on OpenShift using recommended devfile.</p>
                            </div>
                            <div>
                                <p>Allows to browse the catalog and discover <b>Helm Charts</b> and install them on the connected cluster.</p>
                            </div>
                            <div>
                                <p>Allows to connect &#38; <b>provision free OpenShift cluster</b> from IDE, using a guided workflow. This workflow allows you to either Run OpenShift locally or provision a free 30 days Developer Sandbox.</p>
                            </div>
                            <div>
                                <p>Allows Monitoring through <b>view and stream logs</b> from your deployments, pods and containers for Kubernetes resources, with One Click from IDE.
                                </p>
                            </div>
                        </Stack>
                    </Stack>
                </div>
                {this.footer}
            </div>
            <div className='header__logo'>
                <FormControlLabel control={<Checkbox checked={isChecked} onChange={this.updateShowWelcomePageConfig} sx={{ color: 'var(--vscode-foreground)', '&.Mui-checked': { color: 'var(--vscode-foreground)' } }} />}
                    label={<Typography variant='h3' style={{ fontSize: 12 }}>Show welcome page when using OpenShift Toolkit extension</Typography>} />
            </div>
            <ScrollToTop smooth style={{ background: '#EE0000' }} color='#FFFFFF' />
        </>;
    }
}
