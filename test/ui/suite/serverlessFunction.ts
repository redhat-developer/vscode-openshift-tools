/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as fs from 'fs-extra';
import * as pth from 'path';
import {
    ActivityBar,
    EditorView,
    NotificationType,
    SideBarView,
    ViewSection,
    Workbench,
} from 'vscode-extension-tester';
import { VIEWS } from '../common/constants';
import { collapse } from '../common/overdrives';
import { ServerlessFunctionWebView } from '../common/ui/webview/ServerlessFunctionWebViewEditor';
import { expect } from 'chai';

export function testCreateServerlessFunction(path: string) {
    describe('Serverless Function', function () {
        let view: SideBarView;
        let section: ViewSection;
        const functionName = 'test-function';

        before(async function context() {
            this.timeout(10_000);
            await new EditorView().closeAllEditors();
            fs.ensureDirSync(pth.join(path, 'function'), 0o6777);
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            for (const item of [
                VIEWS.appExplorer,
                VIEWS.compRegistries,
                VIEWS.components,
                VIEWS.debugSessions,
            ]) {
                await collapse(await view.getContent().getSection(item));
            }
            section = await view.getContent().getSection(VIEWS.serverlessFunctions);
            await section.expand();

            const notificationCenter = await new Workbench().openNotificationsCenter();
            const notifications = await notificationCenter.getNotifications(NotificationType.Any);
            if (notifications.length > 0) {
                await notificationCenter.close();
            }
            await new EditorView().closeAllEditors();
        });

        it('Create a new Serverless Function', async function test() {
            this.timeout(20_000);
            await collapse(section);
            await section.expand();
            console.log('a');
            const createButton = await section.getAction('Create Function');
            console.log('b');
            await createButton.click();
            console.log('c');
            await new Promise((res) => {
                setTimeout(res, 3_000);
            });
            console.log('d');

            const serverlessFunctionView = new ServerlessFunctionWebView();
            console.log('e');
            await serverlessFunctionView.initializeEditor();
            console.log('f');
            await serverlessFunctionView.insertFunctionName(functionName);
            console.log('g');
            await serverlessFunctionView.selectBuildImage('docker');
            console.log('h');
            await serverlessFunctionView.selectLanguage('Node');
            console.log('i');
            await serverlessFunctionView.selectTemplate('http');
            console.log('j');
            await serverlessFunctionView.selectFolder(pth.join(path, 'function'));
            console.log('k');
            await serverlessFunctionView.clickCreateButton();
            console.log('l');

            await new Promise((res) => {
                setTimeout(res, 2_000);
            });

            await collapse(section);
            console.log('m');
            await section.expand();
            console.log('n');

            const refreshButton = await section.getAction('Refresh Serverless Function View');
            console.log('o');
            await refreshButton.click();
            console.log('p');

            expect(await section.findItem(functionName)).to.be.not.undefined;
        });
    });
}
