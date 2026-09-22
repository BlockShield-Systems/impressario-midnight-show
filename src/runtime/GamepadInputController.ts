export const GAMEPAD_BUTTONS = {
  jump: 0,
  dash: 1,
  melee: 2,
  grandCard: 3,
  spotlight: 5,
  dashTrigger: 7,
  pause: 9,
  down: 13
} as const;

export const GAMEPAD_DEADZONE = 0.22;
export const ROYAL_BOX_LOOK_DOWN_THRESHOLD = 0.55;

export type GamepadPressedAction =
  | "jump"
  | "dash"
  | "melee"
  | "grandCard"
  | "spotlight"
  | "pause";

export type GamepadPollingContext =
  | "gameplay"
  | "pause-menu";

export interface GameplayActionIntentSource {
  consumeGamepadAction(
    action: Extract<
      GamepadPressedAction,
      "melee" | "grandCard" | "spotlight"
    >
  ): boolean;

  readonly gamepadLookDownHeld: boolean;
}

type GamepadReader =
  () => ArrayLike<Gamepad | null>;

const PRESSED_ACTIONS: readonly GamepadPressedAction[] = [
  "jump",
  "dash",
  "melee",
  "grandCard",
  "spotlight",
  "pause"
];

const GAMEPLAY_ACTIONS: readonly GamepadPressedAction[] = [
  "jump",
  "dash",
  "melee",
  "grandCard",
  "spotlight"
];

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function combinePressedIntent(
  keyboardPressed: boolean,
  gamepadPressed: boolean
): boolean {
  return keyboardPressed || gamepadPressed;
}

export class GamepadInputController
implements GameplayActionIntentSource {
  private readonly readGamepads: GamepadReader;
  private readonly previous =
    new Map<GamepadPressedAction, boolean>();
  private readonly queued =
    new Set<GamepadPressedAction>();

  private suppressedUntilNeutral = false;
  private currentMoveX = 0;
  private currentDownHeld = false;
  private currentJumpHeld = false;
  private currentLookDownHeld = false;

  public constructor(
    readGamepads: GamepadReader = () =>
      navigator.getGamepads?.() ?? []
  ) {
    this.readGamepads = readGamepads;

    for (const action of PRESSED_ACTIONS) {
      this.previous.set(action, false);
    }
  }

  public update(context: GamepadPollingContext): void {
    const gamepad = this.readGamepads()[0];

    this.clearContinuousState();

    if (!gamepad) {
      this.resetPreviousState();
      this.suppressedUntilNeutral = false;
      return;
    }

    const axisX = gamepad.axes[0] ?? 0;
    const axisY = gamepad.axes[1] ?? 0;
    const held = this.readHeldActions(gamepad);
    const gamepadActive =
      Math.abs(axisX) >= GAMEPAD_DEADZONE ||
      Math.abs(axisY) >= GAMEPAD_DEADZONE ||
      Boolean(gamepad.buttons[GAMEPAD_BUTTONS.down]?.pressed) ||
      PRESSED_ACTIONS.some(action => held[action]);

    if (this.suppressedUntilNeutral) {
      this.setPreviousState(held);

      if (!gamepadActive) {
        this.suppressedUntilNeutral = false;
      }

      return;
    }

    if (context === "gameplay") {
      if (Math.abs(axisX) >= GAMEPAD_DEADZONE) {
        this.currentMoveX = clamp(axisX, -1, 1);
      }

      this.currentDownHeld =
        axisY > GAMEPAD_DEADZONE ||
        Boolean(gamepad.buttons[GAMEPAD_BUTTONS.down]?.pressed);
      this.currentJumpHeld = held.jump;
      this.currentLookDownHeld =
        axisY > ROYAL_BOX_LOOK_DOWN_THRESHOLD ||
        Boolean(gamepad.buttons[GAMEPAD_BUTTONS.down]?.pressed);

      for (const action of GAMEPLAY_ACTIONS) {
        this.queueRisingEdge(action, held[action]);
      }
    }

    this.queueRisingEdge("pause", held.pause);
    this.setPreviousState(held);
  }

  public suppressUntilNeutral(): void {
    this.suppressedUntilNeutral = true;
    this.queued.clear();
    this.clearContinuousState();
  }

  public reset(): void {
    this.queued.clear();
    this.resetPreviousState();
    this.clearContinuousState();
  }

  public consumeGamepadAction(
    action: Extract<
      GamepadPressedAction,
      "melee" | "grandCard" | "spotlight"
    >
  ): boolean {
    return this.consume(action);
  }

  public consume(
    action: GamepadPressedAction
  ): boolean {
    if (!this.queued.delete(action)) {
      return false;
    }

    return true;
  }

  public get moveX(): number {
    return this.currentMoveX;
  }

  public get downHeld(): boolean {
    return this.currentDownHeld;
  }

  public get jumpHeld(): boolean {
    return this.currentJumpHeld;
  }

  public get gamepadLookDownHeld(): boolean {
    return this.currentLookDownHeld;
  }

  public get isSuppressedUntilNeutral(): boolean {
    return this.suppressedUntilNeutral;
  }

  private readHeldActions(
    gamepad: Gamepad
  ): Record<GamepadPressedAction, boolean> {
    return {
      jump: Boolean(
        gamepad.buttons[GAMEPAD_BUTTONS.jump]?.pressed
      ),
      dash:
        Boolean(
          gamepad.buttons[GAMEPAD_BUTTONS.dash]?.pressed
        ) ||
        Boolean(
          gamepad.buttons[GAMEPAD_BUTTONS.dashTrigger]?.pressed
        ),
      melee: Boolean(
        gamepad.buttons[GAMEPAD_BUTTONS.melee]?.pressed
      ),
      grandCard: Boolean(
        gamepad.buttons[GAMEPAD_BUTTONS.grandCard]?.pressed
      ),
      spotlight: Boolean(
        gamepad.buttons[GAMEPAD_BUTTONS.spotlight]?.pressed
      ),
      pause: Boolean(
        gamepad.buttons[GAMEPAD_BUTTONS.pause]?.pressed
      )
    };
  }

  private queueRisingEdge(
    action: GamepadPressedAction,
    held: boolean
  ): void {
    if (held && !this.previous.get(action)) {
      this.queued.add(action);
    }
  }

  private setPreviousState(
    held: Readonly<Record<GamepadPressedAction, boolean>>
  ): void {
    for (const action of PRESSED_ACTIONS) {
      this.previous.set(action, held[action]);
    }
  }

  private resetPreviousState(): void {
    for (const action of PRESSED_ACTIONS) {
      this.previous.set(action, false);
    }
  }

  private clearContinuousState(): void {
    this.currentMoveX = 0;
    this.currentDownHeld = false;
    this.currentJumpHeld = false;
    this.currentLookDownHeld = false;
  }
}
