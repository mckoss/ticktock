var cLientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var types = require('org.startpad.types');
var random = require('org.startpad.random');
var format = require('org.startpad.format');
require('org.startpad.funcs').patch();

exports.extend({
    'VERSION': "0.1.0",
    'Project': Project,
    'Task': Task,
    'updateNow': updateNow
});

var msPerHour = 1000 * 60 * 60;

var now = new Date().getTime();

var historyProps = {'actual': true, 'remaining': true, 'status': true};
var taskProps = {'actual': true, 'remaining': true, 'status': true, 'description': true,
                 'history': true, 'id': true, 'created': true, 'modified': true,
                 'start': true};

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
       var est = this.actual + this.remaining + 0.05;
       if (est > 0) {
           html += " (";
           if (this.actual) {
               html += format.thousands(this.actual + 0.05, 1) + '/';
           }
           html += format.thousands(est, 1) + ' ' + pluralize('hr', est) + ")";
       }
       return html;
   }
});

function updateNow(d) {
    if (d == undefined) {
        d = new Date();
    }
    now = d.getTime();
}

function pluralize(base, n) {
    return base + (n == 1 ? '' : 's');
}
