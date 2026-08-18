local output = app.params["output"]
if output == nil or output == "" then
  error("Missing --script-param output=<path>")
end

local W, H = 64, 64
local TAU = math.pi * 2

local TAGS = {
  {name="stagehand_idle", archetype="stagehand", count=6, duration=110, loop=false, color="b87346"},
  {name="stagehand_walk", archetype="stagehand", count=8, duration=75, loop=false, color="b87346"},
  {name="stagehand_alert", archetype="stagehand", count=5, duration=80, loop=true, color="b87346"},
  {name="stagehand_hurt", archetype="stagehand", count=4, duration=70, loop=true, color="b87346"},
  {name="stagehand_defeat", archetype="stagehand", count=4, duration=110, loop=true, color="b87346"},
  {name="thrower_idle", archetype="card_thrower", count=6, duration=110, loop=false, color="e6c65c"},
  {name="thrower_move", archetype="card_thrower", count=8, duration=75, loop=false, color="e6c65c"},
  {name="thrower_telegraph", archetype="card_thrower", count=5, duration=76, loop=true, color="e6c65c"},
  {name="thrower_cooldown", archetype="card_thrower", count=5, duration=90, loop=true, color="e6c65c"},
  {name="thrower_hurt", archetype="card_thrower", count=4, duration=70, loop=true, color="e6c65c"},
  {name="thrower_defeat", archetype="card_thrower", count=4, duration=110, loop=true, color="e6c65c"},
  {name="acrobat_stalk", archetype="shadow_acrobat", count=8, duration=75, loop=false, color="a05ee8"},
  {name="acrobat_telegraph", archetype="shadow_acrobat", count=5, duration=90, loop=true, color="a05ee8"},
  {name="acrobat_leap", archetype="shadow_acrobat", count=7, duration=70, loop=false, color="a05ee8"},
  {name="acrobat_hurt", archetype="shadow_acrobat", count=4, duration=70, loop=true, color="a05ee8"},
  {name="acrobat_defeat", archetype="shadow_acrobat", count=4, duration=110, loop=true, color="a05ee8"},
  {name="wraith_hover", archetype="light_wraith", count=8, duration=90, loop=false, color="65eaf3"},
  {name="wraith_telegraph", archetype="light_wraith", count=6, duration=70, loop=true, color="65eaf3"},
  {name="wraith_charge", archetype="light_wraith", count=7, duration=60, loop=false, color="65eaf3"},
  {name="wraith_hurt", archetype="light_wraith", count=4, duration=70, loop=true, color="65eaf3"},
  {name="wraith_defeat", archetype="light_wraith", count=4, duration=110, loop=true, color="65eaf3"},
  {name="sentry_idle", archetype="card_sentry", count=6, duration=110, loop=false, color="ef3f66"},
  {name="sentry_telegraph", archetype="card_sentry", count=6, duration=70, loop=true, color="ef3f66"},
  {name="sentry_cooldown", archetype="card_sentry", count=7, duration=80, loop=true, color="ef3f66"},
  {name="sentry_hurt", archetype="card_sentry", count=4, duration=70, loop=true, color="ef3f66"},
  {name="sentry_defeat", archetype="card_sentry", count=4, duration=110, loop=true, color="ef3f66"},
  {name="echo_duelist_patrol", archetype="echo_duelist", count=8, duration=75, loop=false, color="7fa8ff"},
  {name="echo_duelist_telegraph", archetype="echo_duelist", count=5, duration=84, loop=true, color="7fa8ff"},
  {name="echo_duelist_dash", archetype="echo_duelist", count=7, duration=60, loop=false, color="7fa8ff"},
  {name="echo_duelist_cooldown", archetype="echo_duelist", count=4, duration=100, loop=true, color="7fa8ff"},
  {name="echo_duelist_hurt", archetype="echo_duelist", count=4, duration=70, loop=true, color="7fa8ff"},
  {name="echo_duelist_defeat", archetype="echo_duelist", count=4, duration=110, loop=true, color="7fa8ff"},
  {name="echo_caster_hover", archetype="echo_caster", count=8, duration=90, loop=false, color="df78ff"},
  {name="echo_caster_telegraph", archetype="echo_caster", count=6, duration=70, loop=true, color="df78ff"},
  {name="echo_caster_cooldown", archetype="echo_caster", count=5, duration=90, loop=true, color="df78ff"},
  {name="echo_caster_hurt", archetype="echo_caster", count=4, duration=70, loop=true, color="df78ff"},
  {name="echo_caster_defeat", archetype="echo_caster", count=4, duration=110, loop=true, color="df78ff"},
  {name="dummy_idle", archetype="training_dummy", count=6, duration=130, loop=true, color="c98a45"},
  {name="dummy_hit", archetype="training_dummy", count=4, duration=70, loop=false, color="c98a45"},
  {name="dummy_heavy_hit", archetype="training_dummy", count=5, duration=75, loop=false, color="c98a45"},
  {name="dummy_reset", archetype="training_dummy", count=4, duration=90, loop=false, color="c98a45"},
  {name="core_duelist_idle", archetype="core_duelist", count=6, duration=120, loop=true, color="f052c3"},
  {name="core_duelist_patrol", archetype="core_duelist", count=8, duration=90, loop=true, color="f052c3"},
  {name="core_duelist_telegraph", archetype="core_duelist", count=5, duration=75, loop=false, color="f052c3"},
  {name="core_duelist_dash", archetype="core_duelist", count=5, duration=65, loop=false, color="f052c3"},
  {name="core_duelist_stagger", archetype="core_duelist", count=4, duration=75, loop=false, color="f052c3"},
  {name="core_duelist_defeated", archetype="core_duelist", count=5, duration=90, loop=false, color="f052c3"},
  {name="core_caster_hover", archetype="core_caster", count=8, duration=110, loop=true, color="54e6f2"},
  {name="core_caster_telegraph", archetype="core_caster", count=6, duration=80, loop=false, color="54e6f2"},
  {name="core_caster_cast", archetype="core_caster", count=5, duration=70, loop=false, color="54e6f2"},
  {name="core_caster_stagger", archetype="core_caster", count=4, duration=75, loop=false, color="54e6f2"},
  {name="core_caster_defeated", archetype="core_caster", count=5, duration=90, loop=false, color="54e6f2"},
  {name="core_mime_idle", archetype="core_mime", count=6, duration=125, loop=true, color="e9e9f2"},
  {name="core_mime_stalk", archetype="core_mime", count=8, duration=95, loop=true, color="e9e9f2"},
  {name="core_mime_record", archetype="core_mime", count=6, duration=85, loop=false, color="e9e9f2"},
  {name="core_mime_mimic", archetype="core_mime", count=7, duration=70, loop=false, color="e9e9f2"},
  {name="core_mime_stagger", archetype="core_mime", count=4, duration=75, loop=false, color="e9e9f2"},
  {name="core_mime_defeated", archetype="core_mime", count=5, duration=90, loop=false, color="e9e9f2"},
}

