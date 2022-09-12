/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { VSCodeMessage } from './vsCodeMessage';
import { Icon, Stack, Typography } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import ChatIcon from '@mui/icons-material/Chat';
import BugReportIcon from '@mui/icons-material/BugReport';
import GitHubIcon from '@mui/icons-material/GitHub';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ScrollToTop from 'react-scroll-to-top';
import './welcome.scss';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export class Welcome extends React.Component<DefaultProps, {
    lastRelease: string
}> {
    cloudRef: React.RefObject<HTMLDivElement>;
    componentRef: React.RefObject<HTMLDivElement>;
    devfileRef: React.RefObject<HTMLDivElement>;
    extenContainerRef: React.RefObject<HTMLDivElement>;
    firstDivRef: React.RefObject<HTMLDivElement>;

    constructor(props) {
        super(props);
        this.cloudRef = React.createRef();
        this.componentRef = React.createRef();
        this.devfileRef = React.createRef();
        this.extenContainerRef = React.createRef();
        this.firstDivRef = React.createRef();
        this.state = {
            lastRelease: ''
        }
    }

    componentDidMount(): void {
        VSCodeMessage.onMessage((message) => {
            if (message.data.action === 'getOpenShiftVersion') {
                this.setState({ lastRelease: message.data.param })
            }
        });
        window.addEventListener('scroll', this.handleScroll);
    }

    handleScroll = () => {
        const { pageYOffset } = window;
        console.log('pageYOffset:::', pageYOffset);
        if (pageYOffset > 1000) {
            this.extenContainerRef.current.style.position = 'fixed';
            this.extenContainerRef.current.style.top = 700 / 3 + 'px';
        } else {
            this.extenContainerRef.current.style.position = 'absolute';
            this.extenContainerRef.current.style.top = '0px';
        }
        if (pageYOffset < 550) {
            this.cloudRef.current.style.visibility = 'visible';
            this.cloudRef.current.style.marginTop = '50px';
            this.componentRef.current.style.visibility = 'hidden';
            this.devfileRef.current.style.visibility = 'hidden';
        } else if (pageYOffset >= 550 && pageYOffset < 700) {
            this.cloudRef.current.style.visibility = 'hidden';
            this.componentRef.current.style.visibility = 'visible';
            this.componentRef.current.style.marginTop = '-400px';
            this.devfileRef.current.style.visibility = 'hidden';
        } else if (pageYOffset >= 700) {
            this.cloudRef.current.style.visibility = 'hidden';
            this.componentRef.current.style.visibility = 'hidden';
            this.devfileRef.current.style.visibility = 'visible';
            this.componentRef.current.style.marginTop = '-900px';
        }
    };

    openGetStarted = (): void => {
        VSCodeMessage.postMessage({
            'action': 'callGetStartedPage'
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

    footer = <footer id='footer'>
        <div className='foot-col-1'>
            <div className='setting__input setting__input--big footer__input' style={{ width: '30%' }}>
                <label style={{
                    display: 'flex', flexDirection: 'row'
                }}>
                    <Typography variant='h2' className='highlight'>Help</Typography>
                    <Typography variant='h2' style={{ paddingLeft: '1rem' }}>&#38; Documentation</Typography>
                </label>
            </div>
            <div className='foot-col-2'>
                <div className='help'>
                    <ul>
                        <li>
                            <a href='#' onClick={() => this.openExternalPage('https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector&ssr=false#qna')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <HelpIcon style={{ fontSize: 25 }} />
                                        <Typography variant='body1'>Ask a Question</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                        <li>
                            <a href='#' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/issues')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <BugReportIcon style={{ fontSize: 25 }} />
                                        <Typography variant='body1'>File issues  /  Request a feature</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
                <div className='help'>
                    <ul>
                        <li>
                            <a href='#' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/discussions')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <ChatIcon style={{ fontSize: 25 }} />
                                        <Typography variant='body1'>Start a Discussion</Typography>
                                    </Stack>
                                </div>

                            </a>
                        </li>
                        <li>
                            <a href='#' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/releases')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <RocketLaunchIcon style={{ fontSize: 25 }} />
                                        <Typography variant='body1'>Look out for the Releases</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                    </ul>
                </div>
                <div className='documentation'>
                    <ul>
                        <li>
                            <a href='#' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <GitHubIcon style={{ fontSize: 25 }} />
                                        <Typography variant='body1'>Star the Repository</Typography>
                                    </Stack>
                                </div>
                            </a>
                        </li>
                        <li>
                            <a href='#' onClick={() => this.openExternalPage('https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector')}>
                                <div className='section__header-hint section__footer'>
                                    <Stack direction='row' alignItems='center' gap={1}>
                                        <Icon fontSize='large'>
                                            <img src={require('../../../../images/welcome/microsoft.svg').default} />
                                        </Icon>
                                        <Typography variant='body1'>View in Marketplace</Typography>
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
        const { lastRelease } = this.state;
        return <>
            <header className='header__logo'>
                <img className='image__logo' src={require('../../../../images/title/logo.svg').default} />
                <div className='header__title'>
                    <div className='setting__input setting__input--big' style={{ paddingBottom: '0px', borderBottom: '0px', marginBottom: '0px' }}>
                        <label style={{ display: 'flex', flexDirection: 'row', textAlign: 'center' }}><Typography variant='h1' className='highlight'>OpenShift</Typography><Typography variant='h1' style={{ paddingLeft: '1rem' }}>Connector</Typography></label>
                    </div>
                </div>
            </header>
            <div className='container' id='con'>
                <div className='content__area'>
                    <section className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <p className='section__header-hint'>
                                    OpenShift Connector for VS Code brings the power and convenience of Kubernetes and Red Hat OpenShift to developers. The extension allows developers to create, test, debug and deploy cloud-native applications on OpenShift in simple steps.
                                    With the extension, users can provision a new OpenShift cluster, either using <a>OpenShift Local</a> or using a free(30 days) <a>Red Hat Developer Sandbox</a> instance.
                                </p>
                                <div className='setting__input setting__input--big' style={{ paddingBottom: '0px', borderBottom: '0px', marginBottom: '0px' }}>
                                    <label style={{ display: 'flex', flexDirection: 'row' }}>
                                        <Typography variant='h2'>Welcome to</Typography>
                                        <Typography variant='h2' style={{ paddingLeft: '1rem' }} className='highlight'>OpenShift</Typography>
                                        <Typography variant='h2' style={{ paddingLeft: '1rem' }} >Connector</Typography>
                                    </label>
                                </div>
                                <div className='section__whatsnew'>
                                    <a
                                        title='Watch the OpenShift Getting Started video'
                                        href='#' />
                                    <a
                                        className='button button--flat'
                                        title='See Whats New'
                                        onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/releases/' + `${lastRelease}`)}
                                    >See What's New in OpenShift Connector</a>
                                    <a
                                        className='button button--flat'
                                        title='Open the Get Started with OpenShift Connector walkthrough'
                                        onClick={this.openGetStarted}
                                    >Get Started Walkthrough</a>
                                </div>
                            </div>
                        </div>
                        <div className='section__preview'>
                            <img
                                className='brand'
                                src={require('../../../../images/welcome/OpenShift-Branding-box.png').default}
                                loading='lazy' />
                        </div>
                    </section>
                    <div className='container'>
                        <div className='sticky-section' ref={this.cloudRef}>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label style={{ display: 'flex', flexDirection: 'row' }}><Typography variant='h2' className='highlight'>Hybrid Cloud</Typography><Typography variant='h2' style={{ paddingLeft: '1rem' }}> Flexibility</Typography></label>
                                </div>
                                <p className='section__header-hint'>
                                    Open hybrid cloud is Red Hat's recommended strategy for architecting, developing, and operating a hybrid mix of applications. This extension allows the developers to connect to any OpenShift cluster, be it running locally or on any hybrid cloud. Using the extension, developers can use the streamlined experience for the easy creation of clusters hosted on OpenShift
                                </p>
                                <ul>
                                    <li>
                                        <label>Local OpenShift running on the laptop</label>
                                        <a
                                            className='button button--flat'
                                            title='Open CRC'
                                            onClick={(): void => this.openCluster('crc')}
                                        >OpenShift Local</a>
                                    </li>
                                    <li>
                                        <label>Provision a free tier version of OpenShift Developer Sandbox</label>
                                        <a
                                            className='button button--flat'
                                            title='Open Developer Sandnox'
                                            onClick={(): void => this.openCluster('sandbox')}
                                        >Developer Sandbox</a>
                                    </li>
                                </ul>
                            </div>
                            <div className='section__preview sticky-img'>
                                <img className='content__image__preview' src={require('../../../../images/welcome/cloud.svg').default} />
                            </div>
                        </div>
                        <div className='sticky-section' ref={this.componentRef}>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label style={{ display: 'flex', flexDirection: 'row' }}><Typography variant='h2' className='highlight'>Component</Typography><Typography variant='h2' style={{ paddingLeft: '1rem' }}>Creation Simplicity</Typography></label>
                                </div>
                                <p className='section__header-hint'>
                                    Developers can quickly get started with application development using devfile based sample code. This allows them to built from the ground up with application development on Kubernetes in mind. Users can create, develop, debug and deploy applications on OpenShift within few clicks.
                                </p>
                                <label>
                                    The extension supports Java, NodeJS, Python, .NET, Go, Quarkus, etc.
                                    <a
                                        className='button button--flat'
                                        title='Component Registry View'
                                        onClick={this.openDevfileRegistry}
                                    >Component Registry View</a>
                                </label>
                            </div>
                            <div className='section__preview sticky-img'>
                                <img className='content__image__preview fixMargin' src={require('../../../../images/welcome/component.png').default} />
                            </div>
                        </div>
                        <div className='sticky-section-last' ref={this.devfileRef}>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label style={{ display: 'flex', flexDirection: 'row' }}><Typography variant='h2' className='highlight'>Push</Typography><Typography variant='h2' style={{ paddingLeft: '1rem' }}>code fast and debug on remote</Typography></label>
                                </div>
                                <p className='section__header-hint'>
                                    Developers can quickly check out the code, make changes and do fast deployment on the remote cluster. Once deployed, they can Debug the changes directly in the remote environment. There is a separate view for applications running in Debug Mode.
                                </p>
                            </div>
                            <div className='section__preview sticky-img'>
                                <img className='content__image__preview lastone' src={require('../../../../images/welcome/devfile.png').default} />
                            </div>
                        </div>
                    </div>
                    <div className='extensionContainer'>
                        <div className='extensionContainerLeft'>
                            <div className='setting__input setting__input--big extensionContainerTitle' ref={this.extenContainerRef}>
                                <label style={{ display: 'flex', flexDirection: 'row' }}><Typography variant='h2' className='highlight'>This extension</Typography></label>
                            </div>
                        </div>
                        <div className='extencontainer'>
                            <div className='sticky-section-exten' ref={this.firstDivRef}>
                                <p className='section__header-hint'>a consistent platform running diverse workloads on every infrastructure.</p>
                            </div>
                            <div className='sticky-section-exten'>
                                <p className='section__header-hint'>Allows developers to Push code fast and often. Spend less time maintaining your deployment infrastructure and more time coding. Immediately have your application running each time you compile.</p>
                            </div>
                            <div className='sticky-section-exten'>
                                <p className='section__header-hint'>Allows support for importing devfile templates to set up specific applications quickly. This helps to deploy them all, big and small. Deploy a simple Node.JS application or even a complex Operator-backed service.</p>
                            </div>
                            <div className='sticky-section-exten'>
                                <p className='section__header-hint'>Allows to Run your tests directly on the cluster. Debug and test remote applications deployed directly from your IDE to OpenShift. No more having to exit your IDE to push your application.</p>
                            </div>
                            <div className='sticky-section-exten'>
                                <p className='section__header-hint'>Allows to connect & provision free OpenShift cluster  from IDE, using a guided workflow. This workflow allows you to either Run OpenShift locally or provision a free 30 days Developer Sandbox.</p>
                            </div>
                            <div className='sticky-section-exten'>
                                <p className='section__header-hint'>Allows Monitoring through view and stream logs from your deployments, pods and containers for Kubernetes resources, with One Click from IDE.
</p>
                            </div>
                        </div>
                    </div>
                    {this.footer}
                </div>
            </div>
            <ScrollToTop smooth style={{ background: '#EE0000' }} color='#FFFFFF' />
        </>;
    }
}
