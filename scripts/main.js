var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var format = require('org.startpad.format');
var taskLib = require('com.pandatask.tasks');
var types = require('org.startpad.types');
var drag = require('org.startpad.drag');
var viz;
require('org.startpad.string').patch();
require('org.startpad.funcs').patch();

exports.extend({
    'onReady': onReady,
    'getDoc': getDoc,
    'setDoc': setDoc,
    'onSaveSuccess': onSaveSuccess
});

var client;
var $doc;                            // Bound elements here
var project;
var editedId;
var editedText;
var dragger;
var burnDownChart;

var TASK =
    '<div id="{id}" class="task">' +
    '<input class="check" type="checkbox"/>' +
    '<div class="promote icon"></div>' +
    '<div class="delete icon"></div>' +
    '<div class="content">{content}</div>' +
    '<textarea></textarea>' +
    '</div>';

var UPDATE_INTERVAL = 1000 * 60;
var DEBUG = true;

function onReady() {
    viz = google.visualization;
    handleAppCache();
    $doc = dom.bindIDs();
    // REVIEW: This should be the native behavior of bindIDs.
    for (var id in $doc) {
        $doc[id] = $($doc[id]);
    }

    // Style UI for touch devices
    if ('ontouchstart' in window) {
        $(document.body).addClass('touch-device');
    }

    burnDownChart = new viz.LineChart($doc['burn-down'][0]);

    project = new taskLib.Project({onTaskEvent: onTaskEvent});
    client = new clientLib.Client(exports);
    client.saveInterval = 2;
    client.autoLoad = true;

    client.addAppBar();

    // Add the template new task
    $doc['new-tasks'].append(TASK.format({id: "new", content: "Add new task"}));

    $(window).keydown(onKey);

    dragger = new TaskDragger();

    setInterval(onTimer, UPDATE_INTERVAL);
    if (DEBUG) {
        setInterval(function () {
            if (!project.consistencyCheck()) {
                alert("inconsistent project data");
            }
        }, 10000);
    }
}

function setDoc(json) {
    var listTypes = ['ready', 'working', 'done'];
    project = new taskLib.Project({onTaskEvent: onTaskEvent});
    for (var i = 0; i < listTypes.length; i++) {
        var name = listTypes[i] + '-tasks';
        $doc[name].empty();
    }
    project.fromJSON(json.blob);
    $doc["project-title"].text(json.title);
}

function getDoc() {
    return {
        blob: project.toJSON(),
        readers: ['public']
    };
}

function onSaveSuccess() {
    $doc["project-title"].text(client.meta.title);
}

function onTimer() {
    taskLib.updateNow();
    // Update timers in all working tasks
    $('div.task', $doc['working-tasks']).each(function () {
        var task = project.getTask(this.id);
        $('.content', this).html(task.getContentHTML());
    });
}

function TaskDragger() {
    drag.DragController.call(this, '.task:not(#new):not(.edit):not(.no-target)');
}

TaskDragger.subclass(drag.DragController, {
    onClick: function (evt) {
        onClick(evt);
    },

    onDragStart: function () {
        // Don't allow drag over the following task in it's list
        var task = project.getTask(this.$target.attr('id'));
        var pos = project.getListPosition(task);
        var nextTask = project[task.status][pos + 1];
        if (nextTask) {
            this.$nextTask = $('#' + nextTask.id);
            this.$nextTask.addClass('no-target');
        }
        drag.DragController.prototype.onDragStart.call(this);
    },

    onRelease: function (point) {
        if (this.$nextTask) {
            this.$nextTask.removeClass('no-target');
            this.$nextTask = undefined;
        }
        if (this.$lastDropTarget) {
            project.moveBefore(this.$target.attr('id'),
                               this.$lastDropTarget.attr('id'));
        }
        drag.DragController.prototype.onRelease.call(this, point);
    }
});

