/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { Theme } from "@mui/material/styles";
import { createStyles} from "@mui/styles";

export default (theme: Theme) =>
    createStyles({
        displayedName: {
            margin: '0rem 0.5rem',
            marginBottom: '0rem!important'
        },
        displayedDescription: {
            margin: '0rem 0.5rem',
            marginBottom: '0rem',
            color: '#adabae'
        }
    });
