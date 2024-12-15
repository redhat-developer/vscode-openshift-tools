/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

export async function loadChaiImports(): Promise<{ expect: Chai.ExpectStatic, assert: Chai.AssertStatic }> {
    const chai = await import('chai');
    const sinonChai = await import('sinon-chai');
    chai.use(sinonChai.default);
    const { expect, assert } = chai;
    return { expect, assert };
}
