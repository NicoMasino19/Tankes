import type { InputState } from "@tankes/shared";
export declare class InputController {
    private readonly canvas;
    private readonly keys;
    private mouseX;
    private mouseY;
    private mouseDown;
    private sequence;
    constructor(canvas: HTMLCanvasElement);
    dispose(): void;
    buildInput(worldMouseX: number, worldMouseY: number): InputState;
    getMouseScreenPosition(): {
        x: number;
        y: number;
    };
    private onKeyDown;
    private onKeyUp;
    private onMouseMove;
    private onMouseDown;
    private onMouseUp;
}
