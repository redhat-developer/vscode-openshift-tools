/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as React from "react";
import * as ReactDOM from "react-dom";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Log from './log';

ReactDOM.render(
    <Log text={'odo log'} />,
    document.getElementById("root"),
);
