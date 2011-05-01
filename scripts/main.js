var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var taskLib = require('com.ticktocktask.tasks');
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
               '<div> Time:<input type=number id=time{i} class=time />hours<input id=ok{i} type=button value=OK />' + 
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
    
    
    $('#r-add').click(onAdd.curry('r'));
    $('#w-add').click(onAdd.curry('w'));
    $('#d-add').click(onAdd.curry('d'));

    //$('.header').click(refresh);
    
    client.addAppBar();
}

//list is r, w, d for ready working done
function onAdd(list) {
    var i = addList.length;
    addList[addList.length] = list;
    $('div.' + list + '-tasks').append(ADD_TASK.format({i: i}));
    $('#ok' + i).click(onOk.curry(i));
}

function onOk(i) {
  //t[i] = project.addTask({description: "task number " + i, estimated: 0, completed: 0});
    var d = $('#description' + i).val();
    var t = $('#time' + i).val();
    var list = addList[i];
    var units;
    t == 1 ? units = 'hour' : units = 'hours';
    var task = project.addTask({description: d, time: t, list: list, units: units});
    addList[i] = undefined;
    $('#add' + i).remove();
    $('div.' + list + '-tasks').append(TASK.format({id: task.id, description: task.description, time: task.time, units: task.units}));
    $('div#' + task.id).find()
    client.setDirty();
    client.save();
}

function refresh() {
    $('.r-tasks').empty();
    $('.w-tasks').empty();
    $('.d-tasks').empty();
    for (var i = 0; i < project.tasks.length; i++) {
        var task = project.tasks[i];
        $('div.' + task.list + '-tasks').append(TASK.format({id: task.id, description: task.description, time: task.time, units: task.units}));
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
