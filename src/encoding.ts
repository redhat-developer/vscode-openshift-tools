/*---------------------------------------------------------------------------------------------
	MIT License

	Copyright (c) 2015 - present Microsoft Corporation

	All rights reserved.

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as jschardet from 'jschardet';

jschardet.Constants.MINIMUM_THRESHOLD = 0.2;

function detectEncodingByBOM(buffer: Buffer): string | null {
	if (!buffer || buffer.length < 2) {
		return null;
	}

	const b0 = buffer.readUInt8(0);
	const b1 = buffer.readUInt8(1);

	// UTF-16 BE
	if (b0 === 0xFE && b1 === 0xFF) {
		return 'utf16be';
	}

	// UTF-16 LE
	if (b0 === 0xFF && b1 === 0xFE) {
		return 'utf16le';
	}

	if (buffer.length < 3) {
		return null;
	}

	const b2 = buffer.readUInt8(2);

	// UTF-8
	if (b0 === 0xEF && b1 === 0xBB && b2 === 0xBF) {
		return 'utf8';
	}

	return null;
}

const IGNORE_ENCODINGS = [
	'ascii',
	'utf-8',
	'utf-16',
	'utf-32'
];

const JSCHARDET_TO_ICONV_ENCODINGS: { [name: string]: string } = {
	'ibm866': 'cp866',
	'big5': 'cp950'
};

export function detectEncoding(buffer: Buffer): string | null {
	let result = detectEncodingByBOM(buffer);

	if (result) {
		return result;
	}

	const detected = jschardet.detect(buffer);

	if (!detected || !detected.encoding) {
		return null;
	}

	const encoding = detected.encoding;

	// Ignore encodings that cannot guess correctly
	// (http://chardet.readthedocs.io/en/latest/supported-encodings.html)
	if (0 <= IGNORE_ENCODINGS.indexOf(encoding.toLowerCase())) {
		return null;
	}

	const normalizedEncodingName = encoding.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
	const mapped = JSCHARDET_TO_ICONV_ENCODINGS[normalizedEncodingName];

	return mapped || normalizedEncodingName;
}
