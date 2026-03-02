export class StartScreen {
    element;
    input;
    button;
    helperText;
    constructor(onPlay) {
        this.element = document.createElement("div");
        this.element.className =
            "absolute inset-0 z-20 flex items-center justify-center bg-slate-950/95 px-4";
        const panel = document.createElement("div");
        panel.className = "w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl";
        const title = document.createElement("h1");
        title.className = "mb-5 text-2xl font-semibold text-slate-100";
        title.textContent = "Tankes";
        this.input = document.createElement("input");
        this.input.className =
            "mb-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-500 focus:ring";
        this.input.placeholder = "Nickname";
        this.input.maxLength = 16;
        this.button = document.createElement("button");
        this.button.className =
            "w-full rounded-md bg-cyan-500 px-3 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400";
        this.button.textContent = "Play";
        this.helperText = document.createElement("div");
        this.helperText.className = "mt-2 text-center text-xs text-slate-400";
        this.helperText.textContent = "Join and survive the round.";
        this.button.addEventListener("click", () => {
            onPlay(this.input.value.trim());
        });
        this.input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                onPlay(this.input.value.trim());
            }
        });
        panel.append(title, this.input, this.button, this.helperText);
        this.element.append(panel);
    }
    hide() {
        this.element.style.display = "none";
    }
    show() {
        this.element.style.display = "flex";
        this.setLoading(false);
    }
    setLoading(loading) {
        this.button.disabled = loading;
        this.input.disabled = loading;
        this.button.classList.toggle("opacity-70", loading);
        this.button.textContent = loading ? "Connecting..." : "Play";
    }
}
//# sourceMappingURL=StartScreen.js.map