var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
require('org.startpad.funcs').patch();

exports.extend({
    'VERSION': "0.1.0",
    'Project': Project
});

function Project() {
    this.tasks = [];
}

Project.methods({
   addTask: function(task) {
       this.tasks.push(task);
       return task;
   } 
});
