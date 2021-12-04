
function acquireVsCodeApi() {
    return {
        // stub requests from web view here
        postMessage: function (message) {
            window.alert(message.action);
        }
    }
}