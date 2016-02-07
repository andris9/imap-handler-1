/* eslint no-console: 0 */

'use strict';

var imapFormalSyntax = require('./imap-formal-syntax');

/**
 * Compiles an input object into
 */
module.exports = function (response, asArray, isLogging) {
    var respParts = [];
    var resp = (response.tag || '') + (response.command ? ' ' + response.command : '');
    var val;
    var lastType;
    var walk = function (node) {

        if (lastType === 'LITERAL' || (['(', '<', '['].indexOf(resp.substr(-1)) < 0 && resp.length)) {
            resp += ' ';
        }

        if (Array.isArray(node)) {
            lastType = 'LIST';
            resp += '(';
            node.forEach(walk);
            resp += ')';
            return;
        }

        if (!node && typeof node !== 'string' && typeof node !== 'number') {
            resp += 'NIL';
            return;
        }

        if (typeof node === 'string') {
            if (isLogging && node.length > 20) {
                resp += '"(* ' + node.length + 'B string *)"';
            } else {
                resp += JSON.stringify(node);
            }
            return;
        }

        if (typeof node === 'number') {
            resp += Math.round(node) || 0; // Only integers allowed
            return;
        }

        lastType = node.type;

        if (isLogging && node.sensitive) {
            resp += '"(* value hidden *)"';
            return;
        }

        switch (node.type.toUpperCase()) {
            case 'LITERAL':
                if (isLogging) {
                    resp += '"(* ' + node.value.length + 'B literal *)"';
                } else {
                    if (!node.value) {
                        resp += '{0}\r\n';
                    } else {
                        resp += '{' + node.value.length + '}\r\n';
                    }
                    respParts.push(resp);
                    resp = node.value || '';
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

                if (imapFormalSyntax.verify(val.charAt(0) === '\\' ? val.substr(1) : val, imapFormalSyntax['ATOM-CHAR']()) >= 0) { // eslint-disable-line new-cap
                    val = JSON.stringify(val);
                }

                resp += val;

                if (node.section) {
                    resp += '[';
                    node.section.forEach(walk);
                    resp += ']';
                }
                if (node.partial) {
                    resp += '<' + node.partial.join('.') + '>';
                }
                break;
        }

    };

    [].concat(response.attributes || []).forEach(walk);

    if (resp.length) {
        respParts.push(resp);
    }

    return asArray ? respParts : respParts.join('');
};
