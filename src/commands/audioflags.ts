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
export let audioFlagPositions = new Set<number>();

export function addAudioFlag(): void {
    const editor: TextEditor | undefined = window.activeTextEditor;

    // Throw error if no editor open
    if (!editor) {
        outputErrorMessage("AddAudioFlag: No Active Editor");
        return;
    }
    
    // Throw error if there is already an audio flag on the active line.
    if (audioFlagPositions.has(fetchLineNumber(editor))) {
        outputErrorMessage("AddAudioFlag: Prexisting Audio Flag Present");
        return;
    }

    // Add the audio flag to the position set.
    audioFlagPositions.add(fetchLineNumber(editor));

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
    
    // Throw error an audio flag isn't on the active line.
    if (!audioFlagPositions.has(fetchLineNumber(editor))) {
        outputErrorMessage("DeleteAudioFlag: No Prexisting Audio Flag Present");
        return;
    }
    
    // Remove the audio flag from the position set.
    audioFlagPositions.delete(fetchLineNumber(editor));

    // Update the audio flag decorations.
    updateAudioFlagDecorations();

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
        flagRange.push(new Range(line - 1, 0, line - 1, 1));
    });

    editor.setDecorations(audioFlagDecorationType, flagRange)
}