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

var now;

function Project(options) {
    types.extend(this, options);
    if (this.tasks == undefined) {
        this.tasks = [];
    }

    for (var i = 0; i < this.tasks.length; i++) {
        var task = this.tasks[i];
        this.tasks[i] = new Task(task);
    }
}

Project.methods({
   addTask: function(task) {
       task = new Task(task);
       this.tasks.push(task);
       return task;
   },
   
   toJSON: function () {
       return this;
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
               var bucket = buckets[change.when];
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

function Task(options) {
    this.id = random.randomString(16);
    this.created = now;
    this.history = [];
    this.change(options);
}

historyProps = {'actual': true, 'remaining': true};

Task.methods({
   change: function (options) {
       this.modified = now;
       for (var prop in options) {
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
    now = new Date(d.getYear(), d.getMonth(), d.getDate())
}


