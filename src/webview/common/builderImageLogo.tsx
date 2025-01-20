/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import React from 'react';
import apacheImg from '../../../images/logos/apache.svg';
import dotnetImg from '../../../images/logos/dotnet.svg';
import eapImg from '../../../images/logos/eap.svg';
import goLangImg from '../../../images/logos/golang.svg';
import nginxImg from '../../../images/logos/nginx.svg';
import nodejsImg from '../../../images/logos/nodejs.svg';
import openjdkImg from '../../../images/logos/openjdk.svg';
import perlImg from '../../../images/logos/perl.svg';
import phpImg from '../../../images/logos/php.svg';
import pythonImg from '../../../images/logos/python.svg';
import rubyImg from '../../../images/logos/ruby.svg';

const logos = new Map<string, React.FunctionComponent<React.SVGAttributes<SVGElement>>>()
    .set('icon-dotnet', dotnetImg)
    .set('icon-eap', eapImg)
    .set('icon-go-gopher', goLangImg)
    .set('icon-golang', goLangImg)
    .set('icon-httpd', apacheImg)
    .set('icon-java', openjdkImg)
    .set('icon-nginx', nginxImg)
    .set('icon-nodejs', nodejsImg)
    .set('icon-openjdk', openjdkImg)
    .set('icon-perl', perlImg)
    .set('icon-php', phpImg)
    .set('icon-python', pythonImg)
    .set('icon-rh-openjdk', openjdkImg)
    .set('icon-ruby', rubyImg);

export function getIcons(iconClass?: string) {
    return logos.get(iconClass);
};
