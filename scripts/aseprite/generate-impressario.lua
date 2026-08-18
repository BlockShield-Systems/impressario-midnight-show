-- Impressario procedural Aseprite source generator
-- Requires Aseprite scripting API v1.2.10+.
--
-- Generates:
--   * 128x128 RGB/RGBA sprite
--   * 14 editable layers
--   * fixed production palette
--   * 108 frames
--   * complete movement tags
--   * nine cane-combat animations

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

local FRAME_GROUPS = {
  {
    name = "idle",
    kind = "idle",
    durations = { 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125 },
    repeats = 0,
    color = { 216, 170, 70 }
  },
  {
    name = "run",
    kind = "run",
    durations = { 0.070, 0.070, 0.070, 0.070, 0.070, 0.070, 0.070, 0.070, 0.070, 0.070 },
    repeats = 0,
    color = { 183, 42, 80 }
  },
  {
    name = "jump_start",
    kind = "jump_start",
    durations = { 0.060, 0.060, 0.060 },
    repeats = 1,
    color = { 241, 192, 155 }
  },
  {
    name = "rise",
    kind = "rise",
    durations = { 0.100, 0.100, 0.100 },
    repeats = 0,
    color = { 110, 205, 236 }
  },
  {
    name = "fall",
    kind = "fall",
    durations = { 0.110, 0.110, 0.110 },
    repeats = 0,
    color = { 84, 126, 188 }
  },
  {
    name = "land",
    kind = "land",
    durations = { 0.050, 0.060, 0.080 },
    repeats = 1,
    color = { 111, 224, 166 }
  },
  {
    name = "dash",
    kind = "dash",
    durations = { 0.045, 0.045, 0.045, 0.045, 0.045, 0.045 },
    repeats = 1,
    color = { 244, 199, 104 }
  },
  {
    name = "wall_slide",
    kind = "wall_slide",
    durations = { 0.090, 0.090, 0.090, 0.090 },
    repeats = 0,
    color = { 116, 154, 215 }
  },
  {
    name = "wall_jump",
    kind = "wall_jump",
    durations = { 0.055, 0.055, 0.065, 0.075 },
    repeats = 1,
    color = { 126, 215, 238 }
  },
  {
    name = "hurt",
    kind = "hurt",
    durations = { 0.060, 0.070, 0.090, 0.120 },
    repeats = 1,
    color = { 238, 82, 104 }
  },
  {
    name = "attack_combo_1",
    kind = "attack_combo_1",
    durations = { 0.070, 0.040, 0.040, 0.075, 0.075 },
    repeats = 1,
    color = { 245, 212, 119 }
  },
  {
    name = "attack_combo_2",
    kind = "attack_combo_2",
    durations = { 0.060, 0.045, 0.045, 0.053, 0.053, 0.054 },
    repeats = 1,
    color = { 255, 221, 125 }
  },
  {
    name = "attack_combo_3",
    kind = "attack_combo_3",
    durations = { 0.055, 0.055, 0.050, 0.050, 0.063, 0.062, 0.062, 0.063 },
    repeats = 1,
    color = { 255, 239, 173 }
  },
  {
    name = "attack_low",
    kind = "attack_low",
    durations = { 0.045, 0.045, 0.050, 0.050, 0.070, 0.070, 0.070 },
    repeats = 1,
    color = { 229, 168, 71 }
  },
  {
    name = "attack_launcher",
    kind = "attack_launcher",
    durations = { 0.060, 0.060, 0.050, 0.050, 0.060, 0.060, 0.060, 0.060 },
    repeats = 1,
    color = { 247, 210, 115 }
  },
  {
    name = "attack_air_neutral",
    kind = "attack_air_neutral",
    durations = { 0.070, 0.060, 0.060, 0.060, 0.060, 0.060 },
    repeats = 1,
    color = { 236, 198, 95 }
  },
  {
    name = "attack_air_up",
    kind = "attack_air_up",
    durations = { 0.080, 0.060, 0.060, 0.067, 0.066, 0.067 },
    repeats = 1,
    color = { 248, 220, 135 }
  },
  {
    name = "attack_down",
    kind = "attack_down",
    durations = { 0.050, 0.050, 0.080, 0.080, 0.074, 0.073, 0.073 },
    repeats = 1,
    color = { 242, 185, 79 }
  },
  {
    name = "attack_dash",
    kind = "attack_dash",
    durations = { 0.035, 0.065, 0.065, 0.050, 0.050, 0.050, 0.050 },
    repeats = 1,
    color = { 255, 226, 144 }
  },
}

