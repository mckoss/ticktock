var cLientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var types = require('org.startpad.types');
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
    types.extend(this, options);
}

Task.methods({
   change: function (options) {
       types.extend(this, options);
       return this;
   } 
});
