'use strict';

var log4js = require('log4js');

var Vue = require('vue');
Vue.config.silent = true;
var filtersGlobal = Vue.filters;

var asset = require('./asset.js');
var scope = require('./scope.js');
var compilers = require('./compilers.js');
var renders = require('./renders.js');

var systemOptions = {
    filters: true,
    partials: true,
    components: true,
    mixin: true,
    config: true,
    _logger: true
};

var initLogger = function initLogger(config, logger) {
    return {
        _config: config,
        _logger: logger,
        log: function log() {
            if (!this._config.silent) {
                this._logger.debug.apply(this._logger, arguments);
            }

            return this;
        },
        debug: function debug() {
            if (!this._config.silent && this._config.debug) {
                this._logger.debug.apply(this._logger, arguments);
            }

            return this;
        },
        info: function info() {
            if (!this._config.silent && this._config.debug) {
                this._logger.info.apply(this._logger, arguments);
            }

            return this;
        },
        warn: function warn() {
            if (!this._config.silent) {
                this._logger.warn.apply(this._logger, arguments);
            }

            return this;
        },
        error: function error() {
            if (!this._config.silent) {
                this._logger.error.apply(this._logger, arguments);
            }

            return this;
        }
    };
};

var VueRender = function VueRender(logger) {
    logger = logger || log4js.getLogger('[VueServer]');

    var VueRoot = function VueRoot(instance) {
        var that = this;
        var vm;
        var compileInProgress = false;

        scope.$logger = this.logger;
        renders.$logger = this.logger;

        if (!instance) {
            this.logger.error('Can\'t initialize render: no root instance transmitted');
            return this;
        }

        // -------------------------
        // Global prototype
        var globalPrototype = {};
        var proto = Object.getPrototypeOf(this);

        for (var name in proto) {
            if (systemOptions[name]) {
                continue;
            } else {
                globalPrototype[name] = proto[name];
            }
        }

        scope.globalPrototype = globalPrototype;
        // -------------------------

        scope.config = this.config;

        scope.filters = this.filters;
        scope.partials = this.partials;
        scope.components = this.components;
        scope.mixin = this.mixin || null;

        vm = scope.initViewModel({
            parent: null,
            filters: {},
            partials: {},
            components: {},
            component: asset.composeComponent(this.logger, instance, this.mixin),
            isComponent: true
        });

        vm.$on('_vueServer.tryBeginCompile', function () {
            if (compileInProgress) {
                that.logger.error('Building proccess gone wrong. Some VMs finished compilation after $root Ready');
                return;
            }

            compileInProgress = true;
            this.$emit('_vueServer.readyToCompile');
            this.$broadcast('_vueServer.readyToCompile');

            process.nextTick(function () {
                compilers.compile(this);

                process.nextTick(function () {
                    var html = renders.render(this);
                    this.$emit('vueServer.htmlReady', html);
                }.bind(this));
            }.bind(this));
            // }
        });

        return vm;
    };

    VueRoot.extend = function (instance) {
        if (!instance) {
            instance = {};
        }
        return asset.composeComponent(this.prototype.logger, instance, this.mixin);
    };

    VueRoot.component = function (id, instance) {
        if (instance) {
            this.prototype.components[id] = this.extend(instance);
        }

        return this.prototype.components[id];
    };

    VueRoot.filter = function (id, filter) {
        if (filter) {
            this.prototype.filters[id] = filter;
        }

        return this.prototype.filters[id];
    };

    VueRoot.partial = function (id, partial) {
        if (partial) {
            var result = asset.compileTemplate(this.prototype.logger, partial, 'Partial "' + id + '"');

            this.prototype.partials[id] = result;
        }

        return this.prototype.partials[id];
    };

    VueRoot.mixin = function (mixin) {
        if (mixin) {
            this.prototype.mixin = mixin;
        }
    };

    VueRoot.prototype._logger = logger;

    VueRoot.prototype.components = {};
    VueRoot.prototype.filters = filtersGlobal;
    VueRoot.prototype.partials = {};

    VueRoot.prototype.config = {
        debug: false,
        silent: false,
        replace: true,
        onLogMessage: null
    };
    VueRoot.config = VueRoot.prototype.config;

    VueRoot.prototype.logger = initLogger(VueRoot.config, logger);

    return VueRoot;
};

module.exports = VueRender;