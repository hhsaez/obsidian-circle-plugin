import { FileView, IconName, MarkdownView, Notice, Plugin } from 'obsidian';

const VIEW_TYPE_CIRCLE = "circle-view";

class CircleView extends MarkdownView {
	getViewType(): string {
		return VIEW_TYPE_CIRCLE;
	}

	getDisplayText(): string {
		return "Circle";
	}

	getIcon(): IconName {
		return "circle"; // built-in icon
	}

	async onOpen() {
		this.containerEl.empty();
		const canvas = document.createElement("canvas");
		canvas.width = 600;
		canvas.height = 600;
		this.containerEl.appendChild(canvas);
		const ctx = canvas.getContext("2d");
		if (ctx) {
			this.drawCircle(ctx);
		}
	}

	protected async onClose(): Promise<void> {
		this.containerEl.empty();
	}

	private drawCircle(ctx: CanvasRenderingContext2D) {
		ctx.fillStyle = "#ccc";
		ctx.beginPath();
		ctx.arc(300, 300, 200, 0, 2 * Math.PI);
		ctx.fill();
	}
}

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
