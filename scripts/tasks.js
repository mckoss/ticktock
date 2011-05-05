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
        for (var i = 0; i < tasks.length; i++) {
            var task = tasks[i];
            this.tasks.unshift(new Task(task, this));
        }
    },

    addTask: function(task) {
        task = new Task(task, this);
        this.tasks.push(task);
        this._notify('add', task);
        return task;
    },

    _notify: function (action, target, options) {
        if (this.onTaskChange) {
            this.onTaskChange(types.extend({action: action, target: target}, options));
        }
    },

    install: function(task) {
        this.map[task.id] = task;
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
        this._notify('move', task, {from: iTask, to: iMove});
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
    this.change(options);
    if (this.history && this.history.length == 0) {
        delete this.history;
    }
    project.install(this);
}

Task.methods({
    change: function (options) {
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
        this._getProject()._notify('change', this, {properties: Object.keys(options)});
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
