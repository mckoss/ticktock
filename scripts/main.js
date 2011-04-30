var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var taskLib = require('com.ticktocktask.tasks');
var strings = require('org.startpad.strings');
var format = strings.format;


exports.extend({
    'onReady': onReady,
    'getDoc': getDoc,
    'setDoc': setDoc
});

var client;
var doc;                            // Bound elements here
var project;


function onReady() {
    handleAppCache();
    doc = dom.bindIDs();
    
    project = new taskLib.Project({title: ''});
    client = new clientLib.Client(exports);
    client.saveInterval = 0;

    console.log(format.replaceKeys);
    
    var tasks = testTasks();
    console.log(project.tasks);
    console.log('tasks', tasks);
    
    client.addAppBar();
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
