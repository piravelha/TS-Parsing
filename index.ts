import { Parser, alt, empty, lazy, pure, regex, seq, string } from "./parsing"

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

const keywords = ["def", "end"]

const identifier: Parser<string> =
  regex(/[a-zA-Z_][a-zA-Z_0-9]*|[\+\-\*\/!@#$%&^~:<>=|?]+/)
  .flatMap(id => {
    let newId = ""
    for (let i = 0; i < id.length; i++) {
      const char = id[i]
      if (operatorLookup[char]) {
        newId += operatorLookup[char]
      }
      else newId += char
    }
    return keywords.indexOf(newId) >= 0
      ? empty
      : pure(newId)
  })

const parameterList: Parser<string> = seq(
  string("("),
  identifier,
  seq(
    string(","),
    identifier
  ).map(([,id]) => id).many(),
  string(")")
).map(([,f,r,]) => `(${[f].concat(r).join(", ")})`)

const expression: Parser<string> =
  lazy(() => alt(
    freeMethodAccess,
    methodCall,
    identifier,
    propertyAccess,
  ))

const argumentList: Parser<string> = seq(
  string("("),
  expression,
  seq(
    string(","),
    expression
  ).map(([,e]) => e).many(),
  string(")"),
).map(([,f,r,]) => `(${[f].concat(r).join(", ")})`)

const primaryExpression: Parser<string> =
  lazy(() => alt(
    identifier,
    seq(
      string("("),
      expression,
      string(")"),
    ).map(([,expr,]) => expr),
  ))

const statement: Parser<string> =
  lazy(() => alt(
    methodDefinition,
  ))

const block: Parser<string> = seq(
  string("block"),
  statement.many(),
  expression,
  string("end"),
).map(([,stmts,expr,]) =>
  `${stmts.map(s => `${s}\n`)}return ${expr}`)

const propertyAccess: Parser<string> = seq(
  primaryExpression,
  string("."),
  identifier,
).map(([expr,,name]) =>
  `${expr}["${name}"]()`)

const methodCall: Parser<string> = seq(
  alt(
    propertyAccess,
    primaryExpression,
  ),
  argumentList,
).map(([func,args]) =>
  `${func}${args}`)

const freeMethodAccess: Parser<string> = seq(
  primaryExpression,
  identifier,
  primaryExpression,
).map(([expr,name,arg]) =>
  `${expr}["${name}"](${arg})`)

const methodDefinition: Parser<string> = seq(
  string("def"),
  identifier,
  parameterList.optOr(""),
  string("="),
  alt(
    block,
    expression.map(e => `return ${e}`),
  ),
).map(([,id,ps,,bl]) => {
  if (ps === "") {
    return `local ${id} = (function()\n${bl}\nend)()`
  }
  return `function ${id}${ps}\n${bl}\nend`
})

const classDefinition: Parser<string> = seq(
  string("class"),
  identifier,
  parameterList.optOr("()"),
  methodDefinition.many(),
  string("end"),
).map(([,name,params,methods,]) =>
`function ${name}${params}
  ${methods.join("\n")}
  return {
    ${params.slice(1, -1).split(", ").map(p =>
      `${p} = ${p},\n`
    ).join("")}
    ${methods.map(m => {
      const name = m.split("function ")[1].split("(")[0]
      return `${name} = ${name},\n`
    }).join("")}
  }
end`
)

const start = classDefinition

console.log(format(start.parse(`
  class Int(value)
    def +(other) = block
      def result = value + other
      result
    end
  end
`)))