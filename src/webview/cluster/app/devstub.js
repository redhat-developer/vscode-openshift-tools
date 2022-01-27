
function acquireVsCodeApi() {
    let loginTimeoutCounter = 0;
    return {
        // stub requests from web view here
        postMessage: function (message) {
            if (message.action === 'sandboxPageCheckAuthSession') {
                setTimeout(function() {
                    window.postMessage({ action: 'sandboxPageLoginRequired'}, '*')
                }, 1000);
            }
            if (message.action === 'sandboxPageLoginRequest') {
                if (loginTimeoutCounter<2) {
                    setTimeout(function() {
                        loginTimeoutCounter++;
                        window.postMessage({ action: 'sandboxPageLoginRequired', errorCode: 'loginTimedOut'}, '*');
                    }, 3000);
                } else {
                    setTimeout(function() {
                        window.postMessage({ action: 'sandboxPageDetectStatus'}, '*');
                        setTimeout(function() {
                            window.postMessage({ action: 'sandboxRequestVerificationCode'}, '*')
                        }, 3000);
                    }, 3000);
                }
            }
            if (message.action === 'sandboxPageDetectStatus') {
                setTimeout(function() {
                    window.postMessage({ action: 'sandboxPageRequestSignup', error: 'loginTimedOut'}, '*');
                }, 3000);
            }
            if (message.action === 'sandboxRequestSignup') {
                setTimeout(function() {
                    window.postMessage({ action: 'sandboxPageRequestVerificationCode'}, '*');
                }, 3000);
            }
            if (message.action === 'sandboxPageRequestVerificationCode') {
                window.postMessage({ action: 'sandboxPageRequestVerificationCode'}, '*');
            }
            if (message.action === 'sandboxRequestVerificationCode') {
                setTimeout(function() {
                    window.postMessage({ action: 'sandboxPageEnterVerificationCode'}, '*');
                }, 3000);
            }
            if (message.action === 'sandboxCheckVerificationCode') {
                setTimeout(function() {
                    window.postMessage({ action: 'sandboxWaitingForApproval'});
                    setTimeout(function() {
                        window.postMessage({ action: 'sandboxWaitingForProvision'}, '*')
                        setTimeout(function() {
                            window.postMessage({ action: 'sandboxProvisioned'}, '*')
                        }, 3000);
                    }, 3000);
                }, 3000);
            }
        }
    }
}