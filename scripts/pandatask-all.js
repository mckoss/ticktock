/* Source: scripts/namespace-plus.js */
/* Source: src/namespace.js */
/* Namespace.js - modular namespaces in JavaScript

   by Mike Koss - placed in the public domain
*/

(function(global) {
    var globalNamespace = global['namespace'];
    var VERSION = '3.0.1';

    function Module() {}

    function numeric(s) {
        if (!s) {
            return 0;
        }
        var a = s.split('.');
        return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
    }

    if (globalNamespace) {
        if (numeric(VERSION) <= numeric(globalNamespace['VERSION'])) {
            return;
        }
        Module = globalNamespace.constructor;
    } else {
        global['namespace'] = globalNamespace = new Module();
    }
    globalNamespace['VERSION'] = VERSION;

    function require(path) {
        path = path.replace(/-/g, '_');
        var parts = path.split('.');
        var ns = globalNamespace;
        for (var i = 0; i < parts.length; i++) {
            if (ns[parts[i]] === undefined) {
                ns[parts[i]] = new Module();
            }
            ns = ns[parts[i]];
        }
        return ns;
    }

    var proto = Module.prototype;

    proto['module'] = function(path, closure) {
        var exports = require(path);
        if (closure) {
            closure(exports, require);
        }
        return exports;
    };

    proto['extend'] = function(exports) {
        for (var sym in exports) {
            if (exports.hasOwnProperty(sym)) {
                this[sym] = exports[sym];
            }
        }
    };
}(this));
/* Source: src/types.js */
namespace.module('org.startpad.types', function (exports, require) {
exports.extend({
    'VERSION': '0.2.2',
    'isArguments': function (value) { return isType(value, 'arguments'); },
    'isArray': function (value) { return isType(value, 'array'); },
    'copyArray': copyArray,
    'isType': isType,
    'typeOf': typeOf,
    'extend': extend,
    'project': project,
    'getFunctionName': getFunctionName,
    'keys': Object.keys || keys,
    'patch': patch
});

function patch() {
    Object.keys = Object.keys || keys;  // JavaScript 1.8.5
    return exports;
}

// Can be used to copy Arrays and Arguments into an Array
function copyArray(arg) {
    return Array.prototype.slice.call(arg);
}

var baseTypes = ['number', 'string', 'boolean', 'array', 'function', 'date',
                 'regexp', 'arguments', 'undefined', 'null'];

function internalType(value) {
    return Object.prototype.toString.call(value).match(/\[object (.*)\]/)[1].toLowerCase();
}

function isType(value, type) {
    return typeOf(value) == type;
}

// Return one of the baseTypes as a string
function typeOf(value) {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    var type = internalType(value);
    if (baseTypes.indexOf(type) == -1) {
        type = typeof(value);
    }
    return type;
}

// IE 8 has bug that does not enumerates even own properties that have
// these internal names.
var enumBug = !{toString: true}.propertyIsEnumerable('toString');
var internalNames = ['toString', 'toLocaleString', 'valueOf',
                     'constructor', 'isPrototypeOf'];

// Copy the (own) properties of all the arguments into the first one (in order).
function extend(dest) {
    var i, j;
    var source;
    var prop;

    if (dest === undefined) {
        dest = {};
    }
    for (i = 1; i < arguments.length; i++) {
        source = arguments[i];
        for (prop in source) {
            if (source.hasOwnProperty(prop)) {
                dest[prop] = source[prop];
            }
        }
        if (!enumBug) {
            continue;
        }
        for (j = 0; j < internalNames.length; j++) {
            prop = internalNames[j];
            if (source.hasOwnProperty(prop)) {
                dest[prop] = source[prop];
            }
        }
    }
    return dest;
}

// Return new object with just the listed properties "projected"
// into the new object.  Ignore undefined properties.
function project(obj, props) {
    var result = {};
    if (typeof props == 'string') {
        props = [props];
    }
    for (var i = 0; i < props.length; i++) {
        var name = props[i];
        if (obj && obj.hasOwnProperty(name)) {
            result[name] = obj[name];
        }
    }
    return result;
}

function getFunctionName(fn) {
    if (typeof fn != 'function') {
        return undefined;
    }
    var result = fn.toString().match(/function\s*(\S+)\s*\(/);
    if (!result) {
        return '';
    }
    return result[1];
}

function keys(obj) {
    var list = [];

    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            list.push(prop);
        }
    }
    return list;
}
});

