/* eslint no-console: 0 */

'use strict';

let imapFormalSyntax = require('./imap-formal-syntax');
let streams = require('stream');
let PassThrough = streams.PassThrough;
let Transform = streams.Transform;
let util = require('util');

// make sure that a stream piped to this transform stream
// always emits a fixed amounts of bytes. Either by truncating
// input or emitting padding characters
function LengthLimiter(expectedLength, padding) {
    this.expectedLength = expectedLength;
    this.padding = padding || ' ';
    this.byteCounter = 0;
    this.finished = false;

    Transform.call(this);
}
util.inherits(LengthLimiter, Transform);

LengthLimiter.prototype._transform = function (chunk, encoding, done) {
    if (encoding !== 'buffer') {
        chunk = new Buffer(chunk, encoding);
    }

    if (!chunk || !chunk.length || this.finished) {
        return done();
    }

    if (chunk.length + this.byteCounter <= this.expectedLength) {
        this.byteCounter += chunk.length;
        if (this.byteCounter >= this.expectedLength) {
            this.finished = true;
        }
        this.push(chunk);
        return done();
    }

    let buf = chunk.slice(0, this.expectedLength - this.byteCounter);
    this.finished = true;
    this.push(buf);
    done();
};

LengthLimiter.prototype._flush = function (done) {
    if (!this.finished) {
        let buf = new Buffer(this.padding.repeat(this.expectedLength - this.byteCounter));
        this.push(buf);
    }
    done();
};

/**
 * Compiles an input object into
 */
module.exports = function (response, isLogging) {
    let output = new PassThrough();

    let resp = (response.tag || '') + (response.command ? ' ' + response.command : '');
    let val, lastType;

    let waiting = false;
    let queue = [];
    let ended = false;
    let emit = function (stream, expectedLength) {

        if (resp.length) {
            queue.push(new Buffer(resp, 'binary'));
            resp = '';
        }

        if (stream) {
            queue.push({
                type: 'stream',
                stream,
                expectedLength
            });
        }


        if (waiting) {
            return;
        }

        if (!queue.length) {
            if (ended) {
                output.end();
            }
            return;
        }

        let value = queue.shift();

        if (value.type === 'stream') {
            if (!value.expectedLength) {
                return emit();
            }
            waiting = true;
            let limiter = new LengthLimiter(value.expectedLength, ' ');
            value.stream.pipe(limiter).pipe(output, {
                end: false
            });
            limiter.on('end', () => {
                waiting = false;
                return emit();
            });
        } else if (value instanceof Buffer) {
            output.write(value);
            return emit();
        } else {
            if (typeof value === 'number') {
                value = value.toString();
            } else if (typeof value !== 'string') {
                value = (value || '').toString();
            }
            output.write(new Buffer(value, 'binary'));
            return emit();
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

                let len;

                if (nval && typeof nval.pipe === 'function') {
                    len = node.expectedLength || 0;
                } else {
                    len = (nval || '').toString().length;
                }

                if (isLogging) {
                    resp += '"(* ' + len + 'B literal *)"';
                } else {
                    resp += '{' + len + '}\r\n';
                    emit();

                    if (nval && typeof nval.pipe === 'function') {
                        //value is a stream object
                        emit(nval, len);
                    } else {
                        resp = nval || '';
                    }
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
        ended = true;
        emit();
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

// expose for testing
module.exports.LengthLimiter = LengthLimiter;
