import { AbilitySlot } from "@tankes/shared";
export class InputController {
    canvas;
    keys = new Set();
    mouseX = 0;
    mouseY = 0;
    leftMouseDown = false;
    sequence = 0;
    abilityTriggers = [];
    constructor(canvas) {
        this.canvas = canvas;
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("mousedown", this.onMouseDown);
        canvas.addEventListener("contextmenu", this.onContextMenu);
        window.addEventListener("mouseup", this.onMouseUp);
    }
    dispose() {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        this.canvas.removeEventListener("mousedown", this.onMouseDown);
        this.canvas.removeEventListener("contextmenu", this.onContextMenu);
        window.removeEventListener("mouseup", this.onMouseUp);
    }
    buildInput(worldMouseX, worldMouseY) {
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
    consumeAbilityTriggers() {
        if (this.abilityTriggers.length === 0) {
            return [];
        }
        const triggers = [...this.abilityTriggers];
        this.abilityTriggers.length = 0;
        return triggers;
    }
    getMouseScreenPosition() {
        return { x: this.mouseX, y: this.mouseY };
    }
    onKeyDown = (event) => {
        if (!this.keys.has(event.code)) {
            if (event.code === "Digit1") {
                this.abilityTriggers.push(AbilitySlot.Slot1);
            }
            else if (event.code === "Digit2") {
                this.abilityTriggers.push(AbilitySlot.Slot2);
            }
            else if (event.code === "Digit3") {
                this.abilityTriggers.push(AbilitySlot.Ultimate);
            }
        }
        this.keys.add(event.code);
    };
    onKeyUp = (event) => {
        this.keys.delete(event.code);
    };
    onMouseMove = (event) => {
        const rect = this.canvas.getBoundingClientRect();
        this.mouseX = event.clientX - rect.left;
        this.mouseY = event.clientY - rect.top;
    };
    onMouseDown = (event) => {
        if (event.button === 0) {
            this.leftMouseDown = true;
            return;
        }
        if (event.button === 2) {
            event.preventDefault();
            this.abilityTriggers.push(AbilitySlot.RightClick);
        }
    };
    onMouseUp = (event) => {
        if (event.button === 0) {
            this.leftMouseDown = false;
        }
    };
    onContextMenu = (event) => {
        event.preventDefault();
    };
}
//# sourceMappingURL=InputController.js.map