local LAYERS = {
  "01_shadow",
  "02_fx_back",
  "03_body_back",
  "04_legs",
  "05_torso",
  "06_head",
  "07_face",
  "08_arms_weapon",
  "09_fx_front",
  "10_guides"
}

local function rgba(hex, alpha)
  hex = hex:gsub("#", "")
  local r = tonumber(hex:sub(1, 2), 16)
  local g = tonumber(hex:sub(3, 4), 16)
  local b = tonumber(hex:sub(5, 6), 16)
  return app.pixelColor.rgba(r, g, b, alpha or 255)
end

local function px(img, x, y, c)
  x, y = math.floor(x + 0.5), math.floor(y + 0.5)
  if x >= 0 and y >= 0 and x < W and y < H then
    img:drawPixel(x, y, c)
  end
end

local function rect(img, x, y, w, h, c)
  for yy = math.floor(y), math.floor(y + h - 1) do
    for xx = math.floor(x), math.floor(x + w - 1) do
      px(img, xx, yy, c)
    end
  end
end

local function line(img, x0, y0, x1, y1, c, width)
  x0, y0 = math.floor(x0 + 0.5), math.floor(y0 + 0.5)
  x1, y1 = math.floor(x1 + 0.5), math.floor(y1 + 0.5)
  local dx, sx = math.abs(x1 - x0), x0 < x1 and 1 or -1
  local dy, sy = -math.abs(y1 - y0), y0 < y1 and 1 or -1
  local err = dx + dy
  local radius = math.max(0, math.floor((width or 1) / 2))

  while true do
    for oy = -radius, radius do
      for ox = -radius, radius do
        px(img, x0 + ox, y0 + oy, c)
      end
    end

    if x0 == x1 and y0 == y1 then break end

    local e2 = 2 * err
    if e2 >= dy then err, x0 = err + dy, x0 + sx end
    if e2 <= dx then err, y0 = err + dx, y0 + sy end
  end
