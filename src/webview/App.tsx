import * as React from 'react';
import './App.css';
import Card from './components/Card';

class App extends React.Component {
  public render() {
    const cardList = [
      {
        heading: "OpenShift Online",
        headingIntro: "Free professional hosting trial",
        description: "OpenShift® Online is hosted and managed by Red Hat®. Our free starter tier is perfect for individual experimentation.",
        url: "https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift_Online-UX-Standard-RGB.svg",
        urlAlt: "Red Hat OpenShift Online",
        redirectLink: "https://manage.openshift.com/register/confirm",
        buttonText: "Sign up now"
      },
      {
        heading: "cloud.redhat.com",
        headingIntro: "Try in the cloud for free",
        description: "Install, register, and manage OpenShift 4 clusters.",
        url: "https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift_4-A-Standard-RGB.svg",
        urlAlt: "Red Hat OpenShift 4",
        redirectLink: "https://cloud.redhat.com/openshift",
        buttonText: "Free trial"
      },
      {
        heading: "Local Installation",
        headingIntro: "Install VSCode Extension to run OpenShift locally",
        description: "Run instance of minishift/CDK locally and connect to the local cluster.",
        url: "https://www.openshift.com/hubfs/images/logos/osh/Logo-Red_Hat-OpenShift-A-Standard-RGB.svg",
        urlAlt: "Red Hat OpenShift",
        redirectLink: "https://marketplace.visualstudio.com/items?itemName=redhat.vscode-server-connector",
        buttonText: "Install from Marketplace"
      }
    ];

    return (
      <div className="App">
        <div className="row">
          <div className="app-body">
            <div className="ux-band-container">
              <div className="container" style= {{ marginBottom: 30 }}>
                <div className="text-heading">
                  <h1>Try Red Hat OpenShift</h1>
                  <p>Test drive the industry’s leading container application platform in your browser, and see how easy it is to use Kubernetes in your organization today.</p>
                </div>
              </div>

              <div className="row">
                  <Card cardList={cardList}></Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default App;