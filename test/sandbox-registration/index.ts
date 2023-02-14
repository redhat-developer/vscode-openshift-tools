/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import express = require('express');

const app = express();
const appApi = express();

app.get('/', function (req, res) {
    res.send('<b>Registartion server mock</b>');
});

appApi.get('/', function (req, res) {
    res.send('<b>API server host mock</b>')
});

let signupStatus;
let signupStatusTimeoutError = false;
let verificationCodeRequestTimeoutError = false;
let validateVerificationCodeRequestTimeoutError = false;

// set SandBox Registration server to http://localhost:300 and timeout to 5000 in settings
// before using this stub server for testing
const LongTimeout = 6000;
const ShortTimeout = 4000;

app.route('/api/v1/signup')
    .get((req, res) => {
        if (signupStatus) {
            // eslint-disable-next-line no-console
            console.log('Check signup status');
            if (signupStatusTimeoutError) {
                setTimeout(() => res.send(signupStatus), ShortTimeout)
            } else {
                signupStatusTimeoutError = true;
                setTimeout(() => res.send(signupStatus), LongTimeout)
            }
        } else {
            res.sendStatus(404);
        }
    })
    .post(function(req, res) {
        // eslint-disable-next-line no-console
        console.log('Signing up for sandbox');
        // TODO: Fill up the URLs
        signupStatus = {
            apiEndpoint: 'http://localhost:3001',
            cheDashboardURL: '',
            clusterName: '',
            company: '',
            compliantUsername: '',
            consoleURL: '',
            familyName: '',
            givenName: '',
            status: {
                ready: false,
                reason: 'PendingApproval',
                verificationRequired: true
            },
            username: ''
        };
        // TODO: Check the correct status from original service
        res.sendStatus(200);
    });
    app.route('/api/v1/signup/verification').put(function(req, res) {
        if (verificationCodeRequestTimeoutError) {
            setTimeout(()=>res.status(200).send(''), ShortTimeout);
        } else {
            verificationCodeRequestTimeoutError = true;
            setTimeout(()=>res.status(200).send(''), LongTimeout);
        }
    });
    app.route('/api/v1/signup/verification/*').get(function(req, res) {
        // eslint-disable-next-line no-console
        if(!validateVerificationCodeRequestTimeoutError) {
            validateVerificationCodeRequestTimeoutError = true;
            // will fail because of timeout
            setTimeout(()=>res.status(200).send(''),LongTimeout);
            return;
        }
        // eslint-disable-next-line no-console
        console.log('Verified return code');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        signupStatus.status.verificationRequired = false;
        setTimeout(function() {
            // switch account from PendingApproval to status provisioning
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            signupStatus.status.reason = '';
            // eslint-disable-next-line no-console
            console.log('Chsnge to provisioning state');
            setTimeout(function() {
                // switch account to status provisioned
                // eslint-disable-next-line no-console
                console.log('Change to provisioned state');
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                signupStatus.status.reason = 'Provisioned';
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                signupStatus.status.ready = true;
            },ShortTimeout);
        },ShortTimeout);
        res.sendStatus(200);
    });
    appApi.route('/.well-known/oauth-authorization-server').get(function(req, res) {
        res.status(200).send({
            token_endpoing: 'http://tosome.where'
        })
    });

// Use a wildcard for a route
// app.get('/the*man', function(req, res) {
// Use regular expressions in routes
// app.get(/bat/, function(req, res) {

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(function(req, res, next) {
    res.status(404).send('Sorry, that route doesn\'t exist.');
});
appApi.use(function(req, res, next) {
    res.status(404).send('Sorry, that route doesn\'t exist.');
});

app.listen(3000, function () {
    // eslint-disable-next-line no-console
    console.log('SandBox Registration Service Mock');
});

appApi.listen(3001, function () {
    // eslint-disable-next-line no-console
    console.log('SandBox API Host Mock');
});
