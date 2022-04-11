/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { CardItem } from "./cardItem";
import React, { forwardRef } from "react";
import { Devfile } from "../commands";

export interface DevFileProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    devFile: Devfile;
    style: any;
}

export const WrapperCardItem: React.ForwardRefExoticComponent<DevFileProps> = forwardRef((props, ref) => <CardItem {...props} />)
