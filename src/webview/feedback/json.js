/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/
export const json = {
    'pages': [
        {
            'name': 'Feedback Page',
            'elements': [
                {
                    'type': 'rating',
                    'name': 'Satisfaction',
                    'isRequried': true,
                    'title': 'Overall, how satisfied or dissatisfied are you with the extension?',
                    'autoGenerate': false,
                    'rateCount': 5,
                    'minRateDescription': 'Extremely dissatisfied',
                    'maxRateDescription': 'Extremely satisfied'
                },
                {
                    'type': 'comment',
                    'name': 'Satisfaction low score reason',
                    'visibleIf': '{Satisfaction} <= 3',
                    'titleLocation': 'hidden',
                    'hideNumber': true,
                    'placeholder': 'What\'s the main reason for your score?',
                    'maxLength': 500
                },
                {
                    'type': 'rating',
                    'name': 'Recommendation',
                    'title': 'How likely is it that you would recommend the OpenShift Toolkit extension to a friend or colleague?',
                    'autoGenerate': false,
                    'rateCount': 5,
                    'minRateDescription': 'Not at all!',
                    'maxRateDescription': 'Extremely!'
                },
                {
                    'type': 'comment',
                    'name': 'Recommendation low score reason',
                    'visibleIf': '{Recommendation} <= 3',
                    'titleLocation': 'hidden',
                    'hideNumber': true,
                    'placeholder': 'What\'s the main reason for your score?',
                    'maxLength': 500
                },
                {
                    'type': 'boolean',
                    'name': 'Used-similar-extension',
                    'title': 'Have you used any similar extension for cloud-native development ?'
                },
                {
                    'type': 'text',
                    'name': 'Similar extension',
                    'visibleIf': '{Used-similar-extension} = true',
                    'titleLocation': 'hidden',
                    'hideNumber': true,
                    'placeholder': 'Please mention the similar extension name/URL.'
                },
                {
                    'type': 'text',
                    'name': 'Frustrating feature',
                    'title': 'What, if anything, do you find frustrating or challenging about the extension workflow?'
                },
                {
                    'type': 'text',
                    'name': 'Missing feature',
                    'title': 'What capabilities would you like to see on the extension?'
                },
                {
                    'type': 'text',
                    'name': 'Best feature',
                    'title': 'What do you like best about the extension?'
                },
                {
                    'type': 'text',
                    'name': 'contact',
                    'hideNumber': true,
                    'title': 'Share your contact information if you\'d like us to answer you:',
                    'placeholder': 'Provide email address or leave blank for anonymous feedback'
                },
            ]
        }
    ],
    'showProgressBar': 'top',
    'progressBarType': 'questions',
    'widthMode': 'static',
    'width': '864px'
};
