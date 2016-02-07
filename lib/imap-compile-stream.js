/* eslint no-console: 0 */

'use strict';

var imapFormalSyntax = require('./imap-formal-syntax');
var streams = require('stream');
var PassThrough = streams.PassThrough;
var Transform = streams.Transform;
var util = require('util');

// make sure that a stream piped to this transform stream
// always emits a fixed amounts of bytes. Either by truncating
// input or emitting padding characters
function LengthLimiter(expectedLength, padding, startFrom) {
    this.expectedLength = expectedLength;
    this.padding = padding || ' ';
    this.byteCounter = 0;
    this.startFrom = startFrom || 0;
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

    if (chunk.length + this.byteCounter <= this.startFrom) {
        // ignore
        this.byteCounter += chunk.length;
        return done();
    }

    if (this.byteCounter < this.startFrom) {
        // split the chunk and ignore the first part
        chunk = chunk.slice(this.startFrom - this.byteCounter);
        this.byteCounter += (this.startFrom - this.byteCounter);
    }

    if (chunk.length + this.byteCounter <= this.expectedLength) {
        this.byteCounter += chunk.length;
        if (this.byteCounter >= this.expectedLength) {
            this.finished = true;
        }
        this.push(chunk);
        return done();
    }

    var buf = chunk.slice(0, this.expectedLength - this.byteCounter);
    this.finished = true;
    this.push(buf);
    done();
};

LengthLimiter.prototype._flush = function (done) {
    if (!this.finished) {
        var buf = new Buffer(repeat(this.padding, this.expectedLength - this.byteCounter));
        this.push(buf);
    }
    done();
};

/**
 * Compiles an input object into
 */
module.exports = function (response, isLogging) {
    var output = new PassThrough();

    var resp = (response.tag || '') + (response.command ? ' ' + response.command : '');
    var val, lastType;

    var waiting = false;
    var queue = [];
    var ended = false;
    var emit = function (stream, expectedLength, startFrom, maxLength) {
        expectedLength = expectedLength || 0;
        startFrom = startFrom || 0;
        maxLength = maxLength || 0;

        if (resp.length) {
            queue.push(new Buffer(resp, 'binary'));
            resp = '';
        }

        if (stream) {
            queue.push({
                type: 'stream',
                stream: stream,
                expectedLength: expectedLength,
                startFrom: startFrom,
                maxLength: maxLength
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

        var value = queue.shift();

        if (value.type === 'stream') {
            if (!value.expectedLength) {
                return emit();
            }
            waiting = true;
            var limiter = new LengthLimiter(value.maxLength ? Math.min(value.expectedLength, value.startFrom + value.maxLength) : value.expectedLength, ' ', value.startFrom);
            value.stream.pipe(limiter).pipe(output, {
                end: false
            });

            // pass errors to output
            value.stream.on('error', function (err) {
                output.emit('error', err);
            });

            limiter.on('end', function () {
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

    var walk = function (node, callback) {
        var pos;
        var next;

        if (lastType === 'LITERAL' || (['(', '<', '['].indexOf(resp.substr(-1)) < 0 && resp.length)) {
            resp += ' ';
        }

        if (Array.isArray(node)) {
            lastType = 'LIST';
            resp += '(';

            pos = 0;
            next = function () {
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
                var nval = node.value;
                if (typeof nval === 'number') {
                    nval = nval.toString();
                }

                var len;

                if (nval && typeof nval.pipe === 'function') {
                    len = node.expectedLength || 0;
                    if (node.startFrom) {
                        len -= node.startFrom;
                    }
                    if (node.maxLength) {
                        len = Math.min(len, node.maxLength);
                    }
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
                        emit(nval, node.expectedLength, node.startFrom, node.maxLength);
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

                if (imapFormalSyntax.verify(val.charAt(0) === '\\' ? val.substr(1) : val, imapFormalSyntax['ATOM-CHAR']()) >= 0) { //eslint-disable-line new-cap
                    val = JSON.stringify(val);
                }

                resp += val;

                var finalize = function () {
                    if (node.partial) {
                        resp += '<' + node.partial.join('.') + '>';
                    }
                    setImmediate(callback);
                };

                if (node.section) {
                    resp += '[';

                    pos = 0;
                    next = function () {
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

    var finalize = function () {
        ended = true;
        emit();
    };
    var pos = 0;
    var attribs = [].concat(response.attributes || []);
    var next = function () {
        if (pos >= attribs.length) {
            return setImmediate(finalize);
        }
        walk(attribs[pos++], next);
    };
    setImmediate(next);

    return output;
};

function repeat(str, count) {
    return new Array(count + 1).join(str);
}

// expose for testing
module.exports.LengthLimiter = LengthLimiter;
