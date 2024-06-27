/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------
import * as _ from 'lodash';

import * as threeScaleImg from '../../images/logos/3scale.svg';
import * as aerogearImg from '../../images/logos/aerogear.svg';
import * as amqImg from '../../images/logos/amq.svg';
import * as angularjsImg from '../../images/logos/angularjs.svg';
import * as ansibleImg from '../../images/logos/ansible.svg';
import * as apacheImg from '../../images/logos/apache.svg';
import * as beakerImg from '../../images/logos/beaker.svg';
import * as buildIconImg from '../../images/logos/build-icon.svg';
import * as camelImg from '../../images/logos/camel.svg';
import * as capedwarfImg from '../../images/logos/capedwarf.svg';
import * as catalogImg from '../../images/logos/catalog-icon.svg';
import * as cassandraImg from '../../images/logos/cassandra.svg';
import * as clojureImg from '../../images/logos/clojure.svg';
import * as codeigniterImg from '../../images/logos/codeigniter.svg';
import * as cordovaImg from '../../images/logos/cordova.png';
import * as datagridImg from '../../images/logos/datagrid.svg';
import * as datavirtImg from '../../images/logos/datavirt.svg';
import * as debianImg from '../../images/logos/debian.svg';
import * as decisionserverImg from '../../images/logos/decisionserver.svg';
import * as djangoImg from '../../images/logos/django.svg';
import * as dotnetImg from '../../images/logos/dotnet.svg';
import * as drupalImg from '../../images/logos/drupal.svg';
import * as eapImg from '../../images/logos/eap.svg';
import * as elasticImg from '../../images/logos/elastic.svg';
import * as erlangImg from '../../images/logos/erlang.svg';
import * as fedoraImg from '../../images/logos/fedora.svg';
import * as freebsdImg from '../../images/logos/freebsd.svg';
import * as gitImg from '../../images/logos/git.svg';
import * as githubImg from '../../images/logos/github.svg';
import * as gitlabImg from '../../images/logos/gitlab.svg';
import * as giteaImg from '../../images/logos/gitea.svg';
import * as glassfishImg from '../../images/logos/glassfish.svg';
import * as goLangImg from '../../images/logos/golang.svg';
import * as grailsImg from '../../images/logos/grails.svg';
import * as hadoopImg from '../../images/logos/hadoop.svg';
import * as haproxyImg from '../../images/logos/haproxy.svg';
import * as helmImg from '../../images/logos/helm.svg';
import * as infinispanImg from '../../images/logos/infinispan.svg';
import * as jbossImg from '../../images/logos/jboss.svg';
import * as jenkinsImg from '../../images/logos/jenkins.svg';
import * as jettyImg from '../../images/logos/jetty.svg';
import * as joomlaImg from '../../images/logos/joomla.svg';
import * as jrubyImg from '../../images/logos/jruby.svg';
import * as jsImg from '../../images/logos/js.svg';
import * as knativeImg from '../../images/logos/knative.svg';
import * as serverlessFuncImage from '../../images/logos/serverlessfx.svg';
import * as kubevirtImg from '../../images/logos/kubevirt.svg';
import * as laravelImg from '../../images/logos/laravel.svg';
import * as loadBalancerImg from '../../images/logos/load-balancer.svg';
import * as mariadbImg from '../../images/logos/mariadb.svg';
import * as mediawikiImg from '../../images/logos/mediawiki.svg';
import * as memcachedImg from '../../images/logos/memcached.svg';
import * as mongodbImg from '../../images/logos/mongodb.svg';
import * as mssqlImg from '../../images/logos/mssql.svg';
import * as mysqlDatabaseImg from '../../images/logos/mysql-database.svg';
import * as nginxImg from '../../images/logos/nginx.svg';
import * as nodejsImg from '../../images/logos/nodejs.svg';
import * as openjdkImg from '../../images/logos/openjdk.svg';
import * as redhatImg from '../../images/logos/redhat.svg';
import * as openlibertyImg from '../../images/logos/openliberty.svg';
import * as openshiftImg from '../../images/logos/openshift.svg';
import * as openstackImg from '../../images/logos/openstack.svg';
import * as otherLinuxImg from '../../images/logos/other-linux.svg';
import * as otherUnknownImg from '../../images/logos/other-unknown.svg';
import * as perlImg from '../../images/logos/perl.svg';
import * as phalconImg from '../../images/logos/phalcon.svg';
import * as phpImg from '../../images/logos/php.svg';
import * as playImg from '../../images/logos/play.svg';
import * as postgresqlImg from '../../images/logos/postgresql.svg';
import * as processserverImg from '../../images/logos/processserver.svg';
import * as pythonImg from '../../images/logos/python.svg';
import * as quarkusImg from '../../images/logos/quarkus.svg';
import * as rabbitmqImg from '../../images/logos/rabbitmq.svg';
import * as railsImg from '../../images/logos/rails.svg';
import * as reactImg from '../../images/logos/react.svg';
import * as redisImg from '../../images/logos/redis.svg';
import * as rhIntegrationImg from '../../images/logos/rh-integration.svg';
import * as rhSpringBoot from '../../images/logos/rh-spring-boot.svg';
import * as rhTomcatImg from '../../images/logos/rh-tomcat.svg';
import * as rubyImg from '../../images/logos/ruby.svg';
import * as rustImg from '../../images/logos/rust.svg';
import * as scalaImg from '../../images/logos/scala.svg';
import * as shadowmanImg from '../../images/logos/shadowman.svg';
import * as springImg from '../../images/logos/spring.svg';
import * as springBootImg from '../../images/logos/spring-boot.svg';
import * as ssoImg from '../../images/logos/sso.svg';
import * as stackoverflowImg from '../../images/logos/stackoverflow.svg';
import * as suseImg from '../../images/logos/suse.svg';
import * as symfonyImg from '../../images/logos/symfony.svg';
import * as tomcatImg from '../../images/logos/tomcat.svg';
import * as ubuntuImg from '../../images/logos/ubuntu.svg';
import * as vertxImg from '../../images/logos/vertx.svg';
import * as wildflyImg from '../../images/logos/wildfly.svg';
import * as windowsImg from '../../images/logos/windows.svg';
import * as wordpressImg from '../../images/logos/wordpress.svg';
import * as xamarinImg from '../../images/logos/xamarin.svg';
import * as zendImg from '../../images/logos/zend.svg';
import * as operatorImg from '../../images/logos/operator.svg';

