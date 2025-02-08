// src/BeamManager.ts
import * as THREE from 'three';
import { Beam } from './Beam';
import { eventBus } from '../events/EventBus';
import { EVENT_BEAM_DESELECTED, EVENT_BEAM_SELECTED } from '../events/Constants';
import { AppState } from './AppState';

export class BeamManager {
    private beamsGroup: THREE.Group;

    constructor() {
        const appState = AppState.getInstance();
        const scene = appState.scene;

        this.beamsGroup = new THREE.Group();
        scene.add(this.beamsGroup);

        eventBus.on(EVENT_BEAM_SELECTED, (beam: Beam) => {
            beam.isSelected = true;
        });
        eventBus.on(EVENT_BEAM_DESELECTED, () => {
            for (let child of this.beamsGroup.children) {
                let beam = child as Beam;
                beam.isSelected = false;
            }
        });
    }

    public addBeam(beam: Beam): void {
        this.beamsGroup.add(beam);
    }

    public removeBeam(beam: Beam) {
        this.beamsGroup.remove(beam);
    }

    public getBeamsGroup(): THREE.Group {
        return this.beamsGroup;
    }
}
