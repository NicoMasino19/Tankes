export class InputController {
    canvas;
    keys = new Set();
    mouseX = 0;
    mouseY = 0;
    mouseDown = false;
    sequence = 0;
    constructor(canvas) {
        this.canvas = canvas;
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("mousedown", this.onMouseDown);
        window.addEventListener("mouseup", this.onMouseUp);
    }
    dispose() {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        this.canvas.removeEventListener("mousedown", this.onMouseDown);
        window.removeEventListener("mouseup", this.onMouseUp);
    }
    buildInput(worldMouseX, worldMouseY) {
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
    getMouseScreenPosition() {
        return { x: this.mouseX, y: this.mouseY };
    }
    onKeyDown = (event) => {
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
    onMouseDown = () => {
        this.mouseDown = true;
    };
    onMouseUp = () => {
        this.mouseDown = false;
    };
}
//# sourceMappingURL=InputController.js.map