-- Impressario procedural Aseprite source generator
-- Requires Aseprite scripting API v1.2.10+.
--
-- Generates:
--   * 128x128 RGB/RGBA sprite
--   * 14 editable layers
--   * fixed production palette
--   * 32 frames
--   * movement tags
--   * first cane attack reference animation

local output = app.params["output"]

if output == nil or output == "" then
  error(
    "Missing parameter: " ..
    "--script-param output=<target.aseprite>"
  )
end

local WIDTH = 128
local HEIGHT = 128
local ORIGIN_X = 64
local ORIGIN_Y = 98

local function rgba(hex, alpha)
  hex = hex:gsub("#", "")

  if #hex ~= 6 then
    error("Invalid RGB hex color: " .. hex)
  end

  local r = tonumber(hex:sub(1, 2), 16)
  local g = tonumber(hex:sub(3, 4), 16)
  local b = tonumber(hex:sub(5, 6), 16)

  return app.pixelColor.rgba(
    r,
    g,
    b,
    alpha or 255
  )
end

local COLORS = {
  transparent = rgba("#000000", 0),

  coat = rgba("#8E1638"),
  coatLight = rgba("#B72A50"),
  coatShadow = rgba("#541025"),
  coatDeepShadow = rgba("#3A0A1A"),

  shirt = rgba("#F4EADB"),
  shirtShadow = rgba("#CDBEAE"),

  skin = rgba("#DCA27F"),
  skinLight = rgba("#F1C09B"),
  skinShadow = rgba("#A96858"),

  hair = rgba("#1A1114"),
  moustache = rgba("#27171A"),

  hat = rgba("#120D12"),
  hatLight = rgba("#35252F"),

  gold = rgba("#D8AA46"),
  goldLight = rgba("#F5D477"),
  goldShadow = rgba("#8B5D20"),

  legs = rgba("#21151A"),
  shoeLight = rgba("#5A4450"),

  eye = rgba("#110A0D"),
  eyeLight = rgba("#F8E1C4"),

  guide = rgba("#00FFFF", 170),
  hitboxGuide = rgba("#FF3B7F", 150),

  attackFx = rgba("#F5D477", 170)
}

local PALETTE = {
  { name = "Transparent", hex = "#000000", alpha = 0 },
  { name = "Coat", hex = "#8E1638" },
  { name = "Coat Light", hex = "#B72A50" },
  { name = "Coat Shadow", hex = "#541025" },
  { name = "Coat Deep Shadow", hex = "#3A0A1A" },
  { name = "Shirt", hex = "#F4EADB" },
  { name = "Shirt Shadow", hex = "#CDBEAE" },
  { name = "Skin", hex = "#DCA27F" },
  { name = "Skin Light", hex = "#F1C09B" },
  { name = "Skin Shadow", hex = "#A96858" },
  { name = "Hair", hex = "#1A1114" },
  { name = "Moustache", hex = "#27171A" },
  { name = "Hat", hex = "#120D12" },
  { name = "Hat Light", hex = "#35252F" },
  { name = "Gold", hex = "#D8AA46" },
  { name = "Gold Light", hex = "#F5D477" },
  { name = "Gold Shadow", hex = "#8B5D20" },
  { name = "Legs", hex = "#21151A" },
  { name = "Shoe Light", hex = "#5A4450" },
  { name = "Eye", hex = "#110A0D" },
  { name = "Eye Light", hex = "#F8E1C4" },
  { name = "Guide", hex = "#00FFFF" },
  { name = "Hitbox Guide", hex = "#FF3B7F" },
  { name = "Attack FX", hex = "#F5D477", alpha = 170 }
}

local LAYER_NAMES_BOTTOM_TO_TOP = {
  "01_fx_back",
  "02_coat_tails",
  "03_back_arm",
  "04_back_leg",
  "05_torso_coat",
  "06_shirt_vest",
  "07_front_leg",
  "08_front_arm",
  "09_head",
  "10_hair_moustache",
  "11_hat",
  "12_cane",
  "13_fx_front",
  "14_guides"
}

