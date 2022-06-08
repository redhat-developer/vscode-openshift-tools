export * from './customObjectsApi';
import { CustomObjectsApi } from './customObjectsApi';
export * from './projectOpenshiftIoApi';
import { ProjectOpenshiftIoApi } from './projectOpenshiftIoApi';
export * from './projectOpenshiftIoV1Api';
import { ProjectOpenshiftIoV1Api } from './projectOpenshiftIoV1Api';
import * as http from 'http';

export class HttpError extends Error {
    constructor (public response: http.IncomingMessage, public body: any, public statusCode?: number) {
        super('HTTP request failed');
        this.name = 'HttpError';
    }
}

export { RequestFile } from '../model/models';

export const APIS = [CustomObjectsApi, ProjectOpenshiftIoApi, ProjectOpenshiftIoV1Api];
