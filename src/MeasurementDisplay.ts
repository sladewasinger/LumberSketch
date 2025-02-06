// src/MeasurementDisplay.ts
export class MeasurementDisplay {
    private element: HTMLElement;

    constructor(element: HTMLElement) {
        this.element = element;
    }

    public update(text: string): void {
        this.element.innerText = text;
    }

    public clear(): void {
        this.element.innerText = '';
    }
}
