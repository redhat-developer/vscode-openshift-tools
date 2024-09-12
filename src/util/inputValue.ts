/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import * as path from 'path';
import { env, InputBox, QuickInputButton, QuickInputButtons, ThemeIcon, Uri, window } from 'vscode';

export class quickBtn implements QuickInputButton {
    constructor(public iconPath:  Uri | { light: Uri; dark: Uri } | ThemeIcon, public tooltip: string) { }
}

/*
    * Shows a Input Field to type in a username. Returns either:
    * - username string, or
    * - `null` in case of user cancelled (pressed `ESC`), or
    * - `undefined` if user pressed `Back` button
    * @param prompt A prompt text to be shown
    * @param initialValue an initial value
    * @param password a boolean indicating if the chars are to be hidden (i.e. a password is to be typed in)
    * @param validate a callback function to be invoked to validate value
    * @param placeHolder (optional) A place holder text to be shown
    * @param abortController if provided, allows cancelling the operation
    * @returns string contaning user name or null if cancelled or undefined if Back is pressed
    */
export function inputValue(prompt: string, initialValue: string, password: boolean, validate, placeHolder?: string,
        abortController?: AbortController): Promise<string | null | undefined> {
    return new Promise<string | null | undefined>((resolve, reject) => {
        const input: InputBox = window.createInputBox();
        input.value = initialValue;
        input.prompt = prompt;
        input.password = password;
        if (placeHolder) input.placeholder = placeHolder;
        const enterBtn = new quickBtn(new ThemeIcon('check'), 'Enter');
        const cancelBtn = new quickBtn(new ThemeIcon('close'), 'Cancel');
        const pasteBtn = new quickBtn({
                light: Uri.file(path.resolve(__dirname, '../../../images/paste-light.svg')),
                dark: Uri.file(path.resolve(__dirname, '../../../images/paste-dark.svg'))
            },
            'Paste from Clipboard');
        const hideBtn = new quickBtn(new ThemeIcon('eye'), 'Hide value');
        const showBtn = new quickBtn(new ThemeIcon('eye-closed'), 'Show value');
        let isHidden = password;
        const updateButtons = (() => {
            const buttons = [];
            if (password) {
                buttons.push(isHidden ? showBtn : hideBtn);
            }
            buttons.push(pasteBtn, QuickInputButtons.Back, enterBtn, cancelBtn);
            input.buttons = buttons;
        });
        updateButtons();
        const validationMessage: string = validate(input.value? input.value : '');
        const resolveAndClose = ((result) => {
            input.dispose();
            resolve(result);
        });
        const pasteFromClipboard = (async () => {
            try {
                const clipboard = (await env.clipboard.readText()).trim();
                if (clipboard.length > 0) {
                    input.value = clipboard;
                    input.validationMessage = validate(clipboard);
                }
            } catch {
                // Do nothing
            }
        });
        input.ignoreFocusOut = true;
        if (validationMessage) {
            input.validationMessage = validationMessage;
        }
        const acceptInput = async () => {
            const value = input.value.trim();
            input.enabled = false;
            input.busy = true;
            if (!(await validate(value))) {
                input.hide();
                resolve(value);
            }
            input.enabled = true;
            input.busy = false;
        };
        input.onDidAccept(acceptInput);
        input.onDidChangeValue(async text => {
            const current = validate(text.trim());
            const validating = current;
            const validationMessage = await current;
            if (current === validating) {
                input.validationMessage = validationMessage;
            }
        });
        input.onDidHide(() => {
            input.dispose();
            resolve(null);
        })
        input.onDidTriggerButton(async (event) => {
            if (event === QuickInputButtons.Back) resolveAndClose(undefined);
            else if (event === showBtn) {
                input.password = isHidden = !isHidden;
                updateButtons();
            } else if (event === hideBtn) {
                input.password = isHidden = !isHidden;
                updateButtons();
            } else if (event === pasteBtn) await pasteFromClipboard();
            else if (event === cancelBtn) resolveAndClose(null);
            else if (event === enterBtn) await acceptInput();
        });
        if (abortController) {
            abortController.signal.addEventListener('abort', (ev) => resolveAndClose(null));
        }
        input.show();
    });
}
