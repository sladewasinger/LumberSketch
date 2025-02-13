export interface UndoableCommand {
    execute(): void;
    undo(): void;
}
