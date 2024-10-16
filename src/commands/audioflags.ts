import { getAudioFlagDecorationType, /*getAudioFlagStorage*/ } from "../extension";
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


// Set to store the audio flag positions
//let audioFlagPositions: number[] = [];
let openDocuments = new Map<string, Document>();
//let lineCount: number | undefined = undefined;

// Event listener to update audio flag positions upon lines being added/removed from the active document
workspace.onDidChangeTextDocument(event => {
    // Get open document and check for errors.
    const document = openDocuments.get(event.document.fileName);
    if (document === undefined) {
        outputErrorMessage("AudioFlag: File Initialization Error");
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
    if (event) {
        updateAudioFlagDecorations();
    }
});

workspace.onDidSaveTextDocument(event => {
    if (event)
    {
        // This stuff is commented out because we don't need it at this very moment, but probably will upon expanding functionality later.
        /*
        // Update the storage
        const storage = getAudioFlagStorage();
        const document = event.fileName;

        if (storage!.getKeys().indexOf(document) !== -1)
        {
            storage!.setValue(document, audioFlagPositions);
        }*/
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

    // Get the open document and check for errors.
    const document = openDocuments.get(editor.document.fileName);
    if (document === undefined) {
        outputErrorMessage("AudioFlag: File Initialization Error");
        return;
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

    // Get the open document and check for errors.
    const document = openDocuments.get(editor.document.fileName);
    if (document === undefined) {
        outputErrorMessage("AudioFlag: File Initialization Error");
        return;
    }

    const audioFlagPositions = document.getAudioFlagPos();
    
    const flagRange: Range[] = [];
    audioFlagPositions.forEach(line => {
        flagRange.push(new Range(line, 0, line, 1));
    });

    const decoration = getAudioFlagDecorationType();
    
    // This shouldn't happen, but we will check if the decoration type is null so that Typescript doesn't complain.
    if (decoration === undefined)
    {
        outputErrorMessage("AudioFlag: Decoration Icon Error");
        return;
    }
    
    editor.setDecorations(decoration, flagRange)
}

// This stuff is commented out because we don't need it at this very moment, but probably will upon expanding functionality later.
/*export class AudioFlagStorage {
    constructor(private storage: Memento) { }

    public getValue(key: string) : number[] | undefined {
        return this.storage.get<number[]>(key);
    }

    public setValue(key: string, value: number[] | undefined) {
        this.storage.update(key, value);
    }

    public getKeys(): readonly string[] {
        return this.storage.keys();
    }
}*/

export function initializeAllDocuments(docs: readonly TextDocument[]) {
    // For each text document, we will initialize it in the openDocuments map.
    docs.forEach(document => {
        const name = document.fileName;
        const lines = document.lineCount;
        openDocuments.set(name, new Document(name, lines));
    });
}

/**
 * A class representing an open document. It contains a file name, line count, and an array consisting of audio flag line positions.
 */
class Document {
    private fileName: string;
    private lineCount: number;
    private audioFlagPositions: number[];

    constructor(file: string, lines: number) {
        this.fileName = file;
        this.lineCount = lines;
        this.audioFlagPositions = [];
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