/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import threeScaleImg from '../../../images/logos/3scale.svg';
import aerogearImg from '../../../images/logos/aerogear.svg';
import amqImg from '../../../images/logos/amq.svg';
import angularjsImg from '../../../images/logos/angularjs.svg';
import ansibleImg from '../../../images/logos/ansible.svg';
import apacheImg from '../../../images/logos/apache.svg';
import beakerImg from '../../../images/logos/beaker.svg';
import buildIconImg from '../../../images/logos/build-icon.svg';
import camelImg from '../../../images/logos/camel.svg';
import capedwarfImg from '../../../images/logos/capedwarf.svg';
import catalogImg from '../../../images/logos/catalog-icon.svg';
import cassandraImg from '../../../images/logos/cassandra.svg';
import clojureImg from '../../../images/logos/clojure.svg';
import codeigniterImg from '../../../images/logos/codeigniter.svg';
import cordovaImg from '../../../images/logos/cordova.png';
import datagridImg from '../../../images/logos/datagrid.svg';
import datavirtImg from '../../../images/logos/datavirt.svg';
import debianImg from '../../../images/logos/debian.svg';
import decisionserverImg from '../../../images/logos/decisionserver.svg';
import djangoImg from '../../../images/logos/django.svg';
import dotnetImg from '../../../images/logos/dotnet.svg';
import drupalImg from '../../../images/logos/drupal.svg';
import eapImg from '../../../images/logos/eap.svg';
import elasticImg from '../../../images/logos/elastic.svg';
import erlangImg from '../../../images/logos/erlang.svg';
import fedoraImg from '../../../images/logos/fedora.svg';
import freebsdImg from '../../../images/logos/freebsd.svg';
import gitImg from '../../../images/logos/git.svg';
import githubImg from '../../../images/logos/github.svg';
import gitlabImg from '../../../images/logos/gitlab.svg';
import giteaImg from '../../../images/logos/gitea.svg';
import glassfishImg from '../../../images/logos/glassfish.svg';
import goLangImg from '../../../images/logos/golang.svg';
import grailsImg from '../../../images/logos/grails.svg';
import hadoopImg from '../../../images/logos/hadoop.svg';
import haproxyImg from '../../../images/logos/haproxy.svg';
import helmImg from '../../../images/logos/helm.svg';
import infinispanImg from '../../../images/logos/infinispan.svg';
import jbossImg from '../../../images/logos/jboss.svg';
import jenkinsImg from '../../../images/logos/jenkins.svg';
import jettyImg from '../../../images/logos/jetty.svg';
import joomlaImg from '../../../images/logos/joomla.svg';
import jrubyImg from '../../../images/logos/jruby.svg';
import jsImg from '../../../images/logos/js.svg';
import knativeImg from '../../../images/logos/knative.svg';
import serverlessFuncImage from '../../../images/logos/serverlessfx.svg';
import kubevirtImg from '../../../images/logos/kubevirt.svg';
import laravelImg from '../../../images/logos/laravel.svg';
import loadBalancerImg from '../../../images/logos/load-balancer.svg';
import mariadbImg from '../../../images/logos/mariadb.svg';
import mediawikiImg from '../../../images/logos/mediawiki.svg';
import memcachedImg from '../../../images/logos/memcached.svg';
import mongodbImg from '../../../images/logos/mongodb.svg';
import mssqlImg from '../../../images/logos/mssql.svg';
import mysqlDatabaseImg from '../../../images/logos/mysql-database.svg';
import nginxImg from '../../../images/logos/nginx.svg';
import nodejsImg from '../../../images/logos/nodejs.svg';
import openjdkImg from '../../../images/logos/openjdk.svg';
import redhatImg from '../../../images/logos/redhat.svg';
import openlibertyImg from '../../../images/logos/openliberty.svg';
import openshiftImg from '../../../images/logos/openshift.svg';
import openstackImg from '../../../images/logos/openstack.svg';
import otherLinuxImg from '../../../images/logos/other-linux.svg';
import otherUnknownImg from '../../../images/logos/other-unknown.svg';
import perlImg from '../../../images/logos/perl.svg';
import phalconImg from '../../../images/logos/phalcon.svg';
import phpImg from '../../../images/logos/php.svg';
import playImg from '../../../images/logos/play.svg';
import postgresqlImg from '../../../images/logos/postgresql.svg';
import processserverImg from '../../../images/logos/processserver.svg';
import pythonImg from '../../../images/logos/python.svg';
import quarkusImg from '../../../images/logos/quarkus.svg';
import rabbitmqImg from '../../../images/logos/rabbitmq.svg';
import railsImg from '../../../images/logos/rails.svg';
import reactImg from '../../../images/logos/react.svg';
import redisImg from '../../../images/logos/redis.svg';
import rhIntegrationImg from '../../../images/logos/rh-integration.svg';
import rhSpringBoot from '../../../images/logos/rh-spring-boot.svg';
import rhTomcatImg from '../../../images/logos/rh-tomcat.svg';
import rubyImg from '../../../images/logos/ruby.svg';
import rustImg from '../../../images/logos/rust.svg';
import scalaImg from '../../../images/logos/scala.svg';
import shadowmanImg from '../../../images/logos/shadowman.svg';
import springImg from '../../../images/logos/spring.svg';
import springBootImg from '../../../images/logos/spring-boot.svg';
import ssoImg from '../../../images/logos/sso.svg';
import stackoverflowImg from '../../../images/logos/stackoverflow.svg';
import suseImg from '../../../images/logos/suse.svg';
import symfonyImg from '../../../images/logos/symfony.svg';
import tomcatImg from '../../../images/logos/tomcat.svg';
import ubuntuImg from '../../../images/logos/ubuntu.svg';
import vertxImg from '../../../images/logos/vertx.svg';
import wildflyImg from '../../../images/logos/wildfly.svg';
import windowsImg from '../../../images/logos/windows.svg';
import wordpressImg from '../../../images/logos/wordpress.svg';
import xamarinImg from '../../../images/logos/xamarin.svg';
import zendImg from '../../../images/logos/zend.svg';
import operatorImg from '../../../images/logos/operator.svg';

const logos = new Map<string, React.FunctionComponent<React.SVGAttributes<SVGElement>>>()
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

export function getIcons(iconClass?: string) {
    return logos.get(iconClass);
};
