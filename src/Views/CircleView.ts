import { IconName, MarkdownView, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { Node, parseFileHeaders, parseHeaders } from "src/utils/parseHeaders";

export const VIEW_TYPE_CIRCLE = "circle-view";

export class CircleView extends MarkdownView {
    private root: Node | undefined;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_CIRCLE;
    }

    getDisplayText(): string {
        return "Circle";
    }

    getIcon(): IconName {
        return "circle"; // built-in icon
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state.file) {
            const markdownFile = this.app.vault.getAbstractFileByPath(state.file) as TFile;
            const markdown = await this.app.vault.read(markdownFile);
            const children = parseHeaders(markdown);
            this.root = { level: 0, title: markdownFile.basename || "Root", children: children };
            this.render();
        }
        return super.setState(state, result);
    }

    async onOpen() {
        this.render();
    }

    protected async onClose(): Promise<void> {
        this.containerEl.empty();
    }

    private render() {
        this.containerEl.empty();
        if (!this.root) {
            this.containerEl.createEl("p", { text: "No file selected" });
            return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 600;
        this.containerEl.appendChild(canvas);

        this.drawCircleVisualization(canvas, this.root);
    }

    private drawCircleVisualization(canvas: HTMLCanvasElement, root: Node) {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        const { width, height } = canvas;
        const [centerX, centerY] = [width / 2, height / 2];

        ctx.clearRect(0, 0, width, height);

        // Draw Background
        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(0, 0, width, height);

        // Calculate max depth to determine circle spacing
        const maxDepth = this.findMaxDepth(root);
        const maxRadius = Math.min(width, height) / 2 * 0.90; // leave some padding
        const radiusStep = maxDepth > 1 ? maxRadius / maxDepth : maxRadius;

        // Color palette for different levels
        const colors = [
            '#e57373', // Root/File (red)
            '#81c784', // H1 (green)
            '#64b5f6', // H2 (blue)
            '#ffb74d', // H3 (orange)
            '#ba68c8', // H4 (purple)
            '#4db6ac', // H5 (teal)
            '#fff176'  // H6 (yellow)
        ];

        // Draw file innermost circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radiusStep * 0.5, 0, 2 * Math.PI);
        ctx.fillStyle = colors[0];
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw file title in the center
        ctx.font = "bold 16px Arial";
        ctx.fillStyle = "#333";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Draw potentially long text in center (wrapped if needed)
        this.drawWrappedText(ctx, root.title, centerX, centerY, radiusStep * 0.5);

        // Draw Header circles, starting from level 1 (H1)
        this.drawHeaderCircles(ctx, root, centerX, centerY, radiusStep, colors);
    }

    private findMaxDepth(node: Node): number {
        if (!node.children || node.children.length === 0) {
            return 1;
        }

        let maxChildDepth = 0;
        for (const child of node.children) {
            maxChildDepth = Math.max(maxChildDepth, this.findMaxDepth(child));
        }
        return maxChildDepth + 1;
    }

    private drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
        const words = text.split(' ');
        const lineHeight = 20;
        let line = '';
        let lineY = y - (words.length > 1 ? lineHeight / 2 : 0);

        for (let i = 0; i < words.length; ++i) {
            const testLine = line + words[i] + " ";
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && i > 0) {
                ctx.fillText(line, x, lineY);
                line = words[i] + " ";
                lineY += lineHeight;
            } else {
                line = testLine;
            }
        }

        ctx.fillText(line, x, lineY);
    }

    private drawHeaderCircles(
        ctx: CanvasRenderingContext2D,
        node: Node,
        centerX: number,
        centerY: number,
        radiusStep: number,
        colors: string[],
        depth = 0,
        startAngle = 0,
        endAngle = 2 * Math.PI) {
        if (!node.children || node.children.length === 0) {
            return;
        }

        const radius = radiusStep * (depth + 1);
        const nextLevel = depth + 1;
        const colorIndex = Math.min(nextLevel, colors.length - 1);

        // Draw the circle ouline for this level
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw sectiosn for each children
        const anglePerChild = (endAngle - startAngle) / node.children.length;

        for (let i = 0; i < node.children.length; ++i) {
            const child = node.children[i];
            const childStartAngle = startAngle + (anglePerChild * i);
            const childEndAngle = childStartAngle + anglePerChild;
            const midAngle = childStartAngle + (anglePerChild / 2);

            // Draw section arc, but only from inner radius to outer radius (as a ring segment)
            ctx.beginPath();

            // Draw the outer arc
            ctx.arc(centerX, centerY, radius, childStartAngle, childEndAngle);

            // Draw line to inner point
            const innerRadius = depth === 0 ? radiusStep * 0.5 : radiusStep * depth;
            const innerEndX = centerX + innerRadius * Math.cos(childEndAngle);
            const innerEndY = centerY + innerRadius * Math.sin(childEndAngle);
            ctx.lineTo(innerEndX, innerEndY);

            // Draw the innerarc (in counter-clockwise direction)
            ctx.arc(centerX, centerY, innerRadius, childEndAngle, childStartAngle, true);

            // Close the path
            ctx.closePath();

            // Fill and stroke
            ctx.fillStyle = colors[colorIndex] + "80"; // 50% opacity
            ctx.fill();
            ctx.strokeStyle = "#333";
            ctx.stroke();

            // Draw text label
            const textRadius = radius - (radiusStep * 0.35);
            const textAngle = midAngle;
            const textX = centerX + textRadius * Math.cos(textAngle);
            const textY = centerY + textRadius * Math.sin(textAngle);

            ctx.save();
            ctx.font = "12px Arial";
            ctx.fillStyle = "#000";

            // Determine text rotation based on position in the circle
            if (textAngle > Math.PI / 2 && textAngle < Math.PI * 3 / 2) {
                ctx.translate(textX, textY);
                ctx.rotate(textAngle + Math.PI);
                ctx.textAlign = "center";
                ctx.fillText(child.title, 0, 0);
            } else {
                ctx.translate(textX, textY);
                ctx.rotate(textAngle);
                ctx.textAlign = "center";
                ctx.fillText(child.title, 0, 0);
            }
            ctx.restore();

            this.drawHeaderCircles(
                ctx,
                child,
                centerX,
                centerY,
                radiusStep,
                colors,
                depth + 1,
                childStartAngle,
                childEndAngle
            );
        }
    }

}