/* Source: src/funcs.js */
namespace.module('org.startpad.funcs', function (exports, require) {
var types = require('org.startpad.types');

exports.extend({
    'VERSION': '0.3.1',
    'methods': methods,
    'bind': bind,
    'decorate': decorate,
    'create': Object.create || create,
    'subclass': subclass,
    'mro': mro,
    'numericVersion': numericVersion,
    'monkeyPatch': monkeyPatch,
    'patch': patch
});

// Convert 3-part version number to comparable integer.
// Note: No part should be > 99.
function numericVersion(s) {
    if (!s) {
        return 0;
    }
    var a = s.split('.');
    return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
}

// Monkey patch additional methods to constructor prototype, but only
// if patch version is newer than current patch version.
function monkeyPatch(ctor, by, version, patchMethods) {
    if (ctor._patches) {
        var patchVersion = ctor._patches[by];
        if (numericVersion(patchVersion) >= numericVersion(version)) {
            return;
        }
    }
    ctor._patches = ctor._patches || {};
    ctor._patches[by] = version;
    methods(ctor, patchMethods);
}

function patch() {
    if (!Object.create) {
        Object.create = create;
    }

    monkeyPatch(Function, 'org.startpad.funcs', exports.VERSION, {
        'methods': function (obj) { methods(this, obj); },
        'curry': function () {
            var args = [this, undefined].concat(types.copyArray(arguments));
            return bind.apply(undefined, args);
        },
        'curryThis': function (self) {
            var args = types.copyArray(arguments);
            args.unshift(this);
            return bind.apply(undefined, args);
        },
        'decorate': function (decorator) {
            return decorate(this, decorator);
        },
        'subclass': function(parent, extraMethods) {
            subclass(this, parent, extraMethods);
        },
        'mro': function(ctors, extraMethods) {
            ctors.unshift(this);
            mro(ctors, extraMethods);
        }
    });
    return exports;
}

// Copy methods to a Constructor Function's prototype
function methods(ctor, obj) {
    types.extend(ctor.prototype, obj);
}

// Bind 'this' and/or arguments and return new function.
// Differs from native bind (if present) in that undefined
// parameters are merged.
function bind(fn, self) {
    var presets;

    // Handle the monkey-patched and in-line forms of curry
    if (arguments.length == 3 && types.isArguments(arguments[2])) {
        presets = Array.prototype.slice.call(arguments[2], self1);
    } else {
        presets = Array.prototype.slice.call(arguments, 2);
    }

    function merge(a1, a2) {
        var merged = types.copyArray(a1);
        a2 = types.copyArray(a2);
        for (var i = 0; i < merged.length; i++) {
            if (merged[i] === undefined) {
                merged[i] = a2.shift();
            }
        }
        return merged.concat(a2);
    }

    return function curried() {
        return fn.apply(self || this, merge(presets, arguments));
    };
}

// Wrap the fn function with a generic decorator like:
//
// function decorator(fn, arguments, wrapper) {
//   if (fn == undefined) { ... init ...; return;}
//   ...
//   result = fn.apply(this, arguments);
//   ...
//   return result;
// }
//
// The decorated function is created for each call
// of the decorate function.  In addition to wrapping
// the decorated function, it can be used to save state
// information between calls by adding properties to it.
function decorate(fn, decorator) {
    function decorated() {
        return decorator.call(this, fn, arguments, decorated);
    }
    // Init call - pass undefined fn - but available in this
    // if needed.
    decorator.call(fn, undefined, arguments, decorated);
    return decorated;
}

// Create an empty object whose __proto__ points to the given object.
// It's properties will "shadow" those of the given object until modified.
function create(obj) {
    function Create() {}
    Create.prototype = obj;
    return new Create();
}

// Classical JavaScript single-inheritance pattern.
// Call super constructor via this._super(args);
// Call super methods via this._proto.method.call(this, args)
function subclass(ctor, parent, extraMethods) {
    ctor.prototype = exports.create(parent.prototype);
    ctor.prototype.constructor = ctor;
    methods(ctor, extraMethods);
    return ctor;
}

// Define method resolution order for multiple inheritance.
// Builds a custom prototype chain, where each constructor's
// prototype appears exactly once.
function mro(ctors, extraMethods) {
    var parent = ctors.pop().prototype;
    var ctor;
    while (ctors.length > 0) {
        ctor = ctors.pop();
        var ctorName = types.getFunctionName(ctor);
        var proto = exports.create(parent);
        types.extend(proto, ctor.prototype);
        proto.constructor = ctor;
        proto[ctorName + '_super'] = parent;
        parent = proto;
    }
    ctor.prototype = parent;
    methods(ctor, extraMethods);
}
});

