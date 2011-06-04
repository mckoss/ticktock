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
        ut.ok(types.isArray(project.ready));
        ut.ok(types.isArray(project.working));
        ut.ok(types.isArray(project.done));
        ut.ok(project.consistencyCheck());
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
        ut.ok(project.consistencyCheck());
    });

    ut.test("toJSON", function () {
        var project = new taskLib.Project();
        project.addTask({description: "foo"});
        var json = project.toJSON();
        ut.equal(json.schema, 3, "schema");
        ut.equal(json.ready.length, 1);
        ut.equal(json.ready[0].description, "foo");
        ut.equal(json.working.length, 0);
        ut.equal(json.done.length, 0);
        ut.equal(json.deleted.length, 0);
        ut.ok(project.consistencyCheck());
    });

    ut.test("task change", function () {
        var project = new taskLib.Project();
        var task = project.addTask({description: "foo"});
        task.change({description: "bar"});
        ut.equal(task.description, "bar");
        ut.ok(!task.hasOwnProperty('history'));
        ut.ok(!task.hasOwnProperty('tags'));
        ut.ok(!task.hasOwnProperty('assignedTo'));
        ut.equal(task.previous('actual', 99), 99, "Default previous value");
        ut.ok(project.consistencyCheck(), "consistency 1");

        task.change({description: "bar #tag @mike"});
        ut.equal(task.description, "bar");
        ut.ok(task.hasOwnProperty('history'));
        ut.deepEqual(task.tags, ['tag']);
        ut.deepEqual(task.assignedTo, ['mike']);
        ut.ok(project.consistencyCheck(), "consistency 1a");

        taskLib.updateNow(new Date(new Date().getTime() + 1000));
        task.change({actual: 8});
        ut.equal(task.previous('actual', 99), 0, "Previous actual value");
        ut.equal(task.history.length, 3);
        ut.ok(task.modified > task.created, "modified date update");
        ut.ok(project.consistencyCheck(), "consistency 2");

        ut.strictEqual(project.ready, task.getList(), "task in ready");
        task.change({status: 'working'});
        ut.equal(task.previous('status', 'bogus'), 'ready', "Previous status value");
        ut.ok(project.consistencyCheck(), "consistency 3");
        ut.strictEqual(project.working, task.getList(), "task in working");
        ut.ok(project.consistencyCheck(), "consistency 4");

        task.change({status: 'deleted'});
        ut.equal(task.previous('status', 'bogus'), 'working', "Previous status value");
        ut.strictEqual(project.deleted, task.getList(), "task in deleted");
        ut.ok(project.consistencyCheck(), "consistency 5");

        ut.raises(function () { task.change({noSuchProperty: 1}); },
                  /Invalid property/, "Unknown property");
        ut.raises(function () { task.change({status: 'what'}); },
                  /'what' is not one of/, "Invalid value");
        ut.raises(function () { task.change({actual: 'not a number'}); },
                  /actual is a string \(expected a number\)/, "Require a number");
        ut.ok(project.consistencyCheck(), "consistency 6");
    });

    ut.test("move", function () {
        var task;
        var project = new taskLib.Project();

        function testOrder(reorder) {
            for (var i = 0; i < 10; i++) {
                task = project.ready[i];
                ut.equal(task.description, "Task #" + reorder[i]);
            }
        }

        for (var i = 0; i < 10; i++) {
            // addTask inserts at the head of the ready list
            project.addTask({description: "Task #" + (10 - i)});
        }
        testOrder([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

        project.moveAfter(project.ready[5], project.ready[3]);
        testOrder([1, 2, 3, 4, 6, 5, 7, 8, 9, 10]);

        project.moveAfter(project.ready[9]);
        testOrder([10, 1, 2, 3, 4, 6, 5, 7, 8, 9]);

        project.moveAfter(project.ready[1], project.ready[3]);
        testOrder([10, 2, 3, 1, 4, 6, 5, 7, 8, 9]);

        project.move(project.ready[1], 4);
        testOrder([10, 3, 1, 4, 6, 2, 5, 7, 8, 9]);

        project.move(project.ready[1], 0);
        testOrder([10, 3, 1, 4, 6, 2, 5, 7, 8, 9]);

        project.move(project.ready[1], -1);
        testOrder([3, 10, 1, 4, 6, 2, 5, 7, 8, 9]);

        project.moveBefore(project.ready[1], project.ready[0]);
        testOrder([10, 3, 1, 4, 6, 2, 5, 7, 8, 9]);

        project.moveBefore(project.ready[0], project.ready[1]);
        testOrder([10, 3, 1, 4, 6, 2, 5, 7, 8, 9]);

        project.moveBefore(project.ready[0], project.ready[2]);
        testOrder([3, 10, 1, 4, 6, 2, 5, 7, 8, 9]);

        ut.ok(project.consistencyCheck());
    });

    ut.test("parseDescription", function () {
        var options;

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
            options = {description: test[0]};
            taskLib.parseDescription(options);
            ut.equal(options.description, test[1], test[0]);
            test[2].description = test[1];
            ut.deepEqual(options, test[2], test[0] + " properties");
        }

        options = {description: "generic @bobby", assignedTo: ["mike"], tags: ["bug"]};
        taskLib.parseDescription(options);
        ut.deepEqual(options, {description: "generic", assignedTo: ["bobby"], tags: ["bug"]});
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
        ut.ok(project.consistencyCheck());
    });

    ut.test("cumulativeData", function () {
        var project = new taskLib.Project();

        taskLib.updateNow(new Date(2011, 6, 3));
        var task1 = project.addTask({description: "task 1"});
        var task2 = project.addTask({description: "task 2"});
        task2.change({status: 'working'});

        taskLib.updateNow(new Date(2011, 6, 4));
        var task3 = project.addTask({description: "task 3"});
        task2.change({status: 'done'});

        taskLib.updateNow(new Date(2011, 6, 5));
        task1.change({status: 'done'});
        task3.change({status: 'deleted'});

        var data = project.cumulativeData();
        ut.ok(types.isArray(data), "data array");
        ut.equal(data.length, 3, "3 data points");
        ut.deepEqual(data[0], {day: 15158, ready: 1, working: 1, done: 0});
        ut.deepEqual(data[1], {day: 15159, ready: 2, working: 0, done: 1});
        ut.deepEqual(data[2], {day: 15160, ready: 0, working: 0, done: 2});

        ut.ok(project.consistencyCheck());
    });

    ut.test("onTaskEvent", function () {
        var project = new taskLib.Project({onTaskEvent: onTaskEvent});
        var expects = [];
        var task1, task2, task3;

        function onTaskEvent(event) {
            var expect = expects.shift();
            var prop;
            if (expect == undefined) {
                ut.ok(false, "No event expected: " + event.action);
            }
            if (expect.target) {
                ut.strictEqual(event.target, expect.target);
            }
            if (expect.task) {
                for (prop in expect.task) {
                    ut.equal(event.target[prop], expect.task[prop],
                             prop + ' == ' + expect.task[prop]);
                }
            }
            delete expect.target;
            delete expect.task;
            for (prop in expect) {
                ut.deepEqual(event[prop], expect[prop], prop + " == " + expect[prop]);
            }
        }

        expects.push({action: 'add', task: {description: "test 3"}});
        task3 = project.addTask({description: "test 3"});

        expects.push({action: 'add', task: {description: "test 2"}});
        task2 = project.addTask({description: "test 2"});

        expects.push({action: 'add', task: {description: "test 1"}});
        task1 = project.addTask({description: "test 1"});

        expects.push({action: 'change', target: task2,
                      task: {description: "task 2 prime"},
                      properties: ['description']});
        task2.change({description: "task 2 prime"});

        expects.push({action: 'move', target: task2});
        project.move(task2.id, 1);

        expects.push({action: 'change', target: task2,
                      task: {status: "working"}
                     });
        task2.change({status: 'working'});

        expects.push({action: 'change', target: task2,
                      task: {status: "ready"}
                     });
        expects.push({action: 'move', target: task2});
        project.moveBefore(task2, task3);

        ut.equal(expects.length, 0, "Processed all expected notifications: " +
                 expects.map(function (x) { return x.action; }).join(', '));
        ut.ok(project.consistencyCheck());
    });

    coverage.testCoverage();

});
