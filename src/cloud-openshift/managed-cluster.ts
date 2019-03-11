import { TreeItem, ProviderResult} from 'vscode';
import { Cluster } from './uhc';
import * as path from 'path';

export class ManagedClusterNode extends TreeItem{
  static toManagedClusterNode(clusters: Cluster[]): ManagedClusterNode[] {
    return  clusters.map((item) => {
      const node = new ManagedClusterNode(item.display_name);
      node.element = item;
      node.iconFile = 'cluster.png';
      node.contextValue = 'uhc.cluster';
      return node;
    } );
  }

  static notLoggedInNode( ): ManagedClusterNode {
    const node  = new ManagedClusterNode('Login to work with your clusters');
    node.contextValue= 'uhc.notloggedin';
    node.iconFile = 'cluster-down.png';
    node.command = {
      command: 'uhc.login',
      title: ''
    };
    return node;
  }

  private element: Cluster;
  private iconFile: string

  get id () {
    return this.element && this.element.id;
  }

  get tooltip () {
    return this.element && `Cluster state: ${this.element.state}`;
  }

  get iconPath () {
    return this.element && path.join(__dirname, '..', '..', '..', `images/${this.iconFile}`);
  }

  getChildren(element?: ManagedClusterNode): ProviderResult<ManagedClusterNode[]> {
    return null;
  }

  getParent(): ManagedClusterNode {
    return null;
  }
}