/* Source: src/string.js */
namespace.module('org.startpad.string', function (exports, require) {
var funcs = require('org.startpad.funcs');

exports.extend({
    'VERSION': '0.3.0',
    'patch': patch,
    'format': format,
    'strip': strip
});

function patch() {
    funcs.monkeyPatch(String, 'org.startpad.string', exports.VERSION, {
        'format': function formatFunction () {
            if (arguments.length == 1 && typeof arguments[0] == 'object') {
                return format(this, arguments[0]);
            } else {
                return format(this, arguments);
            }
        }
    });
    return exports;
}

var reFormat = /\{\s*([^} ]+)\s*\}/g;

// Format a string using values from a dictionary or array.
// {n} - positional arg (0 based)
// {key} - object property (first match)
// .. same as {0.key}
// {key1.key2.key3} - nested properties of an object
// keys can be numbers (0-based index into an array) or
// property names.
function format(st, args, re) {
    re = re || reFormat;
    if (st == undefined) {
        return "undefined";
    }
    st = st.toString();
    st = st.replace(re, function(whole, key) {
        var value = args;
        var keys = key.split('.');
        for (var i = 0; i < keys.length; i++) {
            key = keys[i];
            var n = parseInt(key);
            if (!isNaN(n)) {
                value = value[n];
            } else {
                value = value[key];
            }
            if (value == undefined) {
                return "";
            }
        }
        // Implicit toString() on this.
        return value;
    });
    return st;
}

// Like Python strip() - remove leading/trailing space
function strip(s) {
    return (s || "").replace(/^\s+|\s+$/g, "");
}
});

/* Source: scripts/random.js */
namespace.module('org.startpad.random', function (exports, require) {
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
});

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

