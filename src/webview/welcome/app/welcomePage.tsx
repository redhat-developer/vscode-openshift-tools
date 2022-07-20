/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import './welcome.scss';

export interface DefaultProps {
    analytics?: import('@segment/analytics-next').Analytics;
}

export const Welcome: React.FC<DefaultProps> = ({ }) => {
    return (
        <>
            <div className='container'>
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
                                className='image__preview'
                                src={require('../../../../images/welcome/OpenShift-Branding-box1.png').default}
                                loading='lazy'
                                width={500}
                            />
                        </div>
                    </section>
                    <section id='welcome' className='section--full'>
                        <h2 className='section__title section__title--primary'>
                            Welcome to <span className='highlight'>OpenShift Connector</span>
                        </h2>
                        <div className='section__whatsnew'>
                            <a
                                title='Watch the OpenShift Getting Started video'
                                href='#'
                            >
                                <img
                                    src='#{webroot}/media/gitlens-tutorial-banner.webp'
                                    alt='Watch the OpenShift Connector Getting Started video'
                                />
                            </a>
                            <a
                                className='button button--flat'
                                title='See Whats New'
                                href='#'
                            >See What's New in OpenShift Connector</a
                            >
                            <span className='button__subaction'
                            >or read the <a href='#'>release notes</a></span
                            >
                            <a
                                className='button button--flat'
                                title='Open the Get Started with GitLens walkthrough'
                                href='command:gitlens.getStarted'
                            >Get Started Walkthrough</a
                            >
                        </div>
                    </section>

                    <section id='current-line' className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label htmlFor='currentLine.enabled'>Component 2</label>
                                    <a
                                        className='link__configure'
                                        title='Jump to more Current Line Blame settings'
                                        href='command:gitlens.showSettingsPage?%22current-line%22'
                                    >
                                        <i className='icon icon__gear'></i>
                                    </a>
                                </div>
                                <p className='section__header-hint'>
                                    description of component 2
                                </p>
                            </div>
                        </div>
                        <div className='section__preview'>
                            <img className='image__preview' src={require('../../../../images/welcome/cloud.svg').default} />
                        </div>
                    </section>

                    <section id='code-lens' className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label htmlFor='codeLens.enabled'>Component 3</label>
                                    <a
                                        className='link__configure'
                                        title='Jump to more Git CodeLens settings'
                                        href='command:gitlens.showSettingsPage?%22code-lens%22'
                                    >
                                        <i className='icon icon__gear'></i>
                                    </a>
                                </div>
                                <p className='section__header-hint'>
                                    description of component 3
                                </p>
                            </div>
                        </div>
                        <div className='section__preview'>
                            <img className='image__preview' src={require('../../../../images/welcome/devfile.svg').default} />
                        </div>
                    </section>

                    <section id='status-bar' className='section--settings'>
                        <div className='section__content'>
                            <div className='section__header'>
                                <div className='setting__input setting__input--big'>
                                    <label htmlFor='statusBar.enabled'>Component 4</label>
                                    <a
                                        className='link__configure'
                                        title='Jump to more Status Bar Blame settings'
                                        href='command:gitlens.showSettingsPage?%22status-bar%22'
                                    >
                                        <i className='icon icon__gear'></i>
                                    </a>
                                </div>
                                <p className='section__header-hint'>
                                    description of component 4
                                </p>
                            </div>
                        </div>
                        <div className='section__preview'>
                            <img className='image__preview' src={require('../../../../images/welcome/component.svg').default} />
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

