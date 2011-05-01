exports.randomString = randomString;

var upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var lower = 'abcdefghijklmnopqrstuvwxyz';
var digits = '0123456789';
var base64 = upper + lower + digits + '+/';
var base64url = upper + lower + digits + '-_';
var hexdigits = digits + 'abcdef';

function randomString(len, chars) {
    if (typeof chars == 'undefined') {
        chars = base64url;
    }
    var radix = chars.length;
    var result = [];
    for (var i = 0; i < len; i++) {
        result[i] = chars[0 | Math.random() * radix];
    }
    return result.join('');
};
