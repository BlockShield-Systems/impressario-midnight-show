local output = app.params["output"]

if output == nil or output == "" then
  error("Missing --script-param output=<path>")
end

local W, H = 128, 128
local TAU = math.pi * 2

local TAGS = {
  {name="boss_dormant", count=6, duration=140, loop=true, form="dormant", color="596b8f"},
  {name="boss_entrance", count=10, duration=90, loop=false, form="entrance", color="e4bd58"},
  {name="boss_phase1_idle", count=8, duration=110, loop=true, form="phase1", color="65eaf3"},
  {name="boss_phase1_telegraph", count=7, duration=75, loop=false, form="phase1", color="65eaf3"},
  {name="boss_phase1_cast", count=8, duration=65, loop=false, form="phase1", color="65eaf3"},
  {name="boss_phase1_counter", count=6, duration=70, loop=false, form="phase1", color="65eaf3"},
  {name="boss_transition_1_2", count=12, duration=85, loop=false, form="transition12", color="a56ae8"},
  {name="boss_phase2_idle", count=8, duration=105, loop=true, form="phase2", color="a56ae8"},
  {name="boss_phase2_telegraph", count=8, duration=70, loop=false, form="phase2", color="a56ae8"},
  {name="boss_phase2_cast", count=9, duration=62, loop=false, form="phase2", color="a56ae8"},
  {name="boss_phase2_counter", count=6, duration=68, loop=false, form="phase2", color="a56ae8"},
  {name="boss_transition_2_3", count=14, duration=78, loop=false, form="transition23", color="ed5ac8"},
  {name="boss_phase3_idle", count=8, duration=95, loop=true, form="phase3", color="ed5ac8"},
  {name="boss_phase3_telegraph", count=9, duration=65, loop=false, form="phase3", color="ed5ac8"},
  {name="boss_phase3_cast", count=10, duration=58, loop=false, form="phase3", color="ed5ac8"},
  {name="boss_phase3_counter", count=7, duration=62, loop=false, form="phase3", color="ed5ac8"},
  {name="boss_hurt_phase1", count=4, duration=70, loop=false, form="phase1", color="65eaf3"},
  {name="boss_hurt_phase2", count=4, duration=68, loop=false, form="phase2", color="a56ae8"},
  {name="boss_hurt_phase3", count=5, duration=62, loop=false, form="phase3", color="ed5ac8"},
  {name="boss_defeat", count=10, duration=105, loop=false, form="defeat", color="f2d783"},
  {name="boss_fireworks", count=12, duration=85, loop=false, form="fireworks", color="f7e184"},
}

local LAYERS = {
  "01_shadow",
  "02_fx_back",
  "03_cape",
  "04_legs",
  "05_torso",
  "06_back_arms",
  "07_head",
  "08_face",
  "09_baton",
  "10_mirror_arms",
  "11_fx_front",
  "12_guides"
}

local function color(hex, alpha)
  hex = hex:gsub("#", "")

  return app.pixelColor.rgba(
    tonumber(hex:sub(1, 2), 16),
    tonumber(hex:sub(3, 4), 16),
    tonumber(hex:sub(5, 6), 16),
    alpha or 255
  )
end

local C = {
  void = color("090713"),
  ink = color("171221"),
  dark = color("272139"),
  coat = color("36314d"),
  silver = color("b7c6dc"),
  white = color("f3f4ee"),
  gold = color("e4bd58"),
  cyan = color("65eaf3"),
  blue = color("438fbd"),
  violet = color("9c62da"),
  pink = color("ed5ac8"),
  red = color("b62c5c"),
  shadow = color("090713", 115),
  cyanGlow = color("65eaf3", 95),
  violetGlow = color("9c62da", 95),
  pinkGlow = color("ed5ac8", 105),
  whiteGlow = color("f3f4ee", 75)
}

local function pixel(img, x, y, value)
  x = math.floor(x + 0.5)
  y = math.floor(y + 0.5)

  if x >= 0 and y >= 0 and x < W and y < H then
    img:drawPixel(x, y, value)
  end
end

local function rect(img, x, y, width, height, value)
  for yy = math.floor(y), math.floor(y + height - 1) do
    for xx = math.floor(x), math.floor(x + width - 1) do
      pixel(img, xx, yy, value)
    end
  end
end