local FRAME_SPECS = {
  -- idle 1-8
  { kind = "idle", phase = 1, duration = 0.125 },
  { kind = "idle", phase = 2, duration = 0.125 },
  { kind = "idle", phase = 3, duration = 0.125 },
  { kind = "idle", phase = 4, duration = 0.125 },
  { kind = "idle", phase = 5, duration = 0.125 },
  { kind = "idle", phase = 6, duration = 0.125 },
  { kind = "idle", phase = 7, duration = 0.125 },
  { kind = "idle", phase = 8, duration = 0.125 },

  -- run 9-18
  { kind = "run", phase = 1, duration = 0.070 },
  { kind = "run", phase = 2, duration = 0.070 },
  { kind = "run", phase = 3, duration = 0.070 },
  { kind = "run", phase = 4, duration = 0.070 },
  { kind = "run", phase = 5, duration = 0.070 },
  { kind = "run", phase = 6, duration = 0.070 },
  { kind = "run", phase = 7, duration = 0.070 },
  { kind = "run", phase = 8, duration = 0.070 },
  { kind = "run", phase = 9, duration = 0.070 },
  { kind = "run", phase = 10, duration = 0.070 },

  -- jump_start 19-21
  { kind = "jump_start", phase = 1, duration = 0.060 },
  { kind = "jump_start", phase = 2, duration = 0.060 },
  { kind = "jump_start", phase = 3, duration = 0.060 },

  -- rise 22-24
  { kind = "rise", phase = 1, duration = 0.100 },
  { kind = "rise", phase = 2, duration = 0.100 },
  { kind = "rise", phase = 3, duration = 0.100 },

  -- fall 25-27
  { kind = "fall", phase = 1, duration = 0.110 },
  { kind = "fall", phase = 2, duration = 0.110 },
  { kind = "fall", phase = 3, duration = 0.110 },

  -- attack_combo_1 28-32
  { kind = "attack_combo_1", phase = 1, duration = 0.070 },
  { kind = "attack_combo_1", phase = 2, duration = 0.040 },
  { kind = "attack_combo_1", phase = 3, duration = 0.040 },
  { kind = "attack_combo_1", phase = 4, duration = 0.075 },
  { kind = "attack_combo_1", phase = 5, duration = 0.075 }
}

local function newImage(sprite)
  local image = Image(
    WIDTH,
    HEIGHT,
    ColorMode.RGB
  )

  image:clear()

  return image
end

local function setPixel(image, x, y, color)
  x = math.floor(x + 0.5)
  y = math.floor(y + 0.5)

  if
    x >= 0 and
    x < WIDTH and
    y >= 0 and
    y < HEIGHT
  then
    image:drawPixel(x, y, color)
  end
end

local function fillRect(
  image,
  x,
  y,
  width,
  height,
  color
)
  x = math.floor(x + 0.5)
  y = math.floor(y + 0.5)
  width = math.floor(width + 0.5)
  height = math.floor(height + 0.5)

  for py = y, y + height - 1 do
    for px = x, x + width - 1 do
      setPixel(image, px, py, color)
    end
  end
end

local function line(
  image,
  x0,
  y0,
  x1,
  y1,
  color
)
  x0 = math.floor(x0 + 0.5)
  y0 = math.floor(y0 + 0.5)
  x1 = math.floor(x1 + 0.5)
  y1 = math.floor(y1 + 0.5)

  local dx = math.abs(x1 - x0)
  local sx = x0 < x1 and 1 or -1
  local dy = -math.abs(y1 - y0)
  local sy = y0 < y1 and 1 or -1
  local err = dx + dy

  while true do
    setPixel(image, x0, y0, color)

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

local function thickLine(
  image,
  x0,
  y0,
  x1,
  y1,
  width,
  color
)
  local radius =
    math.max(0, math.floor(width / 2))

  for offset = -radius, radius do
    line(
      image,
      x0 + offset,
      y0,
      x1 + offset,
      y1,
      color
    )

    if offset ~= 0 then
      line(
        image,
        x0,
        y0 + offset,
        x1,
        y1 + offset,
        color
      )
    end
  end