/* Source: scripts/main.js */
namespace.module('com.pandatask.main', function (exports, require) {
var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var taskLib = require('com.pandatask.tasks');
var types = require('org.startpad.types');
require('org.startpad.string').patch();
require('org.startpad.funcs').patch();

exports.extend({
    'onReady': onReady,
    'getDoc': getDoc,
    'setDoc': setDoc,
    'onSaveSuccess': onSaveSuccess
});

var client;
var $doc;                            // Bound elements here
var project;
var editedTask;
var editedText;
var editedStatus;

var TASK =
    '<div id="{id}" class="task {className}">' +
    // REVIEW: Why do we need a div wrapper?
    '<div id="action_{id}" class="action"><input type="checkbox" id="check_{id}"/></div>' +
    '<div id="promote_{id}" class="promote icon"></div>' +
    '<div class="delete icon" id="delete_{id}"></div>' +
    '<div class="content if-not-edit">{content}</div>' +
    '<div class="edit-container if-edit"><textarea></textarea></div>' +
    '</div>';

var UPDATE_INTERVAL = 1000 * 60;

function onReady() {
    handleAppCache();
    $doc = dom.bindIDs();
    // REVIEW: This should be the native behavior of bindIDs.
    for (var id in $doc) {
        $doc[id] = $($doc[id]);
    }

    project = new taskLib.Project({onTaskChange: onTaskChange});
    client = new clientLib.Client(exports);
    client.saveInterval = 0;
    client.autoLoad = true;

    client.addAppBar();
    refresh();

    $(window).keydown(onKey);
    $(document).mousedown(onClick);

    setInterval(onTimer, UPDATE_INTERVAL);
}

function onTimer() {
    taskLib.updateNow();
    $('div.task', $doc['working-tasks']).each(function () {
        var task = project.getTask(this.id);
        $('.content', this).html(task.getContentHTML());
    });
}

function onClick(evt) {
    if (evt.target.tagName == 'TEXTAREA') {
        return;
    }
    if (editedTask) {
        saveTask(editedTask);
    }
    evt.preventDefault();
}

function setDoc(json) {
    project = new taskLib.Project(types.extend({}, json.blob, {onTaskChange: onTaskChange}));
    $doc["project-title"].text(json.title);
    refresh();
}

function getDoc() {
    return {
        blob: project.toJSON(),
        readers: ['public']
    };
}

function onTaskChange(event) {
    console.log("Task {action}: {target.id} in {target.status}".format(event));
}

function onSaveSuccess() {
    $doc["project-title"].text(client.meta.title);
}

function refresh() {
    $('#working-tasks').empty();
    $('#ready-tasks').empty();
    $('#done-tasks').empty();
    addTemplateTask();

    for (var i = 0; i < project.tasks.length; i++) {
        var task = project.tasks[i];
        addTask(task, task.status + '-tasks');
    }
    onTimer();
}

function addTask(task, listName, className) {
    var top = className == 'top';
    if (top) {
        className = undefined;
    }
    if (className == undefined) {
        className = '';
    }
    content = task.getContentHTML ? task.getContentHTML() : task.description;
    $doc[listName][top ? 'prepend': 'append'](TASK.format(
        types.extend({content: content}, task)));
    $('#' + task.id).click(editTask.curry(task));
    if (listName == 'done-tasks') {
        $('#check_' + task.id)[0].checked = true;
    }
}

function addTemplateTask() {
    addTask({id: 'new', description: "Add new task"}, 'ready-tasks', 'top');
}

function saveTask(task) {
    var $taskDiv = $('#' + task.id);
    $taskDiv.removeClass('edit');
    var text = $('textarea', $taskDiv).val();
    editedTask = undefined;
    if (text == editedText && editedStatus == undefined) {
        return;
    }
    if (task.id == 'new') {
        task = project.addTask({description: text});
        $('#new').remove();
        addTask(task, 'ready-tasks', 'top');
        addTemplateTask();
    } else {
        task.change({description: text});
        if (editedStatus) {
            $taskDiv.remove();
            addTask(task, editedStatus + '-tasks', 'top');
        } else {
            $('.content', $taskDiv).html(task.getContentHTML());
        }
    }
    editedStatus = undefined;
    client.setDirty();
    client.save();
}

function editTask(task, evt) {
    if (editedTask) {
        saveTask(editedTask);
    }

    $('#' + task.id).addClass('edit');
    editedText = task.getEditText ? task.getEditText() : task.description;
    $('textarea', '#' + task.id).val(editedText).focus().select();
    editedTask = task;
    // We don't want the body click event to cancel enter edit mode.
    evt.stopPropagation();

    function moveIt(status) {
        if (editedTask.id != 'new') {
            editedStatus = status;
            editedTask.change({status: editedStatus});
        }
        saveTask(editedTask);
    }

    var id = $(evt.target).attr('id');
    if (id.length && id.split('_').length) {
        var type = id.split('_')[0];
        if (type == 'delete') {
            //deleteTask(task);
        }
        if (type == 'check') {
            if (editedTask.status == 'done') {
                moveIt('working');
                $('#' + id)[0].checked = false;
                return;
            }
            moveIt('done');
            $('#' + id)[0].checked = true;
        }
        if (type == 'promote') {
            if (editedTask.status == 'ready') {
                moveIt('working');
            } else if (editedTask.status == 'working') {
                moveIt('ready');
            }
        }
    }
}

function onKey(evt) {
    var right = 39,
    left = 37,
    up = 38,
    down = 40,
    enter = 13;

    if (!editedTask) {
        return;
    }

    if (event.keyCode == enter) {
        saveTask(editedTask);
        return;
    }

    switch (evt.keyCode) {
    case up:
    case down:
        if (!evt.ctrlKey || editedTask.id == 'new') {
            evt.preventDefault();
            return;
        }
        var taskSave = editedTask;
        saveTask(editedTask);
        project.move(taskSave, evt.keyCode == up ? -1 : 1);
        refresh();
        break;
    }
}

// For offline - capable applications
function handleAppCache() {
    if (typeof applicationCache == 'undefined') {
        return;
    }

    if (applicationCache.status == applicationCache.UPDATEREADY) {
        applicationCache.swapCache();
        location.reload();
        return;
    }

    applicationCache.addEventListener('updateready', handleAppCache, false);
}
});

