#!/usr/bin/env groovy

node('rhel7'){
	stage('Checkout repo') {
		deleteDir()
		git url: 'https://github.com/redhat-developer/vscode-openshift-tools.git',
			branch: "${BRANCH}"
	}

	stage('Install requirements') {
		def nodeHome = tool 'nodejs-8.11.1'
		env.PATH="${env.PATH}:${nodeHome}/bin"
		sh "npm install -g typescript vsce"
	}

	stage('Build') {
		sh "npm install"
		sh "npm run vscode:prepublish"
	}

	withEnv(['JUNIT_REPORT_PATH=report.xml']) {
        stage('Test') {
    		wrap([$class: 'Xvnc']) {
    			sh "npm test"
    			junit 'report.xml'
    		}
        }
	}

	stage('Package') {
        def packageJson = readJSON file: 'package.json'
        packageJson.extensionDependencies = ["ms-kubernetes-tools.vscode-kubernetes-tools"]
        writeJSON file: 'package.json', json: packageJson, pretty: 4
        sh "vsce package -o openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.vsix"
		def findVsix = findFiles(glob: '**.vsix')
		sh "sha256sum ${findVsix[0].path} > openshift-connector-${packageJson.version}-${env.BUILD_NUMBER}.vsix.sha256"
	}

	if(params.UPLOAD_LOCATION) {
		stage('Snapshot') {
			def filesToPush = findFiles(glob: '**.vsix*')
			for (int i = 0; i < filesToPush.size(); i++) {
				sh "rsync -Pzrlt --rsh=ssh --protocol=28 ${filesToPush[i].path} ${UPLOAD_LOCATION}/stable/vscode-openshift-tools/"
				if (filesToPush[i].path.endsWith('vsix')){
					stash name:'vsix', includes:filesToPush[i].path
				}
				if (filesToPush[i].path.endsWith('sha256')) {
					stash name:'vsix.256Sum', includes:256SumFilesToPush[i].path
				}
			}
		}
    }

	if(publishToMarketPlace.equals('true')){
		timeout(time:5, unit:'DAYS') {
			input message:'Approve deployment?', submitter: 'msuman,degolovi'
		}

		stage("Publish to Marketplace") {
            withCredentials([[$class: 'StringBinding', credentialsId: 'vscode_java_marketplace', variable: 'TOKEN']]) {
                def vsix = findFiles(glob: '**.vsix')
                sh 'vsce publish -p ${TOKEN} --packagePath' + " ${vsix[0].path}"
            }
            archive includes:"**.vsix"

            stage "Promote the build to stable"
            def vsix = findFiles(glob: '**.vsix*')
			for (int i = 0; i < vsix.size(); i++) {
				sh "rsync -Pzrlt --rsh=ssh --protocol=28 ${vsix[i].path} ${UPLOAD_LOCATION}/stable/vscode-openshift-tools/"
			}
        }
	}
}
