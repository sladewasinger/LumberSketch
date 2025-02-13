export abstract class InputMode {
    onMouseDown(event: MouseEvent): void { }
    onMouseMove(event: MouseEvent): void { };
    onMouseUp(event: MouseEvent): void { };
    onKeyDown(event: KeyboardEvent): void { };
    onKeyUp(event: KeyboardEvent): void { };

    abstract destroy(): void;
}
