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
    'VERSION': '0.1.0',
    'isArguments': function (value) { return isType(value, 'arguments'); },
    'isArray': function (value) { return isType(value, 'array'); },
    'copyArray': copyArray,
    'isType': isType,
    'typeOf': typeOf,
    'extend': extend,
    'project': project,
    'getFunctionName': getFunctionName
});

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
});

/* Source: src/funcs.js */
namespace.module('org.startpad.funcs', function (exports, require) {
var types = require('org.startpad.types');

exports.extend({
    'VERSION': '0.3.0',
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
    'setDoc': setDoc
});

var client;
var doc;                            // Bound elements here
var project;
var editTask;

var TASK = '<div id="{id}" class="task {className}">' +
           '<div class="content if-not-edit">{description} ({remaining} {units})</div>' +
           '<textarea class="if-edit"></textarea>' +
           '</div>';

function onReady() {
    handleAppCache();
    doc = dom.bindIDs();

    project = new taskLib.Project();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;
    client.autoLoad = true;

    client.addAppBar();
    refresh();

    $(window).keydown(onKey);
    $(window).click(onClick);
}

function setDoc(json) {
    project = new taskLib.Project(json.blob);
    refresh();
}

function getDoc() {
    return {
        blob: project.toJSON(),
        readers: ['public']
    };
}

function onOk(i) {
    var d = $('#description' + i).val();
    var t = $('#time' + i).val();
    var listName = addList[i];
    var units;
    units = t == 1 ? 'hour' : 'hours';
    var task = project.addTask({description: d, remaining: t, status: listName});
    addList[i] = undefined;
    $('#add' + i).remove();
    $('div.' + listName + '-tasks').append(TASK.format({
            id: task.id, description: task.description, time: task.remaining,
            units: task.units}));
    $('div#' + task.id).find();
    client.setDirty();
    client.save();
}

function refresh() {
    $('#ready-tasks').empty();
    $('#done-tasks').empty();
    for (var i = 0; i < project.tasks.length; i++) {
        var task = project.tasks[i];
        addTask(task, task.status + '-tasks');
    }
    addTemplateTask();
}

function addTask(task, listName, className) {
    if (className == undefined) {
        className = '';
    }
    $(doc[listName]).append(TASK.format(
        types.extend({units: pluralize('hr', task.remaining),
                      className: className}, task)));
    $('#' + task.id + ' .content').click(onTaskClick.curry(task));
}

function addTemplateTask() {
    $('#new').remove();
    addTask({id: 'new', description: "Add new task"}, 'ready-tasks', 'new');
}

function saveTask(task) {
    $('#' + task.id).removeClass('edit');
    var text = $('textarea', '#' + task.id).val();
    editTask = undefined;
    if (task.id == 'new') {
        if (text == "Add new task") {
            return;
        }
        task = project.addTask({description: text});
        addTask(task, 'ready-tasks');
        addTemplateTask();
    } else {
        task.change({description: text});
    }
    client.setDirty();
    client.save();
}

function onTaskClick(task) {
    if (editTask) {
        saveTask(editTask);
    }
    $('#' + task.id).addClass('edit');
    $('textarea', '#' + task.id).val(task.description).focus().select();
    editTask = task;
}

function pluralize(base, n) {
    return base + (n == 1 ? '' : 's');
}

function onKey(evt) {
    var right = 39,
        left = 37,
        enter = 13;

    switch (evt.keyCode) {
    case enter:
        if (editTask) {
            saveTask(editTask);
        }
        break;
    case left:
        changeSlide(iSlide - 1);
        break;
    case right:
        changeSlide(iSlide + 1);
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
var cLientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var types = require('org.startpad.types');
var random = require('org.startpad.random');
require('org.startpad.funcs').patch();

exports.extend({
    'VERSION': "0.1.0",
    'Project': Project,
    'updateNow': updateNow
});

var now = new Date().getTime();

var historyProps = {'actual': true, 'remaining': true};
var taskProps = {'actual': true, 'remaining': true, 'status': true, 'description': true,
                 'history': true, 'id': true, 'created': true, 'modified': true};

function Project(options) {
    this.map = {};
    types.extend(this, options);
    if (this.tasks == undefined) {
        this.tasks = [];
    }

    this.schema = 1;

    for (var i = 0; i < this.tasks.length; i++) {
        var task = this.tasks[i];
        this.tasks[i] = new Task(task, this);
    }
}

Project.methods({
   addTask: function(task) {
       task = new Task(task, this);
       this.tasks.push(task);
       return task;
   },

   install: function(task) {
       this.map[task.id] = task;
   },

   getTask: function (id) {
        return this.map[id];
   },

   findIndex: function (id) {
       for (var i = 0; i < this.tasks.length; i++) {
           var task = this.tasks[i];
           if (task.id == id) {
               return i;
           }
       }
   },

   // Move the first tasks to a position just after the second task
   // If no 2nd task is given, more the first task to position 0.
   moveAfter: function (idAfter, idBefore) {
       var iAfter, iBefore;
       iAfter = this.findIndex(idAfter);
       if (idBefore) {
           iBefore = this.findIndex(idBefore);
       } else {
           iBefore = -1;
       }

       var after = this.tasks.splice(iAfter, 1)[0];
       this.tasks.splice(iBefore + 1, 0, after);
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
           var hist = task.history;
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

function Task(options, project) {
    this.id = random.randomString(16);
    this.created = now;
    this.history = [];
    this.status = 'ready';
    this.change(options);
    project.install(this);
}

Task.methods({
   change: function (options) {
       this.modified = now;
       // status *->working: record start time
       // status working->* increment actual time
       if (options.status && options.status != this.status) {

       }
       for (var prop in options) {
           if (!taskProps[prop]) {
               throw new Error("Invalid task property: " + prop);
           }
           if (options.hasOwnProperty(prop)) {
               if (!historyProps[prop]) {
                   continue;
               }
               this.history.push({prop: prop, when: this.modified,
                                  oldValue: this[prop] || 0, newValue: options[prop]});
           }
       }
       types.extend(this, options);
       return this;
   }
});

function updateNow(d) {
    if (d == undefined) {
        d = new Date().getTime();
    }
    now = d;
}


});
