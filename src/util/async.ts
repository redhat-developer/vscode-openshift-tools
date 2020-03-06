/**
 * Copyright (c) Microsoft Corporation
 * Licensed under the MIT License. See LICENSE file in the project root for license information.
 * Taken from https://www.github.com/microsoft/vscode/src/vs/common/async.ts
 * */

/* eslint-disable header/header */

export function isThenable<T>(candidate: any): candidate is Thenable<T> {
    return candidate && typeof (candidate as Thenable<any>).then === 'function';
}

export async function wait(timeout = 2500): Promise<void> {
    return new Promise((res) => setTimeout(res, timeout));
}

export interface Task<T> {
    (): T;
}

export class Delayer<T> {
    private timeout: any;

    private completionPromise: Promise<any> | null;

    private doResolve: ((value?: any | Promise<any>) => void) | null;

    private task: Task<T | Promise<T>> | null;

    constructor(public defaultDelay: number) {
        this.timeout = null;
        this.completionPromise = null;
        this.doResolve = null;
        this.task = null;
    }

    trigger(task: Task<T | Promise<T>>, delay: number = this.defaultDelay): Promise<T> {
        this.task = task;
        this.cancelTimeout();

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        if (!this.completionPromise) {
            this.completionPromise = new Promise((c, e) => {
                this.doResolve = c;
            }).then(() => {
                this.completionPromise = null;
                this.doResolve = null;
                // eslint-disable-next-line no-shadow
                const { task } = this;
                this.task = null;

                return task();
            });
        }

        this.timeout = setTimeout(() => {
            this.timeout = null;
            this.doResolve(null);
        }, delay);

        return this.completionPromise;
    }

    private cancelTimeout(): void {
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
}
