import { Odo, OdoImpl, OpenShiftObject } from '../odo';
import { OpenShiftExplorer } from '../explorer';

export abstract class OpenShiftItem {
    protected static readonly odo: Odo = OdoImpl.getInstance();
    protected static readonly explorer: OpenShiftExplorer = OpenShiftExplorer.getInstance();

    static create(context: OpenShiftObject): Promise<String> { return Promise.reject(); }
    static del(context: OpenShiftObject): Promise<String> { return Promise.reject(); }
}