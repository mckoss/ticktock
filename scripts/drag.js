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

    onDragStart: function () {
        var self = this;
        this.rcTarget = self.getRect(this.$target);
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
            self.dropTargets.push({
                id: this.id,
                rect: self.getRect($dropTarget)
            });
        });

        this.$lastDropTarget = undefined;
    },

    getRect: function ($elt) {
        var offset = $elt.offset();
        var rect = [offset.left, offset.top,
                    offset.left + $elt.outerWidth(),
                    offset.top + $elt.outerHeight()];
        return rect;
    },

    onDrag: function (point) {
        this.$clone.css('-webkit-transform', 'translate({0}px, {1}px)'.format(point));
        var rcTest = vector.add(this.rcTarget, point);
        var size;

        var bestArea = 0;
        var bestId;
        for (var i = 0; i < this.dropTargets.length; i++) {
            size = vector.size(vector.rcClipToRect(rcTest, this.dropTargets[i].rect));
            var area = size[0] * size[1];
            if (area > bestArea) {
                bestArea = area;
                bestId = this.dropTargets[i].id;
            }
        }

        if (!bestId) {
            if (this.$lastDropTarget) {
                this.onDragOver(undefined, this.$lastDropTarget);
                this.$lastDropTarget = undefined;
            }
            return;
        }

        if (this.$lastDropTarget && bestId == this.$lastDropTarget[0].id) {
            return;
        }

        console.log("overlap: ", size[0], size[1]);
        var $dropTarget = $('#' + bestId);
        this.onDragOver($dropTarget, this.$lastDropTarget);
        this.$lastDropTarget = $dropTarget;
    },

    onDragOver: function ($dropTarget, $lastDropTarget) {
        if ($lastDropTarget) {
            $lastDropTarget.removeClass('drop-target');
        }
        if ($dropTarget) {
            $dropTarget.addClass('drop-target');
        }
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
