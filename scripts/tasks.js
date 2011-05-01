var cLientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var types = require('org.startpad.types');
var random = require('org.startpad.random');
require('org.startpad.funcs').patch();

exports.extend({
    'VERSION': "0.1.0",
    'Project': Project
});

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
   }
});

function Task(options) {
    this.id = random.randomString(16);
    this.created = timestamp();
    this.history = [];
    this.change(options);
}

historyProps = {'estimate': true, 'actual': true, 'remaining': true};

Task.methods({
   change: function (options) {
       this.modified = timestamp();
       for (var prop in options) {
           if (options.hasOwnProperty(prop)) {
               if (!historyProps[prop]) {
                   continue;
               }
               this.history.push({prop: prop, when: this.modified,
                                  oldValue: this[prop], newValue: options[prop]});
           }
       }
       types.extend(this, options);
       return this;
   }
});

function timestamp() {
    return new Date().getTime();
}
