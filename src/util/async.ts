/**
 * Copyright (c) Microsoft Corporation
 * Licensed under the MIT License. See LICENSE file in the project root for license information.
 * Taken from https://www.github.com/microsoft/vscode/src/vs/common/async.ts
 */

export function isThenable<T>(candidate: any): candidate is Thenable<T> {
    return candidate && typeof (<Thenable<any>>candidate).then === 'function';
}

export function wait(timeout: number = 2500): Promise<void> {
	return new Promise((res) => setTimeout(res, timeout));
}

export interface ITask<T> {
	(): T;
}

// export interface IDisposable {
// 	dispose(): void;
// }

export class Delayer<T> {

	private timeout: any;
	private completionPromise: Promise<any> | null;
	private doResolve: ((value?: any | Promise<any>) => void) | null;
	private doReject: (err: any) => void;
	private task: ITask<T | Promise<T>> | null;

	constructor(public defaultDelay: number) {
		this.timeout = null;
		this.completionPromise = null;
		this.doResolve = null;
		this.doReject;
		this.task = null;
	}

	trigger(task: ITask<T | Promise<T>>, delay: number = this.defaultDelay): Promise<T> {
		this.task = task;
		this.cancelTimeout();

		if (!this.completionPromise) {
			this.completionPromise = new Promise((c, e) => {
				this.doResolve = c;
				this.doReject = e;
			}).then(() => {
				this.completionPromise = null;
				this.doResolve = null;
				const task = this.task!;
				this.task = null;

				return task();
			});
		}

		this.timeout = setTimeout(() => {
			this.timeout = null;
			this.doResolve!(null);
		}, delay);

		return this.completionPromise;
	}

	// isTriggered(): boolean {
	// 	return this.timeout !== null;
	// }

	// cancel(): void {
	// 	this.cancelTimeout();

	// 	if (this.completionPromise) {
	// 		this.doReject(Error('Canceled'));
	// 		this.completionPromise = null;
	// 	}
	// }

	private cancelTimeout(): void {
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
	}

	// dispose(): void {
	// 	this.cancelTimeout();
	// }
}