/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import OpenShiftItem from '../../openshift/openshiftItem';

export function validateName(value: string): string | null {
    let validationMessage = OpenShiftItem.emptyName('Required', value.trim());
    if (!validationMessage)
        validationMessage = OpenShiftItem.validateMatches(
            `Only lower case alphabets and numeric characters or '-', start and ends with only alphabets`,
            value,
        );
    if (!validationMessage)
        validationMessage = OpenShiftItem.lengthName('Should be between 2-63 characters', value, 0);
    return validationMessage;
}
