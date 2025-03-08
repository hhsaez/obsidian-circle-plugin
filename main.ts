import { Plugin } from 'obsidian';

export default class CirclePlugin extends Plugin {
	async onLoad() {
		console.log("Circle Plugin Loaded");
	}

	onunload(): void {
		console.log("Circle Plugin Unloaded");
	}
}
