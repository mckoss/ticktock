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

var NEW_TASK = '<div id=new{i} class=newTask>' +
               '<div> What:<input id=description{i} /></div>' +
               '<div> Time:<input type=number id=time{i} />hours<input id=done{i} type=button value=done />' + 
               '</div>';

function onReady() {
    handleAppCache();
    doc = dom.bindIDs();
    
    project = new taskLib.Project({title: ''});
    client = new clientLib.Client(exports);
    client.saveInterval = 0;

    $('#r-add').click(onAdd.curry('r'));
    $('#w-add').click(onAdd.curry('w'));
    $('#d-add').click(onAdd.curry('d'));
    
    
    var tasks = testTasks();
    console.log(project.tasks);
    console.log('tasks', tasks);
    
    client.addAppBar();
}

//list is r, w, d for ready working done
function onAdd(list) {
    console.log('list: ' + list);
    var i = addList.length;
    addList[addList.length] = list;
    $('div.'+list+'-tasks').append(NEW_TASK.format());
}

function testTasks() {
    var t = [];
    for (var i = 0; i < 10; i++) {
        t[i] = project.addTask({description: "task number " + i, estimated: 0, completed: 0});
    }
    return t;
}


function setDoc(json) {
    project = new taskLib.Project(json.blob);
    //update UI
}

function getDoc() {
    var p = project.toJSON();
    return {
        title: p.title,
        blob: p,
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
