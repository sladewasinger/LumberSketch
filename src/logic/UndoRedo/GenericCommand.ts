import { UndoableCommand } from "./UndoableCommand";
import { Beam } from "../Beam/Beam";

export class GenericCommand implements UndoableCommand {
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