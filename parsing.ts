type ParserFunction<Xs> = (s: string) => [Xs, string] | null
type LazyParser<Xs> = () => Parser<Xs>

export class Parser<const Xs> {
  raw_parse: ParserFunction<Xs>
  parse: (s: string) => Xs
  constructor(parse: ParserFunction<Xs>) {
    this.raw_parse = parse
    this.parse = input => {
      const result = parse(input)
      if (!result)
        throw new Error("Parsing Failed!")
      const [x, _] = result
      return x
    }
  }
  map<Ys>(f: (xs: Xs) => Ys): Parser<Ys> {
    return new Parser(input => {
      const result = this.raw_parse(input)
      if (!result) return null
      const [xs, rest] = result
      return [f(xs), rest]
    })
  }
  flatMap<Ys>(f: (xs: Xs) => Parser<Ys>): Parser<Ys> {
    return new Parser(input => {
      const result = this.raw_parse(input)
      if (!result) return null
      const [xs, rest] = result
      return f(xs).raw_parse(rest)
    })
  }
  optOr(value: Xs): Parser<Xs> {
    return new Parser(input => {
      const result = this.raw_parse(input)
      if (!result) return [value, input]
      return result
    })
  }
  skip<Ys>(p: Parser<Ys>): Parser<Xs> {
    return new Parser(input => {
      const result = this.raw_parse(input)
      if (!result) return null
      let [xs, rest] = result
      rest = rest.trimStart()
      const result2 = p.raw_parse(rest)
      if (!result2) return null
      const [_, rest2] = result2
      return [xs, rest2]
    })
  }
  some(): Parser<Xs[]> {
    return new Parser(input => {
      const result = this.raw_parse(input)
      if (!result) return null
      let [x, rest] = result
      rest = rest.trimStart()
      const results = this.some().raw_parse(rest)
      if (!results) return [[x], rest]
      let [xs, rest2] = results
      rest2 = rest2.trimStart()
      return [[x].concat(xs), rest2]
    })
  }
  many(): Parser<Xs[]> {
    return new Parser(input => {
      const result = this.some().raw_parse(input)
      if (!result) return [[], input]
      return result
    })
  }
}

export const alt = <Xs>(...ps: Parser<Xs>[]) => new Parser(input => {
  if (!input) return null
  for (const p of ps) {
    const result = p.raw_parse(input)
    if (!result) continue
    return result
  }
  return null
})

type Seq<Ps extends Parser<any>[], Acc extends any[] = []> =
  Ps extends [infer Head extends Parser<any>, ...infer Tail extends Parser<any>[]]
    ? Head extends Parser<infer H>
      ? Seq<Tail, [...Acc, H]>
      : never
    : Parser<Acc>

export const seq = <Ps extends Parser<any>[]>(...ps: Ps): Seq<Ps> => new Parser(input => {
  const results: any[] = []
  for (const p of ps) {
    input = input.trimStart()
    const res = p.raw_parse(input)
    if (!res) return null
    const [x, r] = res
    results.push(x)
    input = r
  }
  return [results, input] as any
}) as any

export const pure = <X>(value: X) => new Parser(input =>
  [value, input]
)

export const empty: Parser<never> = new Parser(input => null)

export const regex = (re: RegExp) => new Parser(input => {
  let source = re.source
  if (!source.startsWith("^")) {
    source = "^(?:" + source + ")"
  }
  re = RegExp(source)
  const result = re.exec(input)
  if (!result) return null
  return [result[0], input.slice(result[0].length, input.length)]
})

export const string = (s: string) => new Parser(input => {
  if (!input.startsWith(s)) return null
  return [s, input.slice(s.length, input.length)]
})

export const lazy = <Xs>(f: LazyParser<Xs>) => new Parser(input => f().raw_parse(input))

export const ws = regex(/\s/).many()
