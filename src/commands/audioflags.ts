import { getAudioFlagDecorationType, getAudioFlagStorage } from "../extension";
import {
	Position,
	Selection,
	TextEditor,
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
let audioFlagPositions: number[] = [];
let lineCount: number | undefined = undefined;

// Event listener to update audio flag positions upon lines being added/removed from the active document
workspace.onDidChangeTextDocument(event => {
    // Get the new line count after the change was made.
    let newLineCount = event.document.lineCount;

    // If the previous line count is undefined then extension is probably starting up. In this case we will assign the line count var for the first time.
    // TODO: this is really jank. should make this more robust at some point.
    if (!lineCount)
    {
        lineCount = newLineCount;
        return;
    }

    // If the new line count differs from the previous line count then we will adjust the audio flag positions.
    if (newLineCount !== lineCount)
    {
        // Get the line where the change was made.
        let start: number = event.contentChanges[0].range.start.line;

        // For every audio flag that is positioned on a line after the change, we will update it's position.
        audioFlagPositions.forEach((lineNum, index) => {
            if (lineNum >= start && lineCount)
            {
                audioFlagPositions[index] = lineNum + (newLineCount - lineCount);
            }
        });

        // Update the line count.
        lineCount = newLineCount;

        // Update the audio flag decorations now that their positions have changed.
        updateAudioFlagDecorations();
    }
})

// Event listener to update audio flag decorations on text editor change.
window.onDidChangeActiveTextEditor(event => {
    if (event) {
        let audioFlagStorage = getAudioFlagStorage();
        
        // This shouldn't happen, but we will check if the storage is undefined so that Typescript doesn't complain.
        if (audioFlagStorage === undefined)
        {
            outputErrorMessage("AudioFlag: Storage Error");
            return;
        }

        // Get the audio flag positions for the current document
        let document = event.document.fileName;
        let positions = audioFlagStorage.getValue(document);

        if (positions === undefined)
        {
            // If there is no array of positions saved for this document, we will create a new one and save it in storage.
            audioFlagPositions = [];
            audioFlagStorage.setValue(document, audioFlagPositions);
        }
        else
        {
            // Set the positions from storage.
            audioFlagPositions = positions;
        }

        lineCount = event.document.lineCount;
        updateAudioFlagDecorations();
    }
});


export function addAudioFlag(): void {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        outputErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }
    
    // Throw error if there is already an audio flag on the active line.
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

    // Throw error an audio flag isn't on the active line.
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
    
    const flagRange: Range[] = [];
    audioFlagPositions.forEach(line => {
        flagRange.push(new Range(line, 0, line, 1));
    });

    let decoration = getAudioFlagDecorationType();
    
    // This shouldn't happen, but we will check if the decoration type is null so that Typescript doesn't complain.
    if (decoration === undefined)
    {
        outputErrorMessage("AudioFlag: Decoration Icon Error");
        return;
    }
    
    editor.setDecorations(decoration, flagRange)
}

export class AudioFlagStorage {
    constructor(private storage: Memento) { }

    public getValue(key: string) : number[] | undefined {
        return this.storage.get<number[]>(key);
    }

    public setValue<T>(key: string, value: number[]) {
        this.storage.update(key, value);
    }
}