/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as ReactDOM from 'react-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import * as React from 'react';
import { Home } from './home';

ReactDOM.render(
    <Router>
        <Routes>
            <Route path="*" element={<Home />} />
            <Route path="/devfiles/" element={<Home />} />
        </Routes>
    </Router>,
    document.getElementById('root'),
);
