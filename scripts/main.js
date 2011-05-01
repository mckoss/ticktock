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

var TASK = '<div id={id} class="task {className}">' +
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

function onAdd(listName) {
    var i = addList.length;
    addList[i] = listName;
    $('div.' + listName + '-tasks').append(ADD_TASK.format({i: i}));
    $('div.' + listName + '-tasks .desc').focus();
    
    $('#ok' + i).click(onOk.curry(i));
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
}

function addTask(task, listName, className) {
    if (className == undefined) {
        className = '';
    }
    $(doc[listName]).append(TASK.format(
        types.extend({units: pluralize('hr', task.remaining),
                      className: className}, task)));
    $('#' + task.id + ' .content').click(onTaskClick.curry(task));
}

function onTaskClick(task) {
    $('#' + task.id).addClass('edit');
}

function pluralize(base, n) {
    return base + (n == 1 ? '' : 's');
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