const logos = new Map<string, unknown>()
    .set('icon-3scale', threeScaleImg)
    .set('icon-aerogear', aerogearImg)
    .set('icon-amq', amqImg)
    .set('icon-angularjs', angularjsImg)
    .set('icon-ansible', ansibleImg)
    .set('icon-apache', apacheImg)
    .set('icon-beaker', beakerImg)
    .set('icon-build', buildIconImg)
    .set('icon-camel', camelImg)
    .set('icon-capedwarf', capedwarfImg)
    .set('icon-cassandra', cassandraImg)
    .set('icon-catalog', catalogImg)
    .set('icon-clojure', clojureImg)
    .set('icon-codeigniter', codeigniterImg)
    .set('icon-cordova', cordovaImg)
    .set('icon-datagrid', datagridImg)
    .set('icon-datavirt', datavirtImg)
    .set('icon-debian', debianImg)
    .set('icon-decisionserver', decisionserverImg)
    .set('icon-django', djangoImg)
    .set('icon-dotnet', dotnetImg)
    .set('icon-drupal', drupalImg)
    .set('icon-eap', eapImg)
    .set('icon-elastic', elasticImg)
    .set('icon-erlang', erlangImg)
    .set('icon-fedora', fedoraImg)
    .set('icon-freebsd', freebsdImg)
    .set('icon-git', gitImg)
    .set('icon-github', githubImg)
    .set('icon-gitlab', gitlabImg)
    .set('icon-gitea', giteaImg)
    .set('icon-glassfish', glassfishImg)
    .set('icon-go-gopher', goLangImg)
    .set('icon-golang', goLangImg)
    .set('icon-grails', grailsImg)
    .set('icon-hadoop', hadoopImg)
    .set('icon-haproxy', haproxyImg)
    .set('icon-helm', helmImg)
    .set('icon-httpd', apacheImg)
    .set('icon-infinispan', infinispanImg)
    .set('icon-java', openjdkImg)
    .set('icon-jboss', jbossImg)
    .set('icon-jenkins', jenkinsImg)
    .set('icon-jetty', jettyImg)
    .set('icon-joomla', joomlaImg)
    .set('icon-jruby', jrubyImg)
    .set('icon-js', jsImg)
    .set('icon-knative', knativeImg)
    .set('icon-kubevirt', kubevirtImg)
    .set('icon-laravel', laravelImg)
    .set('icon-load-balancer', loadBalancerImg)
    .set('icon-mariadb', mariadbImg)
    .set('icon-mediawiki', mediawikiImg)
    .set('icon-memcached', memcachedImg)
    .set('icon-mongodb', mongodbImg)
    .set('icon-mssql', mssqlImg)
    .set('icon-mysql-database', mysqlDatabaseImg)
    .set('icon-nginx', nginxImg)
    .set('icon-nodejs', nodejsImg)
    .set('icon-openjdk', openjdkImg)
    .set('icon-openliberty', openlibertyImg)
    .set('icon-openshift', openshiftImg)
    .set('icon-openstack', openstackImg)
    .set('icon-operator', operatorImg)
    .set('icon-other-linux', otherLinuxImg)
    .set('icon-other-unknown', otherUnknownImg)
    .set('icon-perl', perlImg)
    .set('icon-phalcon', phalconImg)
    .set('icon-php', phpImg)
    .set('icon-play', playImg)
    .set('icon-postgresql', postgresqlImg)
    .set('icon-processserver', processserverImg)
    .set('icon-python', pythonImg)
    .set('icon-quarkus', quarkusImg)
    .set('icon-rabbitmq', rabbitmqImg)
    .set('icon-rails', railsImg)
    .set('icon-react', reactImg)
    .set('icon-redhat', redhatImg) // Use the upstream icon.
    .set('icon-redis', redisImg)
    .set('icon-rh-integration', rhIntegrationImg)
    .set('icon-rh-openjdk', openjdkImg)
    .set('icon-rh-spring-boot', rhSpringBoot)
    .set('icon-rh-tomcat', rhTomcatImg)
    .set('icon-ruby', rubyImg)
    .set('icon-rust', rustImg)
    .set('icon-scala', scalaImg)
    .set('icon-serverless-function', serverlessFuncImage)
    .set('icon-shadowman', shadowmanImg)
    .set('icon-spring', springImg)
    .set('icon-spring-boot', springBootImg)
    .set('icon-sso', ssoImg)
    .set('icon-stackoverflow', stackoverflowImg)
    .set('icon-suse', suseImg)
    .set('icon-symfony', symfonyImg)
    .set('icon-tomcat', tomcatImg)
    .set('icon-ubuntu', ubuntuImg)
    .set('icon-vertx', vertxImg)
    .set('icon-wildfly', wildflyImg)
    .set('icon-windows', windowsImg)
    .set('icon-wordpress', wordpressImg)
    .set('icon-xamarin', xamarinImg)
    .set('icon-zend', zendImg);

export const getIcons = (): { label: string; url: unknown }[] => {
    return Array.from(logos.entries()).map(([iconClass, url]) => ({
        label: iconClass.replace(/^icon-/, ''),
        url,
    }));
};


*/
