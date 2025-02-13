// src/BeamManager.ts
import * as THREE from 'three';
import { Beam } from './Beam';
import { eventBus } from '../events/EventBus';
import { EVENT_BEAM_SELECTION_CHANGED } from '../events/Constants';
import { AppState } from './AppState';

export class BeamManager {
    private beamsGroup: THREE.Group;
    private appState: AppState;
    private beams: Beam[] = [];

    constructor() {
        this.appState = AppState.getInstance();
        const scene = this.appState.scene;

        this.beamsGroup = new THREE.Group();
        scene.add(this.beamsGroup);

        eventBus.on(EVENT_BEAM_SELECTION_CHANGED, () => {
            for (let beam of this.beams) {
                if (this.appState.selectedBeam !== null && this.appState.selectedBeam === beam) {
                    beam.isSelected = true;
                } else {
                    beam.isSelected = false;
                }
            }
        });
    }

    public addBeam(beam: Beam): void {
        this.beamsGroup.add(beam);
        this.beams.push(beam);
    }

    public deleteBeam(beam: Beam) {
        this.beamsGroup.remove(beam);
        const index = this.beams.indexOf(beam);
        if (index > -1) {
            this.beams.splice(index, 1);
        }
    }

    public getBeams(): Beam[] {
        return this.beams.slice(0); // Return a copy of the array
    }
}
