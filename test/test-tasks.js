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
        ut.equal(task.history, undefined);

        taskLib.updateNow(new Date(new Date().getTime() + 1000));
        task.change({actual: 8});
        ut.equal(task.history.length, 1);
        ut.equal(task.history[0].newValue, 8);
        ut.equal(task.history[0].oldValue, 0);
        ut.equal(task.history[0].prop, 'actual');
        ut.ok(task.modified > task.created, "modified date update");
    });

    ut.test("move", function () {
        var task;
        var project = new taskLib.Project();

        function testOrder(reorder) {
            for (var i = 0; i < 10; i++) {
                task = project.tasks[i];
                ut.equal(task.description, "Task #" + reorder[i]);
            }
        }

        for (var i = 0; i < 10; i++) {
            project.addTask({description: "Task #" + (i + 1)});
        }
        testOrder([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        project.moveAfter(project.tasks[5], project.tasks[3]);
        testOrder([1, 2, 3, 4, 6, 5, 7, 8, 9, 10]);

        project.moveAfter(project.tasks[9]);
        testOrder([10, 1, 2, 3, 4, 6, 5, 7, 8, 9]);

        project.moveAfter(project.tasks[1], project.tasks[3]);
        testOrder([10, 2, 3, 1, 4, 6, 5, 7, 8, 9]);

        project.move(project.tasks[1], 4);
        testOrder([10, 3, 1, 4, 6, 2, 5, 7, 8, 9]);

        project.move(project.tasks[1], 0);
        testOrder([10, 3, 1, 4, 6, 2, 5, 7, 8, 9]);

        project.move(project.tasks[1], -1);
        testOrder([3, 10, 1, 4, 6, 2, 5, 7, 8, 9]);
    });

    ut.test("parseDescription", function () {
        var tests = [
            ["nothing here", "nothing here", {}],
            ["  extra space  ", "extra space", {}],
            ["my task @mike", "my task", {assignedTo: ['mike']}],
            ["our @mike task @bobby", "our task", {assignedTo: ['mike', 'bobby']}],
            ["Two people @sam @mike", "Two people", {assignedTo: ['sam', 'mike']}],
            ["more work +2", "more work", {remaining: 2.0}],
            ["tagged task #this-is-tagged #milestone", "tagged task",
             {tags: ['this-is-tagged', 'milestone']}],
            ["kitchen sink @mike #sink #kitchen +1.3", "kitchen sink",
             {assignedTo: ['mike'], tags: ['sink', 'kitchen'], remaining: 1.3}],
            ["Not a #1 tag", "Not a #1 tag", {}],
            ["hours +2h", "hours", {remaining: 2.0}],
            ["days +2d", "days", {remaining: 48.0}],
            ["minutes +15m", "minutes", {remaining: 0.25}]
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

    ut.test("Task", function () {
        var project = new taskLib.Project();
        var task = new taskLib.Task({description: "test task @mike #tag +2"}, project);

        var html = task.getContentHTML();
        ut.ok(html.indexOf("test task") != -1, "html description");
        ut.ok(html.indexOf(">tag<") != -1, "html tag: " + html);
        ut.ok(html.indexOf(">mike<") != -1, "html assignedTo: " + html);
        ut.ok(html.indexOf("2.0h") != -1, "html hours: " + html);

        var text = task.getEditText();
        ut.ok(text.indexOf("test task") != -1, "text description");
        ut.ok(text.indexOf("#tag") != -1, "text tag: " + text);
        ut.ok(text.indexOf("@mike") != -1, "text assignedTo: " + text);
        ut.ok(text.indexOf("+2") != -1, "text hours: " + text);
    });

    ut.test("cumulativeData", function () {
        var project = new taskLib.Project();
        var data = project.cumulativeData();
        ut.ok(types.isArray(data), "data array");
    });

    ut.test("onTaskChange", function () {
    });

    coverage.testCoverage();

});
