var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var types = require('org.startpad.types');
require('org.startpad.funcs').patch();

exports.extend({
    'VERSION': "0.1.0",
    'Project': Project
});

function Project(options) {
    types.extend(this, options);
    this.tasks = [];
}

Project.methods({
   addTask: function(task) {
       this.tasks.push(task);
       return task;
   },
   
   toJSON: function () {
       
   }
});
