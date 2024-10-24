import { getAudioFlagDecorationType, getAudioFlagStorage } from "../extension";
import {
	Position,
	Selection,
	TextEditor,
    TextDocument,
	TextLine,
	window,
	workspace,
    Range,
    Memento,
    TextEditorDecorationType
} from "vscode";
import { CommandEntry } from "./commandEntry";

export const audioFlagCommands: CommandEntry[] = [
    {
        name: "mind-reader.addAudioFlag",
        callback: addAudioFlag
    },
    {
        name: "mind-reader.deleteAudioFlag",
        callback: deleteAudioFlag
    },
    {
        name: "mind-reader.moveToAudioFlag",
        callback: moveToAudioFlag
    }
];


export function outputErrorMessage(message:string) {
    window.showErrorMessage(message);
}

/** Helper Function
 ** This function returns the line number of the active text editor window
 *  @param editor
 *  @returns editor!.selection.active.line
 */
export function getLineNumber(editor: TextEditor | undefined): number {
    return editor!.selection.active.line;
}


// Map to store audio flags for each text document.
let openDocuments = new Map<string, Document>();

// Event listener to update audio flag positions upon lines being added/removed from the active document
workspace.onDidChangeTextDocument(event => {
    // Check if the current document has any audio flags in it. If it doesn't we will exit this function.
    const document = openDocuments.get(event.document.fileName);
    if (document === undefined) {
        return;
    }

    const lineCount = document.getLineCount();
    
    // Get the new line count after the change was made.
    const newLineCount = event.document.lineCount;

    // If the new line count differs from the previous line count then we will adjust the audio flag positions.
    if (newLineCount !== lineCount)
    {
        // Get the line where the change was made.
        const start: number = event.contentChanges[0].range.start.line;

        // For every audio flag that is positioned on a line after the change, we will update it's position.
        const audioFlagPositions = document.getAudioFlagPos();
        audioFlagPositions.forEach((lineNum, index) => {
            if (lineNum >= start && lineCount)
            {
                audioFlagPositions[index] = lineNum + (newLineCount - lineCount);
            }
        });

        // Update the line count.
        document.setLineCount(newLineCount);

        // Update the audio flag decorations now that their positions have changed.
        updateAudioFlagDecorations();
    }
})

// Event listener to update audio flag decorations on text editor change.
window.onDidChangeActiveTextEditor(event => {
    if (event && !event.document.isUntitled && openDocuments.get(event.document.fileName) === undefined)
    {
        initializeDocument(event.document);
    }

    updateAudioFlagDecorations();
});

// Event listener to save audio flags upon file save.
workspace.onDidSaveTextDocument(event => {
    if (event)
    {
        const name = event.fileName;
        const document = openDocuments.get(name);
        if (document !== undefined)
        {
            // Update the storage
            const storage = getAudioFlagStorage();
            storage!.setValue(name, document);
        }
    }
});

// Event listener to remove documents from the openDocuments map when they are closed.
workspace.onDidCloseTextDocument(event => {
    if (event)
    {
        openDocuments.delete(event.fileName);
    }
})


export function addAudioFlag(): void {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        outputErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }

    // Check if the document has been saved yet.
    if (editor.document.isUntitled) {
        outputErrorMessage("AudioFlag: Document must be saved before using audio flags!");
        return;
    }

    // Get the open document and check for errors.
    let document = openDocuments.get(editor.document.fileName);
    if (document === undefined) {
        document = new Document(editor.document.fileName, editor.document.lineCount);
        openDocuments.set(editor.document.fileName, document);
    }
    
    // Throw error if there is already an audio flag on the active line.
    const audioFlagPositions = document.getAudioFlagPos();
    if (audioFlagPositions.indexOf(getLineNumber(editor)) !== -1) {
        outputErrorMessage("AddAudioFlag: Prexisting Audio Flag Present");
        return;
    }

    // Add the audio flag to the position set and sort the set in numerical order.
    audioFlagPositions.push(getLineNumber(editor));
    audioFlagPositions.sort(function(a, b) {
        return a - b;
    });

    // Update the audio flag decorations.
    updateAudioFlagDecorations();

    editor.revealRange(editor.selection, 1); // Make sure cursor is within range
    window.showTextDocument(editor.document, editor.viewColumn); // You are able to type without reclicking in document
}

export function deleteAudioFlag(): void {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        outputErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }

    // Get the open document and check for errors.
    const document = openDocuments.get(editor.document.fileName);
    if (document === undefined) {
        outputErrorMessage("AudioFlag: File Initialization Error");
        return;
    }

    const audioFlagPositions = document.getAudioFlagPos();
    
    const index = audioFlagPositions.indexOf(getLineNumber(editor));

    // Throw error an audio flag isn't on the active line.
    if (index === -1) {
        outputErrorMessage("DeleteAudioFlag: No Prexisting Audio Flag Present");
        return;
    }
    
    // Remove the audio flag from the position set.
    audioFlagPositions.splice(index, 1);

    // Update the audio flag decorations.
    updateAudioFlagDecorations();

    editor.revealRange(editor.selection, 1); // Make sure cursor is within range
    window.showTextDocument(editor.document, editor.viewColumn); // You are able to type without reclicking in document
}

