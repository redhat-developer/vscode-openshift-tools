#!/usr/bin/env groovy

node('rhel8'){
  stage('Checkout repo') {
    deleteDir()
    git url: 'https://github.com/redhat-developer/vscode-openshift-tools.git',
      branch: "${BRANCH}"
  }

  stage('Install requirements') {
    def nodeHome = tool 'nodejs-15.14.0'
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

  def packageJson = readJSON file: 'package.json'

  stage('Package') {
    packageJson.extensionDependencies = ["ms-kubernetes-tools.vscode-kubernetes-tools"]
    writeJSON file: 'package.json', json: packageJson, pretty: 4
    sh 'node ./out/build/update-readme.js'
    sh "vsce package -o openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.vsix"
    sh "sha256sum *.vsix > openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.vsix.sha256"
    sh "npm pack && mv vscode-openshift-connector-${packageJson.version}.tgz openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.tgz"
    sh "sha256sum *.tgz > openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.tgz.sha256"
  }

  stage('vsix package smoke test') {
      wrap([$class: 'Xvnc']) {
        sh "node ./out/build/install-vscode.js 1.56.0 && .vscode-test/vscode-linux-x64-1.56.0/VSCode-linux-x64/bin/code --install-extension openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.vsix && node ./out/build/run-tests.js vsix-test test/fake-extension/"
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
          def vsix = findFiles(glob: '**.vsix')
          sh 'vsce publish -p ${TOKEN} --packagePath' + " ${vsix[0].path}"
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
          def vsix = findFiles(glob: '**.vsix')
          sh 'ovsx publish -p ${OVSX_TOKEN}' + " ${vsix[0].path}"
        }
      }
    }
  }
}