end

local function ellipse(img, cx, cy, rx, ry, c)
  local left = math.floor(cx - rx)
  local right = math.ceil(cx + rx)
  local top = math.floor(cy - ry)
  local bottom = math.ceil(cy + ry)

  for y = top, bottom do
    for x = left, right do
      local nx = (x - cx) / math.max(rx, 0.001)
      local ny = (y - cy) / math.max(ry, 0.001)
      if nx * nx + ny * ny <= 1 then
        px(img, x, y, c)
      end
    end
  end
end

local function tri(img, x1, y1, x2, y2, x3, y3, c)
  local minX = math.floor(math.min(x1, x2, x3))
  local maxX = math.ceil(math.max(x1, x2, x3))
  local minY = math.floor(math.min(y1, y2, y3))
  local maxY = math.ceil(math.max(y1, y2, y3))

  local function edge(ax, ay, bx, by, pxv, pyv)
    return (pxv - ax) * (by - ay) - (pyv - ay) * (bx - ax)
  end

  for y = minY, maxY do
    for x = minX, maxX do
      local a = edge(x1, y1, x2, y2, x, y)
      local b = edge(x2, y2, x3, y3, x, y)
      local d = edge(x3, y3, x1, y1, x, y)
      if (a >= 0 and b >= 0 and d >= 0) or
         (a <= 0 and b <= 0 and d <= 0) then
        px(img, x, y, c)
      end
    end
  end
end

local function contains(value, token)
  return string.find(value, token, 1, true) ~= nil
end

local function poseFor(tag, index, count)
  local t = count <= 1 and 0 or (index - 1) / (count - 1)
  local cycle = (index - 1) / count
  local bob = math.sin(cycle * TAU)
  local stride = math.sin(cycle * TAU)
  local attack = 0
  local recoil = 0
  local collapse = 0

  if contains(tag, "telegraph") or contains(tag, "alert") or
     contains(tag, "charge") or contains(tag, "record") then
    attack = t * 0.45
  elseif contains(tag, "attack") or contains(tag, "throw") or
         contains(tag, "fire") or contains(tag, "cast") or
         contains(tag, "dash") or contains(tag, "mimic") then
    attack = math.sin(t * math.pi)
  elseif contains(tag, "leap") then
    attack = math.sin(t * math.pi)
    bob = -math.sin(t * math.pi) * 4
  end

  if contains(tag, "hurt") or contains(tag, "stagger") or
     contains(tag, "hit") then
    recoil = math.sin(t * math.pi)
  end

  if contains(tag, "defeat") or contains(tag, "defeated") or
     contains(tag, "dissipate") then
    collapse = t
  end

  if contains(tag, "heavy_hit") then
    recoil = math.sin(t * math.pi) * 1.5
  end

  return {
    t = t,
    bob = bob,
    stride = stride,
    attack = attack,
    recoil = recoil,
    collapse = collapse
  }
end

local P = {
  ink = rgba("120d18"),
  dark = rgba("251329"),
  black = rgba("08070f"),
  bone = rgba("f0dbba"),
  white = rgba("f4f2ed"),
  gold = rgba("e7bd54"),
  red = rgba("b62b4b"),
  crimson = rgba("7f1738"),
  blue = rgba("579bd7"),
  cyan = rgba("65eaf3"),
  violet = rgba("9b54d8"),
  magenta = rgba("ee57c4"),
  brown = rgba("755035"),
  wood = rgba("b77b42"),
  grey = rgba("686579"),
  silver = rgba("b9c5d8"),
  shadow = rgba("130d1b", 110),
  glowCyan = rgba("65eaf3", 110),
  glowPink = rgba("ee57c4", 105),
  glowGold = rgba("e7bd54", 105)
}

local function drawShadow(img, x, y, wide, alpha)
  ellipse(img, x, y, wide, 3, rgba("100b16", alpha or 105))
end

