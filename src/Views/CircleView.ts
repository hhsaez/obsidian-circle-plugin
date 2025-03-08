import { IconName, MarkdownView, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { Node, parseFileHeaders, parseHeaders } from "src/utils/parseHeaders";

export const VIEW_TYPE_CIRCLE = "circle-view";

interface SelectableSection {
    startAngle: number;
    endAngle: number;
    innerRadius: number;
    outerRadius: number;
    title: string;
    centerX: number;
    centerY: number;
};

export class CircleView extends MarkdownView {
    private canvas: HTMLCanvasElement | undefined;
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
            this.redraw();
        }
        return super.setState(state, result);
    }

    private sectionHitboxes: Array<SelectableSection> = [];
    private selectedSection: SelectableSection | undefined;

    async onOpen() {
        this.containerEl.empty();
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.display = "block";
        this.containerEl.appendChild(this.canvas);

        this.canvas.addEventListener("click", (ev: MouseEvent) => this.handleCanvasClick(ev));

        this.registerEvent(this.app.workspace.on("resize", () => {
            this.resizeCanvas();
        }));

        this.registerEvent(this.app.workspace.on("layout-change", () => {
            this.resizeCanvas();
        }));
    }

    // Add this method to handle clicks
    private handleCanvasClick(event: MouseEvent) {
        const canvas = event.target as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Calculate distance and angle from center
        for (const section of this.sectionHitboxes) {
            const { centerX, centerY, startAngle, endAngle, innerRadius, outerRadius, title } = section;

            // Calculate distance from center
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Check if click is within the ring segment
            if (distance >= innerRadius && distance <= outerRadius) {
                // Calculate angle in radians
                let angle = Math.atan2(dy, dx);
                if (angle < 0) angle += 2 * Math.PI; // Convert to 0-2π range

                // Check if angle is within section's arc
                let inArc = false;
                if (startAngle <= endAngle) {
                    inArc = angle >= startAngle && angle <= endAngle;
                } else {
                    // Handle case where arc crosses 0°
                    inArc = angle >= startAngle || angle <= endAngle;
                }

                if (inArc) {
                    // set the selected section
                    this.selectedSection = section;
                    this.redraw();
                    return;
                }
            }
        }

        // If we clicked outside of any section, clear the selection
        if (this.selectedSection) {
            this.selectedSection = undefined;
            // Redraw without the selection
            this.redraw();
        }
    }

    protected async onClose(): Promise<void> {
        this.containerEl.empty();
    }

    private redraw() {
        if (this.canvas && this.root) {
            this.drawCircleVisualization(this.canvas, this.root);
        }
    }

    private resizeCanvas() {
        if (!this.canvas) {
            return;
        }

        const { clientWidth, clientHeight } = this.containerEl;
        if (this.canvas.width === clientWidth && this.canvas.height === clientWidth) {
            // Only resize if dimensions have actually changed.
            return;
        }

        this.canvas.width = Math.max(100, clientWidth);
        this.canvas.height = Math.max(100, clientHeight);

        this.redraw();
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
        const maxRadius = Math.min(width, height) / 2 * 0.95; // leave some padding
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
        // ctx.beginPath();
        // ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        // ctx.strokeStyle = "#333";
        // ctx.lineWidth = 1.5;
        // ctx.stroke();

        // Draw sectiosn for each children
        const anglePerChild = (endAngle - startAngle) / node.children.length;

        for (let i = 0; i < node.children.length; ++i) {
            const child = node.children[i];
            const childStartAngle = startAngle + (anglePerChild * i);
            const childEndAngle = childStartAngle + anglePerChild;
            const midAngle = childStartAngle + (anglePerChild / 2);
            const innerRadius = depth === 0 ? radiusStep * 0.5 : radiusStep * depth;
            const innerEndX = centerX + innerRadius * Math.cos(childEndAngle);
            const innerEndY = centerY + innerRadius * Math.sin(childEndAngle);

            // Check if this section is selected
            const isSelected = this.selectedSection &&
                this.selectedSection.startAngle === childStartAngle &&
                this.selectedSection.endAngle === childEndAngle
            this.selectedSection?.innerRadius === innerRadius &&
                this.selectedSection?.outerRadius === radius;

            // Draw section arc, but only from inner radius to outer radius (as a ring segment)
            ctx.beginPath();

            // Draw the outer arc
            ctx.arc(centerX, centerY, radius, childStartAngle, childEndAngle);

            // Draw line to inner point
            ctx.lineTo(innerEndX, innerEndY);

            // Draw the innerarc (in counter-clockwise direction)
            ctx.arc(centerX, centerY, innerRadius, childEndAngle, childStartAngle, true);

            // Close the path
            ctx.closePath();

            // Fill and stroke
            ctx.fillStyle = colors[colorIndex] + "80"; // 50% opacity
            ctx.fill();
            ctx.strokeStyle = isSelected ? "000" : "#333";
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.stroke();

            // Draw text label
            const textRadius = radius - (radiusStep * 0.35);
            const textAngle = midAngle;
            const textX = centerX + textRadius * Math.cos(textAngle);
            const textY = centerY + textRadius * Math.sin(textAngle);

            // Calculate the available width for the text
            // We estimate how much arc length we have available
            const arcLength = anglePerChild * textRadius;

            // Don't render text if the arc is too small
            // Minimum size for readable text (empirically determined)
            const MIN_ARC_LENGTH = 40;

            if (arcLength >= MIN_ARC_LENGTH) {
                ctx.save();
                ctx.font = "12px Arial";
                ctx.fillStyle = "#000";

                // Determine text rotation based on position in the circle
                if (textAngle > Math.PI / 2 && textAngle < Math.PI * 3 / 2) {
                    ctx.translate(textX, textY);
                    ctx.rotate(textAngle + Math.PI);
                    ctx.textAlign = "center";
                    // Calculate max text width - estimate based on arc size
                    const maxWidth = Math.min(arcLength * 0.8, 100);
                    // Draw text with possible line breaks
                    this.drawArcText(ctx, child.title, 0, 0, maxWidth);
                } else {
                    ctx.translate(textX, textY);
                    ctx.rotate(textAngle);
                    ctx.textAlign = "center";

                    // Calculate max text width - estimate based on arc size
                    const maxWidth = Math.min(arcLength * 0.8, 100);
                    this.drawArcText(ctx, child.title, 0, 0, maxWidth);
                }
                ctx.restore();
            }

            // Store hitbox information for interaction
            this.sectionHitboxes.push({
                startAngle: childStartAngle,
                endAngle: childEndAngle,
                innerRadius: innerRadius,
                outerRadius: radius,
                title: child.title,
                centerX: centerX,
                centerY: centerY
            });

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

    private drawArcText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number) {
        // For very short text, just try to show the first few characters
        if (maxWidth < 40 && text.length > 6) {
            ctx.fillText(text.substring(0, 5) + "...", x, y);
            return;
        }

        // For normal arcs, try to break text into lines if needed
        const words = text.split(' ');
        const lineHeight = 14;
        let lines = [];
        let currentLine = "";

        // Create lines that fit within maxWidth
        for (let i = 0; i < words.length; ++i) {
            const testLine = currentLine + (currentLine ? " " : "") + words[i];
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && i > 0) {
                lines.push(currentLine);
                currentLine = words[i];
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        // Limit to 2 lines at most in arc segments to avoid overlapping
        if (lines.length > 2) {
            lines = lines.slice(0, 2);
            lines[1] = lines[1] + "...";
        }

        // Draw lines centered vertically around the original y position
        const totalHeight = lines.length * lineHeight;
        let lineY = y - (totalHeight / 2) + (lineHeight / 2);

        for (const line of lines) {
            ctx.fillText(line, x, lineY);
            lineY += lineHeight;
        }
    }

}

