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

/* ==========================================================
   Project

   tasks array is maintained in the following order:

   - Working tasks (new tasks added to top).
   - Ready tasks (new tasks added to top).
   - Completed (reverse chronological by completion date)
   ========================================================== */

function Project(options) {
    options = options || {};
    this.map = {};
    types.extend(this, types.project(options, 'onTaskEvent'));
    this.ready = [];
    this.working = [];
    this.done = [];
    if (!options.schema || options.schema == 1) {
        this.mergeTasks(options.tasks);
    } else {
        this.mergeTasks(options.ready);
        this.mergeTasks(options.working);
        this.mergeTasks(options.done);
    }
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
        this._notify('add', task);
        return this.insertTask(task);
    },

    insertTask: function (task) {
        var list = task.getList();
        // Add to top of list
        list.unshift(task);
        this.map[task.id] = task;
        return task;
    },

    removeTask: function (task) {
        task = this.getTask(task);
        var i = this.getListPosition(task);
        if (i != -1) {
            task.getList().splice(i, 1);
            return undefined;
        }
        delete this.map[task.id];
        return task;
    },

    _notify: function (action, target, options) {
        if (this.onTaskEvent) {
            this.onTaskEvent(types.extend({action: action, target: target}, options));
        }
    },

    getTask: function (id) {
        if (typeof id == 'string') {
            return this.map[id];
        }
        return id;
    },

    // Search for target - either a task or task.id - return position
    // it's list
    getListPosition: function (target) {
        target = this.getTask(target);
        if (target == undefined) {
            return -1;
        }
        var list = target.getList();
        for (var i = 0; i < list.length; i++) {
            if (list[i] === target) {
                return i;
            }
        }
    },

    // Move the first tasks to a position just after the second task
    // If no 2nd task is given, more the first task to position 0.
    moveAfter: function (mover, target) {
        target = this.getTask(target);
        mover = this.getTask(mover);
        if (target && mover.status != target.status) {
            mover.change({status: target.status});
        }
        var n = this.getListPosition(target) - this.getListPosition(mover);
        if (n < 0) {
            n++;
        }
        this.move(mover, n);
    },

    // Move task by n positions up or down
    move: function (task, n) {
        task = this.getTask(task);
        var list = task.getList();
        var iTask = this.getListPosition(task);
        var iMove = iTask + n;
        if (n == 0 || iMove < 0 || iMove >= list.length) {
            return;
        }
        task = list.splice(iTask, 1)[0];
        list.splice(iMove, 0, task);
        this._notify('move', task, {from: iTask, to: iMove});
    },

    // Object to use for JSON persistence
    toJSON: function () {
        return types.extend({schema: 2}, types.project(this, ['ready', 'working', 'done']));
    },

    // Calculate cumulative remaining, and actual
    // by Day.
    cumulativeData: function(prop) {
        var minDate, maxDate;
        var buckets = {};
        var bucket, i, j;

        var tasks = this.ready.concat(this.working, this.done);

        for (i = 0; i < tasks.length; i++) {
            var task = tasks[i];
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

// Properties we allow to be changed (id and history are internal).
var taskValidation = {id: 'string', history: 'array',
                      actual: 'number', remaining: 'number',
                      status: ['ready', 'working', 'done'],
                      description: 'string',
                      created: 'number', modified: 'number',
                      start: 'number', assignedTo: 'array', tags: 'array'};
// Record history for changes to these properties.
var historyProps = {'actual': true, 'remaining': true, 'status': true};


function Task(options, project) {
    // Don't migrate other tasks project over
    if (options._getProject) {
        delete options._getProject;
    }
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
}

Task.methods({
    change: function (options, quiet) {
        var changed = false;
        parseDescription(options);
        validateProperties(options, taskValidation);

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
            // Move between lists
            this._getProject().removeTask(this);
            this.status = options.status;
            this._getProject().insertTask(this);
            changed = true;
        }

        for (var prop in options) {
            if (options.hasOwnProperty(prop)) {
                if (this[prop] == options[prop]) {
                    continue;
                }
                changed = true;
                var oldValue = this[prop] || 0;
                var newValue = options[prop];
                this[prop] = options[prop];
                if (!historyProps[prop]) {
                    continue;
                }
                if (oldValue != newValue) {
                    if (!this.history) {
                        this.history = [];
                    }
                    this.history.push({prop: prop, when: this.modified,
                                       oldValue: oldValue, newValue: newValue});
                }
            }
        }
        if (changed && !quiet) {
            this._getProject()._notify('change', this, {properties: Object.keys(options)});
        }
        return this;
    },

    getList: function () {
        return this._getProject()[this.status];
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

function validateProperties(obj, validation) {
    var prop;
    for (prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            if (!validation[prop]) {
                throw new Error("Invalid property: " + prop);
            }
            if (types.typeOf(validation[prop]) == 'array') {
                var allowed = validation[prop];
                var found = false;
                for (var i = 0; i < allowed.length; i++) {
                    if (obj[prop] == allowed[i]) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    throw new Error("Invalid property: '{0}' is not one of '{1}'".format(
                        obj[prop], allowed.join(', ')));
                }
                continue;
            }
            if (types.typeOf(obj[prop]) != validation[prop]) {
                throw new Error("Invalid property: {0} is a {1} (expected a {2})".format(
                    prop, types.typeOf(obj[prop]), validation[prop]));
            }
        }
    }
}
