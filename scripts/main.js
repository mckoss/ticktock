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
var editText;

var TASK = '<div id="{id}" class="task {className}">' +
           '<div class="content if-not-edit">{description} ({remaining} {units})</div>' +
           '<textarea class="if-edit"></textarea>' +
           '</div>';
           
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

function onOk(i) {
    var d = $('#description' + i).val();
    var t = $('#time' + i).val();
    var listName = addList[i];
    var units;
    units = t == 1 ? 'hour' : 'hours';
    var task = project.addTask({description: d, remaining: t, status: listName});
    addList[i] = undefined;
    $('#add' + i).remove();
    $('div.' + listName + '-tasks').append(TASK.format({
            id: task.id, description: task.description, time: task.remaining,
            units: task.units}));
    $('div#' + task.id).find();
    client.setDirty();
    client.save();
}

function refresh() {
    $('#ready-tasks').empty();
    $('#done-tasks').empty();
    for (var i = 0; i < project.tasks.length; i++) {
        var task = project.tasks[i];
        addTask(task, task.status + '-tasks');
    }
    addTemplateTask();
}

function addTask(task, listName, className) {
    if (className == undefined) {
        className = '';
    }
    $(doc[listName]).append(TASK.format(
        types.extend({units: pluralize('hr', task.remaining),
                      className: className}, task)));
    $('#' + task.id + ' .content').click(editTask.curry(task));
}

function addTemplateTask() {
    addTask({id: 'new', description: "Add new task"}, 'ready-tasks', 'new');
}

function saveTask(task) {
    $('#' + task.id).removeClass('edit');
    var text = $('textarea', '#' + task.id).val();
    editedTask = undefined;
    if (text == editText) {
        return;
    }
    if (task.id == 'new') {
        task = project.addTask({description: text});
        $('#new').remove();
        addTask(task, 'ready-tasks');
        addTemplateTask();
    } else {
        task.change({description: text});
        $('.content', '#' + task.id).text(task.description);
    }
    client.setDirty();
    client.save();
}

function editTask(task, evt) {
    if (editedTask) {
        saveTask(editedTask);
    }
    $('#' + task.id).addClass('edit');
    editText = task.description;
    $('textarea', '#' + task.id).val(editText).focus().select();
    editedTask = task;
    evt.stopPropagation();
}

function pluralize(base, n) {
    return base + (n == 1 ? '' : 's');
}

function onKey(evt) {
    var right = 39,
        left = 37,
        enter = 13;
    var toStatus = {37: 'ready', 39: 'done'};

    switch (evt.keyCode) {
    case enter:
    case left:
    case right:
        if (editedTask) {
            var newStatus = toStatus[evt.keyCode];
            if (editedTask.id != 'new' && newStatus) {
                editedTask.change({status: newStatus});
            }
            saveTask(editedTask);
        }
        break;
    case left:
        changeSlide(iSlide - 1);
        break;
    case right:
        changeSlide(iSlide + 1);
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
