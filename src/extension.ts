import * as vscode from "vscode";
import * as pl from "./pylex";
import CommandNodeProvider from "./commandNodeProvider";
import Logger from "./log";
import { installer } from "./pythonManager";
import path = require("path");
import * as ev3 from "./ev3/src/extension";
import {toggleLineHighlight, highlightDeactivate} from "./commands/lineHighlighter";
import { setShouldSpeak } from "./commands/text";
import { initializeDocument, updateAudioFlagDecorations, AudioFlagStorage } from "./commands/audioflags";
import {
	accessCommands,
	hubCommands,
	navCommands,
	textCommands,
	voicetotextCommands,
	TTSCommand,
	lineHighlightercommands,
	voiceCommands,
	audioFlagCommands
} from "./commands";
import { Configuration } from "./util";

//import { runClient } from "./client";

// Output Logger
const product: string = vscode.workspace
	.getConfiguration("mind-reader")
	.get("productType")!;
const outputChannel = vscode.window.createOutputChannel(product + " Output");
export const logger = new Logger(outputChannel);

let parser: pl.Parser = new pl.Parser();
let audioFlagDecorationType: vscode.TextEditorDecorationType | undefined = undefined;
let audioFlagStorage: AudioFlagStorage | undefined = undefined;
export const rootDir = path.dirname(__filename);
export function activate(context: vscode.ExtensionContext) {
	let config = new Configuration(context);

	//python packages installer
	installer();

	//runClient(serverModule);

	parser.parse("Beep Boop");

	const allCommands = [
		accessCommands,
		hubCommands,
		navCommands,
		textCommands,
		TTSCommand,
		lineHighlightercommands,
		voiceCommands,
		audioFlagCommands
	].flat(1);

	voicetotextCommands.forEach((command) => {
		context.subscriptions.push(
			vscode.commands.registerTextEditorCommand(
				command.name,
				command.callback,
			),
		);
	});

	// Register Commands
	allCommands.forEach((command) => {
		context.subscriptions.push(
			vscode.commands.registerCommand(command.name, command.callback),
		);
	});

	let accessProvider = new CommandNodeProvider(
		[accessCommands].flat(1),
	);
	vscode.window.registerTreeDataProvider("accessActions", accessProvider);

	let textProvider = new CommandNodeProvider(
		[textCommands, lineHighlightercommands].flat(1)
	);
	vscode.window.registerTreeDataProvider("textActions", textProvider);

	let audioFlagProvider = new CommandNodeProvider(audioFlagCommands);
	vscode.window.registerTreeDataProvider("audioFlagActions", audioFlagProvider);

	let hubProvider = new CommandNodeProvider(hubCommands);
	vscode.window.registerTreeDataProvider("hubActions", hubProvider);

	ev3.activate(context);
	toggleLineHighlight();
	setShouldSpeak();

	// Initialize AudioFlagStorage
	audioFlagStorage = new AudioFlagStorage(context.workspaceState);

	// Create the audio flag decoration.
	audioFlagDecorationType = vscode.window.createTextEditorDecorationType({
		gutterIconPath: context.asAbsolutePath("/media/audioflagicon.png"),
		gutterIconSize: "contain"
	});

	// Check if a text document is already open and if it is initialize it.
	const documents = vscode.workspace.textDocuments;
	if (documents.length >= 1) {
		initializeDocument(documents[0]);
	}

	// Update the audio flag decorations.
	updateAudioFlagDecorations();

	vscode.window.showInformationMessage("Mind Reader finished loading!");
}

const ttsStatusBar: vscode.StatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    1000
  );
  ttsStatusBar.command = "mind-reader.toggleTTS";
  ttsStatusBar.text = "$(megaphone) Text-to-Speech";
  ttsStatusBar.show();


export function deactivate() {}
highlightDeactivate();


// Helper functions to get extension context level audio flag stuff.
export function getAudioFlagDecorationType(): vscode.TextEditorDecorationType | undefined {
	return audioFlagDecorationType;
}

export function getAudioFlagStorage(): AudioFlagStorage | undefined {
	return audioFlagStorage;
}

function clearAudioFlagStorage() {
	if (audioFlagStorage !== undefined)
	{
		audioFlagStorage.getKeys().forEach((key) => {
			audioFlagStorage!.setValue(key, undefined);
		});
	}
}