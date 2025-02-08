import { EVENT_GUI_CUT_BEAM_CLICKED, EVENT_GUI_PLACE_BEAM_CLICKED, EVENT_GUI_SELECT_BEAM_CLICKED } from "../events/Constants";
import { eventBus } from "../events/EventBus";
import { AppState } from "./AppState";

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

        this.placeBeamButton.addEventListener("click", (event) => {
            eventBus.emit(EVENT_GUI_PLACE_BEAM_CLICKED, event);
        });
        this.selectBeamButton.addEventListener("click", (event) => {
            eventBus.emit(EVENT_GUI_SELECT_BEAM_CLICKED, event);
        });
        this.cutBeamButton.addEventListener("click", (event) => {
            eventBus.emit(EVENT_GUI_CUT_BEAM_CLICKED, event);
        });
    }
}