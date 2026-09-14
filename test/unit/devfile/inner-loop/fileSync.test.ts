/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as chai from 'chai';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ChangeBatcher, resolveIgnoreRules } from '../../../../src/devfile/inner-loop/fileSync';

const { expect } = chai;

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

suite('devfile/inner-loop/fileSync.ts', () => {

    suite('resolveIgnoreRules()', () => {
        let rootDir: string;

        setup(async () => {
            rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'filesync-test-'));
        });

        teardown(async () => {
            await fs.rm(rootDir, { recursive: true, force: true });
        });

        test('always ignores .git and .odo, even without a .gitignore', async () => {
            const rules = await resolveIgnoreRules(rootDir);

            expect(rules.ignores('.git')).to.be.true;
            expect(rules.ignores('.git/HEAD')).to.be.true;
            expect(rules.ignores('.odo')).to.be.true;
            expect(rules.ignores('.odo/devstate.json')).to.be.true;
        });

        test('does not ignore ordinary source files when there is no .gitignore', async () => {
            const rules = await resolveIgnoreRules(rootDir);

            expect(rules.ignores('src/index.ts')).to.be.false;
        });

        test('adds patterns from the component root .gitignore', async () => {
            await fs.writeFile(path.join(rootDir, '.gitignore'), 'node_modules\n*.log\ndist/\n');

            const rules = await resolveIgnoreRules(rootDir);

            expect(rules.ignores('node_modules/some-pkg/index.js')).to.be.true;
            expect(rules.ignores('debug.log')).to.be.true;
            expect(rules.ignores('dist/bundle.js')).to.be.true;
            expect(rules.ignores('src/index.ts')).to.be.false;
        });
    });

    suite('ChangeBatcher', () => {
        test('coalesces multiple changes into a single batch after the debounce window', async () => {
            const batches: { changed: string[]; deleted: string[] }[] = [];
            const batcher = new ChangeBatcher((changed, deleted) => batches.push({ changed, deleted }), 20);

            batcher.recordChange('a.txt');
            batcher.recordChange('b.txt');
            batcher.recordDelete('c.txt');

            await wait(60);

            expect(batches).to.have.lengthOf(1);
            expect(batches[0].changed.sort()).to.deep.equal(['a.txt', 'b.txt']);
            expect(batches[0].deleted).to.deep.equal(['c.txt']);
        });

        test('restarts the debounce window on each new event', async () => {
            const batches: { changed: string[]; deleted: string[] }[] = [];
            const batcher = new ChangeBatcher((changed, deleted) => batches.push({ changed, deleted }), 30);

            batcher.recordChange('a.txt');
            await wait(20);
            expect(batches).to.have.lengthOf(0);

            batcher.recordChange('b.txt');
            await wait(20);
            expect(batches).to.have.lengthOf(0);

            await wait(20);
            expect(batches).to.have.lengthOf(1);
            expect(batches[0].changed.sort()).to.deep.equal(['a.txt', 'b.txt']);
        });

        test('the latest event for a path wins when it flips kind within the same window', async () => {
            const batches: { changed: string[]; deleted: string[] }[] = [];
            const batcher = new ChangeBatcher((changed, deleted) => batches.push({ changed, deleted }), 20);

            batcher.recordChange('a.txt');
            batcher.recordDelete('a.txt');

            await wait(60);

            expect(batches).to.have.lengthOf(1);
            expect(batches[0].changed).to.deep.equal([]);
            expect(batches[0].deleted).to.deep.equal(['a.txt']);
        });

        test('emits separate batches across separate debounce windows', async () => {
            const batches: { changed: string[]; deleted: string[] }[] = [];
            const batcher = new ChangeBatcher((changed, deleted) => batches.push({ changed, deleted }), 20);

            batcher.recordChange('a.txt');
            await wait(60);
            batcher.recordChange('b.txt');
            await wait(60);

            expect(batches).to.have.lengthOf(2);
            expect(batches[0].changed).to.deep.equal(['a.txt']);
            expect(batches[1].changed).to.deep.equal(['b.txt']);
        });

        test('dispose() cancels a pending flush without emitting it', async () => {
            const batches: { changed: string[]; deleted: string[] }[] = [];
            const batcher = new ChangeBatcher((changed, deleted) => batches.push({ changed, deleted }), 20);

            batcher.recordChange('a.txt');
            batcher.dispose();

            await wait(60);

            expect(batches).to.have.lengthOf(0);
        });

        test('does not invoke the callback when nothing is pending', async () => {
            const batches: { changed: string[]; deleted: string[] }[] = [];
            const batcher = new ChangeBatcher((changed, deleted) => batches.push({ changed, deleted }), 20);

            batcher.dispose();
            await wait(30);

            expect(batches).to.have.lengthOf(0);
        });
    });
});
