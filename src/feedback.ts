/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
import { vsCommand } from './vscommand';
import FeedbackLoader from './webview/feedback/feedbackLoader';

export class Feedback {

    @vsCommand('openshift.show.feedback')
    static async openFeedbackWindow(): Promise<void> {
        await FeedbackLoader.loadView('Share Feedback');
    }

}