/* Source: scripts/tasks.js */
namespace.module('com.pandatask.tasks', function (exports, require) {
var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var types = require('org.startpad.types').patch();
var string = require('org.startpad.string');
var random = require('org.startpad.random');
var format = require('org.startpad.format');
require('org.startpad.funcs').patch();

exports.extend({
    'VERSION': "0.1.0",
    'Project': Project,
    'Task': Task,
    'updateNow': updateNow,
    'parseDescription': parseDescription
});

var msPerHour = 1000 * 60 * 60;
var reTag = /\s+#([a-zA-Z]\S+)/g;
var rePerson = /\s+@(\S+)/g;
var reRemain = /\s+\+(\d+(?:\.\d*)?)([dhm]?)/g;

var now = new Date().getTime();

var historyProps = {'actual': true, 'remaining': true, 'status': true};
var taskProps = {'actual': true, 'remaining': true, 'status': true, 'description': true,
                 'history': true, 'id': true, 'created': true, 'modified': true,
                 'start': true, assignedTo: true, tags: true};

/* ==========================================================
   Project
   ========================================================== */

function Project(options) {
    options = options || {};
    this.map = {};
    types.extend(this, types.project(options, 'onTaskChange'));
    this.tasks = [];
    this.schema = 1;
    this.mergeTasks(options.tasks);
}

Project.methods({
    mergeTasks: function (tasks) {
        if (!tasks) {
            return;
        }
        for (var i = tasks.length - 1; i >= 0; i--) {
            this.addTask(tasks[i]);
        }
    },

    addTask: function(task) {
        task = new Task(task, this);
        this.tasks.unshift(task);
        return task;
    },

    _notify: function (action, target, options) {
        if (this.onTaskChange) {
            this.onTaskChange(types.extend({action: action, target: target}, options));
        }
    },

    install: function(task) {
        this.map[task.id] = task;
        this._notify('add', task);
    },

    getTask: function (id) {
        return this.map[id];
    },

    // Search for target - either a task or task.id - return index in array
    findIndex: function (target) {
        for (var i = 0; i < this.tasks.length; i++) {
            var task = this.tasks[i];
            if (typeof target == 'string') {
                task = task.id;
            }
            if (task === target) {
                return i;
            }
        }
    },

    // Move the first tasks to a position just after the second task
    // If no 2nd task is given, more the first task to position 0.
    moveAfter: function (mover, target) {
        var n = this.findIndex(target) - this.findIndex(mover);
        if (n < 0) {
            n++;
        }
        this.move(mover, n);
    },

    // Move task by n positions up or down
    // TODO: do not move outside its own same-status section.
    move: function (task, n) {
        var iTask = this.findIndex(task);
        var iMove = iTask + n;
        if (n == 0 || iMove < 0 || iMove >= this.tasks.length) {
            return;
        }
        task = this.tasks.splice(iTask, 1)[0];
        this.tasks.splice(iMove, 0, task);
        this._notify('move', task, {from: iTask, to: iMove,
                                    fromList: task.status, toList: task.status});
    },

    toJSON: function () {
        return {tasks: this.tasks};
    },

    // Calculate cumulative remaining, and actual
    // by Day.
    cumulativeData: function(prop) {
        var minDate, maxDate;
        var buckets = {};
        var bucket, i, j;

        for (i = 0; i < this.tasks.length; i++) {
            var task = this.tasks[i];
            var hist = task.history || [];
            for (j = 0; j < hist.length; j++) {
                var change = hist[j];
                if (minDate == undefined || change.when < minDate) {
                    minDate = change.when;
                }
                if (maxDate == undefined || change.when > maxDate) {
                    maxDate = change.when;
                }
                bucket = buckets[change.when];
                if (bucket == undefined) {
                    bucket = {actual: 0, remaining: 0};
                    buckets[change.when] = bucket;
                }
                bucket[change.prop] += change.newValue - change.oldValue;
            }
        }
        var results = [];
        var cumulative = {actual: 0, remaining: 0};
        for (var curDate = minDate; curDate <= maxDate; curDate = tomorrow(curDate)) {
            bucket = buckets[curDate];
            if (bucket != undefined) {
                cumulative.actual += bucket.actual;
                cumulative.remaining += bucket.remaining;
            }
            results[curDate] = types.extend({date: curDate}, cumulative);
        }
        return results;
    }

});

/* ==========================================================
   Task
   ========================================================== */

function Task(options, project) {
    this._getProject = function () { return project; };

    this.id = random.randomString(16);
    this.created = now;
    this.status = 'ready';
    this.remaining = 0;
    this.actual = 0;
    this.description = '';
    this.change(options, true);
    if (this.history && this.history.length == 0) {
        delete this.history;
    }
    project.install(this);
}

Task.methods({
    change: function (options, quiet) {
        this.modified = now;
        // status *->working: record start time
        // status working->* increment actual time
        if (options.status && options.status != this.status) {
            if (options.status == 'working') {
                this.start = now;
            } else if (this.status == 'working') {
                var hrs = (now - this.start) / msPerHour;
                delete this.start;
                this.actual += hrs;
            }
        }

        parseDescription(options);

        for (var prop in options) {
            if (!taskProps[prop]) {
                throw new Error("Invalid task property: " + prop);
            }
            if (options.hasOwnProperty(prop)) {
                if (!historyProps[prop]) {
                    continue;
                }
                var oldValue = this[prop] || 0;
                var newValue = options[prop];
                if (oldValue != newValue) {
                    if (!this.history) {
                        this.history = [];
                    }
                    this.history.push({prop: prop, when: this.modified,
                                       oldValue: oldValue, newValue: newValue});
                }
            }
        }
        types.extend(this, options);
        if (!quiet) {
            this._getProject()._notify('change', this, {properties: Object.keys(options)});
        }
        return this;
    },

    getContentHTML: function () {
        var html = "";
        html += '<span class="description">{0}</span>'.format(format.escapeHTML(this.description));
        if (this.actual || this.remaining || (this.start && now > this.start)) {
            var actual = this.actual;
            if (this.start) {
                actual += (now - this.start) / msPerHour;
            }

            html += " (";
            if (actual) {
                html += "<span{0}>{1}</span>{2}".format(
                    this.remaining && actual > this.remaining ? ' class="overdue"' : '',
                    timeString(actual),
                    this.remaining ? '/' : '');
            }
            if (this.remaining) {
                html += timeString(this.remaining);
            }
            html += ")";
        }
        if (this.assignedTo && this.assignedTo.length > 0) {
            html += '<div class="assigned">' + this.assignedTo.join(', ') + "</div>";
        }
        if (this.tags && this.tags.length > 0) {
            html += '<div class="tags">' + this.tags.join(', ') + "</div>";
        }
        return html;
    },

    getEditText: function () {
        var text = "";
        text += this.description;
        if (this.tags && this.tags.length > 0) {
            text += ' #' + this.tags.join(' #');
        }
        if (this.assignedTo && this.assignedTo.length > 0) {
            text += ' @' + this.assignedTo.join(' @');
        }
        if (this.remaining > 0) {
            text += ' +' + timeString(this.remaining);
        }
        return text;
    }

});

/* ==========================================================
   Helper functions
   ========================================================== */

function updateNow(d) {
    if (d == undefined) {
        d = new Date();
    }
    now = d.getTime();
}

function timeString(hrs) {
    if (hrs > 48) {
        return format.thousands(hrs / 24 + 0.05, 1) + 'd';
    }

    var min = hrs * 60;

    // Fractional hours
    if (min > 15) {
        return format.thousands(hrs + 0.05, 1) + 'h';
    }

    return format.thousands(min + 0.5, 0) + 'm';
}

// Parse description to exctract:
// +hrs - remaining (optional 'h', 'd', or 'm' suffix)
// [tags] - tags
// @person - assignedTo
function parseDescription(options) {
    if (options.description == undefined) {
        return;
    }
    var assignedTo = [];
    var tags = [];
    var remaining = 0;
    var desc = options.description;

    desc = desc.replace(rePerson, function (whole, key) {
        assignedTo.push(key);
        return '';
    });

    desc = desc.replace(reTag, function (whole, key) {
        tags.push(key);
        return '';
    });

    desc = desc.replace(reRemain, function (whole, key, units) {
        var factor = 1;
        switch (units) {
        case 'd':
            factor = 24;
            break;
        case 'm':
            factor = 1 / 60;
            break;
        }
        remaining += parseFloat(key) * factor;
        return '';
    });

    options.description = string.strip(desc);

    if (remaining > 0) {
        options.remaining = remaining;
    }

    if (assignedTo.length > 0) {
        options.assignedTo = assignedTo;
    }

    if (tags.length > 0) {
        options.tags = tags;
    }
}
});

