import { window, TreeDataProvider, Disposable, Event, TreeItem, ProviderResult, EventEmitter } from "vscode";
import { ManagedClusterNode } from './managed-cluster';
import { UHC } from './uhc';
import * as validator from 'validator';

export class UHCExplorer implements TreeDataProvider<ManagedClusterNode>, Disposable {
  private uhc: UHC = new UHC();
  private onDidChangeTreeDataEmitter: EventEmitter<ManagedClusterNode | undefined> = new EventEmitter<ManagedClusterNode | undefined>();
  readonly onDidChangeTreeData?: Event<ManagedClusterNode | undefined> = this.onDidChangeTreeDataEmitter.event;

  getTreeItem(element: ManagedClusterNode): TreeItem | Thenable<TreeItem> {
    return element;
  }

  getChildren(element?: ManagedClusterNode): ProviderResult<ManagedClusterNode[]> {
    if (element) {
      return element.getChildren();
    }
    else {
      return new Promise(
        async (res) => {
          try {
            res(ManagedClusterNode.toManagedClusterNode(await this.uhc.getClusters()));
          } catch (error) {
            res([ManagedClusterNode.notLoggedInNode()]);
          }
        }
      );
    }
  }

  getParent(element: ManagedClusterNode): ManagedClusterNode {
    return element.getParent();
  }

  dispose() {
    // TODO: dispose connections
  }

  async addClusterToContext(context) {
    const credentials = await this.uhc.getClusterCredentials(context.id);
    //TODO: Add credentials.kubeconfig to current kubeconfig context.
  }

  async login(): Promise<void> {
    const username = await window.showInputBox({
      ignoreFocusOut: true,
      prompt: "Provide Username for cloud.openshift.com",
      validateInput: (value: string) => validator.isEmpty(value) ? 'User name cannot be empty' : undefined
    });
    if (!username) return null;
    const passwd = await window.showInputBox({
      ignoreFocusOut: true,
      password: true,
      prompt: "Provide Password for cloud.openshift.com"
    });
    if (!passwd) return null;
    await this.uhc.login(username, passwd);
    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

}