local function line(img, x0, y0, x1, y1, value, width)
  x0 = math.floor(x0 + 0.5)
  y0 = math.floor(y0 + 0.5)
  x1 = math.floor(x1 + 0.5)
  y1 = math.floor(y1 + 0.5)

  local dx = math.abs(x1 - x0)
  local sx = x0 < x1 and 1 or -1
  local dy = -math.abs(y1 - y0)
  local sy = y0 < y1 and 1 or -1
  local err = dx + dy
  local radius = math.max(
    0,
    math.floor((width or 1) / 2)
  )

  while true do
    for oy = -radius, radius do
      for ox = -radius, radius do
        pixel(img, x0 + ox, y0 + oy, value)
      end
    end

    if x0 == x1 and y0 == y1 then
      break
    end

    local e2 = 2 * err

    if e2 >= dy then
      err = err + dy
      x0 = x0 + sx
    end

    if e2 <= dx then
      err = err + dx
      y0 = y0 + sy
    end
  end
end

local function ellipse(img, cx, cy, rx, ry, value)
  for y = math.floor(cy - ry), math.ceil(cy + ry) do
    for x = math.floor(cx - rx), math.ceil(cx + rx) do
      local nx = (x - cx) / math.max(rx, 0.001)
      local ny = (y - cy) / math.max(ry, 0.001)

      if nx * nx + ny * ny <= 1 then
        pixel(img, x, y, value)
      end
    end
  end
end

local function triangle(
  img,
  x1, y1,
  x2, y2,
  x3, y3,
  value
)
  local minX = math.floor(math.min(x1, x2, x3))
  local maxX = math.ceil(math.max(x1, x2, x3))
  local minY = math.floor(math.min(y1, y2, y3))
  local maxY = math.ceil(math.max(y1, y2, y3))

  local function edge(ax, ay, bx, by, px, py)
    return
      (px - ax) * (by - ay) -
      (py - ay) * (bx - ax)
  end

  for y = minY, maxY do
    for x = minX, maxX do
      local a = edge(x1, y1, x2, y2, x, y)
      local b = edge(x2, y2, x3, y3, x, y)
      local c = edge(x3, y3, x1, y1, x, y)

      if
        (a >= 0 and b >= 0 and c >= 0) or
        (a <= 0 and b <= 0 and c <= 0)
      then
        pixel(img, x, y, value)
      end
    end
  end
end

local function contains(value, token)
  return string.find(value, token, 1, true) ~= nil
end

local function phaseOf(tag)
  if contains(tag, "phase3") or
     contains(tag, "transition_2_3") then
    return 3
  end

  if contains(tag, "phase2") or
     contains(tag, "transition_1_2") then
    return 2
  end

  return 1
end

local function pose(tag, index, count)
  local progress =
    count <= 1 and 0 or
    (index - 1) / (count - 1)

  local cycle = (index - 1) / count
  local phase = phaseOf(tag)

  local result = {
    progress = progress,
    cycle = cycle,
    phase = phase,
    bob = math.sin(cycle * TAU) * 1.5,
    sway = math.sin(cycle * TAU) * 2,
    cast = 0,
    recoil = 0,
    transition = 0,
    collapse = 0,
    explosion = 0
  }

  if contains(tag, "entrance") then
    result.bob = -14 * (1 - progress)
    result.transition = progress
  end

  if contains(tag, "telegraph") then
    result.cast = progress * 0.55
  end

  if contains(tag, "_cast") then
    result.cast = math.sin(progress * math.pi)
  end

  if contains(tag, "counter") then
    result.cast =
      math.sin(progress * math.pi) * 1.25
  end

  if contains(tag, "hurt") then
    result.recoil =
      math.sin(progress * math.pi)
  end

  if contains(tag, "transition") then
    result.transition =
      math.sin(progress * math.pi)
  end

  if contains(tag, "defeat") then
    result.collapse = progress
    result.recoil =
      math.sin(progress * math.pi) * 0.8
  end

  if contains(tag, "fireworks") then
    result.phase = 3
    result.collapse = 1
    result.explosion = progress
    result.bob = 0
    result.sway = 0
    result.cast = 0
    result.recoil = 0
  end

  return result
end

local function drawShadow(images, p)
  local width =
    22 +
    p.phase * 3 -
    p.collapse * 8

  ellipse(
    images[1],
    64,
    114,
    width,
    5,
    C.shadow
  )
end

