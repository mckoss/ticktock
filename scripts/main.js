var clientLib = require('com.pageforest.client');
var dom = require('org.startpad.dom');
var taskLib = require('com.ticktocktask.tasks');
//


exports.extend({
    'onReady': onReady,
    'getDoc': getDoc,
    'setDoc': setDoc
});

var client;
var doc;                            // Bound elements here

function onReady() {
    handleAppCache();
    doc = dom.bindIDs();
    client = new clientLib.Client(exports);
    client.saveInterval = 0;

    client.addAppBar();
    
    project = new taskLib.Project({title: "Bobby's Contributions Panda"});
    var tasks = testTasks();
    console.log(project.tasks);
}

function testTasks() {
    var t = [];
    for (var i = 0; i < 10; i++) {
        t[0] = project.addTask({description: "task number " + i, estimated: 0, completed: 0});
    }
}


function setDoc(json) {
}

function getDoc() {
    return {
        blob: {
            version: 1,
            tasks: [],
        },
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
