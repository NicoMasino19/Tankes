import { type InputState, type AbilitySlot as AbilitySlotValue } from "@tankes/shared";
export declare class InputController {
    private readonly canvas;
    private readonly keys;
    private mouseX;
    private mouseY;
    private leftMouseDown;
    private sequence;
    private readonly abilityTriggers;
    constructor(canvas: HTMLCanvasElement);
    dispose(): void;
    buildInput(worldMouseX: number, worldMouseY: number): InputState;
    consumeAbilityTriggers(): AbilitySlotValue[];
    getMouseScreenPosition(): {
        x: number;
        y: number;
    };
    private onKeyDown;
    private onKeyUp;
    private onMouseMove;
    private onMouseDown;
    private onMouseUp;
    private onContextMenu;
}
