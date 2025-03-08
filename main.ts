import { FileView, Notice, Plugin } from 'obsidian';
import { CircleView, VIEW_TYPE_CIRCLE } from 'src/Views/CircleView';

export default class CirclePlugin extends Plugin {
	async onload() {
		console.log("Circle Plugin Loaded");

		this.registerView(VIEW_TYPE_CIRCLE, (leaf) => new CircleView(leaf));

		this.addCommand({
			id: "toggle-circle-view",
			name: "Toggle Circle View",
			callback: () => this.toggleCircleView(),
		});
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CIRCLE);

		console.log("Circle Plugin Unloaded");
	}

	private async toggleCircleView() {
		const { workspace } = this.app;
		const leaf = workspace.getLeaf();
		if (!leaf) {
			new Notice("No active file to visualize");
			return;
		}

		const currentView = leaf.view;
		const currentFilePath = currentView instanceof FileView ? currentView.file?.path : null;
		if (!currentFilePath) {
			new Notice("No active file to visualize");
			return;
		}

		if (leaf.view.getViewType() === VIEW_TYPE_CIRCLE) {
			await leaf.setViewState({ type: "markdown", state: { file: currentFilePath } })
		} else {
			await leaf.setViewState({ type: VIEW_TYPE_CIRCLE, state: { file: currentFilePath } })
		}
	}
}
