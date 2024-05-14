"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ws = exports.lazy = exports.string = exports.regex = exports.empty = exports.pure = exports.seq = exports.alt = exports.Parser = void 0;
var Parser = /** @class */ (function () {
    function Parser(parse) {
        this.raw_parse = parse;
        this.parse = function (input) {
            var result = parse(input);
            if (!result)
                throw new Error("Parsing Failed!");
            var x = result[0], _ = result[1];
            return x;
        };
    }
    Parser.prototype.map = function (f) {
        var _this = this;
        return new Parser(function (input) {
            var result = _this.raw_parse(input);
            if (!result)
                return null;
            var xs = result[0], rest = result[1];
            return [f(xs), rest];
        });
    };
    Parser.prototype.flatMap = function (f) {
        var _this = this;
        return new Parser(function (input) {
            var result = _this.raw_parse(input);
            if (!result)
                return null;
            var xs = result[0], rest = result[1];
            return f(xs).raw_parse(rest);
        });
    };
    Parser.prototype.optOr = function (value) {
        var _this = this;
        return new Parser(function (input) {
            var result = _this.raw_parse(input);
            if (!result)
                return [value, input];
            return result;
        });
    };
    Parser.prototype.skip = function (p) {
        var _this = this;
        return new Parser(function (input) {
            var result = _this.raw_parse(input);
            if (!result)
                return null;
            var xs = result[0], rest = result[1];
            rest = rest.trimStart();
            var result2 = p.raw_parse(rest);
            if (!result2)
                return null;
            var _ = result2[0], rest2 = result2[1];
            return [xs, rest2];
        });
    };
    Parser.prototype.some = function () {
        var _this = this;
        return new Parser(function (input) {
            var result = _this.raw_parse(input);
            if (!result)
                return null;
            var x = result[0], rest = result[1];
            rest = rest.trimStart();
            var results = _this.some().raw_parse(rest);
            if (!results)
                return [[x], rest];
            var xs = results[0], rest2 = results[1];
            rest2 = rest2.trimStart();
            return [[x].concat(xs), rest2];
        });
    };
    Parser.prototype.many = function () {
        var _this = this;
        return new Parser(function (input) {
            var result = _this.some().raw_parse(input);
            if (!result)
                return [[], input];
            return result;
        });
    };
    return Parser;
}());
exports.Parser = Parser;
var alt = function () {
    var ps = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        ps[_i] = arguments[_i];
    }
    return new Parser(function (input) {
        for (var _i = 0, ps_1 = ps; _i < ps_1.length; _i++) {
            var p = ps_1[_i];
            var result = p.raw_parse(input);
            if (!result)
                continue;
            return result;
        }
        return null;
    });
};
exports.alt = alt;
var seq = function () {
    var ps = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        ps[_i] = arguments[_i];
    }
    return new Parser(function (input) {
        var results = [];
        for (var _i = 0, ps_2 = ps; _i < ps_2.length; _i++) {
            var p = ps_2[_i];
            input = input.trimStart();
            var res = p.raw_parse(input);
            if (!res)
                return null;
            var x = res[0], r = res[1];
            results.push(x);
            input = r;
        }
        return [results, input];
    });
};
exports.seq = seq;
var pure = function (value) { return new Parser(function (input) {
    return [value, input];
}); };
exports.pure = pure;
exports.empty = new Parser(function (input) { return null; });
var regex = function (re) { return new Parser(function (input) {
    var source = re.source;
    if (!source.startsWith("^")) {
        source = "^" + source;
    }
    re = RegExp(source);
    var result = re.exec(input);
    if (!result)
        return null;
    return [result[0], input.slice(result[0].length, input.length)];
}); };
exports.regex = regex;
var string = function (s) { return new Parser(function (input) {
    if (!input.startsWith(s))
        return null;
    return [s, input.slice(s.length, input.length)];
}); };
exports.string = string;
var lazy = function (f) { return new Parser(function (input) { return f().raw_parse(input); }); };
exports.lazy = lazy;
exports.ws = (0, exports.regex)(/\s/).many();