local function drawStagehand(images, p)
  local x = 31 - p.recoil * 3
  local y = 0 + p.bob * 0.6 + p.collapse * 11
  drawShadow(images[1], 31, 57, 14 - p.collapse * 3, 105)

  line(images[4], x - 6, 43 + y, x - 8 - p.stride * 3, 55 + y, P.dark, 4)
  line(images[4], x + 5, 43 + y, x + 7 + p.stride * 3, 55 + y, P.dark, 4)
  rect(images[4], x - 11 - p.stride * 3, 54 + y, 8, 3, P.black)
  rect(images[4], x + 3 + p.stride * 3, 54 + y, 8, 3, P.black)

  ellipse(images[5], x, 36 + y, 12, 13, P.brown)
  rect(images[5], x - 10, 32 + y, 20, 14, P.wood)
  rect(images[5], x - 7, 34 + y, 14, 14, P.crimson)
  line(images[5], x - 7, 36 + y, x + 7, 36 + y, P.gold, 2)

  ellipse(images[6], x, 22 + y, 9, 9, P.dark)
  rect(images[6], x - 9, 17 + y, 18, 6, P.black)
  ellipse(images[7], x + 2, 22 + y, 6, 5, P.bone)
  rect(images[7], x + 3, 21 + y, 3, 2, P.black)

  local reach = 11 + p.attack * 9
  line(images[8], x + 8, 34 + y, x + reach, 35 - p.attack * 4 + y, P.wood, 4)
  line(images[8], x + reach, 35 - p.attack * 4 + y,
       x + reach + 4, 25 - p.attack * 5 + y, P.gold, 2)
  line(images[8], x + reach + 4, 25 - p.attack * 5 + y,
       x + reach + 8, 27 - p.attack * 5 + y, P.gold, 2)
end

local function drawThrower(images, p)
  local x = 30 - p.recoil * 3
  local y = -1 + p.bob + p.collapse * 13
  drawShadow(images[1], 31, 57, 10, 90)

  line(images[4], x - 3, 43 + y, x - 5 - p.stride * 2, 55 + y, P.ink, 3)
  line(images[4], x + 3, 43 + y, x + 5 + p.stride * 2, 55 + y, P.ink, 3)

  tri(images[3], x - 7, 31 + y, x - 13, 49 + y, x + 1, 46 + y, P.violet)
  rect(images[5], x - 5, 28 + y, 10, 18, P.dark)
  line(images[5], x - 4, 30 + y, x + 5, 42 + y, P.gold, 2)

  ellipse(images[6], x, 21 + y, 6, 8, P.bone)
  rect(images[6], x - 8, 12 + y, 16, 4, P.dark)
  rect(images[6], x - 5, 8 + y, 10, 7, P.crimson)
  px(images[7], x + 2, 21 + y, P.black)

  local reach = 10 + p.attack * 13
  line(images[8], x + 4, 30 + y, x + reach, 25 + y, P.bone, 3)

  for i = 0, 2 do
    local cx = x + reach + i * 3
    local cy = 22 + y + i
    rect(images[8], cx, cy, 4, 6, i == 1 and P.red or P.white)
    px(images[8], cx + 1, cy + 2, P.black)
  end

  if p.attack > 0.45 then
    for i = 1, 3 do
      rect(images[9], x + 20 + i * 6, 20 + i * 2, 4, 6, P.white)
    end
  end
end

local function drawAcrobat(images, p)
  local x = 29 - p.recoil * 4 + p.attack * 2
  local y = 2 + p.bob + p.collapse * 12
  drawShadow(images[1], 30, 57, 11, 95)

  line(images[4], x - 3, 39 + y, x - 12 - p.stride * 4, 54 + y, P.black, 3)
  line(images[4], x + 2, 40 + y, x + 12 + p.stride * 4, 53 + y, P.black, 3)
  line(images[5], x, 25 + y, x - 2, 41 + y, P.violet, 5)
  line(images[5], x - 2, 27 + y, x - 10, 34 + y, P.grey, 2)

  ellipse(images[6], x + 2, 20 + y, 5, 7, P.black)
  tri(images[6], x - 2, 16 + y, x + 7, 12 + y, x + 6, 21 + y, P.violet)
  px(images[7], x + 4, 20 + y, P.cyan)

  local handX = x + 9 + p.attack * 16
  local handY = 30 + y - p.attack * 8
  line(images[8], x + 2, 27 + y, handX, handY, P.grey, 2)
  ellipse(images[8], handX, handY, 2, 2, P.white)

  for i = 0, 3 do
    line(images[9], x - 12 + i * 4, 33 + y + i,
         x - 8 + i * 4, 35 + y + i, P.silver, 1)
  end
