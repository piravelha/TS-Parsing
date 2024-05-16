"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var parsing_1 = require("./parsing");
var fs_1 = require("fs");
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
function convertScalaToLua(scalaString) {
    scalaString = scalaString.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '').trim();
    var scalaPattern = /^`(.*?)`$/;
    var match = scalaString.match(scalaPattern);
    if (!match) {
        throw new Error("Invalid format");
    }
    var content = match[1];
    var luaString = '("';
    var regex = /\$(\w+)|\$\{([^}]+)\}/g;
    var index = 0;
    var result;
    var identifiers = [];
    while ((result = regex.exec(content)) !== null) {
        luaString += content.slice(index, result.index);
        if (result[1]) {
            identifiers.push("tostring(".concat(identifier.parse(result[1]), ")"));
            luaString += "%s";
        }
        else if (result[2]) {
            identifiers.push("tostring(".concat(expression.parse(result[2]), ")"));
            luaString += "%s";
        }
        index = regex.lastIndex;
    }
    luaString += content.slice(index) + '"):format(';
    luaString += identifiers.join(', ') + ')';
    return luaString;
}
function freeMethodAccessMapping(expr, name, arg) {
    if (expr === "_") {
        var var1 = "_ANON_".concat(idCount++);
        if (arg === "_") {
            var var2 = "_ANON_".concat(idCount++);
            return "__LAZY(function()\nreturn function(".concat(var1, ")\nreturn __LAZY(function()\nreturn function(").concat(var2, ")\nreturn __EAGER(__EAGER(").concat(var1, ")[\"").concat(name, "\"])(").concat(var2, ")\nend\nend)\nend\nend)");
        }
        return "__LAZY(function()\nreturn function(".concat(var1, ")\nreturn __EAGER(__EAGER(").concat(var1, ")[\"").concat(name, "\"])(").concat(arg, ")\nend\nend)");
    }
    if (arg === "_") {
        var var2 = "_ANON_".concat(idCount++);
        return "__LAZY(function()\nreturn function(".concat(var2, ")\nreturn __EAGER(__EAGER(").concat(expr, ")[\"").concat(name, "\"])(").concat(var2, ")\nend\nend)");
    }
    return "__EAGER(__EAGER(".concat(expr, ")[\"").concat(name, "\"])(").concat(arg, ")");
}
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
var luaKeywords = {
    "not": "_NOT",
    "and": "_AND",
    "or": "_OR",
};
var keywords = ["yield", "_OP___EQ_", "def", "end", "match", "case", "block", "_OP___LT__PIPE_", "_OP___AT_", "do"];
var idCount = 0;
var identifier = (0, parsing_1.regex)(/[a-zA-Z][a-zA-Z0-9]*|[\+\-\*\/!@$%&^~:<>=|?]+/)
    .flatMap(function (id) {
    var newId = "";
    var isOp = false;
    for (var i = 0; i < id.length; i++) {
        var char = id[i];
        if (operatorLookup[char]) {
            isOp = true;
            newId += operatorLookup[char];
        }
        else
            newId += char;
    }
    if (isOp)
        newId = "_OP__".concat(newId);
    return keywords.indexOf(newId) >= 0
        ? parsing_1.empty
        : newId in luaKeywords
            ? (0, parsing_1.pure)(luaKeywords[newId])
            : (0, parsing_1.pure)(newId);
});
var int = (0, parsing_1.regex)(/\d+/)
    .map(function (i) { return "__INT(".concat(i, ")"); });
var float = (0, parsing_1.regex)(/\d+\.\d+/)
    .map(function (f) { return "__FLOAT(".concat(f, ")"); });
var str = (0, parsing_1.regex)(/"[^"]*"/)
    .map(function (s) { return "__STRING(".concat(s, ")"); });
