require('org.startpad.string').patch();
require('org.startpad.funcs').patch();
var vector = require('org.startpad.vector');
var types = require('org.startpad.types');

exports.extend({
    'DragController': DragController
});

function DragController(selector, container, options) {
    container = container || document;
    this.dragging = false;
    this.selector = selector;
    this.minDistance2 = 4 * 4;
    // jQuery bug with relative body positioning
    this.topFix = $(document.body).offset().top;
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
            if (vector.distance2(this.getPoint(evt), this.start) > this.minDistance2) {
                this.deferredStart = false;
                this.onDragStart();
            }
            return;
        }
        this.onDrag(vector.subFrom(this.getPoint(evt), this.start));
    },

    // Override this function - called when dragging starts
    onDragStart: function () {
        var self = this;
        this.$clone = this.$target.clone();
        this.$clone.addClass('phantom');
        this.$clone.width(this.$target.width());
        var offset = this.$target.offset();
        offset.top -= this.topFix;
        this.$clone.offset(offset);
        this.$target.addClass('dragging');
        $(document.body).append(this.$clone);

        this.dropTargets = [];
        $(this.selector).each(function () {
            // Don't drop target on self
            if (this.id == self.$target[0].id) {
                return;
            }
            var $dropTarget = $(this);
            var offset = $dropTarget.offset();
            var rect = [offset.left, offset.top,
                        offset.left + $dropTarget.width(),
                        offset.top + $dropTarget.height()];
            self.dropTargets.push({
                id: this.id,
                rect: rect
            });
        });

        this.$dropTarget = undefined;
        this.$lastDropTarget = undefined;
    },

    // Override this function - called when mouse moves during a drag.
    onDrag: function (point) {
        this.$clone.css('-webkit-transform', 'translate({0}px, {1}px)'.format(point));
    },

    onMouseUp: function (evt) {
        if (this.dragging && !this.deferredStart) {
            this.onRelease(vector.subFrom(this.getPoint(evt), this.start));
        } else {
            this.onClick(evt);
        }
        this.dragging = false;
        delete this.$target;
    },

    // Override this function - called when drag is complete.
    onRelease: function (point) {
        this.$target.removeClass('dragging');
        this.$clone.remove();
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
        return [evt.pageX, evt.pageY];
    }
});