local function drawAura(images, p)
  local glow =
    p.phase == 1 and C.cyanGlow or
    p.phase == 2 and C.violetGlow or
    C.pinkGlow

  local radius =
    27 +
    p.phase * 4 +
    p.cast * 6 +
    math.sin(p.cycle * TAU) * 2

  ellipse(
    images[2],
    64,
    69 + p.bob,
    radius,
    radius + 8,
    glow
  )

  local shardCount =
    p.phase == 1 and 3 or
    p.phase == 2 and 6 or 9

  for index = 1, shardCount do
    local angle =
      p.cycle * TAU +
      index * TAU / shardCount

    local distance =
      35 +
      p.phase * 5 +
      p.cast * 8

    local x =
      64 + math.cos(angle) * distance

    local y =
      66 + p.bob +
      math.sin(angle) * distance * 0.72

    triangle(
      images[2],
      x, y - 5,
      x - 3, y + 4,
      x + 3, y + 2,
      p.phase == 3 and C.pink or C.cyan
    )
  end
end

local function drawCape(images, p, x, y)
  local capeColor =
    p.phase == 1 and C.coat or
    p.phase == 2 and C.violet or
    C.red

  triangle(
    images[3],
    x - 13,
    y + 35,
    x - 23 - p.sway,
    y + 82,
    x + 1,
    y + 73,
    capeColor
  )

  triangle(
    images[3],
    x + 12,
    y + 35,
    x + 24 + p.sway,
    y + 82,
    x - 1,
    y + 73,
    capeColor
  )

  if p.phase >= 2 then
    line(
      images[3],
      x - 15,
      y + 44,
      x - 27,
      y + 66,
      C.pink,
      2
    )

    line(
      images[3],
      x + 15,
      y + 44,
      x + 27,
      y + 66,
      C.cyan,
      2
    )
  end
end

local function drawLegs(images, p, x, y)
  local spread =
    6 + p.recoil * 3

  line(
    images[4],
    x - 5,
    y + 69,
    x - spread,
    y + 92 - p.collapse * 15,
    C.ink,
    5
  )

  line(
    images[4],
    x + 5,
    y + 69,
    x + spread,
    y + 92 - p.collapse * 15,
    C.ink,
    5
  )

  rect(
    images[4],
    x - spread - 5,
    y + 90 - p.collapse * 15,
    10,
    4,
    C.void
  )

  rect(
    images[4],
    x + spread - 4,
    y + 90 - p.collapse * 15,
    10,
    4,
    C.void
  )
end

local function drawTorso(images, p, x, y)
  local bodyColor =
    p.phase == 1 and C.dark or
    p.phase == 2 and C.coat or
    C.ink

  ellipse(
    images[5],
    x,
    y + 51,
    14 + p.phase,
    23 - p.collapse * 5,
    bodyColor
  )

  triangle(
    images[5],
    x - 13,
    y + 37,
    x,
    y + 47,
    x + 13,
    y + 37,
    p.phase == 3 and C.pink or C.gold
  )

  line(
    images[5],
    x,
    y + 45,
    x,
    y + 69,
    p.phase == 1 and C.cyan or C.pink,
    3
  )

  ellipse(
    images[5],
    x,
    y + 55,
    4 + p.phase,
    5 + p.phase,
    p.phase == 1 and C.cyan or
    p.phase == 2 and C.violet or
    C.pink
  )
end

local function drawArms(images, p, x, y)
  local reach =
    15 + p.cast * 21

  local lift =
    p.cast * 14

  line(
    images[6],
    x - 10,
    y + 43,
    x - reach,
    y + 53 - lift,
    C.dark,
    5
  )

  line(
    images[6],
    x + 10,
    y + 43,
    x + reach,
    y + 52 - lift,
    C.dark,
    5
  )

  ellipse(
    images[6],
    x - reach,
    y + 53 - lift,
    3,
    3,
    C.white
  )

  ellipse(
    images[6],
    x + reach,
    y + 52 - lift,
    3,
    3,
    C.white
  )
end

local function drawHead(images, p, x, y)
  ellipse(
    images[7],
    x,
    y + 25,
    10,
    12 - p.collapse * 2,
    C.white
  )

  local crownColor =
    p.phase == 1 and C.gold or
    p.phase == 2 and C.cyan or
    C.pink

  triangle(
    images[7],
    x - 11,
    y + 17,
    x - 6,
    y + 2 - p.phase * 2,
    x,
    y + 16,
    crownColor
  )

  triangle(
    images[7],
    x - 3,
    y + 15,
    x + 1,
    y - 2 - p.phase * 2,
    x + 5,
    y + 16,
    crownColor
  )

  triangle(
    images[7],
    x + 3,
    y + 16,
    x + 9,
    y + 4,
    x + 12,
    y + 19,
    crownColor
  )

  if p.phase == 3 then
    line(
      images[7],
      x + 8,
      y + 10,
      x + 18,
      y + 1,
      C.pink,
      3
    )
  end
