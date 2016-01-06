/*eslint no-unused-expressions: 0, prefer-arrow-callback: 0 */

'use strict';

let chai = require('chai');
let imapHandler = require('../lib/imap-handler');

let expect = chai.expect;
chai.config.includeStack = true;

describe('IMAP Command Compiler', function () {

    describe('#compile', function () {

        it('should compile correctly', function (done) {
            let command = '* FETCH (ENVELOPE ("Mon, 2 Sep 2013 05:30:13 -0700 (PDT)" NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "tr.ee")) NIL NIL NIL "<-4730417346358914070@unknownmsgid>") BODYSTRUCTURE (("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 105 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "<test1>" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 5 NIL NIL NIL) ("MESSAGE" "RFC822" NIL NIL NIL "7BIT" 83 (NIL NIL ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "kreata.ee")) ((NIL NIL "andris" "pangalink.net")) NIL NIL "NIL" NIL) ("TEXT" "PLAIN" NIL NIL NIL "7BIT" 12 0 NIL NIL NIL) 4 NIL NIL NIL) ("TEXT" "HTML" ("CHARSET" "utf-8") NIL NIL "QUOTED-PRINTABLE" 19 0 NIL NIL NIL) "MIXED" ("BOUNDARY" "----mailcomposer-?=_1-1328088797399") NIL NIL))',
                parsed = imapHandler.parser(command, {
                    allowUntagged: true
                });

            resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
                expect(err).to.not.exist;
                expect(compiled.toString('binary')).to.equal(command);
                done();
            });
        });
    });

    describe('Types', function () {
        let parsed;

        beforeEach(function () {
            parsed = {
                tag: '*',
                command: 'CMD'
            };
        });

        describe('No attributes', function () {
            it('should compile correctly', function (done) {
                let command = '* CMD';

                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
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
                let command = '* CMD Tere tere!';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
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
                let command = '* CMD [ALERT]';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
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
                let command = '* CMD ALERT \\ALERT "NO ALERT"';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
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
                let command = '* CMD *:4,5,6';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
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

                let command = '* CMD NIL NIL';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
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

                let command = '* CMD "Tere tere!" "Vana kere"';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
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

                let command = '* CMD "Tere tere!" "Vana kere"';
                resolveStream(imapHandler.compiler(parsed, true), (err, compiled) => {
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

                let command = '* CMD "(* value hidden *)" "Vana kere"';
                resolveStream(imapHandler.compiler(parsed, true), (err, compiled) => {
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

                let command = '* CMD "(* 54B string *)" "Vana kere"';
                resolveStream(imapHandler.compiler(parsed, true), (err, compiled) => {
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

                let command = '* 1 EXPUNGE';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });
        describe('Literal', function () {
            it('shoud return as text', function (done) {
                let parsed = {
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

                let command = '* CMD {10}\r\nTere tere! "Vana kere"';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });

            it('should compile correctly without tag and command', function (done) {
                let parsed = {
                    attributes: [{
                        type: 'LITERAL',
                        value: 'Tere tere!'
                    }, {
                        type: 'LITERAL',
                        value: 'Vana kere'
                    }]
                };
                let command = '{10}\r\nTere tere! {9}\r\nVana kere';
                resolveStream(imapHandler.compiler(parsed), (err, compiled) => {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });

            it('shoud return byte length', function (done) {
                let parsed = {
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

                let command = '* CMD "(* 10B literal *)" "Vana kere"';
                resolveStream(imapHandler.compiler(parsed, true), (err, compiled) => {
                    expect(err).to.not.exist;
                    expect(compiled.toString('binary')).to.equal(command);
                    done();
                });
            });
        });
    });
});

function resolveStream(stream, callback) {
    let chunks = [];
    let chunklen = 0;

    stream.on('readable', () => {
        let chunk;

        while ((chunk = stream.read()) !== null) {
            chunks.push(chunk);
            chunklen += chunk.length;
        }
    });

    stream.on('error', err => callback(err));
    stream.on('end', () => callback(null, Buffer.concat(chunks, chunklen)));
}
