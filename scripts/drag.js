require('org.startpad.string').patch();
require('org.startpad.funcs').patch();
var types = require('org.startpad.types');

exports.extend({
    'DragController': DragController
});

function DragController(selector, container, options) {
    container = container || document;
    this.dragging = false;
    this.selector = selector;
    this.minDistance = 4;
    types.extend(this, options);

    $(container).bind('touchstart mousedown', this.onMouseDown.curryThis(this));
    $(container).bind('touchmove mousemove', this.onMouseMove.curryThis(this));
    $(container).bind('touchend touchcancel mouseup', this.onMouseUp.curryThis(this));
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
        this.deferredStart = true;
        this.start =  this.getPoint(evt);
        evt.preventDefault();
    },

    onMouseMove: function (evt) {
        if (!this.dragging) {
            return;
        }
        if (this.deferredStart) {
            if (this.getPoint(evt).distance(this.start) > this.minDistance) {
                this.deferredStart = false;
                this.onDragStart();
            }
            return;
        }
        this.onDrag(this.getPoint(evt).subFrom(this.start));
    },

    // Override this function - called when dragging starts
    onDragStart: function () {
    },

    // Override this function - called when mouse moves during a drag.
    onDrag: function (point) {
        console.log("Drag: {0}, {1}".format(point));
    },

    onMouseUp: function (evt) {
        if (this.dragging && this.getPoint(evt).distance(this.start) >= this.minDistance) {
            this.onRelease(this.getPoint(evt).subFrom(this.start));
        } else {
            this.onClick(evt);
        }
        this.dragging = false;
        delete this.$target;
    },

    // Override this function - called when drag is complete.
    onRelease: function (point) {
        console.log("Release: {0}, {1}".format(point));
    },

    // Override this function - respond to a non-drag click (mouse up).
    onClick: function (evt) {
        console.log("Non-drag click", evt);
    },

    getPoint: function (evt) {
        evt = evt.originalEvent || evt;
        if (evt.type.indexOf('touch') == 0) {
            evt = evt.touches[0];
        }
        return new Point(evt.pageX, evt.pageY);
    }
});


function Point(x, y) {
    this.push(x);
    this.push(y);
}

Point.subclass(Array, {
    addTo: function (other) {
        this[0] += other[0];
        this[1] += other[1];
        return this;
    },

    subFrom: function (other) {
        this[0] -= other[0];
        this[1] -= other[1];
        return this;
    },

    copy: function () {
        return new Point(this[0], this[1]);
    },

    distance: function (other) {
        var delta = this.copy().subFrom(other);
        return Math.sqrt(delta[0] * delta[0] + delta[1] * delta[1]);
    }
});
