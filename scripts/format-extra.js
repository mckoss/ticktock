/* Source: scripts/format.js */
namespace.module('org.startpad.format', function (exports, require) {
var base = require('org.startpad.base');
var string = require('org.startpad.string');

exports.extend({
    'fixedDigits': fixedDigits,
    'thousands': thousands,
    'slugify': slugify,
    'escapeHTML': escapeHTML,
    'replaceKeys': replaceKeys,
    'replaceString': replaceString,
    'base64ToString': base64ToString,
    'canvasToPNG': canvasToPNG,
    'dateFromISO': dateFromISO,
    'isoFromDate': isoFromDate,
    'setTimezone': setTimezone,
    'decodeClass': decodeClass,
    'shortDate': shortDate,
    'wordList': wordList,
    'arrayFromWordList': arrayFromWordList,
    'repeat': repeat
});

// Thousands separator
var comma = ',';

// Return an integer as a string using a fixed number of digits,
// (require a sign if fSign).
function fixedDigits(value, digits, fSign) {
    var s = "";
    var fNeg = (value < 0);
    if (digits == undefined) {
        digits = 0;
    }
    if (fNeg) {
        value = -value;
    }
    value = Math.floor(value);

    for (; digits > 0; digits--) {
        s = (value % 10) + s;
        value = Math.floor(value / 10);
    }

    if (fSign || fNeg) {
        s = (fNeg ? "-" : "+") + s;
    }

    return s;
}

// Return integer as string with thousand separators with optional
// decimal digits.
function thousands(value, digits) {
    var integerPart = Math.floor(value);
    var s = integerPart.toString();
    var sLast = "";
    while (s != sLast) {
        sLast = s;
        s = s.replace(/(\d+)(\d{3})/, "$1" + comma + "$2");
    }

    var fractionString = "";
    if (digits && digits >= 1) {
        digits = Math.floor(digits);
        var fraction = value - integerPart;
        fraction = Math.floor(fraction * Math.pow(10, digits));
        fractionString = "." + fixedDigits(fraction, digits);
    }
    return s + fractionString;
}

// Converts to lowercase, removes non-alpha chars and converts
// spaces to hyphens
function slugify(s) {
    s = string.strip(s).toLowerCase();
    s = s.replace(/[^a-zA-Z0-9]/g, '-').
          replace(/[\-]+/g, '-').
          replace(/(^-+)|(-+$)/g, '');
    return s;
}

function escapeHTML(s) {
    s = s.toString();
    s = s.replace(/&/g, '&amp;');
    s = s.replace(/</g, '&lt;');
    s = s.replace(/>/g, '&gt;');
    s = s.replace(/\"/g, '&quot;');
    s = s.replace(/'/g, '&#39;');
    return s;
}

// Replace all instances of pattern, with replacement in string.
function replaceString(string, pattern, replacement) {
    var output = "";
    if (replacement == undefined) {
        replacement = "";
    }
    else {
        replacement = replacement.toString();
    }
    var ich = 0;
    var ichFind = string.indexOf(pattern, 0);
    while (ichFind >= 0) {
        output += string.substring(ich, ichFind) + replacement;
        ich = ichFind + pattern.length;
        ichFind = string.indexOf(pattern, ich);
    }
    output += string.substring(ich);
    return output;
}

// Replace keys in dictionary of for {key} in the text string.
function replaceKeys(st, keys) {
    for (var key in keys) {
        if (keys.hasOwnProperty(key)) {
            st = replaceString(st, "{" + key + "}", keys[key]);
        }
    }
    // remove unused keys
    st = st.replace(/\{[^\{\}]*\}/g, "");
    return st;
}

//------------------------------------------------------------------
// ISO 8601 Date Formatting YYYY-MM-DDTHH:MM:SS.sssZ (where Z
// could be +HH or -HH for non UTC) Note that dates are inherently
// stored at UTC dates internally. But we infer that they denote
// local times by default. If the dt.__tz exists, it is assumed to
// be an integer number of hours offset to the timezone for which
// the time is to be indicated (e.g., PST = -08). Callers should
// set dt.__tz = 0 to fix the date at UTC. All other times are
// adjusted to designate the local timezone.
// -----------------------------------------------------------------

// Default timezone = local timezone
// var tzDefault = -(new Date().getTimezoneOffset()) / 60;
var tzDefault = 0;

function setTimezone(tz) {
    if (tz == undefined) {
        tz = -(new Date().getTimezoneOffset()) / 60;
    }
    tzDefault = tz;
}

function isoFromDate(dt, fTime) {
    var dtT = new Date();
    dtT.setTime(dt.getTime());

    var tz = dt.__tz;
    if (tz == undefined) {
        tz = tzDefault;
    }

    // Adjust the internal (UTC) time to be the local timezone
    // (add tz hours) Note that setTime() and getTime() are always
    // in (internal) UTC time.
    if (tz != 0) {
        dtT.setTime(dtT.getTime() + 60 * 60 * 1000 * tz);
    }

    var s = dtT.getUTCFullYear() + "-" +
        fixedDigits(dtT.getUTCMonth() + 1, 2) + "-" +
        fixedDigits(dtT.getUTCDate(), 2);
    var ms = dtT % (24 * 60 * 60 * 1000);

    if (ms || fTime || tz != 0) {
        s += "T" + fixedDigits(dtT.getUTCHours(), 2) + ":" +
            fixedDigits(dtT.getUTCMinutes(), 2);
        ms = ms % (60 * 1000);
        if (ms) {
            s += ":" + fixedDigits(dtT.getUTCSeconds(), 2);
        }
        if (ms % 1000) {
            s += "." + fixedDigits(dtT.getUTCMilliseconds(), 3);
        }
        if (tz == 0) {
            s += "Z";
        } else {
            s += fixedDigits(tz, 2, true);
        }
    }
    return s;
}

var regISO = new RegExp("^(\\d{4})-?(\\d\\d)-?(\\d\\d)" +
                        "(T(\\d\\d):?(\\d\\d):?((\\d\\d)" +
                        "(\\.(\\d{0,6}))?)?(Z|[\\+-]\\d\\d))?$");

//--------------------------------------------------------------------
// Parser is more lenient than formatter. Punctuation between date
// and time parts is optional. We require at the minimum,
// YYYY-MM-DD. If a time is given, we require at least HH:MM.
// YYYY-MM-DDTHH:MM:SS.sssZ as well as YYYYMMDDTHHMMSS.sssZ are
// both acceptable. Note that YYYY-MM-DD is ambiguous. Without a
// timezone indicator we don't know if this is a UTC midnight or
// Local midnight. We default to UTC midnight (the ISOFromDate
// function always writes out non-UTC times so we can append the
// time zone). Fractional seconds can be from 0 to 6 digits
// (microseconds maximum)
// -------------------------------------------------------------------
function dateFromISO(sISO) {
    var e = new base.Enum(1, "YYYY", "MM", "DD", 5, "hh", "mm",
                           8, "ss", 10, "sss", "tz");
    var aParts = sISO.match(regISO);
    if (!aParts) {
        return undefined;
    }

    aParts[e.mm] = aParts[e.mm] || 0;
    aParts[e.ss] = aParts[e.ss] || 0;
    aParts[e.sss] = aParts[e.sss] || 0;

    // Convert fractional seconds to milliseconds
    aParts[e.sss] = Math.round(+('0.' + aParts[e.sss]) * 1000);
    if (!aParts[e.tz] || aParts[e.tz] === "Z") {
        aParts[e.tz] = 0;
    } else {
        aParts[e.tz] = parseInt(aParts[e.tz]);
    }

    // Out of bounds checking - we don't check days of the month is correct!
    if (aParts[e.MM] > 59 || aParts[e.DD] > 31 ||
        aParts[e.hh] > 23 || aParts[e.mm] > 59 || aParts[e.ss] > 59 ||
        aParts[e.tz] < -23 || aParts[e.tz] > 23) {
        return undefined;
    }

    var dt = new Date();

    dt.setUTCFullYear(aParts[e.YYYY], aParts[e.MM] - 1, aParts[e.DD]);

    if (aParts[e.hh]) {
        dt.setUTCHours(aParts[e.hh], aParts[e.mm],
                       aParts[e.ss], aParts[e.sss]);
    } else {
        dt.setUTCHours(0, 0, 0, 0);
    }

    // BUG: For best compatibility - could set tz to undefined if
    // it is our local tz Correct time to UTC standard (utc = t -
    // tz)
    dt.__tz = aParts[e.tz];
    if (aParts[e.tz]) {
        dt.setTime(dt.getTime() - dt.__tz * (60 * 60 * 1000));
    }
    return dt;
}

// Decode objects of the form:
// {'__class__': XXX, ...}
function decodeClass(obj) {
    if (obj == undefined || obj.__class__ == undefined) {
        return undefined;
    }

    if (obj.__class__ == 'Date') {
        return dateFromISO(obj.isoformat);
    }
    return undefined;
}

// A short date format, that will also parse with Date.parse().
// Namely, m/d/yyyy h:mm am/pm
// (time is optional if 12:00 am exactly)
function shortDate(d) {
    if (!(d instanceof Date)) {
        return undefined;
    }
    var s = (d.getMonth() + 1) + '/' +
        (d.getDate()) + '/' +
        (d.getFullYear());
    var hr = d.getHours();
    var ampm = ' am';
    if (hr >= 12) {
        ampm = ' pm';
    }
    hr = hr % 12;
    if (hr == 0) {
        hr = 12;
    }
    var sT = hr + ':' + fixedDigits(d.getMinutes(), 2) + ampm;
    if (sT != '12:00 am') {
        s += ' ' + sT;
    }
    return s;
}

// Turn an array of strings into a word list
function wordList(a) {
    a = base.map(a, string.strip);
    a = base.filter(a, function(s) {
        return s != '';
    });
    return a.join(', ');
}

function arrayFromWordList(s) {
    s = string.strip(s);
    var a = s.split(/[ ,]+/);
    a = base.filter(a, function(s) {
        return s != '';
    });
    return a;
}

var base64map =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Convert a base-64 string to a binary-encoded string
function base64ToString(base64) {
    var b;

    // Use browser-native function if it exists
    if (typeof atob == "function") {
        return atob(base64);
    }

    // Remove non-base-64 characters
    base64 = base64.replace(/[^A-Z0-9+\/]/ig, "");

    for (var chars = [], i = 0, imod4 = 0;
         i < base64.length;
         imod4 = ++i % 4) {
        if (imod4 == 0) {
            continue;
        }
        b = ((base64map.indexOf(base64.charAt(i - 1)) &
              (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2)) |
            (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2));
        chars.push(String.fromCharCode(b));
    }

    return chars.join('');

}

function canvasToPNG(canvas) {
    var prefix = "data:image/png;base64,";
    var data = canvas.toDataURL('image/png');
    if (data.indexOf(prefix) != 0) {
        return undefined;
    }
    //return base64ToString(data.substr(prefix.length));
    return data.substr(prefix.length);
}

function repeat(s, times) {
    return new Array(times + 1).join(s);
}
});
