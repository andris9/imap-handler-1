/* eslint no-unused-expressions:0 */
/* globals beforeEach, describe, it */

'use strict';

var chai = require('chai');
var imapHandler = require('../lib/imap-handler');
var PassThrough = require('stream').PassThrough;
var expect = chai.expect;
chai.config.includeStack = true;

describe('IMAP Command Compile Stream', function () {

    describe('#compile', function () {

        it('should compile correctly', function (done) {
            var command = '* FETCH (ENVELOPE ("Mon, 2 Sep 2013 05:30:13 -0700 (PDT)" NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "tr.ee")) NIL NIL NIL "<-4730417346358914070@unknownmsgid>") BODYSTRUCTURE (("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 105 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "<test1>" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 5 NIL NIL NIL) ("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 83 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "NIL" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 4 NIL NIL NIL) ("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "QUOTED-PRINTABLE" 19 0 NIL NIL NIL) "MIXED" ("BOUNDARY" "----mailcomposer-?=_1-1328088797399") NIL NIL))',
                parsed = imapHandler.parser(command, {
                    allowUntagged: true
                });

            resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                expect(err).to.not.exist;
                expect(compiled.toString('binary')).to.equal(command);
                done();
            });
        });
    });

    describe('Types', function () {
        var parsed;

        beforeEach(function () {
            parsed = {
                tag: '*',
                command: 'CMD'
            };
        });

        describe('No attributes', function () {
            it('should compile correctly', function (done) {
                var command = '* CMD';

                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });

        describe('TEXT', function () {
            it('should compile correctly', function (done) {
                parsed.attributes = [{
                    type: 'TEXT',
                    value: 'Tere tere!'
                }];
                var command = '* CMD Tere tere!';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });

        describe('SECTION', function () {
            it('should compile correctly', function (done) {
                parsed.attributes = [{
                    type: 'SECTION',
                    section: [{
                        type: 'ATOM',
                        value: 'ALERT'
                    }]
                }];
                var command = '* CMD [ALERT]';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });

        describe('ATOM', function () {
            it('should compile correctly', function (done) {
                parsed.attributes = [{
                    type: 'ATOM',
                    value: 'ALERT'
                }, {
                    type: 'ATOM',
                    value: '\\ALERT'
                }, {
                    type: 'ATOM',
                    value: 'NO ALERT'
                }];
                var command = '* CMD ALERT \\ALERT "NO ALERT"';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });

        describe('SEQUENCE', function () {
            it('should compile correctly', function (done) {
                parsed.attributes = [{
                    type: 'SEQUENCE',
                    value: '*:4,5,6'
                }];
                var command = '* CMD *:4,5,6';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });

        describe('NIL', function () {
            it('should compile correctly', function (done) {
                parsed.attributes = [
                    null,
                    null
                ];

                var command = '* CMD NIL NIL';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });

        describe('TEXT', function () {
            it('should compile correctly', function (done) {
                parsed.attributes = [
                    // keep indentation
                    {
                        type: 'String',
                        value: 'Tere tere!',
                        sensitive: true
                    },
                    'Vana kere'
                ];

                var command = '* CMD "Tere tere!" "Vana kere"';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });

            it('should keep short strings', function (done) {
                parsed.attributes = [
                    // keep indentation
                    {
                        type: 'String',
                        value: 'Tere tere!'
                    },
                    'Vana kere'
                ];

                var command = '* CMD "Tere tere!" "Vana kere"';
                resolveStream(imapHandler.compileStream(parsed, true), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });

            it('should hide strings', function (done) {
                parsed.attributes = [
                    // keep indentation
                    {
                        type: 'String',
                        value: 'Tere tere!',
                        sensitive: true
                    },
                    'Vana kere'
                ];

                var command = '* CMD "(* value hidden *)" "Vana kere"';
                resolveStream(imapHandler.compileStream(parsed, true), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });

            it('should hide long strings', function (done) {
                parsed.attributes = [
                    // keep indentation
                    {
                        type: 'String',
                        value: 'Tere tere! Tere tere! Tere tere! Tere tere! Tere tere!'
                    },
                    'Vana kere'
                ];

                var command = '* CMD "(* 54B string *)" "Vana kere"';
                resolveStream(imapHandler.compileStream(parsed, true), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });

        describe('No Command', function () {
            it('should compile correctly', function (done) {
                parsed = {
                    tag: '*',
                    attributes: [
                        1, {
                            type: 'ATOM',
                            value: 'EXPUNGE'
                        }
                    ]
                };

                var command = '* 1 EXPUNGE';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });
        describe('Literal', function () {
            it('shoud return as text', function (done) {
                var parsed = {
                    tag: '*',
                    command: 'CMD',
                    attributes: [
                        // keep indentation
                        {
                            type: 'LITERAL',
                            value: 'Tere tere!'
                        },
                        'Vana kere'
                    ]
                };

                var command = '* CMD {10}\r\nTere tere! "Vana kere"';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });

            it('should compile correctly without tag and command', function (done) {
                var parsed = {
                    attributes: [{
                        type: 'LITERAL',
                        value: 'Tere tere!'
                    }, {
                        type: 'LITERAL',
                        value: 'Vana kere'
                    }]
                };
                var command = '{10}\r\nTere tere! {9}\r\nVana kere';
                resolveStream(imapHandler.compileStream(parsed), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });

            it('shoud return byte length', function (done) {
                var parsed = {
                    tag: '*',
                    command: 'CMD',
                    attributes: [
                        // keep indentation
                        {
                            type: 'LITERAL',
                            value: 'Tere tere!'
                        },
                        'Vana kere'
                    ]
                };

                var command = '* CMD "(* 10B literal *)" "Vana kere"';
                resolveStream(imapHandler.compileStream(parsed, true), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });

            it('shoud pipe literal streams', function (done) {
                var stream1 = new PassThrough();
                var stream2 = new PassThrough();
                var stream3 = new PassThrough();
                var parsed = {
                    tag: '*',
                    command: 'CMD',
                    attributes: [
                        // keep indentation
                        {
                            type: 'LITERAL',
                            value: 'Tere tere!'
                        }, {
                            type: 'LITERAL',
                            expectedLength: 5,
                            value: stream1
                        },
                        'Vana kere', {
                            type: 'LITERAL',
                            expectedLength: 7,
                            value: stream2
                        }, {
                            type: 'LITERAL',
                            value: 'Kuidas laheb?'
                        }, {
                            type: 'LITERAL',
                            expectedLength: 5,
                            value: stream3
                        }
                    ]
                };

                var command = '* CMD {10}\r\nTere tere! {5}\r\ntest1 "Vana kere" {7}\r\ntest2   {13}\r\nKuidas laheb? {5}\r\ntest3';
                resolveStream(imapHandler.compileStream(parsed, false), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });

                setTimeout(function () {
                    stream2.end('test2');
                    setTimeout(function () {
                        stream1.end('test1');
                        setTimeout(function () {
                            stream3.end('test3');
                        }, 100);
                    }, 100);
                }, 100);
            });

            it('shoud pipe limited literal streams', function (done) {
                var stream1 = new PassThrough();
                var stream2 = new PassThrough();
                var stream3 = new PassThrough();
                var parsed = {
                    tag: '*',
                    command: 'CMD',
                    attributes: [
                        // keep indentation
                        {
                            type: 'LITERAL',
                            value: 'Tere tere!'
                        }, {
                            type: 'LITERAL',
                            expectedLength: 5,
                            value: stream1,
                            startFrom: 2,
                            maxLength: 2
                        },
                        'Vana kere', {
                            type: 'LITERAL',
                            expectedLength: 7,
                            value: stream2,
                            startFrom: 2
                        }, {
                            type: 'LITERAL',
                            value: 'Kuidas laheb?'
                        }, {
                            type: 'LITERAL',
                            expectedLength: 7,
                            value: stream3,
                            startFrom: 2,
                            maxLength: 2
                        }
                    ]
                };

                var command = '* CMD {10}\r\nTere tere! {2}\r\nst "Vana kere" {5}\r\nst2   {13}\r\nKuidas laheb? {2}\r\nst';
                resolveStream(imapHandler.compileStream(parsed, false), function (err, compiled) {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });

                setTimeout(function () {
                    stream2.end('test2');
                    setTimeout(function () {
                        stream1.end('test1');
                        setTimeout(function () {
                            stream3.end('test3');
                        }, 100);
                    }, 100);
                }, 100);
            });

            it('shoud pipe errors for literal streams', function (done) {
                var stream1 = new PassThrough();
                var parsed = {
                    tag: '*',
                    command: 'CMD',
                    attributes: [
                        // keep indentation
                        {
                            type: 'LITERAL',
                            value: 'Tere tere!'
                        }, {
                            type: 'LITERAL',
                            expectedLength: 5,
                            value: stream1
                        }
                    ]
                };

                resolveStream(imapHandler.compileStream(parsed, false), function (err) {
                    expect(err).to.exist;
                    done();
                });

                setTimeout(function () {
                    stream1.emit('error', new Error('Stream error'));
                }, 100);
            });
        });
    });

    describe('#LengthLimiter', function () {
        this.timeout(10000); //eslint-disable-line no-invalid-this

        it('should emit exact length', function (done) {
            var len = 1024;
            var limiter = new imapHandler.compileStream.LengthLimiter(len);
            var expected = repeat('X', len);

            resolveStream(limiter, function (err, value) {
                value = value.toString();
                expect(err).to.not.exist;
                expect(value).to.equal(expected);
                done();
            });

            var emitted = 0;
            var emitter = function () {
                var str = repeat('X', 128);
                emitted += str.length;
                limiter.write(new Buffer(str));
                if (emitted >= len) {
                    limiter.end();
                } else {
                    setTimeout(emitter, 100);
                }
            };

            setTimeout(emitter, 100);
        });

        it('should truncate output', function (done) {
            var len = 1024;
            var limiter = new imapHandler.compileStream.LengthLimiter(len - 100);
            var expected = repeat('X', len - 100);

            resolveStream(limiter, function (err, value) {
                value = value.toString();
                expect(err).to.not.exist;
                expect(value).to.equal(expected);
                done();
            });

            var emitted = 0;
            var emitter = function () {
                var str = repeat('X', 128);
                emitted += str.length;
                limiter.write(new Buffer(str));
                if (emitted >= len) {
                    limiter.end();
                } else {
                    setTimeout(emitter, 100);
                }
            };

            setTimeout(emitter, 100);
        });

        it('should skip output', function (done) {
            var len = 1024;
            var limiter = new imapHandler.compileStream.LengthLimiter(len - 100, false, 30);
            var expected = repeat('X', len - 100 - 30);

            resolveStream(limiter, function (err, value) {
                value = value.toString();
                expect(err).to.not.exist;
                expect(value).to.equal(expected);
                done();
            });

            var emitted = 0;
            var emitter = function () {
                var str = repeat('X', 128);
                emitted += str.length;
                limiter.write(new Buffer(str));
                if (emitted >= len) {
                    limiter.end();
                } else {
                    setTimeout(emitter, 100);
                }
            };

            setTimeout(emitter, 100);
        });

        it('should pad output', function (done) {
            var len = 1024;
            var limiter = new imapHandler.compileStream.LengthLimiter(len + 100);
            var expected = repeat('X', len) + repeat(' ', 100);

            resolveStream(limiter, function (err, value) {
                value = value.toString();
                expect(err).to.not.exist;
                expect(value).to.equal(expected);
                done();
            });

            var emitted = 0;
            var emitter = function () {
                var str = repeat('X', 128);
                emitted += str.length;
                limiter.write(new Buffer(str));
                if (emitted >= len) {
                    limiter.end();
                } else {
                    setTimeout(emitter, 100);
                }
            };

            setTimeout(emitter, 100);
        });
    });
});

function resolveStream(stream, callback) {
    var chunks = [];
    var chunklen = 0;

    stream.on('readable', function () {
        var chunk;

        while ((chunk = stream.read()) !== null) {
            chunks.push(chunk);
            chunklen += chunk.length;
        }
    });

    stream.on('error', function (err) {
        return callback(err);
    });
    stream.on('end', function () {
        return callback(null, Buffer.concat(chunks, chunklen));
    });
}

function repeat(str, count) {
    return new Array(count + 1).join(str);
}
