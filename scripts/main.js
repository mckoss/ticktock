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
var editedId;
var editedText;
var drag;

var TASK =
    '<div id="{id}" class="task">' +
    '<input class="check" type="checkbox"/>' +
    '<div class="promote icon"></div>' +
    '<div class="delete icon"></div>' +
    '<div class="content">{content}</div>' +
    '<textarea></textarea>' +
    '</div>';

var UPDATE_INTERVAL = 1000 * 60;
var DEBUG = true;

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
    $doc['new-tasks'].append(TASK.format({id: "new", content: "Add new task"}));

    $(window).keydown(onKey);
    $(document).click(onClick);
    
    drag = new DragController('.task');

    setInterval(onTimer, UPDATE_INTERVAL);
    if (DEBUG) {
        setInterval(function () {
            if (!project.consistencyCheck()) {
                alert("inconsitent");
            }
        }, 10000);
    }
}

function setDoc(json) {
    project = new taskLib.Project({onTaskEvent: onTaskEvent});
    project.fromJSON(json.blob);
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

function Point(x, y) {
    this.push(x);
    this.push(y);
}

Point.subclass(Array, {
    add: function (other) {
        this[0] += other[0];
        this[1] += other[1];
        return this;
    },
    
    sub: function (other) {
        this[0] -= other[0];
        this[1] -= other[1];
        return this;
    }
});

function DragController(selector) {
    this.dragging = false;
    this.selector = selector;

    $(document).bind('touchstart mousedown', this.onMouseDown.curryThis(this));
    $(document).bind('touchmove mousemove', this.onMouseMove.curryThis(this));
    $(document).bind('toucheend touchcancel mouseup', this.onMouseUp.curryThis(this));
}

DragController.methods({
    onMouseDown: function (evt) {
        this.$target = $(evt.target).closest(this.selector);
        if (this.$target.length != 1) {
            this.dragging = false;
            console.log("No draggable element: '{selector}'".format(this));
            return;
        }
        this.dragging = true;
        this.start =  this.getPoint(evt);
        console.log("Mouse down: {0}, {1}".format(this.start));
        evt.stopPropagation();
        evt.preventDefault();
    },

    onMouseMove: function (evt) {
        if (!this.dragging) {
            return;
        }
        this.delta = this.getPoint(evt).sub(this.start);
        this.$target.css('-webkit-transform', 'translate({0}px, {1}px)'.format(this.delta));
    },
    
    onMouseUp: function (evt) {
        if (this.dragging) {
            evt.stopPropagation();
            evt.preventDefault();
            console.log("Killing mouse up");
        }
        this.dragging = false;
    },

    getPoint: function (evt) {
        evt = evt.originalEvent || evt;
        if (evt.type.indexOf('touch') == 0) {
            evt = evt.touches[0];
        }
        return new Point(evt.pageX, evt.pageY);
    }
});

function onClick(evt) {
    console.log("Click on " + evt.target.tagName + "." + evt.target.className, evt.target);

    if (evt.target.tagName == 'TEXTAREA') {
        return;
    }
    if (editedId) {
        saveTask(editedId);
    }
    
    var $target = $(evt.target);
    var $taskDiv = $target.closest('.task');
    var id = $taskDiv.attr('id');
    console.log("Task id: {0}".format(id));

    if (!id) {
        evt.preventDefault();
        return;
    }

    var task = project.getTask(id);

    if ($target.hasClass('check')) {
        task.change({status: task.status != 'done' ? 'done' :
                     task.previous('status', 'working') });
    } else if ($target.hasClass('delete')) {
        task.change({status: 'deleted'});
    } else if ($target.hasClass('promote')) {
        var other = { ready: 'working', working: 'ready', done: 'working' };
        task.change({ status: other[task.status] });
    } else {
        $taskDiv.addClass('edit');
        editedText = task ? task.getEditText() : '';
        $('textarea', $taskDiv).val(editedText).focus().select();
        editedId = id;       
    }

    evt.stopPropagation();
    evt.preventDefault();
}

function onKey(evt) {
    var right = 39,
    left = 37,
    up = 38,
    down = 40,
    enter = 13;

    if (!editedId) {
        return;
    }

    if (event.keyCode == enter) {
        saveTask(editedId);
        return;
    }

    switch (evt.keyCode) {
    case up:
    case down:
        if (!evt.ctrlKey || editedId == 'new') {
            evt.preventDefault();
            return;
        }
        var idSave = editedId;
        // TODO: should keep task in edit mode - so may need to
        // move OTHER tasks around it in the list!
        saveTask(editedId);
        project.move(idSave, evt.keyCode == up ? -1 : 1);
        break;
    default:
        console.log("Unknown keyCode: {keyCode}".format(evt));
        break;
    }
}

function onTaskEvent(event) {
    console.log("Task {action}: {target.id} in {target.status}".format(event));
    var task = event.target;
    var listName = task.status + '-tasks';

    function updateTask() {
        var $taskDiv = $('#' + event.target.id);
        var content = task.getContentHTML ? task.getContentHTML() : task.description;
        $('.content', $taskDiv).html(content);
        $('.check', $taskDiv)[0].checked = (task.status == 'done');
    }

    switch (event.action) {
    case 'add':
        if (task.status != 'deleted') {
            $doc[listName].prepend(TASK.format(task));
            updateTask();
        }
        break;
    case 'change':
        // Move task between lists
        if (event.properties.indexOf('status') != -1) {
            $('#' + event.target.id).remove();
            if (task.status != 'deleted') {
                $doc[listName].prepend(TASK.format(task));
                updateTask();
            }
        } else {
            updateTask();
        }
        break;
    default:
        alert("Unhandled event: {action} on {target.id}".format(event));
        break;
    }
}

function saveTask(id) {
    var $taskDiv = $('#' + id);
    $taskDiv.removeClass('edit');
    var text = $('textarea', $taskDiv).val();
    editedId = undefined;
    if (text == editedText) {
        return;
    }
    if (id == 'new') {
        project.addTask({description: text});
    } else {
        project.getTask(id).change({description: text});
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
