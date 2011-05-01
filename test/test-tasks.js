namespace.module('com.pandatask.tasks.test', function (exports, require) {
    var ut = require('com.jquery.qunit');
    var types = require('org.startpad.types');
    var utCoverage = require('org.startpad.qunit.coverage');
    var taskLib = require('com.pandatask.tasks');

    ut.module('com.pandatask.tasks');
    
    var coverage = new utCoverage.Coverage('com.pandatask.tasks');

    ut.test("version", function () {
        var version = taskLib.VERSION.split('.');
        ut.equal(version.length, 3, "VERSION has 3 parts");
        ut.ok(version[0] == 0 && version[1] == 1, "tests for version 0.1");
    });
    
    ut.test("project", function () {
       var project = new taskLib.Project();
       ut.ok(project != undefined); 
       ut.ok(types.isArray(project.tasks));
    });
    
    ut.test("tasks", function () {
        var project = new taskLib.Project();
        var task = project.addTask({description: "hello"});
        ut.equal(task.description, "hello");
        ut.ok(task.id.length > 10, "task id is " + task.id);
        ut.equal(types.typeOf(task.modified), 'number', 'modified');
        ut.equal(types.typeOf(task.created), 'number', 'created');
        
        var other = project.getTask(task.id);
        ut.strictEqual(task, other, "id lookup");
    });
    
    ut.test("toJSON", function () {
        var project = new taskLib.Project();
        project.addTask({description: "foo"});
        var json = project.toJSON();
        ut.equal(json.tasks.length, 1);
        ut.equal(json.tasks[0].description, "foo");
    });
    
    ut.test("task change", function () {
        var project = new taskLib.Project();
        var task = project.addTask({description: "foo"});
        task.change({description: "bar"});
        ut.equal(task.description, "bar");
        ut.equal(task.history.length, 0);
        
        taskLib.updateNow(new Date(new Date().getTime() + 1000));
        task.change({actual: 8});
        ut.equal(task.history.length, 1);
        ut.equal(task.history[0].newValue, 8);
        ut.equal(task.history[0].oldValue, 0);
        ut.equal(task.history[0].prop, 'actual');
        ut.ok(task.modified > task.created, "modified date update");
    });
    
    ut.test("move after", function () {
        var task;
        var project = new taskLib.Project();
        
        for (var i = 0; i < 10; i++) {
            project.addTask({description: "Task #" + (i + 1)});
        }
        for (var i = 0; i < 10; i++) {
            task = project.tasks[i];
            ut.equal(task.description, "Task #" + (i + 1));
        }
        project.moveAfter(project.tasks[5], project.tasks[3]);
        var reorder = [1, 2, 3, 4, 6, 5, 7, 8, 9, 10];
        for (var i = 0; i < 10; i++) {
            task = project.tasks[i];
            ut.equal(task.description, "Task #" + reorder[i]);
        }
    });
    
    ut.test("parseDescription", function () {
        var tests = [
            ["nothing here", "nothing here", {}],
            ["  extra space  ", "extra space", {}],
            ["my task @mike", "my task", {assignedTo: ['mike']}],
            ["our @mike task @bobby", "our task", {assignedTo: ['mike', 'bobby']}],
            ["more work +2", "more work", {remaining: 2.0}],
            ["tagged task [this is tagged, milestone]", "tagged task",
             {tags: ['this-is-tagged', 'milestone']}],
            ["kitchen sink @mike [sink, kitchen] +1.3", "kitchen sink",
             {assignedTo: ['mike'], tags: ['sink', 'kitchen'], remaining: 1.3}]
        ];
        
        for (var i = 0; i < tests.length; i++) {
            var test = tests[i];
            var options = {description: test[0]};
            taskLib.parseDescription(options);
            ut.equal(options.description, test[1], test[0]);
            test[2].description = test[1];
            ut.deepEqual(options, test[2], test[0] + " properties");
        }
    });

    coverage.testCoverage();
    
});
