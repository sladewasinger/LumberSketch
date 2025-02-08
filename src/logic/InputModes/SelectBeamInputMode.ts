import { EVENT_BEAM_DESELECTED, EVENT_BEAM_SELECTED } from "../../events/Constants";
import { eventBus } from "../../events/EventBus";
import { AppState } from "../AppState";
import { Beam } from "../Beam";
import { BeamManager } from "../BeamManager";
import { InputMode } from "./InputMode";
import * as THREE from "three";

export class SelectBeamInputMode extends InputMode {
    appState: AppState;
    mouse1Down = false;

    constructor() {
        super();
        this.appState = AppState.getInstance();
        document.body.style.cursor = 'pointer';
    }

    onMouseMove(event: MouseEvent): void {
        const beam = this.appState.selectedBeam;
        if (!beam || !this.mouse1Down) return;

        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        rayCaster.ray.intersectPlane(groundPlane, intersection);
        beam.position.copy(intersection);
    }

    onMouseDown(event: MouseEvent): void {
        if (event.button !== 0) return;
        this.mouse1Down = true;

        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);
        const intersects = rayCaster.intersectObjects(this.appState.beams, false);

        if (intersects.length > 0) {
            const beam = intersects[0].object as Beam;
            this.appState.selectedBeam = beam;
            eventBus.emit(EVENT_BEAM_SELECTED, beam);
        } else {
            this.appState.selectedBeam = null;
        }
    }

    onMouseUp(event: MouseEvent): void {
        if (event.button !== 0) return;
        this.mouse1Down = false;
        eventBus.emit(EVENT_BEAM_DESELECTED);
    }

    destroy(): void {
        document.body.style.cursor = 'default';
    }
}