end

local function drawFace(images, p, x, y)
  rect(
    images[8],
    x - 6,
    y + 22,
    12,
    3,
    C.ink
  )

  pixel(
    images[8],
    x - 3,
    y + 23,
    p.phase == 3 and C.pink or C.cyan
  )

  pixel(
    images[8],
    x + 3,
    y + 23,
    p.phase == 3 and C.pink or C.cyan
  )

  line(
    images[8],
    x - 3,
    y + 30,
    x + 3,
    y + 30,
    C.ink,
    1
  )
end

local function drawBaton(images, p, x, y)
  local handX =
    x + 15 + p.cast * 15

  local handY =
    y + 49 - p.cast * 15

  local tipX =
    handX + 22 + p.cast * 12

  local tipY =
    handY - 19 - p.cast * 8

  line(
    images[9],
    handX,
    handY,
    tipX,
    tipY,
    C.gold,
    3
  )

  ellipse(
    images[9],
    tipX,
    tipY,
    4 + p.cast * 2,
    4 + p.cast * 2,
    p.phase == 3 and C.pink or C.cyan
  )

  if p.collapse > 0.45 then
    line(
      images[9],
      tipX + 2,
      tipY + 2,
      tipX + 12,
      tipY + 14,
      C.gold,
      2
    )
  end
end

local function drawMirrorArms(images, p, x, y)
  if p.phase < 2 and p.transition < 0.4 then
    return
  end

  local count =
    p.phase == 2 and 2 or 4

  for index = 1, count do
    local side =
      index % 2 == 0 and 1 or -1

    local row =
      math.floor((index - 1) / 2)

    local shoulderX =
      x + side * (13 + row * 4)

    local shoulderY =
      y + 41 + row * 9

    local handX =
      x + side *
      (31 + row * 8 + p.cast * 10)

    local handY =
      y + 31 +
      row * 17 -
      p.cast * 8

    line(
      images[10],
      shoulderX,
      shoulderY,
      handX,
      handY,
      p.phase == 3 and C.pink or C.silver,
      3
    )

    triangle(
      images[10],
      handX,
      handY - 5,
      handX - side * 4,
      handY + 5,
      handX + side * 5,
      handY + 3,
      p.phase == 3 and C.pink or C.cyan
    )
  end
end

local function drawFrontFx(images, p, x, y)
  if p.cast <= 0.05 and p.transition <= 0.05 then
    return
  end

  local fxColor =
    p.phase == 1 and C.cyan or
    p.phase == 2 and C.violet or
    C.pink

  local radius =
    17 +
    p.cast * 19 +
    p.transition * 11

  for index = 1, 12 do
    local angle =
      index * TAU / 12 +
      p.cycle * TAU

    pixel(
      images[11],
      x + math.cos(angle) * radius,
      y + 50 +
      math.sin(angle) * radius,
      fxColor
    )
  end

  if p.phase == 3 and p.cast > 0.35 then
    line(
      images[11],
      x - 43,
      y + 50,
      x + 43,
      y + 50,
      C.pink,
      2
    )

    line(
      images[11],
      x,
      y + 8,
      x,
      y + 91,
      C.cyan,
      2
    )
  end
end

local function clamp(value, minimum, maximum)
  return math.max(
    minimum,
    math.min(maximum, value)
  )
end

local function drawFireworkBurst(
  img,
  centerX,
  centerY,
  progress,
  delay,
  maximumRadius,
  primary,
  secondary
)
  if progress <= delay then
    return
  end

  local localProgress =
    clamp(
      (progress - delay) /
      math.max(0.001, 1 - delay),
      0,
      1
    )

  if localProgress >= 0.98 then
    return
  end

  local radius =
    3 +
    maximumRadius *
    math.sin(localProgress * math.pi * 0.72)

  local rayCount = 16

  for ray = 1, rayCount do
    local angle =
      ray * TAU / rayCount +
      delay * 4

    local innerRadius =
      math.max(0, radius - 5)

    local outerRadius =
      radius +
      (ray % 3)

    local innerX =
      centerX +
      math.cos(angle) * innerRadius

    local innerY =
      centerY +
      math.sin(angle) * innerRadius

    local outerX =
      centerX +
      math.cos(angle) * outerRadius

    local outerY =
      centerY +
      math.sin(angle) * outerRadius

    line(
      img,
      innerX,
      innerY,
      outerX,
      outerY,
      ray % 2 == 0
        and primary
        or secondary,
      localProgress < 0.55 and 2 or 1
    )

    if ray % 4 == 0 then
      pixel(
        img,
        outerX + math.cos(angle) * 3,
        outerY + math.sin(angle) * 3,
        C.white
      )
    end
  end