end

local function drawWraith(images, p)
  local x = 31 - p.recoil * 3
  local y = 4 + p.bob * 2 + p.collapse * 8
  drawShadow(images[1], 31, 58, 9, 65)

  ellipse(images[2], x, 31 + y, 14 + p.attack * 2, 19, P.glowCyan)
  ellipse(images[5], x, 31 + y, 9, 16, P.blue)
  tri(images[5], x - 9, 36 + y, x - 6, 55 + y, x, 43 + y, P.blue)
  tri(images[5], x, 40 + y, x + 4, 56 + y, x + 9, 35 + y, P.violet)

  ellipse(images[6], x, 20 + y, 7, 8, P.white)
  tri(images[6], x - 7, 22 + y, x, 29 + y, x + 7, 22 + y, P.silver)
  rect(images[7], x - 4, 19 + y, 2, 2, P.black)
  rect(images[7], x + 2, 19 + y, 2, 2, P.black)
  line(images[7], x - 2, 24 + y, x + 2, 24 + y, P.black, 1)

  local orbX = x + 12 + p.attack * 10
  ellipse(images[9], orbX, 29 + y, 4 + p.attack * 2, 4 + p.attack * 2, P.cyan)
  line(images[9], x + 5, 30 + y, orbX, 29 + y, P.cyan, 2)
end

local function drawSentry(images, p)
  local x = 31 - p.recoil * 3
  local y = 5 + p.bob * 1.5 + p.collapse * 11
  drawShadow(images[1], 31, 58, 11, 70)

  ellipse(images[2], x, 31 + y, 17, 17, P.glowGold)
  tri(images[3], x - 12, 23 + y, x - 18, 34 + y, x - 11, 45 + y, P.crimson)
  tri(images[3], x + 12, 23 + y, x + 18, 34 + y, x + 11, 45 + y, P.crimson)

  rect(images[5], x - 8, 20 + y, 16, 25, P.white)
  rect(images[5], x - 6, 22 + y, 12, 21, P.red)
  rect(images[5], x - 3, 25 + y, 6, 15, P.white)
  ellipse(images[6], x, 19 + y, 7, 6, P.gold)
  rect(images[7], x - 4, 18 + y, 8, 2, P.black)

  local angle = p.t * TAU
  for i = 0, 3 do
    local a = angle + i * math.pi * 0.5
    local cx = x + math.cos(a) * (13 + p.attack * 5)
    local cy = 32 + y + math.sin(a) * 13
    rect(images[8], cx - 2, cy - 3, 5, 7, i % 2 == 0 and P.white or P.red)
  end

  if p.attack > 0.35 then
    line(images[9], x + 8, 32 + y, x + 25, 32 + y, P.gold, 3)
  end
end

local function drawDuelist(images, p, core)
  local x = 29 - p.recoil * 4 + p.attack * 2
  local y = p.bob * 0.7 + p.collapse * 13
  local coat = core and P.magenta or P.blue
  local glow = core and P.glowPink or rgba("579bd7", 95)

  drawShadow(images[1], 31, 57, 11, 95)
  ellipse(images[2], x, 34 + y, 11, 18, glow)

  line(images[4], x - 3, 42 + y, x - 5 - p.stride * 2, 55 + y, P.dark, 3)
  line(images[4], x + 3, 42 + y, x + 6 + p.stride * 2, 55 + y, P.dark, 3)

  tri(images[3], x - 6, 29 + y, x - 13, 50 + y, x + 1, 44 + y, coat)
  rect(images[5], x - 6, 27 + y, 12, 17, P.dark)
  line(images[5], x - 5, 30 + y, x + 5, 39 + y, core and P.cyan or P.gold, 2)

  ellipse(images[6], x, 21 + y, 6, 7, core and P.white or P.bone)
  rect(images[6], x - 7, 15 + y, 14, 3, coat)
  px(images[7], x + 3, 21 + y, core and P.magenta or P.black)

  local reach = 10 + p.attack * 17
  line(images[8], x + 4, 30 + y, x + reach, 30 - p.attack * 3 + y, P.bone, 2)
  line(images[8], x + reach, 30 - p.attack * 3 + y,
       x + reach + 15, 27 - p.attack * 3 + y,
       core and P.cyan or P.silver, 1)

  if core then
    line(images[9], x - 8, 18 + y, x - 14, 12 + y, P.magenta, 1)
    line(images[9], x + 5, 38 + y, x + 12, 45 + y, P.cyan, 1)
  end
