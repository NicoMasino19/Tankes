import type { InputState } from "@tankes/shared";

export class InputController {
  private readonly keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private mouseDown = false;
  private sequence = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
  }

  buildInput(worldMouseX: number, worldMouseY: number): InputState {
    this.sequence += 1;
    return {
      up: this.keys.has("KeyW"),
      down: this.keys.has("KeyS"),
      left: this.keys.has("KeyA"),
      right: this.keys.has("KeyD"),
      shoot: this.mouseDown,
      aimX: worldMouseX,
      aimY: worldMouseY,
      sequence: this.sequence
    };
  }

  getMouseScreenPosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  private onKeyDown = (event: KeyboardEvent): void => {
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

  private onMouseDown = (): void => {
    this.mouseDown = true;
  };

  private onMouseUp = (): void => {
    this.mouseDown = false;
  };
}
