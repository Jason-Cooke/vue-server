var excludeInstanceOptions = {
    'data': true,
    'methods': true,
    'computed': true,
    'paramAttributes': true,
    'props': true,
    'el': true,
    'template': true,
    'replace': true,
    'created': true,
    'createdBe': true,
    'beforeCompile': true,
    'compiled': true,
    'compiledBe': true,
    'ready': true,
    'attached': true,
    'detached': true,
    'beforeDestroy': true,
    'destroyed': true,
    'directives': true,
    'filters': true,
    'components': true,
    'partials': true,
    'transitions': true,
    'inherit': true,
    'events': true,
    'watch': true,
    'mixins': true,
    'name': true
};

var common = {
    getValNew: function(vm, value) {
        var result;

        if (typeof value === 'function') {
            try {
                result = value(vm);
            } catch(e) {
                vm.$logger.warn('Error executing expression [begin]');
                vm.$logger.warn(common.getVmPath(vm));
                vm.$logger.warn(e.toString());
                vm.$logger.warn(value.toString());
                vm.$logger.warn('Error executing expression [end]');
            } 
        } else {
            result = value;
        }

        return result;
    },

    execute: function(config) {
        var value = this.getValNew(config.vm, config.value.get);

        value = this.applyFilters(config.vm, config.value.filters, value);

        if (config.isEscape) {
            value = this.escapeHtml(value);
        }

        if (config.isClean) {
            value = this.cleanValue(value);
        }

        return value;
    },

    applyFilters: function(vm, filters, value) {
        if (filters) {
            for (var i = 0; i < filters.length; i++) {
                value = this.applyFilter( vm, filters[i], value );
            };
        }

        return value;
    },

    applyFilter: function(vm, meta, value) {
        var filter = vm.$options.filters[meta.name];
        var replacement = function(v) {
            return v;
        };

        if (!filter) {
            vm.$logger.warn( 'Unknown filter "' + meta.name + '":', common.getVmPath(vm) );
            filter = replacement;
        }

        if (typeof filter !== 'function') {
            filter = filter.read || replacement;
        }

        var args = [value];

        if (meta.args) {
            for (var i = 0; i < meta.args.length; i++) {
                if (!meta.args[i].dynamic) {
                    args.push( meta.args[i].value );
                } else {
                    args.push( vm.$get(meta.args[i].value) );
                }
            };
        }

        return filter.apply(vm, args);
    },


    // Brand new strip function
    // Better than any "replace" version;
    escapeHtml: function(str) {
        if (typeof str === 'string') {
            return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        }

        return str;
    },

    cleanValue: function(value) {
        if (value === undefined || value === null) {
            return '';
        } else { 
            return value;
        }
    },

    setElement: function(element) {
        // Перенастраиваем цикл из-за изменений в порядке элементов
        if (element) {
            element.dirs = element.dirs || {};
            return element;
        } else {
            return false;
        }
    },

    getVmPath: function(vm) {
        if (!vm.$parent) {
            return '$root'
        } else {
           return vm.nestingPath ? vm.nestingPath : (vm.$parent.nestingPath + '>>RepeatItem');
        }
    },

    extend: function() {
        return Array.prototype.reduce.call(arguments, function(previousValue, currentValue) {
            for (var item in currentValue) {
                previousValue[item] = currentValue[item];
            }

            return previousValue;
        });
    },



    composeComponent: function(component) {
        var options = {};
        var rawVm = {};

        options.methods = component.methods || {};

        var instancePropsMap = common.getObjectPropNames(component);


        // Теперь нужно пробежаться по всем свойствам объекта-класса и пробросить все
        // свойства, являющиеся функциями в methods
        for (var i = instancePropsMap.length - 1; i >= 0; i--) {
            (function() {
                var name = instancePropsMap[i],
                    item = component[name];

                if (excludeInstanceOptions[name]) {
                    options[name] = item;
                } else {
                    if (typeof item === 'function') {
                        options.methods[name] = item;
                    } else {
                        rawVm[name] = item;
                    }
                }
            })();
        };



        // Реализация примесей
        if (options.mixins && Array.isArray(options.mixins)) {
            (function() {
                var mixed = {
                    data: null,
                    createdBe: null,
                    compiledBe: null
                };

                var selfParams = {};

                for (var param in mixed) {
                    if (options[param]) {
                        selfParams[param] = options[param];
                    }
                }

                options.mixins.push(selfParams);

                options.mixins.forEach(function (item) {
                    for (var param in mixed) {
                        if (item[param] && typeof item[param] === 'function') {
                            if (mixed[param]) {
                                var mixedFn = mixed[param];
                                var newFn = item[param];
                                mixed[param] = new Function([
                                    'var result = ' + mixedFn.toString() + '.call(this);',
                                    'var data = ' + newFn.toString() + '.call(this);',
                                    'for (var item in data) {',
                                        'result[item] = data[item]',
                                    '};',
                                    'return result;'
                                ].join(''))
                            } else {
                                mixed[param] = item[param];
                            }
                        }
                    }
                });

                common.extend(options, mixed);
            })();
        }

        return {options: options, rawVm: rawVm};

    },


    // Хитрожопый способ получить имена ВСЕХ свойств класса.
    // Прикол в том, что разные компиляторы es6 в es5 по разному обращаются с этими свойствами
    // Кто-то кладёт их напрямую в объект с enumerable: false, кто-то же просто использует
    // прототипирование, в результате чего свойства класса попадают в __proto__
    getObjectPropNames: function(object, isModern) {
        if (isModern) {
            return this.getObjectPropNamesModern(object);
        } else {
            return this.getObjectPropNamesLegacy(object);
        }
    },


    getObjectPropNamesLegacy: function(object) {
        var names = Object.keys(object);
        var objectProto = Object.getPrototypeOf(object);

        if (objectProto) {
            names = names.concat(
                this.getObjectPropNamesLegacy(objectProto)
            );
        }

        return names;
    },


    getObjectPropNamesModern: function(object) {
        var names = Object.keys(object).concat(gogo(object));
        
        function gogo(obj) {
            var objectProto = Object.getPrototypeOf(obj);
            var protoNames;

            if (objectProto && objectProto.__proto__) {
                protoNames = Object.getOwnPropertyNames(objectProto).concat(gogo(objectProto));
            }

            if (protoNames) {
                return protoNames;
            } else {
                return [];
            }
        }

        var newNames = [];
        for (var i = 0; i < names.length; i++) {
            if (names[i] === 'constructor') {
                continue;
            }

            newNames.push(names[i]);
        }

        return newNames;
    },


    toCamelCase: function(value) {
        return value.replace(/-(\w)/g, function(a, b){
            return b.toUpperCase();
        });
    }
}

module.exports = common;