local FRAME_SPECS = {}

for _, group in ipairs(FRAME_GROUPS) do
  for phase, duration in ipairs(group.durations) do
    table.insert(
      FRAME_SPECS,
      {
        kind = group.kind,
        phase = phase,
        duration = duration
      }
    )
  end
end

local function newImage(sprite)
  local image = Image(
    WIDTH,
    HEIGHT,
    ColorMode.RGB
  )

  image:clear()

  return image
end

local function isCombatKind(
  kind
)
  return string.sub(
    kind,
    1,
    7
  ) == "attack_"
end

-- Combat weapon poses were authored opposite to the movement/head
-- source-facing convention. Mirror only the directional combat
-- package around the 64,98 character pivot. Runtime then mirrors
-- the complete flattened frame uniformly for world facing.
local function mirrorDirectionalImage(
  image
)
  local mirrored = Image(
    WIDTH,
    HEIGHT,
    ColorMode.RGB
  )

  mirrored:clear()

  for y = 0, HEIGHT - 1 do
    for x = 0, WIDTH - 1 do
      local targetX =
        ORIGIN_X * 2 - x

      if
        targetX >= 0 and
        targetX < WIDTH
      then
        mirrored:drawPixel(
          targetX,
          y,
          image:getPixel(x, y)
        )
      end
    end
  end

  return mirrored
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


local ATTACK_PROFILES = {
  attack_combo_2 = {
    activeFrom = 2,
    activeTo = 3,
    wind = { handX = 67, handY = 76, tipX = 55, tipY = 66 },
    strike = { handX = 80, handY = 73, tipX = 108, tipY = 58 },
    recover = { handX = 75, handY = 78, tipX = 91, tipY = 87 }
  },

  attack_combo_3 = {
    activeFrom = 3,
    activeTo = 4,
    wind = { handX = 70, handY = 68, tipX = 72, tipY = 42 },
    strike = { handX = 80, handY = 76, tipX = 109, tipY = 91 },
    recover = { handX = 74, handY = 79, tipX = 88, tipY = 96 }
  },

  attack_low = {
    activeFrom = 3,
    activeTo = 4,
    wind = { handX = 68, handY = 82, tipX = 57, tipY = 91 },
    strike = { handX = 79, handY = 84, tipX = 109, tipY = 96 },
    recover = { handX = 74, handY = 81, tipX = 89, tipY = 98 }
  },

  attack_launcher = {
    activeFrom = 3,
    activeTo = 4,
    wind = { handX = 70, handY = 83, tipX = 84, tipY = 97 },
    strike = { handX = 75, handY = 67, tipX = 78, tipY = 34 },
    recover = { handX = 73, handY = 75, tipX = 85, tipY = 58 }
  },

  attack_air_neutral = {
    activeFrom = 2,
    activeTo = 3,
    wind = { handX = 68, handY = 76, tipX = 55, tipY = 69 },
    strike = { handX = 81, handY = 74, tipX = 110, tipY = 72 },
    recover = { handX = 74, handY = 77, tipX = 91, tipY = 86 }
  },

  attack_air_up = {
    activeFrom = 2,
    activeTo = 3,
    wind = { handX = 70, handY = 76, tipX = 60, tipY = 62 },
    strike = { handX = 76, handY = 64, tipX = 79, tipY = 31 },
    recover = { handX = 73, handY = 72, tipX = 87, tipY = 53 }
  },

  attack_down = {
    activeFrom = 3,
    activeTo = 4,
    wind = { handX = 69, handY = 73, tipX = 82, tipY = 59 },
    strike = { handX = 74, handY = 87, tipX = 73, tipY = 118 },
    recover = { handX = 72, handY = 81, tipX = 83, tipY = 102 }
  },

  attack_dash = {
    activeFrom = 2,
    activeTo = 3,
    wind = { handX = 70, handY = 76, tipX = 61, tipY = 67 },
    strike = { handX = 84, handY = 74, tipX = 116, tipY = 73 },
    recover = { handX = 78, handY = 77, tipX = 101, tipY = 85 }
  }
}