end

local function drawBossExplosion(images, p)
  if p.explosion <= 0 then
    return
  end

  local progress = p.explosion
  local front = images[11]
  local back = images[2]

  if progress < 0.28 then
    local flashProgress =
      progress / 0.28

    ellipse(
      front,
      64,
      68,
      4 + flashProgress * 26,
      5 + flashProgress * 29,
      flashProgress < 0.55
        and C.white
        or C.gold
    )

    ellipse(
      back,
      64,
      68,
      13 + flashProgress * 32,
      15 + flashProgress * 34,
      C.pinkGlow
    )
  end

  local fragmentProgress =
    clamp(progress / 0.72, 0, 1)

  for fragment = 1, 18 do
    local angle =
      fragment * TAU / 18 +
      fragment * 0.17

    local speed =
      13 +
      (fragment % 5) * 5

    local distance =
      fragmentProgress * speed

    local x =
      64 +
      math.cos(angle) * distance

    local y =
      69 +
      math.sin(angle) * distance -
      fragmentProgress * 7

    local fragmentColor =
      fragment % 3 == 0 and C.gold or
      fragment % 3 == 1 and C.cyan or
      C.pink

    triangle(
      front,
      x,
      y - 4,
      x - 3,
      y + 3,
      x + 3,
      y + 2,
      fragmentColor
    )
  end

  drawFireworkBurst(
    front,
    64,
    55,
    progress,
    0.16,
    32,
    C.gold,
    C.pink
  )

  drawFireworkBurst(
    front,
    38,
    39,
    progress,
    0.30,
    24,
    C.cyan,
    C.white
  )

  drawFireworkBurst(
    front,
    92,
    35,
    progress,
    0.40,
    25,
    C.pink,
    C.gold
  )

  drawFireworkBurst(
    front,
    64,
    24,
    progress,
    0.53,
    27,
    C.white,
    C.cyan
  )

  drawFireworkBurst(
    back,
    28,
    68,
    progress,
    0.58,
    19,
    C.violet,
    C.gold
  )

  drawFireworkBurst(
    back,
    102,
    66,
    progress,
    0.64,
    19,
    C.cyan,
    C.pink
  )
end

local function render(tag, index, count)
  local images = {}

  for layerIndex = 1, #LAYERS do
    images[layerIndex] =
      Image(W, H, ColorMode.RGB)
  end

  local p = pose(tag, index, count)

  local x =
    64 -
    p.recoil * 7 +
    p.collapse * 8

  local y =
    18 +
    p.bob +
    p.collapse * 24

  drawShadow(images, p)

  if p.explosion <= 0 then
    drawAura(images, p)
    drawCape(images, p, x, y)
    drawLegs(images, p, x, y)
    drawTorso(images, p, x, y)
    drawArms(images, p, x, y)
    drawHead(images, p, x, y)
    drawFace(images, p, x, y)
    drawBaton(images, p, x, y)
    drawMirrorArms(images, p, x, y)
    drawFrontFx(images, p, x, y)
  elseif p.explosion < 0.18 then
    drawAura(images, p)
    drawCape(images, p, x, y)
    drawTorso(images, p, x, y)
    drawHead(images, p, x, y)
  end

  drawBossExplosion(images, p)

  return images
end

local sprite = Sprite(W, H, ColorMode.RGB)
sprite.filename = output
sprite.transparentColor = 0

local layers = {}
sprite.layers[1].name = LAYERS[1]
layers[1] = sprite.layers[1]

for index = 2, #LAYERS do
  local layer = sprite:newLayer()
  layer.name = LAYERS[index]
  layers[index] = layer
end

layers[#LAYERS].isVisible = false

local totalFrames = 0

for _, definition in ipairs(TAGS) do
  totalFrames =
    totalFrames + definition.count
end

for index = 2, totalFrames do
  sprite:newEmptyFrame()
end

local globalFrame = 1

for _, definition in ipairs(TAGS) do
  local firstFrame = globalFrame

  for localFrame = 1, definition.count do
    local frame =
      sprite.frames[globalFrame]

    frame.duration =
      definition.duration / 1000

    local images = render(
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

  local tag = sprite:newTag(
    sprite.frames[firstFrame],
    sprite.frames[globalFrame - 1]
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
    tag.repeats =
      definition.loop and 0 or 1
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
