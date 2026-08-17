/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import { ActivityBar, InputBox, SideBarView, VSBrowser, Workbench } from 'vscode-extension-tester';
import { stabilizeComponentsView, waitForItemStable } from './common/conditions';
import { VIEWS } from './common/constants';
import { loadKubeConfigFromBackup } from './common/kubeConfigUtils';
import { checkAboutCommand } from './suite/command-about';
import { testComponentContextMenu } from './suite/componentContextMenu';
import { testComponentCommands } from './suite/componentCommands';
import { checkExtension } from './suite/extension';
import { kubernetesContextTest } from './suite/kubernetesContext';
import { projectTest } from './suite/project';
import { operatorBackedServiceTest } from './suite/operatorBackedService';

import * as sourceMapSupport from 'source-map-support';

sourceMapSupport.install();

describe('Extension public-facing UI tests with Kind cluster', function() {
    const contextFolder = path.join(__dirname, 'context');
    const clusterIsSet = true;
    let view: SideBarView;

    before(async function() {
        await loadKubeConfigFromBackup();
    });

    // Runs first, and only after this describe's tests complete does the next
    // sibling describe below start - safe to check the extension activated
    // before we go anywhere near views the extension itself contributes.
    checkExtension();

    describe('Stabilize cluster explorer', function() {
        before(async function() {
            this.timeout(30_000);

            // This suite launches a fresh VS Code session that has never opened the
            // OpenShift view before, so the Application Explorer needs to actually detect
            // and settle on the (now restored) kubeconfig before any cluster-dependent
            // test runs. Previously this settling happened implicitly, since the shared
            // session had already been idle-open for the ~5 minutes the non-cluster suite
            // took to run beforehand. This only runs after checkExtension()'s tests above
            // have confirmed the extension is actually installed and activated.
            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            await stabilizeComponentsView(() => view.getContent().getSection(VIEWS.appExplorer));
        });

        it('Application Explorer reflects the connected cluster', function() {
            // No-op: the before() hook above did the actual stabilization work.
        });
    });

    checkAboutCommand(clusterIsSet);

    describe('Open nodejs-starter component for cluster tests', function() {
        before(async function() {
            this.timeout(90_000);

            // This suite runs in its own VS Code session, separate from public-ui-test.ts's -
            // extest wipes the whole user-data-dir between the two `extest run-tests`
            // invocations, so nothing carries over from that other session. Component Context
            // Menu/Commands below expect a "nodejs-starter" component to already exist, so copy
            // the vendored fixture (a real, working devfile - not something the wizard needs to
            // create fresh each time) into place and open it as the workspace folder.
            //
            // VSBrowser.openResources() (a `code -r <folder>` CLI call) turned out not to
            // actually open the folder mid-session here - the window title stayed a bare
            // "Visual Studio Code" with no workspace, so the Components tree correctly saw
            // nothing to show. Using the real "File: Open Folder..." command instead - the
            // simple dialog it opens (files.simpleDialog.enable in test/ui/settings.json) is
            // the same automatable InputBox that LocalCodeBasePage.clickSelectFolderButton()
            // already drives successfully for component creation.
            const componentFolder = path.join(contextFolder, 'nodejs-starter');
            fs.copySync(path.join(__dirname, '..', 'fixtures', 'components', 'nodejs-starter'), componentFolder);

            const prompt = await new Workbench().openCommandPrompt();
            await VSBrowser.instance.driver.wait(async () => prompt.isDisplayed(), 5_000);
            await prompt.setText('>File: Open Folder...');
            await prompt.confirm();

            const input = await InputBox.create();
            await input.setText(componentFolder);
            await input.confirm();

            // Opening a folder reloads the whole window - wait for the title to reflect the
            // new workspace before touching any views, since elements from before the reload
            // are no longer valid.
            await VSBrowser.instance.driver.wait(async () => {
                try {
                    const title = await VSBrowser.instance.driver.getTitle();
                    return title.includes('nodejs-starter');
                } catch {
                    return false;
                }
            }, 30_000, 'Window did not reload with the nodejs-starter workspace folder');

            view = await (await new ActivityBar().getViewControl(VIEWS.openshift)).openView();
            const getComponentsSection = () => view.getContent().getSection(VIEWS.components);
            await stabilizeComponentsView(getComponentsSection);

            await waitForItemStable(getComponentsSection, 'nodejs-starter', true, 30_000);
        });

        it('nodejs-starter component is open', function() {
            // No-op: the before() hook above did the actual setup work.
        });
    });

    testComponentContextMenu();
    testComponentCommands(contextFolder);
    projectTest(false)
    kubernetesContextTest(false);
    operatorBackedServiceTest();
});
