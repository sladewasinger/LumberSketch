import { EVENT_GUI_INPUT_MODE_CHANGED } from "../../events/Constants";
import { eventBus } from "../../events/EventBus";
import { AppState } from "../AppState";
import { BeamManager } from "../BeamManager";
import { InputMode } from "./InputMode";
import { PlaceBeamInputMode } from "./PlaceBeamInputMode";
import { SelectBeamInputMode } from "./SelectBeamInputMode";
import * as THREE from "three";

export class InputManager {
    appState: AppState;
    inputMode: InputMode | null = null;

    constructor(
        private beamManager: BeamManager,
    ) {
        this.appState = AppState.getInstance();
        if (!this.appState.container)
            throw new Error("Container not initialized");

        this.appState.container.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));

        eventBus.on(EVENT_GUI_INPUT_MODE_CHANGED, () => {
            switch (this.appState.guiState.inputMode) {
                case 'place-beam':
                    this.changeInputMode(new PlaceBeamInputMode(this.beamManager));
                    break;
                case 'select-beam':
                    this.changeInputMode(new SelectBeamInputMode(this.beamManager));
                    break;
                case 'cut-beam':
                    this.changeInputMode(null);
                    break;
                default:
                    this.changeInputMode(null);
                    break;
            }
        });
    }

    changeInputMode(mode: InputMode | null) {
        this.inputMode?.destroy();
        this.inputMode = mode;
    }

    onMouseDown(event: MouseEvent) {
        this.appState.mousePos.copy(new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        ));
        this.inputMode?.onMouseDown(event);
    }

    onMouseMove(event: MouseEvent) {
        this.appState.mousePos.copy(new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        ));

        this.inputMode?.onMouseMove(event);
    }

    onMouseUp(event: MouseEvent) {
        this.inputMode?.onMouseUp(event);
    }

    onKeyDown(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        this.appState.keysDown.add(event.key.toLowerCase());
        this.inputMode?.onKeyDown(event);
    }

    onKeyUp(event: KeyboardEvent) {
        const key = event.key.toLowerCase();

        this.appState.keysDown.delete(key);

        if (key === 'escape') {
            this.changeInputMode(new SelectBeamInputMode(this.beamManager));
        }
        this.inputMode?.onKeyUp(event);
    }
}