local function applyExtendedPose(
  pose,
  spec
)
  if spec.kind == "land" then
    if spec.phase == 1 then
      pose.bob = 4
      pose.frontKneeY = 93
      pose.backKneeY = 93
      pose.frontFootX = 56
      pose.backFootX = 72
      pose.tailsSwing = 3
    elseif spec.phase == 2 then
      pose.bob = 2
      pose.frontKneeY = 91
      pose.backKneeY = 91
      pose.frontFootX = 58
      pose.backFootX = 70
      pose.tailsSwing = 2
    else
      pose.bob = 0
      pose.tailsSwing = 1
    end

    return
  end

  if spec.kind == "dash" then
    pose.bob = -1
    pose.lean = 5
    pose.frontFootX = 58 - spec.phase
    pose.backFootX = 52 - spec.phase
    pose.frontKneeX = 60
    pose.backKneeX = 57
    pose.frontHandX = 79
    pose.frontHandY = 75
    pose.backHandX = 53
    pose.backHandY = 79
    pose.caneHookX = 82
    pose.caneHookY = 72
    pose.caneTipX = 101 + spec.phase
    pose.caneTipY = 78
    pose.tailsSwing = -7
    return
  end

  if spec.kind == "wall_slide" then
    pose.lean = -2
    pose.frontFootX = 58
    pose.backFootX = 62
    pose.frontFootY = 96
    pose.backFootY = 93
    pose.frontKneeX = 57
    pose.backKneeX = 64
    pose.frontKneeY = 87
    pose.backKneeY = 86
    pose.frontHandX = 75
    pose.frontHandY = 75
    pose.backHandX = 54
    pose.backHandY = 75
    pose.caneTipX = 80
    pose.caneTipY = 92
    pose.tailsSwing = 4 + (spec.phase % 2)
    return
  end

  if spec.kind == "wall_jump" then
    pose.bob = -2
    pose.lean = 2 + spec.phase
    pose.frontFootX = 57
    pose.backFootX = 67
    pose.frontFootY = 94
    pose.backFootY = 91
    pose.frontKneeX = 60
    pose.backKneeX = 65
    pose.frontKneeY = 86
    pose.backKneeY = 85
    pose.frontHandX = 76
    pose.frontHandY = 74
    pose.caneTipX = 91
    pose.caneTipY = 85
    pose.tailsSwing = -5
    return
  end

  if spec.kind == "hurt" then
    pose.lean = -5 + spec.phase
    pose.bob = (spec.phase == 1) and -2 or 1
    pose.frontFootX = 57
    pose.backFootX = 70
    pose.frontKneeY = 91
    pose.backKneeY = 90
    pose.frontHandX = 68
    pose.frontHandY = 75
    pose.backHandX = 54
    pose.backHandY = 77
    pose.caneHookX = 70
    pose.caneHookY = 70
    pose.caneTipX = 82
    pose.caneTipY = 94
    pose.hatTilt = -2
    pose.tailsSwing = -3
    return
  end

  local profile =
    ATTACK_PROFILES[spec.kind]

  if profile == nil then
    return
  end

  local active =
    spec.phase >= profile.activeFrom and
    spec.phase <= profile.activeTo

  local values

  if spec.phase < profile.activeFrom then
    values = profile.wind
  elseif active then
    values = profile.strike
  else
    values = profile.recover
  end

  pose.frontHandX = values.handX
  pose.frontHandY = values.handY
  pose.caneTipX = values.tipX
  pose.caneTipY = values.tipY
  pose.caneHookX = values.handX + 4
  pose.caneHookY = values.handY - 4
  pose.attackFx = active

  if active then
    pose.lean = 4
    pose.frontFootX = 65
    pose.backFootX = 56
    pose.tailsSwing = 5
  elseif spec.phase < profile.activeFrom then
    pose.lean = -2
    pose.tailsSwing = -3
  else
    pose.lean = 1
    pose.tailsSwing = 2
  end

  if
    spec.kind == "attack_low" or
    spec.kind == "attack_down"
  then
    pose.bob = 3
    pose.frontKneeY = 92
    pose.backKneeY = 91
  end

  if
    spec.kind == "attack_air_neutral" or
    spec.kind == "attack_air_up" or
    spec.kind == "attack_down"
  then
    pose.frontFootY = 94
    pose.backFootY = 92
    pose.frontKneeY = 86
    pose.backKneeY = 86
  end

  if spec.kind == "attack_dash" then
    pose.lean = 6
    pose.frontFootX = 57
    pose.backFootX = 51
    pose.tailsSwing = -7
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

  if
    spec.kind ~= "idle" and
    spec.kind ~= "run" and
    spec.kind ~= "jump_start" and
    spec.kind ~= "rise" and
    spec.kind ~= "fall" and
    spec.kind ~= "attack_combo_1"
  then
    applyExtendedPose(
      pose,
      spec
    )
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

    if isCombatKind(spec.kind) then
      image =
        mirrorDirectionalImage(image)
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

    if isCombatKind(spec.kind) then
      image =
        mirrorDirectionalImage(image)
    end

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

    if isCombatKind(spec.kind) then
      image =
        mirrorDirectionalImage(image)
    end

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
        string.sub(
          spec.kind,
          1,
          7
        ) == "attack_"
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

    if isCombatKind(spec.kind) then
      image =
        mirrorDirectionalImage(image)
    end

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
      local handX =
        pose.frontHandX + lean

      local handY =
        pose.frontHandY + bob

      local tipX =
        pose.caneTipX + lean

      local tipY =
        pose.caneTipY + bob

      local deltaX = tipX - handX
      local deltaY = tipY - handY

      line(
        image,
        handX,
        handY - 5,
        tipX,
        tipY - 5,
        COLORS.attackFx
      )

      line(
        image,
        handX - math.floor(deltaY * 0.12),
        handY + math.floor(deltaX * 0.12),
        tipX - math.floor(deltaY * 0.08),
        tipY + math.floor(deltaX * 0.08),
        COLORS.attackFx
      )

      line(
        image,
        handX + math.floor(deltaY * 0.12),
        handY - math.floor(deltaX * 0.12),
        tipX + math.floor(deltaY * 0.08),
        tipY - math.floor(deltaX * 0.08),
        COLORS.attackFx
      )

      setPixel(
        image,
        tipX,
        tipY,
        COLORS.goldLight
      )
    end

    if isCombatKind(spec.kind) then
      image =
        mirrorDirectionalImage(image)
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

local tagStart = 1

for _, group in ipairs(FRAME_GROUPS) do
  local tagEnd =
    tagStart + #group.durations - 1

  local tag =
    addTag(
      group.name,
      tagStart,
      tagEnd,
      Color {
        r = group.color[1],
        g = group.color[2],
        b = group.color[3]
      }
    )

  tag.repeats = group.repeats
  tag.data =
    "Generated M7C animation: " ..
    group.kind

  tagStart = tagEnd + 1
end

if tagStart - 1 ~= #FRAME_SPECS then
  error(
    "Tag/frame mismatch: " ..
    tostring(tagStart - 1) ..
    " versus " ..
    tostring(#FRAME_SPECS)
  )
end

sprite.data =
  "Impressario generated source M7C v2\n" ..
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
