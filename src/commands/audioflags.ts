import { audioFlagDecorationType } from "../extension";
import {
	Position,
	Selection,
	TextEditor,
	TextLine,
	window,
	workspace,
    Range,
    TextEditorDecorationType
} from "vscode";
import { CommandEntry } from "./commandEntry";

export const audioFlagCommands: CommandEntry[] = [
    {
        name: "mind-reader.addAudioFlag",
        callback: addAudioFlag,
        undo: undoAddAudioFlag
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
 *  @returns editor!.selection.active.line + 1
 */
 export function fetchLineNumber(editor: TextEditor | undefined): number {
    return editor!.selection.active.line + 1; // line numbers start at 1, not 0, so we add 1 to the result
}


// Set to store the audio flag positions
export let audioFlagPositions: number[] = [];
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
    if (audioFlagPositions.indexOf(fetchLineNumber(editor)) !== -1) {
        outputErrorMessage("AddAudioFlag: Prexisting Audio Flag Present");
        return;
    }

    // Add the audio flag to the position set.
    audioFlagPositions.push(fetchLineNumber(editor));
    audioFlagPositions.sort();

    // Update the audio flag decorations.
    updateAudioFlagDecorations();

    editor.revealRange(editor.selection, 1); // Make sure cursor is within range
    window.showTextDocument(editor.document, editor.viewColumn); // You are able to type without reclicking in document
}

function undoAddAudioFlag(): void {
    // honestly not convinced that this callback function is ever invoked, but im keeping it around just in case.
}

export function deleteAudioFlag(): void {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        outputErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }
    
    const index = audioFlagPositions.indexOf(fetchLineNumber(editor));

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
    
    // TODO: fix issue where if a flag set on the last line, the cursor will sometimes be incorrectly moved to it instead of the next one in the document.
    audioFlagPositions.forEach(lineNum => {
        if (lineNum-1 > currentLine)
        {
            const lastCharacter = editor.document.lineAt(lineNum-1).text.length;
            let newPosition = new Position(lineNum-1, lastCharacter); // Assign new position to audio flag

            const newSelection = new Selection(newPosition, newPosition);
            editor.selection = newSelection; // Apply change to editor

            editor.revealRange(editor.selection, 1); // Make sure cursor is within range
            window.showTextDocument(editor.document, editor.viewColumn); // You are able to type without reclicking in document
            return;
        }
    });
}

// Helper function that updates the audio flag decorations for the active editor
export function updateAudioFlagDecorations() {
    const editor: TextEditor | undefined = window.activeTextEditor;

    if (!editor) {
        return;
    }
    
    const flagRange: Range[] = [];
    audioFlagPositions.forEach(line => {
        flagRange.push(new Range(line - 1, 0, line - 1, 1));
    });

    editor.setDecorations(audioFlagDecorationType, flagRange)
}