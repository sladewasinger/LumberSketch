import { UndoableCommand } from "../../UndoRedo/UndoableCommand";
import { Beam } from "../Beam";

export class GenericBeamCommand implements UndoableCommand {
    constructor(
        private executeFn: () => void,
        private undoFn: () => void,
    ) { }

    execute(): void {
        this.executeFn();
    }

    undo(): void {
        this.undoFn();
    }
}