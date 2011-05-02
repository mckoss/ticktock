var cLientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var types = require('org.startpad.types');
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
var reTags = /\s*\[([^\]]*)\]\s*/g;
var rePerson = /\s*@(\S+)\s*/g;
var reRemain = /\s*\+(\d+(?:\.\d*)?)\s*/g;

var now = new Date().getTime();

var historyProps = {'actual': true, 'remaining': true, 'status': true};
var taskProps = {'actual': true, 'remaining': true, 'status': true, 'description': true,
                 'history': true, 'id': true, 'created': true, 'modified': true,
                 'start': true, assignedTo: true, tags: true};

/* ==========================================================
   Project
   ========================================================== */

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

   // Move task by n positions up or down - but should not move
   // above it's own same-status section. TODO
   move: function (task, n) {
       var iTask = this.findIndex(task);
       var iMove = iTask + n;
       if (n == 0 || iMove < 0 || iMove >= this.tasks.length) {
           return;
       }
       task = this.tasks.splice(iTask, 1)[0];
       this.tasks.splice(iMove, 0, task);
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

/* ==========================================================
   Task
   ========================================================== */

function Task(options, project) {
    this.id = random.randomString(16);
    this.created = now;
    this.history = [];
    this.status = 'ready';
    this.remaining = 0;
    this.actual = 0;
    this.description = '';
    this.change(options);
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
               if (options.actual == undefined) {
                   options.actual = 0;
               }
               options.actual += hrs;
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
                   this.history.push({prop: prop, when: this.modified,
                       oldValue: oldValue, newValue: newValue});
                   }
           }
       }
       types.extend(this, options);
       return this;
   },

   getContentHTML: function () {
       var html = "";
       html += format.escapeHTML(this.description);
       var est = Math.max(this.actual, this.remaining) + 0.05;
       if (est > 0.05) {
           html += " (";
           if (this.actual) {
               html += format.thousands(this.actual + 0.05, 1) + '/';
           }
           html += format.thousands(est, 1) + ' ' + pluralize('hr', est) + ")";
       }
       if (this.assignedTo && this.assignedTo.length > 0) {
           html += '<div class="assigned">' + this.assignedTo.join(', ') + "</div>";
       }
       return html;
   },

   getEditText: function () {
       var text = "";
       text += this.description;
       if (this.tags && this.tags.length > 0) {
           text += ' [' + this.tags.join(',') + ']';
       }
       if (this.assignedTo && this.assignedTo.length > 0) {
           text += ' @' + this.assignedTo.join(' @');
       }
       var remaining = this.remaining + 0.05;
       if (remaining > 0.5) {
           text += ' +' + format.thousands(remaining, 1);
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

function pluralize(base, n) {
    return base + (n == 1 ? '' : 's');
}

// Parse description to exctract:
// +hrs - remaining
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
        return ' ';
    });

    desc = desc.replace(reTags, function (whole, key) {
        var keys = key.split(',');
        for (var i = 0; i < keys.length; i++) {
            tags.push(format.slugify(keys[i]));
        }
        return ' ';
    });

    desc = desc.replace(reRemain, function (whole, key) {
        remaining += parseFloat(key);
        return ' ';
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
