export declare class StartScreen {
    readonly element: HTMLDivElement;
    private readonly input;
    private readonly button;
    private readonly helperText;
    constructor(onPlay: (nickname: string) => void);
    hide(): void;
    show(): void;
    setLoading(loading: boolean): void;
}
