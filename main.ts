import { MarkdownView, Plugin } from 'obsidian';

const VIEW_TYPE_CIRCLE = "circle-view";

class CircleView extends MarkdownView {
	getViewType(): string {
		return VIEW_TYPE_CIRCLE;
	}

	getDisplayText(): string {
		return "Circle";
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

		this.addCommand({
			id: "toggle-circle-view",
			name: "Toggle Circle View",
			callback: () => this.toggleCircleView(),
		});
	}

	onunload(): void {
		console.log("Circle Plugin Unloaded");
	}

	private toggleCircleView() {
		const { workspace } = this.app;
		const activeLeaf = workspace.getLeaf();
		if (!activeLeaf) {
			return;
		}

		if (activeLeaf.getViewState().type === VIEW_TYPE_CIRCLE) {
			workspace.setActiveLeaf(workspace.getLeaf(true));
		} else {
			workspace.getLeaf(true).setViewState({ type: VIEW_TYPE_CIRCLE });
		}
	}
}
