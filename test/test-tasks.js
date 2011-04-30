namespace.module('com.ticktocktask.tasks.test', function (exports, require) {
    var ut = require('com.jquery.qunit');
    var utCoverage = require('org.startpad.qunit.coverage');
    var tasks = require('com.ticktocktask.tasks');

    ut.module('tasks');

    coverage = new utCoverage.Coverage('com.ticktocktask.tasks');

    ut.test("version", function () {
        var version = tasks.VERSION.split('.');
        ut.equal(version.length, 3, "VERSION has 3 parts");
        ut.ok(version[0] == 0 && version[1] == 1, "tests for version 0.1");
    });

    coverage.testCoverage();

});
