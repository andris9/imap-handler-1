/* eslint object-shorthand:0, new-cap: 0, no-useless-concat: 0 */

'use strict';

// IMAP Formal Syntax
// http://tools.ietf.org/html/rfc3501#section-9

function expandRange(start, end) {
    var chars = [];
    for (var i = start; i <= end; i++) {
        chars.push(i);
    }
    return String.fromCharCode.apply(String,chars);
}

function excludeChars(source, exclude) {
    var sourceArr = Array.prototype.slice.call(source);
    for (var i = sourceArr.length - 1; i >= 0; i--) {
        if (exclude.indexOf(sourceArr[i]) >= 0) {
            sourceArr.splice(i, 1);
        }
    }
    return sourceArr.join('');
}

module.exports = {

    CHAR: function () {
        var value = expandRange(0x01, 0x7F);
        this.CHAR = function () {
            return value;
        };
        return value;
    },

    CHAR8: function () {
        var value = expandRange(0x01, 0xFF);
        this.CHAR8 = function () {
            return value;
        };
        return value;
    },

    SP: function () {
        return ' ';
    },

    CTL: function () {
        var value = expandRange(0x00, 0x1F) + '\x7F';
        this.CTL = function () {
            return value;
        };
        return value;
    },

    DQUOTE: function () {
        return '"';
    },

    ALPHA: function () {
        var value = expandRange(0x41, 0x5A) + expandRange(0x61, 0x7A);
        this.ALPHA = function () {
            return value;
        };
        return value;
    },

    DIGIT: function () {
        var value = expandRange(0x30, 0x39) + expandRange(0x61, 0x7A);
        this.DIGIT = function () {
            return value;
        };
        return value;
    },

    'ATOM-CHAR': function () {
        var value = excludeChars(this.CHAR(), this['atom-specials']());
        this['ATOM-CHAR'] = function () {
            return value;
        };
        return value;
    },

    'ASTRING-CHAR': function () {
        var value = this['ATOM-CHAR']() + this['resp-specials']();
        this['ASTRING-CHAR'] = function () {
            return value;
        };
        return value;
    },

    'TEXT-CHAR': function () {
        var value = excludeChars(this.CHAR(), '\r\n');
        this['TEXT-CHAR'] = function () {
            return value;
        };
        return value;
    },

    'atom-specials': function () {
        var value = '(' + ')' + '{' + this.SP() + this.CTL() + this['list-wildcards']() +
            this['quoted-specials']() + this['resp-specials']();
        this['atom-specials'] = function () {
            return value;
        };
        return value;
    },

    'list-wildcards': function () {
        return '%' + '*';
    },

    'quoted-specials': function () {
        var value = this.DQUOTE() + '\\';
        this['quoted-specials'] = function () {
            return value;
        };
        return value;
    },

    'resp-specials': function () {
        return ']';
    },

    tag: function () {
        var value = excludeChars(this['ASTRING-CHAR'](), '+');
        this.tag = function () {
            return value;
        };
        return value;
    },

    command: function () {
        var value = this.ALPHA() + this.DIGIT();
        this.command = function () {
            return value;
        };
        return value;
    },

    verify: function (str, allowedChars) {
        for (var i = 0, len = str.length; i < len; i++) {
            if (allowedChars.indexOf(str.charAt(i)) < 0) {
                return i;
            }
        }
        return -1;
    }
};
