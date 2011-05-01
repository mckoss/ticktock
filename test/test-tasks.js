namespace.module('com.ticktocktask.tasks.test', function (exports, require) {
    var ut = require('com.jquery.qunit');
    var utCoverage = require('org.startpad.qunit.coverage');
    var taskLib = require('com.ticktocktask.tasks');

    ut.module('tasks');

    ut.test("version", function () {
        var version = taskLib.VERSION.split('.');
        ut.equal(version.length, 3, "VERSION has 3 parts");
        ut.ok(version[0] == 0 && version[1] == 1, "tests for version 0.1");
    });
    
    ut.test("project", function () {
       var project = new taskLib.Project({title: "Sample Project"});
       ut.ok(project != undefined); 
       ut.equal(project.title, "Sample Project");
    });
    
    ut.test("tasks", function () {
        var project = new taskLib.Project();
        var task = project.addTask({description: "hello"});
        ut.equal(task.description, "hello");
        ut.ok(task.id.length > 10, "task id is " + task.id);
    });
    
    ut.test("toJSON", function () {
        var project = new taskLib.Project({title: "Sample"});
        project.addTask({description: "foo"});
        var json = project.toJSON();
        ut.equal(json.title, "Sample");
        ut.equal(json.tasks.length, 1);
        ut.equal(json.tasks[0].description, "foo");
    });
    
    ut.test("task change", function () {
        var project = new taskLib.Project({title: "Sample"});
        var task = project.addTask({description: "foo"});
        task.change({description: "bar"});
        ut.equal(task.description, "bar");
        ut.equal(task.history.length, 0);
        task.change({actual: 8});
        ut.equal(task.history.length, 1);
        ut.equal(task.history[0].newValue, 8);
        ut.equal(task.history[0].oldValue, 0);
        ut.equal(task.history[0].prop, 'actual');
    });

    
});
