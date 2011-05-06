var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var taskLib = require('com.pandatask.tasks');
var types = require('org.startpad.types');
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
var editedTask;
var editedText;

var TASK =
    '<div id="{id}" class="task">' +
    '<input class="check" type="checkbox"/>' +
    '<div class="promote icon"></div>' +
    '<div class="delete icon"></div>' +
    '<div class="content if-not-edit">{content}</div>' +
    '<div class="edit-container if-edit"><textarea></textarea></div>' +
    '</div>';

var UPDATE_INTERVAL = 1000 * 60;

function onReady() {
    handleAppCache();
    $doc = dom.bindIDs();
    // REVIEW: This should be the native behavior of bindIDs.
    for (var id in $doc) {
        $doc[id] = $($doc[id]);
    }

    project = new taskLib.Project({onTaskEvent: onTaskEvent});
    client = new clientLib.Client(exports);
    client.saveInterval = 0;
    client.autoLoad = true;

    client.addAppBar();

    // Add the template new task
    onTaskEvent({action: 'add', target: {id: "new", description: "Add new task", status: 'new'}});

    $(window).keydown(onKey);
    $(document).mousedown(onClick);

    setInterval(onTimer, UPDATE_INTERVAL);
}

function setDoc(json) {
    project = new taskLib.Project(types.extend({}, json.blob, {onTaskEvent: onTaskEvent}));
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
    $('div.task', $doc['working-tasks']).each(function () {
        var task = project.getTask(this.id);
        $('.content', this).html(task.getContentHTML());
    });
}

function onClick(evt) {
    if (evt.target.tagName == 'TEXTAREA') {
        return;
    }
    if (editedTask) {
        saveTask(editedTask);
    }

    var task  = project.getTask(target.id || target.parentNode.id);

    if (!task) {
        evt.preventDefault();
        return;
    }

    var classes = target.className.split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
        switch (classes[i]) {
        case 'task':
            editTask(project.getTask(target.id));
            break;
        case 'check':
            task.change({status: task.status == 'done' ? 'ready' : 'done'});
            break;
        case 'delete':
            project.removeTask(task);
            break;
        case 'promote':
            task.change({status: task.status == 'ready' ? 'working': 'ready'});
            break;
        }
    }

    evt.stopPropogation();
    evt.preventDefault();
}

function onKey(evt) {
    var right = 39,
    left = 37,
    up = 38,
    down = 40,
    enter = 13;

    if (!editedTask) {
        return;
    }

    if (event.keyCode == enter) {
        saveTask(editedTask);
        return;
    }

    switch (evt.keyCode) {
    case up:
    case down:
        if (!evt.ctrlKey || editedTask.id == 'new') {
            evt.preventDefault();
            return;
        }
        var taskSave = editedTask;
        // TODO: should keep task in edit mode - so may need to
        // move OTHER tasks around it in the list!
        saveTask(editedTask);
        project.move(taskSave, evt.keyCode == up ? -1 : 1);
        break;
    }
}

function onTaskEvent(event) {
    console.log("Task {action}: {target.id} in {target.status}".format(event));
    var task = event.target;
    var listName = task.status + '-tasks';

    function updateTask() {
        var $taskDiv = getTaskDiv(task);
        var content = task.getContentHTML ? task.getContentHTML() : task.description;
        $('.content', $taskDiv).html(content);
        $('.check', $taskDiv)[0].checked = (task.status == 'done');
        client.setDirty();
    }

    switch (event.action) {
    case 'add':
        $doc[listName].prepend(TASK.format(task));
        updateTask();
        break;
    case 'change':
        updateTask();
        break;
    case 'remove':

        break;
    default:
        console.error("Unhandled event", event);
        break;
    }
    client.save();
}

function editTask(task, evt) {
    var $taskDiv = getTaskDiv(task);
    $taskDiv.addClass('edit');
    editedText = task.getEditText ? task.getEditText() : task.description;
    $('textarea', $taskDiv).val(editedText).focus().select();
    editedTask = task;
    // We don't want the body click event to cancel enter edit mode.
    evt.stopPropagation();
}

function saveTask(task) {
    var $taskDiv = getTaskDiv(task);
    $taskDiv.removeClass('edit');
    var text = $('textarea', $taskDiv).val();
    editedTask = undefined;
    if (text == editedText) {
        return;
    }
    if (task.id == 'new') {
        project.addTask({description: text});
    } else {
        task.change({description: text});
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

function getTaskDiv(task) {
    if (task.id == 'new') {
        return $('#new');
    }
    return $('#' + project.getTask(task).id);
}
