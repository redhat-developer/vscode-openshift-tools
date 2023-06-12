/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { expect } from 'chai';
import * as fs from 'fs-extra';
import { ActivityBar, By, EditorView, InputBox, SideBarView, ViewSection, WebElement, WebView, WelcomeContentButton, WelcomeContentSection, Workbench } from 'vscode-extension-tester';
import { notificationExists } from '../common/conditions';
import { VIEWS } from '../common/constants';
import path = require('path');

export function testImportFromGit() {
    describe('Import From Git', function () {
        let editorView: EditorView;
        let welcome: WelcomeContentSection;
        const tempDir: string = path.join(__dirname, 'temp');

        before(async function () {
            this.timeout(20000);
            const view: SideBarView = await (await (await new ActivityBar().wait(5_000)).getViewControl(VIEWS.openshift)).openView();
            editorView = await ((await new Workbench().wait(5_000)).getEditorView().wait(5_000));
            await new Promise(res => setTimeout(res, 5000));
            await (await new Workbench().openNotificationsCenter()).clearAllNotifications();

            const explorer: ViewSection = await view.getContent().getSection(VIEWS.appExplorer);
            await explorer.expand();
            welcome = await explorer.findWelcomeContent();

            for (const item of [VIEWS.components, VIEWS.compRegistries, VIEWS.debugSessions]) {
                await (await view.getContent().getSection(item)).collapse();
            }

            if (fs.existsSync(tempDir)) {
                fs.removeSync(tempDir);
            }
            fs.mkdirSync(tempDir);
        });

        after('remove temp dir', function () {
            this.timeout(10_000);
            if (fs.existsSync(tempDir)) {
                fs.removeSync(tempDir);
            }
        });

        it('Import project from git', async function () {
            this.timeout(30_000);
            await editorView.closeAllEditors();
            const buttons: WelcomeContentButton[] = await welcome.getButtons();
            let importButton: WelcomeContentButton;
            for (const btn of buttons) {
                const title = await btn.getTitle();
                if (title === 'Import from Git') {
                    importButton = btn;
                    break;
                }
            }
            await importButton.click();
            await editorView.openEditor('Git Import');

            let elements: WebElement[];
            const webview = new WebView();

            await webview.switchToFrame(); // START WEBVIEW CODE

            elements = await webview.findWebElements(By.xpath('//input[@id="bootstrap-input"]'));
            const importTextBox = elements[0];
            await importTextBox.sendKeys('https://github.com/odo-devfiles/springboot-ex');

            elements  = await webview.findWebElements(By.xpath('//button[contains(text(),"Analyze")]'));
            const analyzeButton = elements[0];
            await analyzeButton.click();

            await webview.switchBack(); // END WEBVIEW CODE

            const fileDialog = await InputBox.create();
            await fileDialog.setText(tempDir);
            await fileDialog.confirm();
            await new Promise(res => setTimeout(res, 5000)); // wait for clone operation to complete

            await webview.switchToFrame(); // START WEBVIEW CODE

            elements = await webview.findWebElements(By.xpath('//p[contains(text(),"Here is the recommended devfile")]'));
            expect(elements).length.greaterThan(0);

            elements = await webview.findWebElements(By.xpath('//div[@data-testid = "card-java-springboot"]'));
            expect(elements).length.greaterThan(0);

            elements  = await webview.findWebElements(By.xpath('//button[contains(text(),"Create Component")]'));
            expect(elements).length.greaterThan(0);
            const createButton = elements[0];
            expect(await createButton.isEnabled()).is.true;
            await createButton.click();

            await webview.switchBack(); // END WEBVIEW CODE

            const devfile: string = path.join(tempDir, 'springboot-ex', 'devfile.yaml');
            await notificationExists('Component \'springboot-ex-comp\' successfully created. Perform actions on it from Components View.', editorView.getDriver(), 10_000);
            expect(fs.existsSync(devfile)).is.true;
        });

    });
}
