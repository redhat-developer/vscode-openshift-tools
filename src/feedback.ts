/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { Disposable } from 'vscode';
import { vsCommand } from './vscommand';
import FeedbackLoader from './webview/feedback/feedbackLoader';

export class Feedback implements Disposable {
    private static instance: Feedback;

    public static getInstance(): Feedback {
        if (!Feedback.instance) {
            Feedback.instance = new Feedback();
        }
        return Feedback.instance;
    }

    dispose() { }

    @vsCommand('openshift.show.feedback')
    static async openFeedbackWindow(): Promise<void> {
        await FeedbackLoader.loadView('Share Feedback');
    }

}
