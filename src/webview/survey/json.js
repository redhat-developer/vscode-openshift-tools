export const json = {
    "pages": [
        {
            "name": "Feedback Page",
            "elements": [
                {
                    "type": "rating",
                    "name": "Satisfaction",
                    "title": "Overall, how satisfied or dissatisfied are you with the extension?",
                    "rateDisplayMode": "smileys",
                    "scaleColorMode": "colored",
                    "minRateDescription": "Extremely dissatisfied",
                    "maxRateDescription": "Extremely satisfied"
                },
                {
                    "type": "comment",
                    "name": "Satisfaction low score reason",
                    "visibleIf": "{Satisfaction} <= 3",
                    "titleLocation": "hidden",
                    "hideNumber": true,
                    "placeholder": "What's the main reason for your score?",
                    "maxLength": 500
                },
                {
                    "type": "rating",
                    "name": "Recommendation",
                    "title": "How likely is it that you would recommend the OpenShift Toolkit extension  to a friend or colleague?",
                    "rateDisplayMode": "smileys",
                    "scaleColorMode": "colored",
                    "minRateDescription": "Not at all!",
                    "maxRateDescription": "Extremely!"
                },
                {
                    "type": "comment",
                    "name": "Recommendation low score reason",
                    "visibleIf": "{Recommendation} <= 3",
                    "titleLocation": "hidden",
                    "hideNumber": true,
                    "placeholder": "What's the main reason for your score?",
                    "maxLength": 500
                },
                {
                    "type": "boolean",
                    "name": "Used-similar-extension",
                    "title": "Have you used similar extension before?"
                },
                {
                    "type": "text",
                    "name": "Similar extension",
                    "visibleIf": "{Used-similar-extension} = true",
                    "titleLocation": "hidden",
                    "hideNumber": true,
                    "placeholder": "Please specify the similar extension..."
                },
                {
                    "type": "text",
                    "name": "Frustrating feature",
                    "title": "What, if anything, do you find frustrating or unappealing about the extension ?"
                },
                {
                    "type": "text",
                    "name": "Missing feature",
                    "title": "What capabilities would you like to see on the extension?"
                },
                {
                    "type": "text",
                    "name": "Best feature",
                    "title": "What do you like best about the extension?"
                }
            ]
        }
    ],
    "showProgressBar": "top",
    "progressBarType": "questions",
    "widthMode": "static",
    "width": "864px",
    "surveyId": "be37f308-5344-4f81-9586-938c4e57f264",
    "surveyPostId": "90238cd2-3de3-430f-b3b4-dc6fc3344e33",
    "surveyShowDataSaving": true
};
