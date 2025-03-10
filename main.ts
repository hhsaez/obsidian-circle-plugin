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

		this.addCommand({
			id: "circle-create-child-header",
			name: "Create child header form selected section",
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(CircleView);
				if (activeView) {
					if (!checking && !activeView.isEditingActive()) {
						activeView.createChildHeader();
					}
					return true;
				}
			},
			// hotkeys: [
			// 	{
			// 		modifiers: ["Shift", "Ctrl"],
			// 		key: "Enter",
			// 	}
			// ]
		});

		this.addCommand({
			id: "circle-create-sibling-header",
			name: "Create sibling header form selected section",
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(CircleView);
				if (activeView) {
					if (!checking && !activeView.isEditingActive()) {
						activeView.createSiblingHeader();
					}
					return true;
				}
				return false;
			},
			// hotkeys: [
			// 	{
			// 		modifiers: ["Shift"],
			// 		key: "Enter",
			// 	}
			// ]
		});

		this.addCommand({
			id: "circle-edit-header",
			name: "Edit selected header",
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(CircleView);
				if (activeView) {
					if (!checking) {
						if (!activeView.isEditingActive()) {
							activeView.showEditInput();
						} else {
							activeView.commitChanges();
						}
					}
					return true;
				}
				return false;
			},
			// hotkeys: [
			// 	{
			// 		modifiers: [],
			// 		key: "Enter",
			// 	}
			// ]
		});

		this.addCommand({
			id: "circle-submit",
			name: "Submit current action",
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(CircleView);
				if (activeView && activeView.isEditingActive()) {
					if (!checking) {
						activeView.commitChanges();
					}
					return false;
				}
				return false;
			},
			// hotkeys: [
			// 	{
			// 		modifiers: [],
			// 		key: "Enter",
			// 	}
			// ]
		});

		this.addCommand({
			id: "circle-cancel",
			name: "Cancel current actions",
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(CircleView);
				if (activeView) {
					if (!checking) {
						activeView.cancelChanges();
					}
					return true;
				}
				return false;
			},
			// hotkeys: [
			// 	{
			// 		modifiers: [],
			// 		key: "Escape",
			// 	}
			// ]
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
