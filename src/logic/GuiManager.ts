import { EVENT_GUI_INPUT_MODE_CHANGED } from "../events/Constants";
import { eventBus } from "../events/EventBus";
import { AppState, GuiInputMode } from "./AppState";

export class GuiManager {
    appState: AppState;

    placeBeamButton: HTMLButtonElement;
    selectBeamButton: HTMLButtonElement;
    cutBeamButton: HTMLButtonElement;

    constructor() {
        this.appState = AppState.getInstance();
        if (!this.appState.container)
            throw new Error("Container not initialized");

        this.placeBeamButton = document.getElementById("place-beam-btn") as HTMLButtonElement;
        this.selectBeamButton = document.getElementById("select-beam-btn") as HTMLButtonElement;
        this.cutBeamButton = document.getElementById("cut-beam-btn") as HTMLButtonElement;

        this.placeBeamButton.addEventListener("click", () => {
            this.changeInputMode(this.placeBeamButton, "place-beam");
        });
        this.selectBeamButton.addEventListener("click", () => {
            this.changeInputMode(this.selectBeamButton, "select-beam");
        });
        this.cutBeamButton.addEventListener("click", () => {
            this.changeInputMode(this.cutBeamButton, "cut-beam");
        });

        window.addEventListener("keydown", this.onKeyDown.bind(this));
    }

    onKeyDown(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        switch (key) {
            case "1":
                this.changeInputMode(this.placeBeamButton, "place-beam");
                break;
            case "2":
                this.changeInputMode(this.selectBeamButton, "select-beam");
                break;
            case "3":
                this.changeInputMode(this.cutBeamButton, "cut-beam");
                break;
        }
    }

    changeInputMode(btn: HTMLButtonElement, mode: GuiInputMode) {
        if (this.appState.guiState.inputMode === mode) {
            this.appState.guiState.inputMode = null;
            this.removeButtonActive(btn);
            eventBus.emit(EVENT_GUI_INPUT_MODE_CHANGED);
            return;
        }

        this.appState.guiState.inputMode = mode;
        this.markButtonActive(btn);
        eventBus.emit(EVENT_GUI_INPUT_MODE_CHANGED);
    }

    markButtonActive(button: HTMLButtonElement) {
        button.classList.add("active");

        const otherButtons = [this.placeBeamButton, this.selectBeamButton, this.cutBeamButton].filter((b) => b !== button);
        for (const otherButton of otherButtons) {
            this.removeButtonActive(otherButton);
        }
    }

    removeButtonActive(button: HTMLButtonElement) {
        button.classList.remove("active");
    }
}