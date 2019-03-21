'use strict';

const url = require('url');
const net = require('net');
const gitclient = require('git-fetch-pack');
const transport = require('git-transport-protocol');

export class Refs {

    static async fetchTag(input: string): Promise<Map<any, any>> {
        return new Promise((resolve, reject) => {
            input = input.replace(/^(?!(?:https|git):\/\/)/, 'https://');

            const tcp = net.connect({
                host: url.parse(input).host,
                port: 9418
            });
            const client = gitclient(input);
            const tags = new Map();

            client.refs.on('data', ref => {

                if (/^refs\/heads/.test(ref.name)) {
                    tags.set(ref.name.split('/')[2].replace(/\^\{\}$/, ''), ref.hash);
                }

                if (/^refs\/tags/.test(ref.name)) {
                    tags.set(ref.name.split('/')[2].replace(/\^\{\}$/, ''), ref.hash);
                }
            });
            client
                .pipe(transport(tcp))
                .on('error', reject)
                .pipe(client)
                .on('error', reject)
                .once('end', () => {
                    resolve(tags);
                });
        });
    }
}
