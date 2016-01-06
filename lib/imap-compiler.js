/* eslint no-console: 0 */

'use strict';

let imapFormalSyntax = require('./imap-formal-syntax');
let PassThrough = require('stream').PassThrough;

/**
 * Compiles an input object into
 */
module.exports = function (response, isLogging) {
    let output = new PassThrough();

    let resp = (response.tag || '') + (response.command ? ' ' + response.command : '');
    let val, lastType;

    let emit = function () {
        if (resp.length) {
            output.write(new Buffer(resp, 'binary'));
        }
    };

    let walk = function (node, callback) {
        if (lastType === 'LITERAL' || (['(', '<', '['].indexOf(resp.substr(-1)) < 0 && resp.length)) {
            resp += ' ';
        }

        if (Array.isArray(node)) {
            lastType = 'LIST';
            resp += '(';

            let pos = 0;
            let next = () => {
                if (pos >= node.length) {
                    resp += ')';
                    return setImmediate(callback);
                }
                walk(node[pos++], next);
            };

            return setImmediate(next);
        }

        if (!node && typeof node !== 'string' && typeof node !== 'number') {
            resp += 'NIL';
            return setImmediate(callback);
        }

        if (typeof node === 'string') {
            if (isLogging && node.length > 20) {
                resp += '"(* ' + node.length + 'B string *)"';
            } else {
                resp += JSON.stringify(node);
            }
            return setImmediate(callback);
        }

        if (typeof node === 'number') {
            resp += Math.round(node) || 0; // Only integers allowed
            return setImmediate(callback);
        }

        lastType = node.type;

        if (isLogging && node.sensitive) {
            resp += '"(* value hidden *)"';
            return setImmediate(callback);
        }

        switch (node.type.toUpperCase()) {
            case 'LITERAL':
                let nval = node.value;
                if (typeof nval === 'number') {
                    nval = nval.toString();
                }
                let len = (nval || '').toString().length;

                if (isLogging) {
                    resp += '"(* ' + len + 'B literal *)"';
                } else {
                    resp += '{' + len + '}\r\n';
                    emit();
                    resp = nval || '';
                }
                break;

            case 'STRING':
                if (isLogging && node.value.length > 20) {
                    resp += '"(* ' + node.value.length + 'B string *)"';
                } else {
                    resp += JSON.stringify(node.value || '');
                }
                break;
            case 'TEXT':
            case 'SEQUENCE':
                resp += node.value || '';
                break;

            case 'NUMBER':
                resp += (node.value || 0);
                break;

            case 'ATOM':
            case 'SECTION':
                val = node.value || '';

                if (imapFormalSyntax.verify(val.charAt(0) === '\\' ? val.substr(1) : val, imapFormalSyntax['ATOM-CHAR']()) >= 0) {
                    val = JSON.stringify(val);
                }

                resp += val;

                let finalize = () => {
                    if (node.partial) {
                        resp += '<' + node.partial.join('.') + '>';
                    }
                    setImmediate(callback);
                };

                if (node.section) {
                    resp += '[';

                    let pos = 0;
                    let next = () => {
                        if (pos >= node.section.length) {
                            resp += ']';
                            return setImmediate(finalize);
                        }
                        walk(node.section[pos++], next);
                    };

                    return setImmediate(next);
                }

                return finalize();
        }
        setImmediate(callback);
    };

    let finalize = () => {
        emit();
        output.end();
    };
    let pos = 0;
    let attribs = [].concat(response.attributes || []);
    let next = () => {
        if (pos >= attribs.length) {
            return setImmediate(finalize);
        }
        walk(attribs[pos++], next);
    };
    setImmediate(next);

    return output;
};
