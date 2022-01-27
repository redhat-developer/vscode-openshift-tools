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

app.get('/', function (req, res) {
    res.send('<b>Registartion server mock</b>');
});

let signupStatus;
let signupStatusTimeoutError = false;
let verificationCodeRequestTimeoutError = false;
let validateVerificationCodeRequestTimeoutError = false;

app.route('/api/v1/signup')
    .get((req, res) => {
        if (signupStatus) {
            // eslint-disable-next-line no-console
            console.log('Check signup status');
            if (signupStatusTimeoutError) {
                setTimeout(() => res.send(signupStatus), 5000)
            } else {
                signupStatusTimeoutError = true;
                setTimeout(() => res.send(signupStatus), 20000)
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
            apiEndpoint: '',
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
            setTimeout(()=>res.sendStatus(200), 5000);
        } else {
            verificationCodeRequestTimeoutError = true;
            setTimeout(()=>res.sendStatus(200),120000);
        }
    });
    app.route('/api/v1/signup/verification/*').get(function(req, res) {
        // eslint-disable-next-line no-console
        if(!validateVerificationCodeRequestTimeoutError) {
            validateVerificationCodeRequestTimeoutError = true;
            // will fail because of timeout
            setTimeout(()=>res.sendStatus(200),120000);
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
            },10000);
        },10000);
        res.sendStatus(200);
    });

// Use a wildcard for a route
// app.get('/the*man', function(req, res) {
// Use regular expressions in routes
// app.get(/bat/, function(req, res) {

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(function(req, res, next) {
    res.status(404).send('Sorry, that route doesn\'t exist.');
});

app.listen(3000, function () {
    // eslint-disable-next-line no-console
    console.log('SandBox Registration Service Mock');
});
