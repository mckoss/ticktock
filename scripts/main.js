var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var taskLib = require('com.pandatask.tasks');
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
var addList = [];

var ADD_TASK = '<div id=add{i} class=newTask>' +
               '<div> What:<input id=description{i} class=desc /></div>' +
               '<div> Time:<input type=number id=time{i} class=time /> hours' +
               '<input id=ok{i} type=button value=OK />' + 
               '</div>';
var TASK = '<div id={id} class=task>' +
           '<img src="images/left.png" class=left >' +
           '<div class=content>{description}. {time} {units}</div>' +
           '<img src="images/right.png" class=right ></div>';
           
function onReady() {
    handleAppCache();
    doc = dom.bindIDs();

    project = new taskLib.Project();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;
    client.autoLoad = true;
    
    $('#ready-add').click(onAdd.curry('ready'));
    $('#working-add').click(onAdd.curry('working'));
    $('#done-add').click(onAdd.curry('done'));

    //$('.header').click(refresh);
    
    client.addAppBar();
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
    $('.ready-tasks').empty();
    $('.working-tasks').empty();
    $('.done-tasks').empty();
    for (var i = 0; i < project.tasks.length; i++) {
        var task = project.tasks[i];
        $('div.' + task.status + '-tasks').append(TASK.format({
            id: task.id, description: task.description, time: task.remaining,
            units: task.units}));
    }
}

function setDoc(json) {
    project = new taskLib.Project(json.blob);
    refresh();
    //update UI
}

function getDoc() {
    return {
        blob: project.toJSON(),
        readers: ['public']
    };
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
