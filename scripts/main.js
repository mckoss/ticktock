var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var taskLib = require('com.pandatask.tasks');
var types = require('org.startpad.types');
require('org.startpad.string').patch();
require('org.startpad.funcs').patch();

exports.extend({
    'onReady': onReady,
    'getDoc': getDoc,
    'setDoc': setDoc
});

var client;
var doc;                            // Bound elements here
var project;
var editedTask;
var editedText;
var editedStatus;

var TASK = '<div id="{id}" class="task {className}">' +
           '<div id="action_{id}" class="action"><input type="checkbox" id="check_{id}"/></div>' +
           '<div id="promote_{id}" class="promote icon"></div>' +
           '<div class="delete icon" id="delete_{id}"></div>' +
           '<div class="content if-not-edit">{content}' + 
           '</div>' +
           '<div class="edit-container">' +
           '<textarea class="if-edit"></textarea>' +
           '</div></div>';
           
var UPDATE_INTERVAL = 1000 * 60;

function onReady() {
    handleAppCache();
    doc = dom.bindIDs();

    project = new taskLib.Project();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;
    client.autoLoad = true;
    
    client.addAppBar();
    refresh();
    
    $(window).keydown(onKey);
    $(document.body).mousedown(onClick);
    
    setInterval(taskLib.updateNow, UPDATE_INTERVAL);
}

function onClick(evt) {
    if (evt.target.tagName == 'TEXTAREA') {
        return;
    }
    if (editedTask) {
        saveTask(editedTask);
    }
    evt.preventDefault();
}

function setDoc(json) {
    project = new taskLib.Project(json.blob);
    refresh();
}

function getDoc() {
    return {
        blob: project.toJSON(),
        readers: ['public']
    };
}

function refresh() {
    $('#working-tasks').empty();
    $('#ready-tasks').empty();
    $('#done-tasks').empty();
    for (var i = 0; i < project.tasks.length; i++) {
        var task = project.tasks[i];
        addTask(task, task.status + '-tasks');
    }
    addTemplateTask();
}

function addTask(task, listName, className) {
    var top = className == 'top';
    if (top) {
        className = undefined;
    }
    if (className == undefined) {
        className = '';
    }
    content = task.getContentHTML ? task.getContentHTML() : task.description;
    $(doc[listName])[top ? 'prepend': 'append'](TASK.format(
        types.extend({content: content}, task)));
    $('#' + task.id).click(editTask.curry(task));
    if (listName == 'done-tasks') {
        $('#check_' + task.id)[0].checked = true;
    }
}

function addTemplateTask() {
    addTask({id: 'new', description: "Add new task"}, 'ready-tasks', 'new');
}

function saveTask(task) {
    var $taskDiv = $('#' + task.id);
    $taskDiv.removeClass('edit');
    var text = $('textarea', $taskDiv).val();
    editedTask = undefined;
    if (text == editedText && editedStatus == undefined) {
        return;
    }
    if (task.id == 'new') {
        task = project.addTask({description: text});
        $('#new').remove();
        addTask(task, 'ready-tasks', 'top');
        addTemplateTask();
    } else {
        task.change({description: text});
        if (editedStatus) {
            $taskDiv.remove();
            addTask(task, editedStatus + '-tasks', 'top');
        } else {
            $('.content', $taskDiv).html(task.getContentHTML());
        }
    }
    editedStatus = undefined;
    client.setDirty();
    client.save();
}

function editTask(task, evt) {
    if (editedTask) {
        saveTask(editedTask);
    }
    
    $('#' + task.id).addClass('edit');
    editedText = task.getEditText ? task.getEditText() : task.description;
    $('textarea', '#' + task.id).val(editedText).focus().select();
    editedTask = task;
    // We don't want the body click event to cancel enter edit mode.
    evt.stopPropagation();
    
    function moveIt(status) {
        if (editedTask.id != 'new') {
            editedStatus = status;
            editedTask.change({status: editedStatus});
        }
        saveTask(editedTask);
    }
    
    var id = $(evt.target).attr('id');
    if (id.length && id.split('_').length) {
        var type = id.split('_')[0];
        if (type == 'delete') {
            //deleteTask(task);
        }
        if (type == 'check') {
            if (editedTask.status == 'done') {
                moveIt('working');
                $('#' + id)[0].checked = false;
                return;
            }
            moveIt('done');
            $('#' + id)[0].checked = true;
        }
        if (type == 'promote') {
            if (editedTask.status == 'ready') {
                moveIt('working');
            } else if (editedTask.status == 'working') {
                moveIt('ready');
            }
        }
    }
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
        if (!evt.ctrlKey || editTask.id == 'new') {
            evt.preventDefault();
            return;
        }
        var taskSave = editedTask;
        saveTask(editedTask);
        project.move(taskSave, evt.keyCode == up ? -1 : 1);
        refresh();
        break;
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
