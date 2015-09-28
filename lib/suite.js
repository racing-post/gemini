'use strict';

var inherit = require('inherit'),
    _ = require('lodash');

function definePrivate(suite) {
    Object.defineProperty(suite, '_states', {
        value: []
    });

    Object.defineProperty(suite, '_children', {
        value: []
    });
}

var Suite = inherit({

    __constructor: function(name) {
        this.name = name;
        this.url = null;
        this.skipped = false;
        this.captureSelectors = null;
        this.tolerance = null;
        this.ignoreSelectors = [];
        this.beforeHook = function() {};
        this.afterHook = function() {};
        this.postActions = [];
        this.browsers = [];
        definePrivate(this);
    },

    addState: function(state) {
        this._states.push(state);
    },

    addPostActions: function(actions) {
        if (actions) {
            this.postActions.push(actions);
        }
    },

    runPostActions: function() {
        var _this = this;
        if (this.postActions.length > 0) {
            return this.postActions[0].perform()
                .then(function() {
                    _this.postActions = [];
                });
        }
    },

    skip: function(browsersList) {
        if (this.skipped === true) {
            return;
        }

        this.skipped = !browsersList
            || _.isArray(this.skipped) && this.skipped.concat(browsersList)
            || browsersList;
    },

    hasChildNamed: function(name) {
        return _.some(this._children, {name: name});
    },

    hasStateNamed: function(name) {
        return _.some(this._states, {name: name});
    },

    get states() {
        return this._states;
    },

    get children() {
        return this._children;
    },

    addChild: function(suite) {
        suite.parent = this;
        this._children.push(suite);
    },

    get hasStates() {
        return this._states.length > 0;
    },

    get isRoot() {
        return !this.parent;
    },

    get fullName() {
        return this.isRoot
            ? this.name
            : this.parent.fullName + ' ' + this.name;
    }
});

exports.create = function createSuite(name, parent) {
    if (!parent) {
        return new Suite(name);
    }

    var suite = Object.create(parent);
    definePrivate(suite);
    suite.name = name;
    suite.path = parent.path? parent.path.concat(name) : [name];
    parent.addChild(suite);
    return suite;
};