export function moveToAudioFlag(): void {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        outputErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }

    // Get the open document and check for errors.
    const document = openDocuments.get(editor.document.fileName);
    if (document === undefined) {
        outputErrorMessage("AudioFlag: File Initialization Error");
        return;
    }

    // Throw error if there are no audio flags in the file.
    const audioFlagPositions = document.getAudioFlagPos();
    if (audioFlagPositions.length === 0) {
        outputErrorMessage("MoveToAudioFlag: No Prexisting Audio Flag Present");
        return;
    }

    let currentLine = editor.selection.active.line; // Save previous position
    let flagLine;
    let lastCharacter;

    // Check if the cursor is already at or past the line number the last audio flag is on. If it is set the cursor to the first audio flag in the file.
    if (audioFlagPositions[audioFlagPositions.length - 1] <= currentLine)
    {
        flagLine = audioFlagPositions[0];
        lastCharacter = editor.document.lineAt(audioFlagPositions[0]).text.length;
    }
    else
    {
        for (let i = 0; i < audioFlagPositions.length; i++)
        {
            let lineNumber = audioFlagPositions[i];
            if (lineNumber > currentLine)
            {
                flagLine = lineNumber;
                lastCharacter = editor.document.lineAt(lineNumber).text.length;
                break;
            }
        }
    }

    // This should never happen, but we check if flagLiune and lastCharacter are undefined so Typescript doesn't complain.
    if (flagLine === undefined || lastCharacter === undefined)
    {
        outputErrorMessage("MoveToAudioFlag: Move Cursor Error");
        return;
    }

    // Move the cursor and whatnot.
    let newPosition = new Position(flagLine, lastCharacter); // Assign new position to audio flag
    const newSelection = new Selection(newPosition, newPosition);
    editor.selection = newSelection; // Apply change to editor

    editor.revealRange(editor.selection, 1); // Make sure cursor is within range
    window.showTextDocument(editor.document, editor.viewColumn); // You are able to type without reclicking in document
}

// Helper function that updates the audio flag decorations for the active editor
export function updateAudioFlagDecorations() {
    const editor: TextEditor | undefined = window.activeTextEditor;

    if (!editor) {
        return;
    }

    // This shouldn't happen, but we will check if the decoration type is null so that Typescript doesn't complain.
    const decoration = getAudioFlagDecorationType();
    if (decoration === undefined)
    {
        outputErrorMessage("AudioFlag: Decoration Icon Error");
        return;
    }

    // Check if the current document has any audio flags.
    const document = openDocuments.get(editor.document.fileName);
    if (document === undefined)
    {
        // If the document has no audio flags, we will set no lines to have the decoration.
        editor.setDecorations(decoration, []);
    }
    else
    {
        // Set the lines with audio flags to have the decoration.
        const audioFlagPositions = document.getAudioFlagPos();
    
        const flagRange: Range[] = [];
        audioFlagPositions.forEach(line => {
            flagRange.push(new Range(line, 0, line, 1));
        });
        
        editor.setDecorations(decoration, flagRange)
    }
}

export function initializeDocument(document: TextDocument) {
    if (!document.isUntitled)
    {
        const name = document.fileName;
        const storage = getAudioFlagStorage();
        const savedDocument = storage!.getValue(name);
        if (savedDocument !== undefined)
        {
            openDocuments.set(name, savedDocument);
        }
    }
}

/**
 * A class representing VS Code's Memento which is used for storing audio flags.
 */
export class AudioFlagStorage {
    constructor(private storage: Memento) { }

    public getValue(key: string) : Document | undefined {
        const value = this.storage.get<string>(key);
        if (value === undefined)
            return undefined;
        else
        {
            const data = JSON.parse(value);
            return new Document(data.fileName, data.lineCount, data.audioFlagPositions);
        }
    }

    public setValue(key: string, value: Document | undefined) {
        if (value === undefined)
            this.storage.update(key, undefined);
        else
            this.storage.update(key, JSON.stringify(value));
    }

    public getKeys(): readonly string[] {
        return this.storage.keys();
    }
}

/**
 * A class representing an open document. It contains a file name, line count, and an array consisting of audio flag line positions.
 */
class Document {
    private fileName: string;
    private lineCount: number;
    private audioFlagPositions: number[];

    constructor(file: string, lines: number, flags?: number[]) {
        this.fileName = file;
        this.lineCount = lines;
        this.audioFlagPositions = flags ?? [];
    }

    public getFileName(): string {
        return this.fileName;
    }

    public getLineCount(): number {
        return this.lineCount;
    }

    public setLineCount(lines: number) {
        this.lineCount = lines;
    }

    public getAudioFlagPos(): number[] {
        return this.audioFlagPositions;
    }
}