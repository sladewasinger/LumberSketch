import { UndoableCommand } from "../../UndoRedo/UndoableCommand";
import * as THREE from 'three';
import { Beam } from "../Beam";

export class MoveBeamCommand implements UndoableCommand {
    constructor(
        private beam: Beam,
        private newPos: THREE.Vector3,
        private oldPos: THREE.Vector3,
    ) { }

    execute(): void {
        this.beam.position.copy(this.newPos);
    }

    undo(): void {
        this.beam.position.copy(this.oldPos);
    }
}