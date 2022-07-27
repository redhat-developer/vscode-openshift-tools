/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import { VSCodeMessage } from './vsCodeMessage';
import './welcome.scss';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export class Welcome extends React.Component<DefaultProps, {
    imageVal: number
}> {
    textContentRef: React.RefObject<HTMLDivElement>;
    cloundContentRef: React.RefObject<HTMLElement>;
    componentContentRef: React.RefObject<HTMLElement>;
    devfileContentRef: React.RefObject<HTMLElement>;

    constructor(props) {
        super(props);
        this.textContentRef = React.createRef();
        this.cloundContentRef = React.createRef();
        this.componentContentRef = React.createRef();
        this.devfileContentRef = React.createRef();
        this.state = {
            imageVal: 1
        }
    }

    componentDidMount() {
        window.addEventListener("scroll", this.handleScroll);
    }

    componentWillUnmount() {
        window.removeEventListener("scroll", this.handleScroll);
    }

    handleScroll = event => {
        const { pageYOffset } = window;
        console.log('pageYOffset:::', pageYOffset);
        console.log('cloundContentRef:::', this.cloundContentRef.current.offsetTop);
        console.log('componentContentRef:::', this.componentContentRef.current.offsetTop);
        console.log('devfileContentRef:::', this.devfileContentRef.current.offsetTop);
        if (pageYOffset < this.componentContentRef.current.offsetTop) {
            this.setState({
                imageVal: 1
            });
        } else if (pageYOffset >= this.componentContentRef.current.offsetTop
            && pageYOffset < this.devfileContentRef.current.offsetTop) {
            this.setState({
                imageVal: 2
            });
        } else if (pageYOffset >= this.devfileContentRef.current.offsetTop) {
            this.setState({
                imageVal: 3
            });
        } else {
            this.setState({
                imageVal: 1
            });
        }
    };

    openGetStarted = (): void => {
        VSCodeMessage.postMessage({
            'action': 'callGetStartedPage'
        });
        return;
    }

    openReleaseNotes = (): void => {
        VSCodeMessage.postMessage({
            'action': 'openReleaseNotes'
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

    render(): React.ReactNode {
        const { imageVal } = this.state;
        return <div className='container'>
            <header>
                <div className='header__logo'>
                    <img className='image__logo' src={require('../../../../images/title/logo.svg').default} />
                    <div>
                        <h1 className='header__title'>OpenShift Connector</h1>
                    </div>
                </div>
            </header>

            <div className='content__area'>
                <section id='current-line' className='section--settings'>
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
                            onClick={this.openReleaseNotes}
                        >See What's New in OpenShift Connector</a>
                        <a
                            className='button button--flat'
                            title='Open the Get Started with OpenShift Connector walkthrough'
                            onClick={this.openGetStarted}
                        >Get Started Walkthrough</a>
                    </div>
                </section>
                <div className='mainContent' id='innerContent'>
                    <div className='textContent' ref={this.textContentRef}>
                        <section id='current-line' className='conent--section--settings' ref={this.cloundContentRef}>
                            <div className='section__content'>
                                <div className='section__header'>
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
                            </div>
                        </section>
                        <section id='code-lens' className='conent--section--settings' ref={this.componentContentRef}>
                            <div className='section__content'>
                                <div className='section__header'>
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
                            </div>
                        </section>

                        <section id='status-bar' className='conent--section--settings' ref={this.devfileContentRef}>
                            <div className='section__content'>
                                <div className='section__header'>
                                    <div className='setting__input setting__input--big'>
                                        <label>Push code fast and debug on remote</label>
                                    </div>
                                    <p className='section__header-hint'>
                                        Developers can quickly check out the code, make changes and do fast deployment on the remote cluster. Once deployed, they can Debug the changes directly in the remote environment. There is a separate view for applications running in Debug Mode.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div className='imageContent'>
                        {
                            imageVal === 1 ? <img className='content__image__preview' src={require('../../../../images/welcome/cloud.svg').default} />
                                : imageVal === 2 ? <img className='content__image__preview' src={require('../../../../images/welcome/component.svg').default} />
                                    : <img className='content__image__preview' src={require('../../../../images/welcome/devfile.svg').default} />
                        }
                    </div>
                </div>
            </div>
        </div>;
    }
}
