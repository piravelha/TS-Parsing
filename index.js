"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var parsing_1 = require("./parsing");
var format = function (code, spaces) {
    if (spaces === void 0) { spaces = 2; }
    var formatted = [];
    var indentation = 0;
    for (var _i = 0, _a = code.split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        if (line.trim().length === 0)
            continue;
        var posBraceCount = line.split("{").length - 1;
        var negBraceCount = line.split("}").length - 1;
        var eqBraces = line.trim().startsWith("}") && posBraceCount === negBraceCount;
        if (/end/.test(line)) {
            indentation -= 1;
        }
        if (/}/.test(line) && negBraceCount > posBraceCount) {
            indentation -= negBraceCount - posBraceCount;
        }
        if (/else/.test(line)) {
            indentation -= 1;
        }
        if (eqBraces) {
            indentation -= 1;
        }
        indentation = indentation < 0 ? 0 : indentation;
        formatted.push("".concat(" ".repeat(spaces * indentation)).concat(line.trimStart()));
        if (/\bfunction\b/.test(line)) {
            indentation += 1;
        }
        if (/then/.test(line)) {
            indentation += 1;
        }
        if (/{/.test(line) && posBraceCount > negBraceCount) {
            indentation += posBraceCount - negBraceCount;
        }
        if (/else/.test(line)) {
            indentation += 1;
        }
        if (eqBraces) {
            indentation += 1;
        }
    }
    return formatted.join("\n");
};
var operatorLookup = {
    "+": "_PLUS_",
    "-": "_DASH_",
    "*": "_STAR_",
    "/": "_SLASH_",
    "!": "_BANG_",
    "@": "_AT_",
    "#": "_HASH_",
    "$": "_DOL_",
    "%": "_PER_",
    "&": "_AMP_",
    "^": "_CARET_",
    "~": "_TILDE_",
    ":": "_COLON_",
    "<": "_LT_",
    ">": "_GT_",
    "=": "_EQ_",
    "|": "_PIPE_",
    "?": "_QM_",
};
var keywords = ["def", "end"];
var identifier = (0, parsing_1.regex)(/[a-zA-Z_][a-zA-Z_0-9]*|[\+\-\*\/!@#$%&^~:<>=|?]+/)
    .flatMap(function (id) {
    var newId = "";
    for (var i = 0; i < id.length; i++) {
        var char = id[i];
        if (operatorLookup[char]) {
            newId += operatorLookup[char];
        }
        else
            newId += char;
    }
    return keywords.indexOf(newId) >= 0
        ? parsing_1.empty
        : (0, parsing_1.pure)(newId);
});
var parameterList = (0, parsing_1.seq)((0, parsing_1.string)("("), identifier, (0, parsing_1.seq)((0, parsing_1.string)(","), identifier).map(function (_a) {
    var id = _a[1];
    return id;
}).many(), (0, parsing_1.string)(")")).map(function (_a) {
    var f = _a[1], r = _a[2];
    return "(".concat([f].concat(r).join(", "), ")");
});
var expression = (0, parsing_1.lazy)(function () { return (0, parsing_1.alt)(freeMethodAccess, methodCall, identifier, propertyAccess); });
var argumentList = (0, parsing_1.seq)((0, parsing_1.string)("("), expression, (0, parsing_1.seq)((0, parsing_1.string)(","), expression).map(function (_a) {
    var e = _a[1];
    return e;
}).many(), (0, parsing_1.string)(")")).map(function (_a) {
    var f = _a[1], r = _a[2];
    return "(".concat([f].concat(r).join(", "), ")");
});
var primaryExpression = (0, parsing_1.lazy)(function () { return (0, parsing_1.alt)(identifier, (0, parsing_1.seq)((0, parsing_1.string)("("), expression, (0, parsing_1.string)(")")).map(function (_a) {
    var expr = _a[1];
    return expr;
})); });
var statement = (0, parsing_1.lazy)(function () { return (0, parsing_1.alt)(methodDefinition); });
var block = (0, parsing_1.seq)((0, parsing_1.string)("block"), statement.many(), expression, (0, parsing_1.string)("end")).map(function (_a) {
    var stmts = _a[1], expr = _a[2];
    return "".concat(stmts.map(function (s) { return "".concat(s, "\n"); }), "return ").concat(expr);
});
var propertyAccess = (0, parsing_1.seq)(primaryExpression, (0, parsing_1.string)("."), identifier).map(function (_a) {
    var expr = _a[0], name = _a[2];
    return "".concat(expr, "[\"").concat(name, "\"]()");
});
var methodCall = (0, parsing_1.seq)((0, parsing_1.alt)(propertyAccess, primaryExpression), argumentList).map(function (_a) {
    var func = _a[0], args = _a[1];
    return "".concat(func).concat(args);
});
var freeMethodAccess = (0, parsing_1.seq)(primaryExpression, identifier, primaryExpression).map(function (_a) {
    var expr = _a[0], name = _a[1], arg = _a[2];
    return "".concat(expr, "[\"").concat(name, "\"](").concat(arg, ")");
});
var methodDefinition = (0, parsing_1.seq)((0, parsing_1.string)("def"), identifier, parameterList.optOr(""), (0, parsing_1.string)("="), (0, parsing_1.alt)(block, expression.map(function (e) { return "return ".concat(e); }))).map(function (_a) {
    var id = _a[1], ps = _a[2], bl = _a[4];
    if (ps === "") {
        return "local ".concat(id, " = (function()\n").concat(bl, "\nend)()");
    }
    return "function ".concat(id).concat(ps, "\n").concat(bl, "\nend");
});
var classDefinition = (0, parsing_1.seq)((0, parsing_1.string)("class"), identifier, parameterList.optOr("()"), methodDefinition.many(), (0, parsing_1.string)("end")).map(function (_a) {
    var name = _a[1], params = _a[2], methods = _a[3];
    return "function ".concat(name).concat(params, "\n  ").concat(methods.join("\n"), "\n  return {\n    ").concat(params.slice(1, -1).split(", ").map(function (p) {
        return "".concat(p, " = ").concat(p, ",\n");
    }).join(""), "\n    ").concat(methods.map(function (m) {
        var name = m.split("function ")[1].split("(")[0];
        return "".concat(name, " = ").concat(name, ",\n");
    }).join(""), "\n  }\nend");
});
var start = classDefinition;
console.log(format(start.parse("\n  class Int(value)\n    def +(other) = block\n      def result = value + other\n      result\n    end\n  end\n")));
