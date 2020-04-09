/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as React from "react";
import * as ReactDOM from "react-dom";
import Log from './log';

const ll = React.createElement(Log, {url: window.logPath});

ReactDOM.render(
  ll,
  document.getElementById("root"),
);
