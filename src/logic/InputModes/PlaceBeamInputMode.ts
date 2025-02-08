import { AppState } from "../AppState";
import { Beam } from "../Beam";
import { InputMode } from "./InputMode";
import * as THREE from "three";

export class PlaceBeamInputMode extends InputMode {
    private appState: AppState;
    private ghostBeam: Beam;

    constructor() {
        super();

        this.appState = AppState.getInstance();

        this.ghostBeam = new Beam({ length: 8 * 12, height: 1.5, depth: 3.5 });
        this.ghostBeam.setOpacity(0.5);
        this.appState.scene.add(this.ghostBeam);
    }

    onMouseMove(event: MouseEvent): void {
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const rayCaster = new THREE.Raycaster();
        rayCaster.setFromCamera(this.appState.mousePos, this.appState.camera);

        const mouseGroundIntersection = new THREE.Vector3();
        rayCaster.ray.intersectPlane(groundPlane, mouseGroundIntersection);

        this.ghostBeam.position.copy(mouseGroundIntersection);
    }

    onMouseDown(event: MouseEvent): void {
        if (event.button !== 0) return;

        const newBeam = this.ghostBeam.clone();
        this.appState.scene.add(newBeam);
        this.appState.beams.push(newBeam);
    }

    destroy(): void {
        this.appState.scene.remove(this.ghostBeam);
    }
}