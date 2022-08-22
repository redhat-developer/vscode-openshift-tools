/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { VSCodeMessage } from './vsCodeMessage';
import { Typography } from '@mui/material';
import HelpIcon from '@mui/icons-material/Help';
import ChatIcon from '@mui/icons-material/Chat';
import BugReportIcon from '@mui/icons-material/BugReport';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import GitHubIcon from '@mui/icons-material/GitHub';
import './welcome.scss';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export class Welcome extends React.Component<DefaultProps, {
    imageVal: number,
    checked: boolean
}> {
    textContentRef: React.RefObject<HTMLDivElement>;
    sandboxRef: React.RefObject<HTMLDivElement>;
    componentRef: React.RefObject<HTMLDivElement>;
    remoteRef: React.RefObject<HTMLDivElement>;

    constructor(props) {
        super(props);
        this.textContentRef = React.createRef();
        this.sandboxRef = React.createRef();
        this.componentRef = React.createRef();
        this.remoteRef = React.createRef();
        this.state = {
            imageVal: 1,
            checked: true
        }
    }

    onCheckboxChange = (isChecked: boolean) => {
        this.setState({ checked: isChecked });
        VSCodeMessage.postMessage({
            'action': 'updateShowWelcomePage',
            'param': isChecked
        })
    }

    handleScroll = () => {
        const { scrollTop } = this.textContentRef.current;
        if (scrollTop < 100) {
            this.setState({
                imageVal: 1
            });
            this.sandboxRef.current.style.marginTop = '0px';
            this.componentRef.current.style.marginTop = '170px';
            this.remoteRef.current.style.marginTop = '340px';
            this.sandboxRef.current.style.visibility = 'visible';
            this.componentRef.current.style.visibility = 'visible';
            this.remoteRef.current.style.visibility = 'visible';
        } else if (scrollTop >= 100 && scrollTop < 140) {
            this.setState({
                imageVal: 2
            });
            this.componentRef.current.style.marginTop = '-170px';
            this.remoteRef.current.style.marginTop = '170px';
            this.sandboxRef.current.style.visibility = 'hidden';
            this.componentRef.current.style.visibility = 'visible';
            this.remoteRef.current.style.visibility = 'hidden';
        } else if (scrollTop >= 140) {
            this.setState({
                imageVal: 3
            });
            this.remoteRef.current.style.marginTop = '-400px';
            this.sandboxRef.current.style.visibility = 'hidden';
            this.componentRef.current.style.visibility = 'hidden';
            this.remoteRef.current.style.visibility = 'visible';
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

    footer = (checked: boolean) => <footer id='footer'>
        <div className='foot-col-1'>
            <input type='checkbox' id='showWhenUsingExtension' defaultChecked={checked} onChange={(e) => {
                this.onCheckboxChange(e.target.checked);
            }} />
            <label htmlFor='showWhenUsingExtension'>Show welcome page when OpenShift Connector Extension is activated</label>
        </div>

        <div className='foot-col-2'>
            <h4>Help</h4>
            <ul>
                <li>
                    <a href='#' onClick={() => this.openExternalPage('https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector&ssr=false#qna')}>
                        <Typography variant='subtitle1' className='footerIcons'>
                            <HelpIcon /> Questions
                        </Typography>
                    </a>
                </li>
                <li>
                    <a href='#' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/issues')}>
                        <Typography variant='subtitle1' className='footerIcons'>
                            <BugReportIcon /> Issues
                        </Typography>
                    </a>
                </li>
                <li>
                    <a href='#'>
                        <Typography variant='subtitle1' className='footerIcons'>
                            <ChatIcon />  Slack
                        </Typography>
                    </a>
                </li>
            </ul>
        </div>

        <div className='foot-col-3'>
            <h4>Resources</h4>
            <ul>
                <li>
                    <a href='#' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/releases')}>
                        <Typography variant='subtitle1' className='footerIcons'>
                            <NewReleasesIcon /> What's New
                        </Typography>
                    </a>
                </li>
                <li>
                    <a href='#' onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools')}>
                        <Typography variant='subtitle1' className='footerIcons'>
                            <GitHubIcon /> GitHub
                        </Typography>
                    </a>
                </li>
                <li>
                    <a href='#' onClick={() => this.openExternalPage('https://marketplace.visualstudio.com/items?itemName=redhat.vscode-openshift-connector')}>
                        <Typography variant='subtitle1' className='footerIcons'>
                            Marketplace
                        </Typography>
                    </a>
                </li>
                <li>
                    <a href='#' onClick={() => this.openExternalPage('https://marketplace.visualstudio.com/items/redhat.vscode-openshift-connector/license')}>
                        <Typography variant='subtitle1' className='footerIcons'>
                            License
                        </Typography>
                    </a>
                </li>
            </ul>
        </div>

    </footer>

    render(): React.ReactNode {
        const { imageVal, checked } = this.state;
        return <>
            <header>
                <div className='header__logo'>
                    <img className='image__logo' src={require('../../../../images/title/logo.svg').default} />
                    <div>
                        <h1 className='header__title'>OpenShift Connector</h1>
                    </div>
                </div>
            </header>
            <div className='container' id='con'>
                <div className='content__area'>
                    <section className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label>Component 1</label>
                                    <a
                                        className='link__configure'
                                        title='Jump to more Current Line Blame settings'
                                        href='command:gitlens.showSettingsPage?%22current-line%22'
                                    >
                                        <i className='icon icon__gear'></i>
                                    </a>
                                </div>
                                <p className='section__header-hint'>
                                    description of component 1
                                </p>
                            </div>
                        </div>
                        <div className='section__preview'>
                            <img
                                className='brand'
                                src={require('../../../../images/welcome/OpenShift-Branding-box.png').default}
                                loading='lazy'
                                width={500} />
                        </div>
                    </section>
                    <section id='welcome' className='section--full'>
                        <h2 className='section__title section__title--primary'>
                            Welcome to <span className='highlight'>OpenShift Connector</span>
                        </h2>
                        <div className='section__whatsnew'>
                            <a
                                title='Watch the OpenShift Getting Started video'
                                href='#' />
                            <a
                                className='button button--flat'
                                title='See Whats New'
                                onClick={() => this.openExternalPage('https://github.com/redhat-developer/vscode-openshift-tools/releases')}
                            >See What's New in OpenShift Connector</a>
                            <a
                                className='button button--flat'
                                title='Open the Get Started with OpenShift Connector walkthrough'
                                onClick={this.openGetStarted}
                            >Get Started Walkthrough</a>
                        </div>
                    </section>
                    <section id='current-line' className='conent--section--settings'>
                        <div className='scroll__content' ref={this.textContentRef} onScroll={() => this.handleScroll()}>
                            <div className='section__header' ref={this.sandboxRef}>
                                <div className='setting__input setting__input--big'>
                                    <label>Hybrid Cloud Flexibility</label>
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
                            <div className='section__header' ref={this.componentRef}>
                                <div className='setting__input setting__input--big'>
                                    <label>Component Creation Simplicity</label>
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
                            <div className='section__header' ref={this.remoteRef}>
                                <div className='setting__input setting__input--big'>
                                    <label>Push code fast and debug on remote</label>
                                </div>
                                <p className='section__header-hint'>
                                    Developers can quickly check out the code, make changes and do fast deployment on the remote cluster. Once deployed, they can Debug the changes directly in the remote environment. There is a separate view for applications running in Debug Mode.
                                </p>
                            </div>
                        </div>
                        <div className='section__preview'>
                            {imageVal === 1 ? <img className='content__image__preview' src={require('../../../../images/welcome/cloud.svg').default} />
                                : imageVal === 2 ? <img className='content__image__preview' src={require('../../../../images/welcome/component.svg').default} />
                                    : <img className='content__image__preview' src={require('../../../../images/welcome/devfile.svg').default} />}
                        </div>
                    </section>
                </div>
            </div>
            {this.footer(checked)}
        </>;
    }
}
