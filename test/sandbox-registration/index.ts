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

app.route('/api/v1/signup')
    .get((req, res) => {
        if (signupStatus) {
            // eslint-disable-next-line no-console
            console.log('Check signup status');
            res.json(signupStatus);
        } else {
            res.sendStatus(404);
        }
    })
    .put(function(req, res) {
        // eslint-disable-next-line no-console
        console.log('Signing up for sandbox');
        // TODO: Fill up the URLs
        signupStatus = {
            apiEndpoint: '',
            cheDashboardURL: '',
            clusterName: '',
            company: '',
            compliantUsername: '',
            consoleUrl: '',
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
        res.sendStatus(200);
    });
    app.route('/api/v1/signup/verification/*').get(function(req, res) {
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
