import { Parser, alt, empty, lazy, pure, regex, seq, string } from "./parsing"
import { readFileSync, writeFileSync } from "fs"

const format = (code: string, spaces: number = 2) => {
  let formatted: string[] = []
  let indentation = 0
  for (let line of code.split("\n")) {
    if (line.trim().length === 0) continue

    const posBraceCount = line.split("{").length - 1
    const negBraceCount = line.split("}").length - 1
    const eqBraces = line.trim().startsWith("}") && posBraceCount === negBraceCount

    if (/end/.test(line)) {
      indentation -= 1
    } if (/}/.test(line) && negBraceCount > posBraceCount) {
      indentation -= negBraceCount - posBraceCount
    } if (/else/.test(line)) {
      indentation -= 1
    }

    if (eqBraces) {
      indentation -= 1
    }

    indentation = indentation < 0 ? 0 : indentation

    formatted.push(`${
      " ".repeat(spaces * indentation)
    }${line.trimStart()}`)

    if (/\bfunction\b/.test(line)) {
      indentation += 1
    } if (/then/.test(line)) {
      indentation += 1
    } if (/{/.test(line) && posBraceCount > negBraceCount) {
      indentation += posBraceCount - negBraceCount
    } if (/else/.test(line)) {
      indentation += 1
    }

    if (eqBraces) {
      indentation += 1
    }
  }
  return formatted.join("\n")
}

function convertScalaToLua(scalaString) {
  scalaString = scalaString.replace(
    /\/\/.*|\/\*[\s\S]*?\*\//g, ''
  ).trim();

  const scalaPattern = /^`(.*?)`$/;
  const match = scalaString.match(scalaPattern);

  if (!match) {
    throw new Error("Invalid format");
  }

  let content = match[1];
  let luaString = '("';
  const regex = /\$(\w+)|\$\{([^}]+)\}/g;
  let index = 0;
  let result;
  let identifiers = []

  while ((result = regex.exec(content)) !== null) {
    luaString += content.slice(index, result.index);
    if (result[1]) {
      identifiers.push(`tostring(${identifier.parse(result[1])})`);
      luaString += "%s";
    } else if (result[2]) {
      identifiers.push(`tostring(${expression.parse(result[2])})`);
      luaString += "%s";
    }
    index = regex.lastIndex;
  }

  luaString += content.slice(index) + '"):format(';
  luaString += identifiers.join(', ') + ')';

  return luaString
}

const operatorLookup: Record<string, string> = {
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
}

const luaKeywords: Record<string, string> = {
  "not": "_NOT",
  "and": "_AND",
  "or": "_OR",
}

const keywords = ["bind", "to", "def", "end", "match", "case", "block", "_OP___LT__PIPE_", "_OP___AT_", "do"]

let idCount = 0

const identifier: Parser<string> =
  regex(/[a-zA-Z][a-zA-Z0-9]*|[\+\-\*\/!@$%&^~:<>=|?]+/)
  .flatMap(id => {
    let newId = ""
    let isOp = false
    for (let i = 0; i < id.length; i++) {
      const char = id[i]
      if (operatorLookup[char]) {
        isOp = true
        newId += operatorLookup[char]
      }
      else newId += char
    }
    if (isOp) newId = `_OP__${newId}`
    return keywords.indexOf(newId) >= 0
      ? empty
      : newId in luaKeywords
        ? pure(luaKeywords[newId])
        : pure(newId)
  })

const int: Parser<string> =
  regex(/\d+/)
  .map(i => `__INT(${i})`)

const float: Parser<string> =
  regex(/\d+\.\d+/)
  .map(f => `__FLOAT(${f})`)

const str: Parser<string> =
  regex(/"[^"]*"/)
  .map(s => `__STRING(${s})`)

