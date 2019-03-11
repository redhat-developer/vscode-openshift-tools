
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as querystring from 'querystring';

const baseConfig: AxiosRequestConfig = {
  method: 'get',
  baseURL: 'https://api.openshift.com',
  responseType: 'json',
  headers: { }
};

const authConfig: AxiosRequestConfig = {
  method: 'post',
  url: 'https://developers.redhat.com/auth/realms/rhd/protocol/openid-connect/token',
  responseType: 'json',
  headers: {
    ContentType: 'application/x-www-form-urlencoded',
    Accept: 'application/json'
  }
};

export class UHC {
  private authData: any;

  constructor () {
  }

  private isLoggedIn(): boolean {
    return this.authData && this.authData.access_token;
  }

  private notLoggedInError(): Error {
    const error = new Error();
    error.id = 401;
    error.code = 'UHC-401';
    error.reason = 'Not authenticated';
    return error;
  }

  async login(user: string, pass: string): Promise<void> {
    const bodyFormData = {
      grant_type : 'password',
      client_id : 'uhc',
		  username: user,
      password: pass,
      scope : ['openid']
    };
    const config = {...authConfig};
    config.data = querystring.stringify(bodyFormData);
    try {
      const response: AxiosResponse = await axios(config);
      if (response.status === 200) {
        this.authData = response.data;
      }
    } catch (error) {
     Promise.reject(error);
    }

  }

  async getClusters(): Promise<Cluster[]> {
    if (!this.isLoggedIn()) {
      return Promise.reject(this.notLoggedInError());
    }

    let items: Array<Cluster> = [];
    try {
      const clustersConfig = { ...baseConfig };
      clustersConfig.url = '/api/clusters_mgmt/v1/clusters';
      clustersConfig.headers.Authorization = `Bearer ${this.authData.access_token}`;
      const response: AxiosResponse = await axios(clustersConfig);
      if (response.status === 200) {
        items = response.data.items;
      }
    } catch (error) {
      Promise.reject(error);
    }
    return items;
  }

  async getCluster(clusterId: string): Promise<Cluster> {
    if ( !this.isLoggedIn()) {
      return Promise.reject(this.notLoggedInError());
    }
    let cluster: Cluster =  null;
    const config = { ...baseConfig };
    config.url = `/api/clusters_mgmt/v1/clusters/${clusterId}`;
    config.headers.Authorization = `Bearer ${this.authData.access_token}`;
    try {
      const response: AxiosResponse = await axios(config);
      if (response.status === 200) {
        cluster = response.data;
      }
    } catch (error) {
      Promise.reject(error);
    }
    return cluster;
  }

  async getClusterCredentials(clusterId: string): Promise<ClusterCredential> {
    if ( !this.isLoggedIn()) {
      return Promise.reject(this.notLoggedInError());
    }
    const config = { ...baseConfig };
    let credentials: ClusterCredential = null;
    config.url = `/api/clusters_mgmt/v1/clusters/${clusterId}/credentials`;
   try {
     const response: AxiosResponse = await axios(config);
     if ( response.status === 200 ) {
         credentials  = response.data
     }

   } catch (error) {
     return Promise.reject(error);
   }
   return credentials;
  }
}

export class Cluster {
  public id: string;
  public console: ClusterConsole;
  public display_name: string;
  public openshift_version: string;
  public state: string

}

export class ClusterConsole {
  public description: string;
  public url: string;
}

export class ClusterCredential {
  public kubeconfig: string;
}

export class Error {
  public reason: string;
  public code: string;
  public id: number;
}
