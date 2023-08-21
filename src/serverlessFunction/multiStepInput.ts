/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable max-classes-per-file */
import { QuickPickItem, window, Disposable, QuickInput, QuickInputButton } from 'vscode';

interface QuickPickParameters<T extends QuickPickItem> {
    title: string;
    items: T[];
    activeItem?: T;
    placeholder: string;
    buttons?: QuickInputButton[];
}

interface InputBoxParameters {
    title: string;
    value?: string;
    prompt: string;
    password: boolean;
    validate: (value: string) => string;
    buttons?: QuickInputButton[];
    placeholder?: string;
    reattemptForLogin?: boolean;
}

class MultiStepInput {
    public current?: QuickInput;

    async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, items, activeItem, placeholder }: P) {
        const disposables: Disposable[] = [];
        try {
            return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve) => {
                const input = window.createQuickPick<T>();
                input.title = title;
                input.placeholder = placeholder;
                input.items = items;
                input.ignoreFocusOut = true;
                if (activeItem) {
                    input.activeItems = [activeItem];
                }
                disposables.push(
                    // eslint-disable-next-line @typescript-eslint/no-shadow
                    input.onDidChangeSelection((items) => {
                        resolve(items[0]);
                        this.current.dispose();
                    }),
                    input.onDidHide(() => {
                        resolve(null);
                    }),
                );
                if (this.current) {
                    this.current.dispose();
                }
                this.current = input;
                this.current.show();
            });
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            disposables.forEach((d) => d.dispose());
        }
    }

    async showInputBox<P extends InputBoxParameters>({
        title,
        value,
        prompt,
        password,
        validate,
        placeholder,
        reattemptForLogin,
    }: P) {
        const disposables: Disposable[] = [];
        try {
            return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve) => {
                const input = window.createInputBox();
                input.title = title;
                input.value = value || '';
                input.prompt = prompt;
                input.password = password;
                input.ignoreFocusOut = true;
                input.placeholder = placeholder || '';
                let validating = validate('');
                if (reattemptForLogin) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    input.validationMessage = 'Incorrect credentials, please try again';
                }
                disposables.push(
                    input.onDidAccept(() => {
                        // eslint-disable-next-line @typescript-eslint/no-shadow
                        const { value } = input;
                        input.enabled = false;
                        input.busy = true;
                        if (!validate(value)) {
                            resolve(value);
                            this.current.dispose();
                        }
                        input.enabled = true;
                        input.busy = false;
                    }),
                    input.onDidChangeValue((text) => {
                        const current = validate(text);
                        validating = current;
                        const validationMessage = current;
                        if (current === validating) {
                            input.validationMessage = validationMessage;
                        }
                    }),
                    input.onDidHide(() => {
                        resolve(null);
                    }),
                );
                if (this.current) {
                    this.current.dispose();
                }
                this.current = input;
                this.current.show();
            });
        } finally {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            disposables.forEach((d) => d.dispose());
        }
    }
}

export const multiStep = new MultiStepInput();