const sString: Parser<string> =
  regex(/`[^`]*`/)
  .map(s => s.replace(/\\\s+\\/, ""))
  .map(convertScalaToLua)

const parameterList: Parser<string> = seq(
  string("("),
  identifier,
  seq(
    string(","),
    identifier,
  ).map(([,id]) => id).many(),
  string(")")
).map(([,f,r,]) => `(${[f].concat(r).join(", ")})`)

const expression: Parser<string> =
  lazy(() => alt(
    doNotation,
    block,
    lambdaExpression,
    prefixOp,
    matchExpression,
    sString,
    freeMethodAccess,
    methodCall,
    propertyAccess,
    array,
    identifier,
    float,
    int,
    str,
  ))

const array: Parser<string> = seq(
  string("["),
  expression,
  seq(
    string(","),
    expression,
  ).map(([,e]) => e).many(),
  string(",").optOr(""),
  string("]"),
).map(([,head,tail,,]) => {
  let arr = [head].concat(tail)
  arr = arr.reverse()
  let code = "Nil"
  arr.forEach(e => code = `Cons(${e}, ${code})`)
  return code
})

const argumentList: Parser<string> = seq(
  string("("),
  alt(
    expression,
    string("_"),
  ),
  seq(
    string(","),
    alt(
      expression,
      string("_"),
    )
  ).map(([,e]) => e).many(),
  string(")"),
).map(([,f,r,]) => `(${[f].concat(r).join(",₩")})`)

const primaryExpression: Parser<string> =
  lazy(() => alt(
    sString,
    prefixOp,
    methodCall,
    array,
    identifier,
    float,
    int,
    str,
    seq(
      string("("),
      expression,
      string(")"),
    ).map(([,expr,]) => expr),
  ))

const statement: Parser<string> =
  lazy(() => alt(
    methodDefinition,
    classDefinition,
  ))

const prefixOp: Parser<string> = seq(
  alt(
    identifier.flatMap(i =>
      i.startsWith("_OP__")
      ? pure(i)
      : empty),
    seq(
      string("@"),
      identifier.flatMap(i =>
        i.startsWith("_OP__")
        ? empty
        : pure(i)),
    ).map(([,i]) => i)
  ),
  primaryExpression,
).map(([op,e]) => `__EAGER(${e}["${op}"])`)

const block: Parser<string> = seq(
  string("block"),
  statement.many(),
  seq(
    string("<|"),
    expression,
  ).map(([,e]) => e),
  string("end"),
).map(([,stmts,expr,]) =>
  `__LAZY(function()\n${stmts.map(s => `${s}\n`).join("")}return ${expr}\nend)`)

const propertyAccess: Parser<string> = seq(
  alt(
    array,
    identifier,
    float,
    int,
    str,
    seq(
      string("("),
      expression,
      string(")"),
    ).map(([,e,]) => e)
  ),
  string("."),
  identifier,
).map(([expr,,name]) =>
  `__EAGER(__EAGER(${expr})["${name}"])`)

const methodCall: Parser<string> = seq(
  alt(
    string("_"),
    propertyAccess,
    identifier,
    seq(
      string("("),
      expression,
      string(")"),
    ).map(([,e,]) => e),
  ),
  argumentList.some(),
).map(([func,argLists]) => {
  let code = `%ARG_0`
  for (const args of argLists) {
    code += "("
    let argsStr = []
    let newArgs = args.slice(1, -1).split(",₩")
    for (let i in newArgs) {
      argsStr.push(`%ARG_${Number(i) + 1}`)
    }
    code += argsStr.join(", ") + ")"

    for (let i in [func].concat(newArgs)) {
      let arg = [func].concat(newArgs)[i]
      if (arg === "_") {
        let argVar = `_ANON_${idCount++}`
        code = `function(${argVar})\nreturn ${code.replace(`%ARG_${i}`, `__EAGER(${argVar})`)}\nend`
      } else {
        code = code.replace(`%ARG_${i}`, `__EAGER(${arg})`)
      }
    }
    code = `__EAGER(${code})`
  }

  return code
})

const freeMethodAccess: Parser<string> = seq(
  alt(
    primaryExpression,
    string("_"),
  ),
  identifier,
  alt(
    methodCall,
    primaryExpression,
    string("_"),
  )
).map(([expr,name,arg]) => {
  if (expr === "_") {
    const var1 = `_ANON_${idCount++}`
    if (arg === "_") {
      const var2 = `_ANON_${idCount++}`
      return `__LAZY(function()\nreturn function(${var1})\nreturn __LAZY(function()\nreturn function(${var2})\nreturn __EAGER(${var1}["${name}"])(${var2})\nend\nend)\nend\nend)`
    }
    return `__LAZY(function()\nreturn function(${var1})\nreturn __EAGER(${var1}["${name}"])(${arg})\nend\nend)` 
  }
  if (arg === "_") {
    const var2 = `_ANON_${idCount++}`
    return `__LAZY(function()\nreturn function(${var2})\nreturn __EAGER(${expr}["${name}"])(${var2})\nend\nend)`
  }
  return `__EAGER(__EAGER(${expr})["${name}"])(${arg})`
})

const lambdaExpression: Parser<string> = seq(
  parameterList,
  string("=>"),
  alt(
    block,
    expression,
  )
).map(([ps,,bl]) => 
  `__LAZY(function()\nreturn function${ps}\nreturn ${bl}\nend\nend)`
)

const methodDefinition: Parser<string> = seq(
  string("def"),
  identifier,
  parameterList.optOr(""),
  string("="),
  alt(
    block,
    expression,
  ),
).map(([,id,ps,,bl]) => {
  if (ps === "") {
    return `local ${id}\n${id} = __LAZY(function()\nreturn ${bl}\nend)`
  }
  return `local ${id}\n${id} = __LAZY(function()\nreturn function${ps}\nreturn ${bl}\nend\nend)`
})

const pattern: Parser<string | [string, any[]]> =
  lazy(() => alt(
    seq(
      identifier,
      string("("),
      seq(
        pattern,
        seq(
          string(","),
          pattern,
        ).map(([,p]) => p).many()
      ).map(([h,t]) => [h].concat(t)),
      string(")"),
    ).map(([classname,,args,]) => [classname, args]),
    identifier as any,
    string("_") as any,
))

const matchExpression: Parser<string> = seq(
  string("match"),
  expression,
  seq(
    string("case"),
    pattern,
    string("=>"),
    expression,
  ).map(([,p,,e]) => [p, e]).some(),
  string("end"),
).map(([,scrutinee,patterns,]) => {
  return `(function(_SCRUTINEE)\n${patterns.map(p => {
    let [pat, expr] = p
    if (pat === "_") {
      return `return ${expr}`   
    }
    if (typeof pat === "string") {
      pat = [pat, []] as any
    }
    const [name, args] = pat as any
    return `if getmetatable(_SCRUTINEE).__type() == ${name} then\nreturn (function(${(args as Array<any>).join(", ")})\nreturn ${expr}\nend)(table.unpack(getmetatable(_SCRUTINEE).__args))\nend`
  }).join("\n")}\nend)(${scrutinee})`
})

const doNotation: Parser<string> = seq(
  string("do"),
  alt(
    seq(
      string("bind"),
      alt(
        identifier,
        string("_"),
      ),
      string("to"),
      expression,
    ).map(([,b,,e]) => [b, e] as const),
    seq(
      string("<|"),
      expression,
    ).map(([,e]) => ["_", e] as const)
  ).some(),
  string("end"),
).map(([,bindings,]) => {
  let code = ""
  let last = bindings.pop()

  for (const [name, expr] of bindings as any) {
    code += `__EAGER(__EAGER(${expr}["_OP___GT__GT__EQ_"])(function(${name})\nreturn `
  }

  code += `${last[1]}${"\nend))".repeat(bindings.length)}`

  return code
})

const classDefinition: Parser<string> = seq(
  string("class"),
  identifier,
  parameterList.optOr("()"),
  methodDefinition.many(),
  string("end"),
).map(([,name,params,methods,]) => {
  let anonName = params === "()"
    ? ""
    : name
  let code = `function ${anonName}${params}
  ${methods.join("\n")}
  return setmetatable({
    ${params.slice(1, -1).split(", ").filter(Boolean).map(p => `${p} = ${p},\n`
    ).join("")}
    ${methods.map(m => {
      let name = m.split("function ")[1]
        ? m.split("function ")[1].split("(")[0].trim()
        : m.split("local ")[1].split(/\=|\n/)[0].trim()
      return `${name} = ${name},\n`
    }).join("")}
  }, {
    __tostring = function()
      return "${name}${params !== "()"
        ? `(" .. ${params.slice(1, -1).split(", ").filter(Boolean).map(p => `tostring(${p})`).join(` .. ", " .. `)} .. ")"`
        : `"`}
    end,
    __args = {${params.slice(1, -1)}},
    __type = function() return ${name} end,
  })
end`
  if (params === "()") {
    code = `$CLASS:${name}$\n${name} = (${code})()`
  }

  return code
})

const program: Parser<string> = seq(
  statement.many(),
  seq(
    string("<|"),
    expression,
  ).map(([,e]) => e),
).map(([s,e]) => s.concat([
  `__EVAL(${e})`
]).join("\n"))

const start = program 
  .map(format)
  .map(code => {
    const lib: string = readFileSync("lib.lua", "utf-8")
    let newCode = []
    for (const line of code.split("\n")) {
      const res = /\$CLASS:(\w+)/.exec(line.trim())
      if (res) {
        newCode = ["local " + line.split("$CLASS:")[1].split("$")[0]].concat(newCode)
      } else {
        newCode.push(line)
      }
    }
    return lib + newCode.join("\n")
  })

const processCode = (code: string) => {
  code = code.replace(/#.+/, "")
  return code
}

const filepath: string = process.argv[2]
const text: string = readFileSync(filepath, "utf-8")

const result = start.parse(processCode(text))

writeFileSync(filepath.split(".hsk")[0] + ".lua", result)