var sString = (0, parsing_1.regex)(/`[^`]*`/)
    .map(function (s) { return s.replace(/\\\s+\\/, ""); })
    .map(convertScalaToLua);
var parameterList = (0, parsing_1.seq)((0, parsing_1.string)("("), identifier, (0, parsing_1.seq)((0, parsing_1.string)(","), identifier).map(function (_a) {
    var id = _a[1];
    return id;
}).many(), (0, parsing_1.string)(")")).map(function (_a) {
    var f = _a[1], r = _a[2];
    return "(".concat([f].concat(r).join(", "), ")");
});
var expression = (0, parsing_1.lazy)(function () { return (0, parsing_1.alt)(doNotation, block, lambdaExpression, prefixOp, matchExpression, sString, freeMethodAccess, methodCall, propertyAccess, array, identifier, float, int, str); });
var array = (0, parsing_1.seq)((0, parsing_1.string)("["), expression, (0, parsing_1.seq)((0, parsing_1.string)(","), expression).map(function (_a) {
    var e = _a[1];
    return e;
}).many(), (0, parsing_1.string)(",").optOr(""), (0, parsing_1.string)("]")).map(function (_a) {
    var head = _a[1], tail = _a[2];
    var arr = [head].concat(tail);
    arr = arr.reverse();
    var code = "Nil";
    arr.forEach(function (e) { return code = "Cons(".concat(e, ", ").concat(code, ")"); });
    return code;
});
var argumentList = (0, parsing_1.seq)((0, parsing_1.string)("("), (0, parsing_1.alt)(expression, (0, parsing_1.string)("_")), (0, parsing_1.seq)((0, parsing_1.string)(","), (0, parsing_1.alt)(expression, (0, parsing_1.string)("_"))).map(function (_a) {
    var e = _a[1];
    return e;
}).many(), (0, parsing_1.string)(")")).map(function (_a) {
    var f = _a[1], r = _a[2];
    return "(".concat([f].concat(r).join(",₩"), ")");
});
var primaryExpression = (0, parsing_1.lazy)(function () { return (0, parsing_1.alt)(sString, prefixOp, methodCall, array, identifier, float, int, str, (0, parsing_1.seq)((0, parsing_1.string)("("), expression, (0, parsing_1.string)(")")).map(function (_a) {
    var expr = _a[1];
    return expr;
})); });
var statement = (0, parsing_1.lazy)(function () { return (0, parsing_1.alt)(methodDefinition, classDefinition); });
var prefixOp = (0, parsing_1.seq)((0, parsing_1.alt)(identifier.flatMap(function (i) {
    return i.startsWith("_OP__")
        ? (0, parsing_1.pure)(i)
        : parsing_1.empty;
}), (0, parsing_1.seq)((0, parsing_1.string)("@"), identifier.flatMap(function (i) {
    return i.startsWith("_OP__")
        ? parsing_1.empty
        : (0, parsing_1.pure)(i);
})).map(function (_a) {
    var i = _a[1];
    return i;
})), primaryExpression).map(function (_a) {
    var op = _a[0], e = _a[1];
    return "__EAGER(__EAGER(".concat(e, ")[\"").concat(op, "\"])");
});
var block = (0, parsing_1.seq)((0, parsing_1.string)("block"), statement.many(), (0, parsing_1.seq)((0, parsing_1.string)("<|"), expression).map(function (_a) {
    var e = _a[1];
    return e;
}), (0, parsing_1.string)("end")).map(function (_a) {
    var stmts = _a[1], expr = _a[2];
    return "__LAZY(function()\n".concat(stmts.map(function (s) { return "".concat(s, "\n"); }).join(""), "return ").concat(expr, "\nend)");
});
var propertyAccessHelper = (0, parsing_1.seq)((0, parsing_1.alt)(array, (0, parsing_1.string)("_"), identifier, float, int, str, (0, parsing_1.seq)((0, parsing_1.string)("("), expression, (0, parsing_1.string)(")")).map(function (_a) {
    var e = _a[1];
    return e;
})), (0, parsing_1.string)("."), identifier).map(function (_a) {
    var expr = _a[0], name = _a[2];
    return [expr, name];
});
var rawPropertyAccess = propertyAccessHelper.map(function (_a) {
    var expr = _a[0], name = _a[1];
    return "".concat(expr, "[\"").concat(name, "\"]");
});
var propertyAccess = propertyAccessHelper.map(function (_a) {
    var expr = _a[0], name = _a[1];
    if (expr === "_") {
        var var1 = "_ANON_".concat(idCount++);
        return "(function(".concat(var1, ")\nreturn __EAGER(__EAGER(").concat(var1, ")[\"").concat(name, "\"])\nend)");
    }
    return "__EAGER(__EAGER(".concat(expr, ")[\"").concat(name, "\"])");
});
var methodCall = (0, parsing_1.seq)((0, parsing_1.alt)(rawPropertyAccess, (0, parsing_1.string)("_"), identifier, (0, parsing_1.seq)((0, parsing_1.string)("("), expression, (0, parsing_1.string)(")")).map(function (_a) {
    var e = _a[1];
    return e;
})), argumentList.some()).map(function (_a) {
    var func = _a[0], argLists = _a[1];
    var code = "%ARG_0";
    for (var _i = 0, argLists_1 = argLists; _i < argLists_1.length; _i++) {
        var args = argLists_1[_i];
        code += "(";
        var argsStr = [];
        var newArgs = args.slice(1, -1).split(",₩");
        for (var i in newArgs) {
            argsStr.push("%ARG_".concat(Number(i) + 1));
        }
        code += argsStr.join(", ") + ")";
        for (var i in [func].concat(newArgs)) {
            var arg = [func].concat(newArgs)[i];
            if (arg.startsWith("_[") || arg === "_") {
                var argVar = "_ANON_".concat(idCount++);
                code = "function(".concat(argVar, ")\nreturn ").concat(code.replace("%ARG_".concat(i), "__EAGER(".concat(argVar).concat(arg.replace("_", ""))), ")\nend");
            }
            else {
                if (/\["/.test(arg)) {
                    var _b = arg.split("[\"", 2), expr = _b[0], name_1 = _b[1];
                    arg = "__EAGER(".concat(expr, ")[\"").concat(name_1);
                }
                code = code.replace("%ARG_".concat(i), "__EAGER(".concat(arg, ")"));
            }
        }
        code = "__EAGER(".concat(code, ")");
    }
    return code;
});
var binaryFreeMethodAccess = (0, parsing_1.seq)((0, parsing_1.alt)(primaryExpression, (0, parsing_1.string)("_")), identifier, (0, parsing_1.alt)(methodCall, primaryExpression, (0, parsing_1.string)("_"))).map(function (_a) {
    var expr = _a[0], name = _a[1], arg = _a[2];
    return freeMethodAccessMapping(expr, name, arg);
});
var freeMethodAccess = (0, parsing_1.seq)((0, parsing_1.alt)(primaryExpression, (0, parsing_1.string)("_")), (0, parsing_1.seq)(identifier, (0, parsing_1.alt)(methodCall, primaryExpression, (0, parsing_1.string)("_"))).some()).map(function (_a) {
    var expr = _a[0], argLists = _a[1];
    var code = expr;
    for (var _i = 0, argLists_2 = argLists; _i < argLists_2.length; _i++) {
        var _b = argLists_2[_i], name_2 = _b[0], arg = _b[1];
        code = freeMethodAccessMapping(code, name_2, arg);
    }
    return code;
});
var lambdaExpression = (0, parsing_1.seq)(parameterList, (0, parsing_1.string)("=>"), (0, parsing_1.alt)(block, expression)).map(function (_a) {
    var ps = _a[0], bl = _a[2];
    return "__LAZY(function()\nreturn function".concat(ps, "\nreturn ").concat(bl, "\nend\nend)");
});
var methodDefinition = (0, parsing_1.seq)((0, parsing_1.string)("def"), identifier, parameterList.optOr(""), (0, parsing_1.string)("="), (0, parsing_1.alt)(block, expression)).map(function (_a) {
    var id = _a[1], ps = _a[2], bl = _a[4];
    if (ps === "") {
        return "local ".concat(id, "\n").concat(id, " = __LAZY(function()\nreturn ").concat(bl, "\nend)");
    }
    return "local ".concat(id, "\n").concat(id, " = __LAZY(function()\nreturn function").concat(ps, "\nreturn ").concat(bl, "\nend\nend)");
});
var pattern = (0, parsing_1.lazy)(function () { return (0, parsing_1.alt)((0, parsing_1.seq)(identifier, (0, parsing_1.string)("("), (0, parsing_1.seq)(pattern, (0, parsing_1.seq)((0, parsing_1.string)(","), pattern).map(function (_a) {
    var p = _a[1];
    return p;
}).many()).map(function (_a) {
    var h = _a[0], t = _a[1];
    return [h].concat(t);
}), (0, parsing_1.string)(")")).map(function (_a) {
    var classname = _a[0], args = _a[2];
    return [classname, args];
}), identifier, (0, parsing_1.string)("_")); });
var matchExpression = (0, parsing_1.seq)((0, parsing_1.string)("match"), expression, (0, parsing_1.seq)((0, parsing_1.string)("case"), pattern, (0, parsing_1.string)("=>"), expression).map(function (_a) {
    var p = _a[1], e = _a[3];
    return [p, e];
}).some(), (0, parsing_1.string)("end")).map(function (_a) {
    var scrutinee = _a[1], patterns = _a[2];
    return "(function(_SCRUTINEE)\n".concat(patterns.map(function (p) {
        var pat = p[0], expr = p[1];
        if (pat === "_") {
            return "return ".concat(expr);
        }
        if (typeof pat === "string") {
            pat = [pat, []];
        }
        var _a = pat, name = _a[0], args = _a[1];
        return "if getmetatable(_SCRUTINEE).__type() == ".concat(name, " then\nreturn (function(").concat(args.join(", "), ")\nreturn ").concat(expr, "\nend)(table.unpack(getmetatable(_SCRUTINEE).__args))\nend");
    }).join("\n"), "\nend)(").concat(scrutinee, ")");
});
var doNotation = (0, parsing_1.seq)((0, parsing_1.string)("do"), (0, parsing_1.alt)((0, parsing_1.seq)((0, parsing_1.string)("yield"), (0, parsing_1.alt)(identifier, (0, parsing_1.string)("_")), (0, parsing_1.string)("="), expression).map(function (_a) {
    var b = _a[1], e = _a[3];
    return [b, e];
}), (0, parsing_1.seq)((0, parsing_1.string)("<|"), expression).map(function (_a) {
    var e = _a[1];
    return ["_", e];
})).some(), (0, parsing_1.string)("end")).map(function (_a) {
    var bindings = _a[1];
    var code = "";
    var last = bindings.pop();
    for (var _i = 0, _b = bindings; _i < _b.length; _i++) {
        var _c = _b[_i], name_3 = _c[0], expr = _c[1];
        code += "__EAGER(__EAGER(__EAGER(".concat(expr, ")[\"_OP___GT__GT__EQ_\"])(function(").concat(name_3, ")\nreturn ");
    }
    code += "".concat(last[1]).concat("\nend))".repeat(bindings.length));
    return code;
});
var classDefinition = (0, parsing_1.seq)((0, parsing_1.string)("class"), identifier, parameterList.optOr("()"), methodDefinition.many(), (0, parsing_1.string)("end")).map(function (_a) {
    var name = _a[1], params = _a[2], methods = _a[3];
    var anonName = params === "()"
        ? ""
        : name;
    var code = "function ".concat(anonName).concat(params, "\n  ").concat(methods.join("\n"), "\n  return setmetatable({\n    ").concat(params.slice(1, -1).split(", ").filter(Boolean).map(function (p) { return "".concat(p, " = ").concat(p, ",\n"); }).join(""), "\n    ").concat(methods.map(function (m) {
        var name = m.split("function ")[1]
            ? m.split("function ")[1].split("(")[0].trim()
            : m.split("local ")[1].split(/\=|\n/)[0].trim();
        return "".concat(name, " = ").concat(name, ",\n");
    }).join(""), "\n  }, {\n    __tostring = function()\n      return \"").concat(name).concat(params !== "()"
        ? "(\" .. ".concat(params.slice(1, -1).split(", ").filter(Boolean).map(function (p) { return "tostring(".concat(p, ")"); }).join(" .. \", \" .. "), " .. \")\"")
        : "\"", "\n    end,\n    __args = {").concat(params.slice(1, -1), "},\n    __type = function() return ").concat(name, " end,\n  })\nend");
    if (params === "()") {
        code = "$CLASS:".concat(name, "$\n").concat(name, " = (").concat(code, ")()");
    }
    return code;
});
var program = (0, parsing_1.seq)(statement.many(), (0, parsing_1.seq)((0, parsing_1.string)("<|"), expression).map(function (_a) {
    var e = _a[1];
    return e;
})).map(function (_a) {
    var s = _a[0], e = _a[1];
    return s.concat([
        "__EVAL(".concat(e, ")")
    ]).join("\n");
});
var start = program
    .map(format)
    .map(function (code) {
    var lib = (0, fs_1.readFileSync)("lib.lua", "utf-8");
    var newCode = [];
    for (var _i = 0, _a = code.split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        var res = /\$CLASS:(\w+)/.exec(line.trim());
        if (res) {
            newCode = ["local " + line.split("$CLASS:")[1].split("$")[0]].concat(newCode);
        }
        else {
            newCode.push(line);
        }
    }
    return lib + newCode.join("\n");
});
var processCode = function (code) {
    code = code.replace(/#.+/, "");
    return code;
};
var filepath = process.argv[2];
var text = (0, fs_1.readFileSync)(filepath, "utf-8");
var result = start.parse(processCode(text));
(0, fs_1.writeFileSync)(filepath.split(".hsk")[0] + ".lua", result);