end

local function drawCaster(images, p, core)
  local x = 30 - p.recoil * 3
  local y = 3 + p.bob * 2 + p.collapse * 11
  local robe = core and P.magenta or P.violet
  local glow = core and P.glowPink or rgba("9b54d8", 100)

  drawShadow(images[1], 31, 58, 10, 65)
  ellipse(images[2], x, 33 + y, 15, 20, glow)

  tri(images[5], x - 8, 28 + y, x - 12, 52 + y, x, 44 + y, robe)
  tri(images[5], x + 8, 28 + y, x + 12, 52 + y, x, 44 + y, robe)
  rect(images[5], x - 7, 27 + y, 14, 18, P.dark)

  ellipse(images[6], x, 21 + y, 6, 7, core and P.black or P.bone)
  tri(images[6], x - 8, 16 + y, x - 4, 8 + y, x, 16 + y, P.gold)
  tri(images[6], x - 2, 16 + y, x + 1, 6 + y, x + 4, 16 + y, P.cyan)
  tri(images[6], x + 3, 16 + y, x + 7, 9 + y, x + 8, 17 + y, P.gold)

  if core then
    rect(images[7], x - 4, 20 + y, 8, 3, P.magenta)
  else
    px(images[7], x + 2, 21 + y, P.black)
  end

  local radius = 13 + p.attack * 7
  local angle = p.t * TAU

  for i = 0, 2 do
    local a = angle + i * TAU / 3
    local cx = x + math.cos(a) * radius
    local cy = 31 + y + math.sin(a) * radius
    tri(images[8], cx, cy - 4, cx - 3, cy + 3, cx + 3, cy + 2,
        core and P.cyan or P.gold)
  end

  ellipse(images[9], x + 14 + p.attack * 7, 29 + y, 3 + p.attack * 2,
          3 + p.attack * 2, core and P.magenta or P.cyan)
end

local function drawDummy(images, p)
  local x = 31 - p.recoil * 5
  local y = p.collapse * 6
  drawShadow(images[1], 31, 58, 12, 100)

  rect(images[4], x - 2, 45 + y, 4, 11, P.wood)
  ellipse(images[4], x, 56 + y, 9, 2, P.dark)
  line(images[5], x, 25 + y, x, 47 + y, P.wood, 4)
  ellipse(images[5], x, 34 + y, 9, 12, P.brown)
  ellipse(images[5], x, 34 + y, 6, 8, P.wood)
  ellipse(images[5], x, 34 + y, 4, 5, P.red)
  ellipse(images[5], x, 34 + y, 2, 3, P.white)

  ellipse(images[6], x, 20 + y, 7, 7, P.wood)
  rect(images[6], x - 7, 16 + y, 14, 3, P.crimson)
  rect(images[7], x - 3, 19 + y, 2, 2, P.black)
  rect(images[7], x + 2, 19 + y, 2, 2, P.black)

  line(images[8], x - 7, 30 + y, x - 17, 35 + y, P.wood, 3)
  line(images[8], x + 7, 30 + y, x + 17, 35 + y, P.wood, 3)
  ellipse(images[8], x - 18, 35 + y, 3, 3, P.bone)
  ellipse(images[8], x + 18, 35 + y, 3, 3, P.bone)
end

