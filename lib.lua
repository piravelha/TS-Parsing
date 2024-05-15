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

local function __INT(n)
  local function _PLUS_(m)
    return __INT(n + m["~"])
  end
  return setmetatable({
    _OP___PLUS_ = _PLUS_,
    ["~"] = n,
  }, {
    __tostring = function()
      return tostring(n)
    end,
    __type = __INT,
    __args = {}
  })
end

local function __STRING(s)
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

local Math = {
  random = function(min, max)
    return IO(function()
      math.randomseed(os.time())
      return __INT(math.random(min["~"], max["~"]))
    end)
  end,
}

function __EVAL(io)
  return getmetatable(__EAGER(io)).__eval()
end

