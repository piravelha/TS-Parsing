local __RANDOM_SEED = 696969696

local function __LAZY(obj)
  if type(obj) == "table" and obj["~lazy"] then
    return obj
  end
  return {
    ["~lazy"] = true,
    ["~"] = obj
  }
end

local function __EAGER(obj)
  if type(obj) ~= "table" or not obj["~lazy"] then
    return obj
  end
  local result = obj["~"]()
  if type(result) == "table" and result["~lazy"] then
    return __EAGER(result)
  end

  return result
end

local True
local False

local function __INT(n)
  if type(n) ~= "number" then
    error(string.format("Attempt to create integer using a non numeric value: %s", tostring(n)))
  elseif n % 1 ~= 0 then
    error(string.format("Attempt to create integer using a fractional value: %s", tostring(n)))
  end

  local function _PLUS_(m)
    return __INT(n + m["~"])
  end
  local function _DASH_(m)
    return __INT(n - m["~"])
  end
  local function _STAR_(m)
    return __INT(n * m["~"])
  end
  local function _SLASH_(m)
    return __INT(n // m["~"])
  end
  local function _EQ__EQ_(m)
    if n == m["~"] then
      return True
    else
      return False
    end
  end
  local function _BANG__EQ_(m)
    if n == m["~"] then
      return False
    else
      return True
    end
  end
  local function _LT_(m)
    if n < m["~"] then
      return True
    else
      return False
    end
  end
  local function _LT__EQ_(m)
    if n <= m["~"] then
      return True
    else
      return False
    end
  end
  local function _GT_(m)
    if n > m["~"] then
      return True
    else
      return False
    end
  end
  local function _GT__EQ_(m)
    if n >= m["~"] then
      return True
    else
      return False
    end
  end
  return setmetatable({
    _OP___PLUS_ = _PLUS_,
    _OP___DASH_ = _DASH_,
    _OP___STAR_ = _STAR_,
    _OP___SLASH_ = _SLASH_,
    _OP___EQ__EQ_ = _EQ__EQ_,
    _OP___BANG__EQ_ = _BANG__EQ_,
    _OP___LT_ = _LT_,
    _OP___LT__EQ_ = _LT__EQ_,
    _OP___GT_ = _GT_,
    _OP___GT__EQ_ = _GT__EQ_,
    ["~"] = n,
  }, {
    __tostring = function()
      return tostring(n)
    end,
    __type = __INT,
    __args = {}
  })
end

local function __FLOAT(f)
  if type(f) ~= "number" then
    error(string.format("Attempt to create float using non numeric value: %s", tostring(f)))
  end

  local function _PLUS_(g)
    return __FLOAT(f + g["~"])
  end
  local function _DASH_(g)
    return __FLOAT(f - g["~"])
  end
  local function _STAR_(g)
    return __FLOAT(f * g["~"])
  end
  local function _SLASH_(g)
    return __FLOAT(f / g["~"])
  end
  return setmetatable({
    _OP___PLUS_ = _PLUS_,
    _OP___DASH_ = _DASH_,
    _OP___STAR_ = _STAR_,
    _OP___SLASH_ = _SLASH_,
    ["~"] = f,
  }, {
    __tostring = function()
      if f % 1 == 0 then
        return tostring(f) .. ".0"
      end
      return tostring(f)
    end,
    __type = function() return __FLOAT end,
    __args = {},
  })
end

local function __STRING(s)
  if type(s) ~= "string" then
    error(string.format("Attempt to create string with a non string value: %s", tostring(s)))
  end

  local function _PLUS_(a)
    return __STRING(s .. a["~"])
  end
   return setmetatable({
    _OP___PLUS_ = _PLUS_,
    ["~"] = s,
  }, {
    __tostring = function()
      return s
    end,
    __type = __STRING,
    __args = {},
  })
end

True = setmetatable({
  _OP___AMP_AMP_ = function(bool)
    return bool
  end,
}, {
  __tostring = function()
    return "True"
  end,
  __type = function() return True end,
  __args = {},
})

False = setmetatable({
  _OP___AMP_AMP_ = function(bool)
    return False
  end,
}, {
  __tostring = function()
    return "False"
  end,
  __type = function() return False end,
  __args = {},
})

local Nil

local function Cons(head, tail)
  local function map(f)
    return Cons(
      __EAGER(f)(__EAGER(head)),
      __EAGER(tail).map(__EAGER(f))
    )
  end

  local function filter(p)
    if p(head) == True then
      return Cons(
        head,
        tail.filter(p)
      )
    end

    return tail.filter(p)
  end

  local function _BANG__BANG_(i)
    if i["~"] == 0 then
      return head
    else
      return tail._OP___BANG__BANG_(__INT(i["~"] - 1))
    end
  end

  return setmetatable({
    head = __LAZY(function()
      return head
    end),
    tail = __LAZY(function()
      return tail
    end),
    map = map,
    _OP___LT__DOL__GT_ = map,
    filter = filter,
    _OP___BANG__BANG_ = _BANG__BANG_,
    ["~1"] = head,
    ["~2"] = tail,
  }, {
    __tostring = function()
      local t = tostring(tail):sub(2)
      if t == "]" then
        return "[" .. tostring(head) .. "]"
      end
      return "[" .. tostring(head) .. ", " .. t
    end,
    __type = function() return Cons end,
    __args = {head, tail},
  })
end

Nil = setmetatable({
  map = function(f)
    return Nil
  end,
  _OP___LT__DOL__GT_ = map,
  filter = function(p)
    return Nil
  end,
}, {
  __tostring = function()
    return "[]"
  end,
  __type = function() return Nil end,
  __args = {},
})

local None

local function Some(value)
  function map(f)
    return Some(f(value))
  end
  function filter(p)
    if p(value) == True then
      return Some(value)
    else
      return None
    end
  end
  function _GT__GT_(m)
    return m
  end
  function _GT__GT__EQ_(f)
    return f(value)
  end
  function _LT__PIPE__GT_(m)
    return Some(value)
  end
  return setmetatable({
    map = map,
    _OP___LT__DOL__GT_ = map,
    filter = filter,
    _OP___GT__GT_ = _GT__GT_,
    _OP___GT__GT__EQ_ = _GT__GT__EQ_,
    ["~"] = value,
  }, {
    __tostring = function()
      return "Some(" .. tostring(value) .. ")"
    end,
    __type = function() return Some end,
    __args = {value}
  })
end

None = setmetatable({
  map = function(f)
    return None
  end,
  _OP___LT__DOL__GT_ = function(f)
    return None
  end,
  filter = function(p)
    return None
  end,
  _OP___GT__GT_ = function(m)
    return None
  end,
  _OP___GT__GT__EQ_ = function(f)
    return None
  end,
}, {
  __tostring = function()
    return "None"
  end,
  __type = function() return None end,
  __args = {},
})

local function IO(action)
  return setmetatable({
    _OP___GT__GT_ = function(other)
      return IO(function()
        action()
        return __EVAL(other)
      end)
    end,
    _OP___GT__GT__EQ_ = function(other)
      return IO(function()
        return __EVAL(other(action()))
      end)
    end,
  }, {
    __type = IO,
    __args = {},
    __eval = action,
  })
end

local function println(...)
  local args = {...}
  return IO(function()
    return print(table.unpack(args))
   end)
end

local List = {
  range = function(min, max, step)
    step = step or __INT(1)
    local l = Nil
    for i = max["~"], min["~"], -step["~"] do
      l = Cons(__INT(i), l)
    end
    return l
  end
}

local Random = {
  random = function(min, max)
    return IO(function()
      __RANDOM_SEED = __RANDOM_SEED + 1 + os.time()
      math.randomseed(__RANDOM_SEED)
      return __INT(math.random(min["~"], max["~"]))
    end)
  end,
}

function __EVAL(io)
  return getmetatable(__EAGER(io)).__eval()
end

