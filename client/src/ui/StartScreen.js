export class StartScreen {
    element;
    input;
    button;
    helperText;
    constructor(onPlay) {
        this.element = document.createElement("div");
        this.element.className =
            "absolute inset-0 z-20 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),rgba(2,6,23,0.97)_50%)] px-4";
        const panel = document.createElement("div");
        panel.className =
            "w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/92 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.6)] backdrop-blur-sm";
        const eyebrow = document.createElement("div");
        eyebrow.className =
            "mb-2 inline-flex rounded-full border border-cyan-500/50 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-200";
        eyebrow.textContent = "Arena Online";
        const title = document.createElement("h1");
        title.className = "mb-2 text-4xl font-black tracking-tight text-slate-100";
        title.textContent = "Tankes";
        const subtitle = document.createElement("p");
        subtitle.className = "mb-5 text-sm text-slate-300";
        subtitle.textContent = "Entrá al round, mejorá stats y elegí habilidades en vivo.";
        const featureStrip = document.createElement("div");
        featureStrip.className = "mb-5 grid grid-cols-3 gap-2 text-[11px]";
        featureStrip.innerHTML =
            '<div class="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-cyan-100"><div class="font-black uppercase tracking-wide">Live</div><div class="mt-1 text-slate-300">Arena online</div></div>' +
                '<div class="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-100"><div class="font-black uppercase tracking-wide">Build</div><div class="mt-1 text-slate-300">Upgrades por nivel</div></div>' +
                '<div class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-100"><div class="font-black uppercase tracking-wide">Draft</div><div class="mt-1 text-slate-300">Elegí habilidades</div></div>';
        this.input = document.createElement("input");
        this.input.className =
            "mb-3 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-slate-100 outline-none ring-cyan-500 placeholder:text-slate-500 focus:ring";
        this.input.placeholder = "Nickname";
        this.input.maxLength = 16;
        this.button = document.createElement("button");
        this.button.className =
            "w-full rounded-lg bg-gradient-to-r from-cyan-400 to-sky-500 px-3 py-2 font-bold text-slate-950 transition hover:brightness-110";
        this.button.textContent = "Play";
        const controls = document.createElement("div");
        controls.className = "mt-4 grid grid-cols-2 gap-2 text-xs";
        controls.innerHTML =
            '<div class="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-slate-300"><span class="font-semibold text-slate-100">Move</span> WASD</div>' +
                '<div class="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-slate-300"><span class="font-semibold text-slate-100">Aim</span> Mouse</div>' +
                '<div class="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-slate-300"><span class="font-semibold text-slate-100">Shoot</span> Click</div>' +
                '<div class="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-slate-300"><span class="font-semibold text-slate-100">Abilities</span> RMB / 1 / 2 / 3</div>';
        const footerNote = document.createElement("div");
        footerNote.className =
            "mt-4 rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400";
        footerNote.innerHTML =
            '<span class="font-semibold uppercase tracking-wide text-cyan-200">Tip</span> Una vez adentro, usá ESC para abrir el menú de ayuda y audio sin pausar la partida.';
        this.helperText = document.createElement("div");
        this.helperText.className = "mt-4 text-center text-xs text-slate-400";
        this.helperText.textContent = "Objetivo: sobreviví 10 minutos, peleá por zonas y mantenete arriba del scoreboard.";
        this.button.addEventListener("click", () => {
            onPlay(this.input.value.trim());
        });
        this.input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                onPlay(this.input.value.trim());
            }
        });
        panel.append(eyebrow, title, subtitle, featureStrip, this.input, this.button, controls, footerNote, this.helperText);
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