local function drawMime(images, p)
  local x = 29 - p.recoil * 4
  local y = p.bob * 0.7 + p.collapse * 13
  drawShadow(images[1], 31, 57, 10, 90)
  ellipse(images[2], x, 33 + y, 13, 19, rgba("f2f2ff", 45))

  line(images[4], x - 3, 42 + y, x - 6 - p.stride * 3, 55 + y, P.black, 3)
  line(images[4], x + 3, 42 + y, x + 6 + p.stride * 3, 55 + y, P.black, 3)

  rect(images[5], x - 6, 28 + y, 12, 17, P.black)
  for yy = 30, 43, 4 do
    rect(images[5], x - 6, yy + y, 12, 2, P.white)
  end

  ellipse(images[6], x, 21 + y, 6, 8, P.white)
  rect(images[6], x - 7, 13 + y, 14, 4, P.black)
  rect(images[6], x - 4, 10 + y, 8, 5, P.black)
  rect(images[7], x - 4, 19 + y, 2, 3, P.black)
  rect(images[7], x + 2, 19 + y, 2, 3, P.black)
  line(images[7], x - 2, 25 + y, x + 2, 25 + y, P.black, 1)

  local spread = 10 + p.attack * 13
  line(images[8], x - 4, 30 + y, x - spread, 24 + y, P.white, 3)
  line(images[8], x + 4, 30 + y, x + spread, 24 + y, P.white, 3)
  ellipse(images[8], x - spread, 24 + y, 3, 4, P.white)
  ellipse(images[8], x + spread, 24 + y, 3, 4, P.white)

  if p.attack > 0.25 then
    rect(images[9], x + 18, 14 + y, 2, 29, rgba("65eaf3", 125))
    rect(images[9], x + 22, 17 + y, 1, 23, rgba("ee57c4", 110))
  end
end

local function render(archetype, tagName, index, count)
  local images = {}
  for i = 1, #LAYERS do
    images[i] = Image(W, H, ColorMode.RGB)
  end

  local p = poseFor(tagName, index, count)

  if archetype == "stagehand" then
    drawStagehand(images, p)
  elseif archetype == "card_thrower" then
    drawThrower(images, p)
  elseif archetype == "shadow_acrobat" then
    drawAcrobat(images, p)
  elseif archetype == "light_wraith" then
    drawWraith(images, p)
  elseif archetype == "card_sentry" then
    drawSentry(images, p)
  elseif archetype == "echo_duelist" then
    drawDuelist(images, p, false)
  elseif archetype == "echo_caster" then
    drawCaster(images, p, false)
  elseif archetype == "training_dummy" then
    drawDummy(images, p)
  elseif archetype == "core_duelist" then
    drawDuelist(images, p, true)
  elseif archetype == "core_caster" then
    drawCaster(images, p, true)
  elseif archetype == "core_mime" then
    drawMime(images, p)
  else
    error("Unknown archetype: " .. tostring(archetype))
  end

  return images
end

local sprite = Sprite(W, H, ColorMode.RGB)
sprite.filename = output
sprite.transparentColor = 0

local layers = {}
sprite.layers[1].name = LAYERS[1]
layers[1] = sprite.layers[1]

for i = 2, #LAYERS do
  local layer = sprite:newLayer()
  layer.name = LAYERS[i]
  layers[i] = layer
end

layers[#LAYERS].isVisible = false

local totalFrames = 0
for _, tag in ipairs(TAGS) do
  totalFrames = totalFrames + tag.count
end

for index = 2, totalFrames do
  sprite:newEmptyFrame()
end

local globalFrame = 1

for _, definition in ipairs(TAGS) do
  local fromFrame = globalFrame

  for localFrame = 1, definition.count do
    local frame = sprite.frames[globalFrame]
    frame.duration = definition.duration / 1000

    local images = render(
      definition.archetype,
      definition.name,
      localFrame,
      definition.count
    )

    for layerIndex = 1, #layers do
      sprite:newCel(
        layers[layerIndex],
        frame,
        images[layerIndex],
        Point(0, 0)
      )
    end

    globalFrame = globalFrame + 1
  end

  local toFrame = globalFrame - 1
  local tag = sprite:newTag(
    sprite.frames[fromFrame],
    sprite.frames[toFrame]
  )

  tag.name = definition.name
  tag.aniDir = AniDir.FORWARD

  local hex = definition.color
  tag.color = Color {
    r = tonumber(hex:sub(1, 2), 16),
    g = tonumber(hex:sub(3, 4), 16),
    b = tonumber(hex:sub(5, 6), 16),
    a = 255
  }

  pcall(function()
    tag.repeats = definition.loop and 0 or 1
  end)
end

sprite:saveAs(output)
sprite:close()

print(
  string.format(
    "Generated %s: %d frames, %d tags, %dx%d",
    output,
    totalFrames,
    #TAGS,
    W,
    H
  )
)