function onClick(evt) {
    var fPrevent = true;

    if (evt.target.tagName == 'TEXTAREA') {
        return;
    }
    if (editedId) {
        saveTask(editedId);
        // Signal iPad keyboard to retract
    }

    var $target = $(evt.target);
    var $taskDiv = $target.closest('.task');
    var id = $taskDiv.attr('id');

    if (!id) {
        evt.preventDefault();
        return;
    }

    var task = project.getTask(id);

    if ($target.hasClass('check')) {
        task.change({status: task.status != 'done' ? 'done' :
                     task.previous('status', 'working') });
    } else if ($target.hasClass('delete')) {
        if (confirm("Are you sure you want to delete this task?")) {
            task.change({status: 'deleted'});
        }
    } else if ($target.hasClass('promote')) {
        var other = { ready: 'working', working: 'ready', done: 'working' };
        task.change({ status: other[task.status] });
    } else {
        $taskDiv.addClass('edit');
        editedText = task ? task.getEditText() : '';
        $('textarea', $taskDiv).val(editedText).focus().select();
        editedId = id;
        // iPad won't bring up keyboard if default is prevented?
        fPrevent = false;
    }

    evt.stopPropagation();
    if (fPrevent) {
        evt.preventDefault();
    }
}

function onKey(evt) {
    var right = 39,
    left = 37,
    up = 38,
    down = 40,
    enter = 13;

    if (!editedId) {
        return;
    }

    if (evt.keyCode == enter) {
        saveTask(editedId);
        return;
    }

    switch (evt.keyCode) {
    case up:
    case down:
        if (!evt.ctrlKey || editedId == 'new') {
            evt.preventDefault();
            return;
        }
        var idSave = editedId;
        // TODO: should keep task in edit mode - so may need to
        // move OTHER tasks around it in the list!
        saveTask(editedId);
        project.move(idSave, evt.keyCode == up ? -1 : 1);
        break;
    default:
        break;
    }
}

function onTaskEvent(event) {
    var task = event.target;
    var listName = task.status + '-tasks';

    function updateTask() {
        var $taskDiv = $('#' + event.target.id);
        var content = task.getContentHTML ? task.getContentHTML() : task.description;
        $('.content', $taskDiv).html(content);
        $('.check', $taskDiv)[0].checked = (task.status == 'done');

        updateChart();
    }

    switch (event.action) {
    case 'add':
        if (task.status != 'deleted') {
            $doc[listName].prepend(TASK.format(task));
            updateTask();
        }
        break;
    case 'change':
        // Move task
        if (event.properties.indexOf('status') != -1) {
            $('#' + event.target.id).remove();
            if (task.status != 'deleted') {
                $doc[listName].prepend(TASK.format(task));
                updateTask();
            }
        } else {
            updateTask();
        }
        break;
    case 'move':
        $('#' + event.target.id).remove();
        var pos = project.getListPosition(event.target);
        $($('.task', $doc[listName])[pos]).before(TASK.format(task));
        updateTask();
        break;
    default:
        alert("Unhandled event: {action} on {target.id}".format(event));
        break;
    }
}

function updateChart() {
    var data = new viz.DataTable();
    data.addColumn('string', 'Day');
    data.addColumn('number', 'Remaining');

    var cumData = project.cumulativeData();
    data.addRows(cumData.length);
    for (var i = 0; i < cumData.length; i++) {
        data.setValue(i, 0, format.shortDate(new Date(cumData[i].date)));
        data.setValue(i, 1, cumData[i].remaining);
    }
    burnDownChart.draw(data, {
        legend: 'none',
        backgroundColor: '#FCEEE0',
        width: 200,
        height: 240,
        title: 'BURN DOWN',
        titleTextStyle: {fontName: 'helvetica', fontSize: 14}
    });
}

function saveTask(id) {
    var $taskDiv = $('#' + id);
    $taskDiv.removeClass('edit');
    $('textarea', $taskDiv).blur();
    var text = $('textarea', $taskDiv).val();
    editedId = undefined;
    if (text == editedText) {
        return;
    }
    if (id == 'new') {
        project.addTask({description: text});
    } else {
        project.getTask(id).change({description: text});
    }
}

// For offline - capable applications
function handleAppCache() {
    if (typeof applicationCache == 'undefined') {
        return;
    }

    if (applicationCache.status == applicationCache.UPDATEREADY) {
        applicationCache.swapCache();
        location.reload();
        return;
    }

    applicationCache.addEventListener('updateready', handleAppCache, false);
}