end

local function fillEllipse(
  image,
  cx,
  cy,
  rx,
  ry,
  color
)
  for y = -ry, ry do
    for x = -rx, rx do
      local normalized =
        (x * x) / (rx * rx) +
        (y * y) / (ry * ry)

      if normalized <= 1 then
        setPixel(
          image,
          cx + x,
          cy + y,
          color
        )
      end
    end
  end
end

local function fillPolygon(
  image,
  points,
  color
)
  local minY = HEIGHT - 1
  local maxY = 0

  for _, point in ipairs(points) do
    minY = math.min(minY, point.y)
    maxY = math.max(maxY, point.y)
  end

  minY = math.floor(minY)
  maxY = math.ceil(maxY)

  for y = minY, maxY do
    local intersections = {}

    local previous =
      points[#points]

    for _, current in ipairs(points) do
      if
        (current.y > y) ~=
        (previous.y > y)
      then
        local x =
          previous.x +
          (y - previous.y) *
          (current.x - previous.x) /
          (current.y - previous.y)

        table.insert(intersections, x)
      end

      previous = current
    end

    table.sort(intersections)

    local index = 1

    while index < #intersections do
      local fromX =
        math.ceil(intersections[index])

      local toX =
        math.floor(intersections[index + 1])

      for x = fromX, toX do
        setPixel(image, x, y, color)
      end

      index = index + 2
    end
  end
end

local function createPose(spec)
  local pose = {
    bob = 0,
    lean = 0,

    backFootX = 68,
    backFootY = ORIGIN_Y,
    frontFootX = 60,
    frontFootY = ORIGIN_Y,

    backKneeX = 67,
    backKneeY = 89,
    frontKneeX = 61,
    frontKneeY = 89,

    backHandX = 57,
    backHandY = 82,
    frontHandX = 72,
    frontHandY = 79,

    caneTipX = 79,
    caneTipY = 98,
    caneHookX = 75,
    caneHookY = 75,

    tailsSwing = 0,
    hatTilt = 0,
    attackFx = false
  }

  if spec.kind == "idle" then
    local bobValues = {
      0, -1, -1, -2,
      -1, 0, 1, 0
    }

    pose.bob =
      bobValues[spec.phase]

    if spec.phase == 3 or
       spec.phase == 4
    then
      pose.frontHandX = 73
      pose.caneTipX = 80
    end
  elseif spec.kind == "run" then
    local run = {
      {
        frontFootX = 54,
        backFootX = 70,
        frontKneeX = 58,
        backKneeX = 66,
        bob = 0
      },
      {
        frontFootX = 55,
        backFootX = 68,
        frontKneeX = 58,
        backKneeX = 65,
        bob = 1
      },
      {
        frontFootX = 60,
        backFootX = 65,
        frontKneeX = 60,
        backKneeX = 63,
        bob = -1
      },
      {
        frontFootX = 66,
        backFootX = 59,
        frontKneeX = 63,
        backKneeX = 61,
        bob = -2
      },
      {
        frontFootX = 70,
        backFootX = 55,
        frontKneeX = 66,
        backKneeX = 59,
        bob = -1
      },
      {
        frontFootX = 70,
        backFootX = 54,
        frontKneeX = 66,
        backKneeX = 58,
        bob = 0
      },
      {
        frontFootX = 68,
        backFootX = 55,
        frontKneeX = 65,
        backKneeX = 58,
        bob = 1
      },
      {
        frontFootX = 65,
        backFootX = 60,
        frontKneeX = 63,
        backKneeX = 60,
        bob = -1
      },
      {
        frontFootX = 59,
        backFootX = 66,
        frontKneeX = 61,
        backKneeX = 63,
        bob = -2
      },
      {
        frontFootX = 55,
        backFootX = 70,
        frontKneeX = 59,
        backKneeX = 66,
        bob = -1
      }
    }

    local current = run[spec.phase]

    for key, value in pairs(current) do
      pose[key] = value
    end

    pose.frontHandX =
      71 + ((spec.phase <= 5) and -2 or 2)

    pose.backHandX =
      57 + ((spec.phase <= 5) and 2 or -2)

    pose.caneTipX =
      pose.frontHandX + 7

    pose.caneTipY = 97
    pose.tailsSwing =
      (spec.phase <= 5) and -2 or 2
  elseif spec.kind == "jump_start" then
    if spec.phase == 1 then
      pose.bob = 1
    elseif spec.phase == 2 then
      pose.bob = 3
      pose.frontKneeY = 92
      pose.backKneeY = 92
    else
      pose.bob = -2
      pose.frontFootY = 96
      pose.backFootY = 96
      pose.tailsSwing = -1
    end
  elseif spec.kind == "rise" then
    pose.bob = -1

    if spec.phase == 1 then
      pose.frontFootX = 59
      pose.backFootX = 67
    elseif spec.phase == 2 then
      pose.frontFootX = 61
      pose.backFootX = 66
      pose.frontFootY = 96
    else
      pose.frontFootX = 62
      pose.backFootX = 65
      pose.backFootY = 96
    end

    pose.frontKneeY = 88
    pose.backKneeY = 88
    pose.tailsSwing = -2
  elseif spec.kind == "fall" then
    pose.frontFootX = 57
    pose.backFootX = 70
    pose.frontKneeY = 88
    pose.backKneeY = 88
    pose.frontHandY = 77
    pose.caneTipY = 94
    pose.tailsSwing = 2

    if spec.phase == 2 then
      pose.bob = 1
    end
  elseif spec.kind ==
         "attack_combo_1"
  then
    if spec.phase == 1 then
      pose.lean = -1
      pose.frontHandX = 67
      pose.frontHandY = 77
      pose.caneHookX = 65
      pose.caneHookY = 74
      pose.caneTipX = 58
      pose.caneTipY = 88
      pose.tailsSwing = -2
    elseif spec.phase == 2 then
      pose.lean = 1
      pose.frontHandX = 76
      pose.frontHandY = 76
      pose.caneHookX = 78
      pose.caneHookY = 75
      pose.caneTipX = 91
      pose.caneTipY = 77
      pose.tailsSwing = 1
    elseif spec.phase == 3 then
      pose.lean = 3
      pose.frontHandX = 80
      pose.frontHandY = 75
      pose.caneHookX = 84
      pose.caneHookY = 74
      pose.caneTipX = 106
      pose.caneTipY = 75
      pose.frontFootX = 65
      pose.backFootX = 57
      pose.tailsSwing = 4
      pose.attackFx = true
    elseif spec.phase == 4 then
      pose.lean = 2
      pose.frontHandX = 76
      pose.frontHandY = 77
      pose.caneHookX = 80
      pose.caneHookY = 76
      pose.caneTipX = 94
      pose.caneTipY = 82
      pose.frontFootX = 64
      pose.tailsSwing = 3
    else
      pose.lean = 0
      pose.frontHandX = 72
      pose.frontHandY = 79
      pose.caneHookX = 75
      pose.caneHookY = 75
      pose.caneTipX = 79
      pose.caneTipY = 98
      pose.tailsSwing = 1
    end
  end

  return pose
end

local function addCel(
  sprite,
  layer,
  frameNumber,
  image
)
  if image:isEmpty() then
    return
  end

  sprite:newCel(
    layer,
    frameNumber,
    image,
    Point(0, 0)
  )
end

local function drawFrame(
  sprite,
  layers,
  frameNumber,
  spec
)
  local pose = createPose(spec)

  local bob = pose.bob
  local lean = pose.lean

  local hipX = 64 + lean
  local hipY = 85 + bob

  local shoulderX = 64 + lean
  local shoulderY = 72 + bob

  -- 01: rear FX / movement smear
  do
    local image = newImage(sprite)

    if spec.kind == "run" then
      local alphaColor =
        rgba("#541025", 100)

      line(
        image,
        51,
        83 + bob,
        43,
        85 + bob,
        alphaColor
      )

      line(
        image,
        53,
        88 + bob,
        46,
        91 + bob,
        alphaColor
      )
    end

    addCel(
      sprite,
      layers["01_fx_back"],
      frameNumber,
      image
    )
  end

  -- 02: coat tails
  do
    local image = newImage(sprite)

    fillPolygon(
      image,
      {
        { x = 57 + lean, y = 81 + bob },
        { x = 64 + lean, y = 83 + bob },
        {
          x = 61 + lean + pose.tailsSwing,
          y = 97 + bob
        },
        {
          x = 54 + lean + pose.tailsSwing,
          y = 92 + bob
        }
      },
      COLORS.coatShadow
    )

    fillPolygon(
      image,
      {
        { x = 64 + lean, y = 83 + bob },
        { x = 72 + lean, y = 81 + bob },
        {
          x = 75 + lean + pose.tailsSwing,
          y = 92 + bob
        },
        {
          x = 67 + lean + pose.tailsSwing,
          y = 97 + bob
        }
      },
      COLORS.coat
    )

    line(
      image,
      64 + lean,
      84 + bob,
      66 + lean + pose.tailsSwing,
      95 + bob,
      COLORS.coatLight
    )

    addCel(
      sprite,
      layers["02_coat_tails"],
      frameNumber,
      image
    )
  end

  -- 03: back arm
  do
    local image = newImage(sprite)

    local elbowX =
      math.floor(
        (58 + pose.backHandX) / 2
      )

    local elbowY =
      77 + bob

    thickLine(
      image,
      58 + lean,
      73 + bob,
      elbowX,
      elbowY,
      4,
      COLORS.coatShadow
    )

    thickLine(
      image,
      elbowX,
      elbowY,
      pose.backHandX + lean,
      pose.backHandY + bob,
      3,
      COLORS.coatShadow
    )

    fillEllipse(
      image,
      pose.backHandX + lean,
      pose.backHandY + bob,
      2,
      2,
      COLORS.skinShadow
    )

    addCel(
      sprite,
      layers["03_back_arm"],
      frameNumber,
      image
    )
  end

  -- 04: back leg
  do
    local image = newImage(sprite)

    thickLine(
      image,
      hipX + 3,
      hipY,
      pose.backKneeX,
      pose.backKneeY + bob,
      4,
      COLORS.legs
    )

    thickLine(
      image,
      pose.backKneeX,
      pose.backKneeY + bob,
      pose.backFootX,
      pose.backFootY,
      4,
      COLORS.legs
    )

    fillRect(
      image,
      pose.backFootX - 2,
      pose.backFootY - 2,
      7,
      3,
      COLORS.legs
    )

    line(
      image,
      pose.backFootX,
      pose.backFootY - 2,
      pose.backFootX + 4,
      pose.backFootY - 2,
      COLORS.shoeLight
    )

    addCel(
      sprite,
      layers["04_back_leg"],
      frameNumber,
      image
    )
  end

  -- 05: torso and coat
  do
    local image = newImage(sprite)

    fillPolygon(
      image,
      {
        { x = shoulderX - 8, y = shoulderY },
        { x = shoulderX + 8, y = shoulderY },
        { x = hipX + 7, y = hipY + 2 },
        { x = hipX - 7, y = hipY + 2 }
      },
      COLORS.coat
    )

    fillPolygon(
      image,
      {
        { x = shoulderX - 8, y = shoulderY },
        { x = shoulderX - 2, y = shoulderY },
        { x = hipX - 1, y = hipY + 2 },
        { x = hipX - 7, y = hipY + 2 }
      },
      COLORS.coatShadow
    )

    line(
      image,
      shoulderX + 6,
      shoulderY + 2,
      hipX + 5,
      hipY,
      COLORS.coatLight
    )

    line(
      image,
      hipX - 5,
      hipY + 1,
      hipX + 5,
      hipY + 1,
      COLORS.coatDeepShadow
    )

    addCel(
      sprite,
      layers["05_torso_coat"],
      frameNumber,
      image
    )
  end

  -- 06: shirt, waistcoat, bow tie
  do
    local image = newImage(sprite)

    fillPolygon(
      image,
      {
        { x = shoulderX - 3, y = shoulderY },
        { x = shoulderX + 4, y = shoulderY },
        { x = hipX + 2, y = hipY - 1 },
        { x = hipX - 2, y = hipY - 1 }
      },
      COLORS.shirt
    )

    line(
      image,
      shoulderX,
      shoulderY + 5,
      hipX,
      hipY - 2,
      COLORS.shirtShadow
    )

    fillPolygon(
      image,
      {
        { x = shoulderX - 5, y = shoulderY + 1 },
        { x = shoulderX - 1, y = shoulderY + 3 },
        { x = shoulderX - 5, y = shoulderY + 5 }
      },
      COLORS.hair
    )

    fillPolygon(
      image,
      {
        { x = shoulderX + 5, y = shoulderY + 1 },
        { x = shoulderX + 1, y = shoulderY + 3 },
        { x = shoulderX + 5, y = shoulderY + 5 }
      },
      COLORS.hair
    )

    fillRect(
      image,
      shoulderX - 1,
      shoulderY + 2,
      3,
      3,
      COLORS.hair
    )

    addCel(
      sprite,
      layers["06_shirt_vest"],
      frameNumber,
      image
    )
  end

  -- 07: front leg
  do
    local image = newImage(sprite)

    thickLine(
      image,
      hipX - 2,
      hipY,
      pose.frontKneeX,
      pose.frontKneeY + bob,
      4,
      COLORS.legs
    )

    thickLine(
      image,
      pose.frontKneeX,
      pose.frontKneeY + bob,
      pose.frontFootX,
      pose.frontFootY,
      4,
      COLORS.legs
    )

    fillRect(
      image,
      pose.frontFootX - 4,
      pose.frontFootY - 2,
      8,
      3,
      COLORS.legs
    )

    line(
      image,
      pose.frontFootX - 3,
      pose.frontFootY - 2,
      pose.frontFootX + 2,
      pose.frontFootY - 2,
      COLORS.shoeLight
    )

    addCel(
      sprite,
      layers["07_front_leg"],
      frameNumber,
      image
    )
  end

  -- 08: front arm
  do
    local image = newImage(sprite)

    local elbowX =
      math.floor(
        (
          shoulderX + 7 +
          pose.frontHandX
        ) / 2
      )

    local elbowY =
      math.floor(
        (
          shoulderY + 4 +
          pose.frontHandY + bob
        ) / 2
      )

    thickLine(
      image,
      shoulderX + 7,
      shoulderY + 3,
      elbowX,
      elbowY,
      4,
      COLORS.coat
    )

    thickLine(
      image,
      elbowX,
      elbowY,
      pose.frontHandX + lean,
      pose.frontHandY + bob,
      3,
      COLORS.coatLight
    )

    fillEllipse(
      image,
      pose.frontHandX + lean,
      pose.frontHandY + bob,
      2,
      2,
      COLORS.skin
    )

    setPixel(
      image,
      pose.frontHandX + lean + 1,
      pose.frontHandY + bob - 1,
      COLORS.skinLight
    )

    addCel(
      sprite,
      layers["08_front_arm"],
      frameNumber,
      image
    )
  end

  -- 09: head
  do
    local image = newImage(sprite)

    local headX = 64 + lean
    local headY = 64 + bob

    fillEllipse(
      image,
      headX,
      headY,
      7,
      8,
      COLORS.skin
    )

    fillEllipse(
      image,
      headX - 3,
      headY + 1,
      3,
      6,
      COLORS.skinShadow
    )

    fillRect(
      image,
      headX + 5,
      headY - 1,
      4,
      3,
      COLORS.skin
    )

    setPixel(
      image,
      headX + 3,
      headY - 2,
      COLORS.eye
    )

    setPixel(
      image,
      headX + 4,
      headY - 3,
      COLORS.eyeLight
    )

    line(
      image,
      headX + 1,
      headY + 5,
      headX + 5,
      headY + 4,
      COLORS.skinShadow
    )

    addCel(
      sprite,
      layers["09_head"],
      frameNumber,
      image
    )
  end

  -- 10: hair and moustache
  do
    local image = newImage(sprite)

    local headX = 64 + lean
    local headY = 64 + bob

    fillPolygon(
      image,
      {
        { x = headX - 6, y = headY - 7 },
        { x = headX + 5, y = headY - 7 },
        { x = headX + 6, y = headY - 4 },
        { x = headX - 6, y = headY - 2 }
      },
      COLORS.hair
    )

    fillRect(
      image,
      headX - 7,
      headY - 4,
      2,
      7,
      COLORS.hair
    )

    line(
      image,
      headX - 1,
      headY + 2,
      headX - 6,
      headY + 4,
      COLORS.moustache
    )

    line(
      image,
      headX,
      headY + 2,
      headX + 6,
      headY + 3,
      COLORS.moustache
    )

    line(
      image,
      headX - 5,
      headY + 4,
      headX - 7,
      headY + 2,
      COLORS.moustache
    )

    line(
      image,
      headX + 5,
      headY + 3,
      headX + 7,
      headY + 1,
      COLORS.moustache
    )

    addCel(
      sprite,
      layers["10_hair_moustache"],
      frameNumber,
      image
    )
  end

  -- 11: top hat
  do
    local image = newImage(sprite)

    local hatX =
      64 + lean + pose.hatTilt

    local hatY = 47 + bob

    fillRect(
      image,
      hatX - 7,
      hatY - 5,
      14,
      13,
      COLORS.hat
    )

    fillRect(
      image,
      hatX - 9,
      hatY + 7,
      19,
      3,
      COLORS.hat
    )

    fillRect(
      image,
      hatX - 7,
      hatY + 4,
      14,
      3,
      COLORS.gold
    )

    line(
      image,
      hatX - 5,
      hatY - 4,
      hatX + 5,
      hatY - 4,
      COLORS.hatLight
    )

    setPixel(
      image,
      hatX + 6,
      hatY + 5,
      COLORS.goldLight
    )

    addCel(
      sprite,
      layers["11_hat"],
      frameNumber,
      image
    )
  end

  -- 12: cane
  do
    local image = newImage(sprite)

    local handX =
      pose.frontHandX + lean

    local handY =
      pose.frontHandY + bob

    local hookX =
      pose.caneHookX + lean

    local hookY =
      pose.caneHookY + bob

    local tipX =
      pose.caneTipX + lean

    local tipY =
      pose.caneTipY +
      (
        spec.kind ==
          "attack_combo_1"
        and bob
        or 0
      )

    thickLine(
      image,
      handX,
      handY,
      tipX,
      tipY,
      2,
      COLORS.goldShadow
    )

    line(
      image,
      handX,
      handY - 1,
      tipX,
      tipY - 1,
      COLORS.gold
    )

    thickLine(
      image,
      handX,
      handY,
      hookX,
      hookY,
      2,
      COLORS.gold
    )

    line(
      image,
      hookX,
      hookY,
      hookX - 4,
      hookY,
      COLORS.goldLight
    )

    setPixel(
      image,
      tipX,
      tipY,
      COLORS.goldLight
    )

    addCel(
      sprite,
      layers["12_cane"],
      frameNumber,
      image
    )
  end

  -- 13: attack effects
  do
    local image = newImage(sprite)

    if pose.attackFx then
      line(
        image,
        82,
        69,
        108,
        69,
        COLORS.attackFx
      )

      line(
        image,
        84,
        72,
        112,
        75,
        COLORS.attackFx
      )

      line(
        image,
        82,
        78,
        108,
        82,
        COLORS.attackFx
      )

      setPixel(
        image,
        111,
        74,
        COLORS.goldLight
      )
    end

    addCel(
      sprite,
      layers["13_fx_front"],
      frameNumber,
      image
    )
  end
end

local sprite = Sprite(
  WIDTH,
  HEIGHT,
  ColorMode.RGB
)

sprite.filename = output
sprite.colorSpace =
  ColorSpace { sRGB = true }

local firstLayer = sprite.layers[1]
firstLayer.name = "01_fx_back"

local layers = {
  ["01_fx_back"] = firstLayer
}

for index = 2,
  #LAYER_NAMES_BOTTOM_TO_TOP
do
  local name =
    LAYER_NAMES_BOTTOM_TO_TOP[index]

  local layer = sprite:newLayer()
  layer.name = name
  layers[name] = layer
end

layers["14_guides"].isVisible = false
layers["14_guides"].opacity = 180

-- Build production palette.
local palette =
  Palette(#PALETTE)

for index, entry in ipairs(PALETTE) do
  palette:setColor(
    index - 1,
    Color {
      r = tonumber(
        entry.hex:sub(2, 3),
        16
      ),
      g = tonumber(
        entry.hex:sub(4, 5),
        16
      ),
      b = tonumber(
        entry.hex:sub(6, 7),
        16
      ),
      a = entry.alpha or 255
    }
  )
end

sprite:setPalette(palette)

-- Create all required frames.
for frameNumber = 2,
  #FRAME_SPECS
do
  sprite:newEmptyFrame(frameNumber)
end

for frameNumber, spec in
  ipairs(FRAME_SPECS)
do
  sprite.frames[frameNumber].duration =
    spec.duration

  drawFrame(
    sprite,
    layers,
    frameNumber,
    spec
  )
end

-- Guides only need one cel. The layer is hidden.
do
  local image = newImage(sprite)

  line(
    image,
    ORIGIN_X,
    32,
    ORIGIN_X,
    112,
    COLORS.guide
  )

  line(
    image,
    32,
    ORIGIN_Y,
    112,
    ORIGIN_Y,
    COLORS.guide
  )

  -- Physics body: 18x30, bottom at y=98.
  line(
    image,
    55,
    68,
    72,
    68,
    COLORS.hitboxGuide
  )

  line(
    image,
    72,
    68,
    72,
    97,
    COLORS.hitboxGuide
  )

  line(
    image,
    72,
    97,
    55,
    97,
    COLORS.hitboxGuide
  )

  line(
    image,
    55,
    97,
    55,
    68,
    COLORS.hitboxGuide
  )

  fillRect(
    image,
    ORIGIN_X - 1,
    ORIGIN_Y - 1,
    3,
    3,
    COLORS.goldLight
  )

  sprite:newCel(
    layers["14_guides"],
    1,
    image,
    Point(0, 0)
  )
end

local function addTag(
  name,
  fromFrame,
  toFrame,
  color
)
  local tag =
    sprite:newTag(
      fromFrame,
      toFrame
    )

  tag.name = name
  tag.aniDir = AniDir.FORWARD
  tag.color = color

  return tag
end

addTag(
  "idle",
  1,
  8,
  Color {
    r = 216,
    g = 170,
    b = 70
  }
)

addTag(
  "run",
  9,
  18,
  Color {
    r = 183,
    g = 42,
    b = 80
  }
)

addTag(
  "jump_start",
  19,
  21,
  Color {
    r = 241,
    g = 192,
    b = 155
  }
)

addTag(
  "rise",
  22,
  24,
  Color {
    r = 110,
    g = 205,
    b = 236
  }
)

addTag(
  "fall",
  25,
  27,
  Color {
    r = 84,
    g = 126,
    b = 188
  }
)

addTag(
  "attack_combo_1",
  28,
  32,
  Color {
    r = 245,
    g = 212,
    b = 119
  }
)

sprite.data =
  "Impressario generated source v1\n" ..
  "Canvas: 128x128 RGBA\n" ..
  "Footpoint: 64,98\n" ..
  "Physics body: 18x30\n" ..
  "Facing: right\n" ..
  "Generated frames are editable production references."

sprite.gridBounds =
  Rectangle {
    x = 0,
    y = 0,
    width = 8,
    height = 8
  }

sprite:saveAs(output)

print(
  "Generated Impressario source: " ..
  output
)

print(
  "Frames: " ..
  tostring(#sprite.frames)
)

print(
  "Layers: " ..
  tostring(#sprite.layers)
)

print(
  "Tags: " ..
  tostring(#sprite.tags)
)

sprite:close()
