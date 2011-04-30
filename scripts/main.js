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

var NEW_TASK = '<div id=add{i} class=newTask>' +
               '<div> What:<input id=desc{i} class=desc /></div>' +
               '<div> Time:<input type=number id=time{i} class=time />hours<input id=ok{i} type=button value=OK />' + 
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
    
    //task.change();
    
    console.log('onOk exists');
    client.addAppBar();
}

//list is r, w, d for ready working done
function onAdd(list) {
    console.log('list: ' + list);
    var i = addList.length;
    addList[addList.length] = list;
    $('div.'+list+'-tasks').append(NEW_TASK.format({i: i}));
    $('#ok' + i).click(onOk.curry(i));
}

function onOk(i) {
  //t[i] = project.addTask({description: "task number " + i, estimated: 0, completed: 0});
    var desc = $('#desc' + i).val();
    var time = $('#time' + i).val();
    var task = project.addTask({description: desc, time: time, list: addList[i]});
    addList[i] = undefined;
    $('#add' + i).remove();
    console.log('project: ');
    console.log(project);
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
