
function acquireVsCodeApi() {
    return {
        // stub requests from web view here
        postMessage: function (message) {
            if (message.action === 'sandboxPageCheckAuthSession') {
                setTimeout(function() {
                    window.postMessage({ action: 'sandboxPageLoginRequired'}, '*')
                },1000);
            }
            if (message.action === 'sandboxPageLoginRequest') {
                window.postMessage({ action: 'sandboxPageDetectStatus'}, '*');
                setTimeout(function() {
                    window.postMessage({ action: 'sandboxRequestVerificationCode'}, '*')
                },3000);
            }
            if (message.action === 'sandboxRequestVerificationCode') {
                window.postMessage({ action: 'sandboxEnterVerificationCode'}, '*');
            }
            if (message.action === 'sandboxCheckVerificationCode') {
                window.postMessage({ action: 'sandboxWaitingForApproval'});
                setTimeout(function() {
                    window.postMessage({ action: 'sandboxWaitingForProvision'}, '*')
                    setTimeout(function() {
                        window.postMessage({ action: 'sandboxProvisioned'}, '*')
                    },3000);
                },3000);
            }
        }
    }
}