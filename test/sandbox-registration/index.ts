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
            res.json(signupStatus);
        }
        res.sendStatus(404);
    })
    .put(function(req, res) {
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
    app.route('/api/v1/signup/verification/*').put(function(req, res) {
        signupStatus.status.verificationRequired = false;
        setTimeout(function() {
            // switch account from PendingApproval to status provisioning
            signupStatus.status.reason = '';
        },10000);
        setTimeout(function() {
            // switch account to status provisioned
            signupStatus.status.reason = 'Provisioned';
            signupStatus.status.ready = true;
        },10000);
    });

// Use a wildcard for a route
// app.get('/the*man', function(req, res) {
// Use regular expressions in routes
// app.get(/bat/, function(req, res) {

app.use(function(req, res, next) {
    res.status(404).send('Sorry, that route doesn\'t exist.');
});

app.listen(3000, function () {
    // eslint-disable-next-line no-console
    console.log('SandBox Registration Service Mock');
});
