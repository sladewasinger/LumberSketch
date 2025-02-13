import { UndoableCommand } from "./UndoableCommand";

export class UndoRedoExecutor {
    private static undoStack: UndoableCommand[] = [];
    private static redoStack: UndoableCommand[] = [];

    static executeCommand(command: UndoableCommand): void {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = [];
    }

    static undo(): void {
        const command = this.undoStack.pop();
        if (command) {
            command.undo();
            this.redoStack.push(command);
        }
    }

    static redo(): void {
        const command = this.redoStack.pop();
        if (command) {
            command.execute();
            this.undoStack.push(command);
        }
    }
}