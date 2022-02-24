#!/usr/bin/env groovy

node('rhel8'){

  def vscodeVersion = ""
  stage('Checkout repo') {
    deleteDir()
    git url: 'https://github.com/redhat-developer/vscode-openshift-tools.git',
      branch: "${BRANCH}"
  }

  def packageJson = readJSON file: 'package.json'

  stage('Install requirements') {
    def nodeHome = tool 'nodejs-16.13.2'
    env.PATH="${env.PATH}:${nodeHome}/bin"
    sh "npm install"
    sh "npm install -g vsce"
  }

  withEnv(['JUNIT_REPORT_PATH=report.xml']) {
    stage('Test') {
      wrap([$class: 'Xvnc']) {
        sh "npm run test:coverage"
        junit 'report.xml'
      }
    }
  }

  stage('Package sources and ovsx package') {
    packageJson.extensionDependencies = ["ms-kubernetes-tools.vscode-kubernetes-tools"]
    writeJSON file: 'package.json', json: packageJson, pretty: 4
    sh 'node ./out/build/update-readme.js'
    sh "vsce package -o openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-ovsx.vsix"
    sh "sha256sum *-ovsx.vsix > openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-ovsx.vsix.sha256"
    sh "npm pack && mv vscode-openshift-connector-${packageJson.version}.tgz openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.tgz"
    sh "sha256sum *.tgz > openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.tgz.sha256"
  }
  
  withEnv(['TARGET=win32']) {
    stage('Package win32-x64') {
      sh "vsce package --target win32-x64 -o openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-win32-x64.vsix"
      sh "sha256sum *-win32-x64.vsix > openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-win32-x64.vsix.sha256"
    }
  }

  withEnv(['TARGET=linux']) {
    stage('Package linux-x64') {
        sh "vsce package --target linux-x64 -o openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-linux-x64.vsix"
        sh "sha256sum *-linux-x64.vsix > openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-linux-x64.vsix.sha256"
    }
  }

  withEnv(['TARGET=darwin']) {
    stage('Package darwin-x64') {
        sh "vsce package --target darwin-x64 -o openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-darwin-x64.vsix"
        sh "sha256sum *-darwin-x64.vsix > openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-darwin-x64.vsix.sha256"
    }
  }

  stage('vsix package smoke test') {
      wrap([$class: 'Xvnc']) {
        sh "node ./out/build/install-vscode.js openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-ovsx.vsix && node ./out/build/run-tests.js vsix-test test/fake-extension/"
      }
  }

  if(params.UPLOAD_LOCATION) {
    stage('Snapshot') {
      def filesToPush = findFiles(glob: '**.vsix')
      sh "rsync -Pzrlt --rsh=ssh --protocol=28 *.vsix* ${UPLOAD_LOCATION}/snapshots/vscode-openshift-tools/"
    }
  }

  if(publishToMarketPlace.equals('true') || publishToOVSX.equals('true')) {
    timeout(time:5, unit:'DAYS') {
      input message:'Approve deployment?', submitter: 'msuman,degolovi'
    }

    if(publishToMarketPlace.equals('true')) {
      stage("Publish to Marketplace") {
        withCredentials([[$class: 'StringBinding', credentialsId: 'vscode_java_marketplace', variable: 'TOKEN']]) {
          sh "vsce publish -p ${TOKEN} --packagePath openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-darwin-x64.vsix"
          sh "vsce publish -p ${TOKEN} --packagePath openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-linux-x64.vsix"
          sh "vsce publish -p ${TOKEN} --packagePath openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-win32-x64.vsix"
        }

        stage "Promote the build to stable"
        sh "rsync -Pzrlt --rsh=ssh --protocol=28 *.vsix* ${UPLOAD_LOCATION}/stable/vscode-openshift-tools/"
        sh "rsync -Pzrlt --rsh=ssh --protocol=28 *.tgz* ${UPLOAD_LOCATION}/stable/vscode-openshift-tools/"
        archive includes:"**.vsix*,**.tgz*"
      }
    }

    if (publishToOVSX.equals('true')) {
      stage("Publish to OVSX") {
        sh "npm install -g ovsx"
        withCredentials([[$class: 'StringBinding', credentialsId: 'open-vsx-access-token', variable: 'OVSX_TOKEN']]) {
          sh "ovsx publish -p ${OVSX_TOKEN} openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}-ovsx.vsix"
        }
      }
    }
  }
}
