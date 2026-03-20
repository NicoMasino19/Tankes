import { AbilitySlot, type InputState, type AbilitySlot as AbilitySlotValue } from "@tankes/shared";

export class InputController {
  private readonly keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private leftMouseDown = false;
  private sequence = 0;
  private readonly abilityTriggers: AbilitySlotValue[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("mouseup", this.onMouseUp);
  }

  buildInput(worldMouseX: number, worldMouseY: number): InputState {
    this.sequence += 1;
    return {
      up: this.keys.has("KeyW"),
      down: this.keys.has("KeyS"),
      left: this.keys.has("KeyA"),
      right: this.keys.has("KeyD"),
      shoot: this.leftMouseDown,
      aimX: worldMouseX,
      aimY: worldMouseY,
      sequence: this.sequence
    };
  }

  consumeAbilityTriggers(): AbilitySlotValue[] {
    if (this.abilityTriggers.length === 0) {
      return [];
    }

    const triggers = [...this.abilityTriggers];
    this.abilityTriggers.length = 0;
    return triggers;
  }

  getMouseScreenPosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.keys.has(event.code)) {
      if (event.code === "Digit1") {
        this.abilityTriggers.push(AbilitySlot.Slot1);
      } else if (event.code === "Digit2") {
        this.abilityTriggers.push(AbilitySlot.Slot2);
      } else if (event.code === "Digit3") {
        this.abilityTriggers.push(AbilitySlot.Ultimate);
      }
    }
    this.keys.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private onMouseMove = (event: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;
  };

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.leftMouseDown = true;
      return;
    }

    if (event.button === 2) {
      event.preventDefault();
      this.abilityTriggers.push(AbilitySlot.RightClick);
    }
  };

  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.leftMouseDown = false;
    }
  };

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
