function kebabify(prop) {
    return prop.replace(/[A-Z]/g, function (a) {
        return '-' + a.toLowerCase();
    });
}

var CSSParser = {
    parse: function (string) {
        var temp = string.split(';');
        var obj = {};

        for (var i = 0; i < temp.length; i++) {
            (function () {
                var item = temp[i];
                if (item) {
                    var prop = item.split(/:(.+)/);

                    if (!prop[1]) {
                        throw 'CSS format is invalid: "' + item + '"';
                    }

                    obj[prop[0].trim()] = prop[1].trim();
                }
            })();
        }

        return obj;
    },

    stringify: function (object) {
        var string = '';

        for (var prop in object) {
            if (object[prop] === undefined || object[prop] === null || object[prop] === '') {
                continue;
            }
            string += kebabify(prop) + ': ' + object[prop] + '; ';
        }

        return string.trim();
    },

    merge: function () {
        var list = [{}];
        for (var i = 0; i < arguments.length; i++) {
            list.push(arguments[i]);
        }
        return list.reduce(function (previousValue, currentValue) {
            for (var item in currentValue) {
                previousValue[kebabify(item)] = currentValue[item];
            }

            return previousValue;
        });
    }
};

module.exports = CSSParser;
