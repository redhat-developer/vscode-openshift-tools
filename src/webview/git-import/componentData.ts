/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export interface ComponentData {
    language: string,
    projectType: string,
    icon: string,
    version?: string
}

export const componentList: ComponentData[] = [
    {
        language: 'dotnet',
        projectType: 'dotnet',
        icon: 'https://github.com/dotnet/brand/raw/main/logo/dotnet-logo.png'
    },
    {
        language: 'typescript',
        projectType: 'angular',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/angular.svg'
    },
    {
        language: 'go',
        projectType: 'go',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/golang.svg'
    },
    {
        language: 'nodejs',
        projectType: 'nodejs',
        icon: 'https://nodejs.org/static/images/logos/nodejs-new-pantone-black.svg'
    },
    {
        language: 'javascript',
        projectType: 'nodejs',
        icon: 'https://nodejs.org/static/images/logos/nodejs-new-pantone-black.svg'
    },
    {
        language: 'python',
        projectType: 'python',
        icon: 'https://nodejs.org/static/images/logos/nodejs-new-pantone-black.svg'
    },
    {
        language: 'java',
        projectType: 'quarkus',
        icon: 'https://design.jboss.org/quarkus/logo/final/SVG/quarkus_icon_rgb_default.svg'
    },
    {
        language: 'java',
        projectType: 'springboot',
        icon: 'https://spring.io/images/projects/spring-edf462fec682b9d48cf628eaf9e19521.svg'
    },
    {
        language: 'java',
        projectType: 'spring',
        icon: 'https://spring.io/images/projects/spring-edf462fec682b9d48cf628eaf9e19521.svg'
    },
    {
        language: 'php',
        projectType: 'laravel',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/laravel.svg'
    },
    {
        language: 'java',
        projectType: 'maven',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/java-maven.jpg'
    },
    {
        language: 'typescript',
        projectType: 'next.js',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/next-js.svg'
    },
    {
        language: 'typescript',
        projectType: 'nuxt.js',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/nuxt-js.svg'
    },
    {
        language: 'java',
        projectType: 'openliberty',
        icon: 'https://raw.githubusercontent.com/OpenLiberty/logos/7fbb132949b9b2589e18c8d5665c1b107028a21d/logomark/svg/OL_logomark.svg'
    },
    {
        language: 'typescript',
        projectType: 'react',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/react.svg'
    },
    {
        language: 'typescript',
        projectType: 'svelte',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/svelte.svg'
    },
    {
        language: 'java',
        projectType: 'vertx',
        icon: 'https://raw.githubusercontent.com/vertx-web-site/vertx-logo/master/vertx-logo.svg'
    },
    {
        language: 'typescript',
        projectType: 'vue',
        icon: 'https://raw.githubusercontent.com/devfile-samples/devfile-stack-icons/main/vue.svg'
    },
    {
        language: 'java',
        projectType: 'websphereliberty',
        icon: 'https://raw.githubusercontent.com/WASdev/logos/main/liberty-was-500-purple.svg'
    },
    {
        language: 'java',
        projectType: 'wildFly',
        icon: 'https://design.jboss.org/wildfly/logo/final/wildfly_logomark.svg'
    }
]
