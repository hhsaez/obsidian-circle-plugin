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
    private markdownFile: TFile | undefined;
    private canvas: HTMLCanvasElement | undefined;
    private root: Node | undefined;

    private sectionHitboxes: Array<SelectableSection> = [];
    private selectedSection: SelectableSection | undefined;

    private editingInput: HTMLInputElement | null = null;
    private editStartNode: Node | null = null;

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
            this.markdownFile = this.app.vault.getAbstractFileByPath(state.file) as TFile;
            const markdown = await this.app.vault.read(this.markdownFile);
            const children = parseHeaders(markdown);
            this.root = { level: 0, title: this.markdownFile.basename || "Root", children: children };
            this.redraw();
        }
        return super.setState(state, result);
    }

    async onOpen() {
        this.containerEl.empty();
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.display = "block";
        this.containerEl.appendChild(this.canvas);

        this.canvas.addEventListener("click", (ev: MouseEvent) => this.handleCanvasClick(ev));

        // Add keyboard event listener for navigation
        // Use tabIndex to make the canvas focusable
        this.canvas.tabIndex = 0;
        this.canvas.addEventListener("keydown", (ev: KeyboardEvent) => this.handleKeyDown(ev));

        this.registerEvent(this.app.workspace.on("resize", () => {
            this.resizeCanvas();
        }));

        this.registerEvent(this.app.workspace.on("layout-change", () => {
            this.resizeCanvas();
        }));

        // Focus on canvas after initialization
        requestAnimationFrame(() => this.canvas?.focus());
    }

    protected async onClose(): Promise<void> {
        // Remove the input element if it exists
        this.editingInput?.remove();
        this.editingInput = null;

        // Cleanup
        this.containerEl.empty();
    }

    // Handle keyboard navigation
    private handleKeyDown(event: KeyboardEvent) {
        if (!this.canvas || !this.root) {
            return;
        }

        if (!this.selectedSection) {
            // if nothing is selected yet, select the first section if available
            if (["ArrowDown", "ArrowRight"].includes(event.key) && this.sectionHitboxes.length > 0) {
                this.selectedSection = this.sectionHitboxes[0];
                this.redraw();
            }
            return;
        }

        const { startAngle, endAngle, innerRadius, outerRadius } = this.selectedSection;
        switch (event.key) {
            case "ArrowRight":
                this.navigateHorizontally(1);
                break;
            case "ArrowLeft":
                this.navigateHorizontally(-1);
                break;
            case "ArrowUp":
                this.navigateVertically(1);
                break;
            case "ArrowDown":
                this.navigateVertically(-1);
                break;
        }
    }

    public createChildHeader(): void {
        if (this.selectedSection) {
            this.showCreateHeaderInput("child");
        }
    }

    public createSiblingHeader(): void {
        if (this.selectedSection) {
            this.showCreateHeaderInput("sibling");
        }
    }

    private showCreateHeaderInput(mode: "child" | "sibling") {
        console.log("showCreateHEaderInput", mode);
        if (!this.selectedSection || !this.canvas) {
            return;
        }

        // Fin the corresponding node in our hierarchy
        const selectedNode = this.findNodeBySection(this.root!, this.selectedSection.title);
        if (!selectedNode) {
            console.error("Could not find node for selected section");
            return;
        }

        this.editStartNode = selectedNode;

        // Create or reuse input element
        if (!this.editingInput) {
            this.editingInput = document.createElement("input");
            this.editingInput.type = "text";
            this.editingInput.className = "circle-edit-input";

            // Style the input
            Object.assign(this.editingInput.style, {
                position: "absolute",
                boxSizing: "border-box",
                padding: "4px 8px",
                background: "rgba(255, 255, 255, 0.9)",
                border: "2px solid var(--interactive-accent)",
                borderRadius: "4px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                fontSize: "14px",
                color: "#000",
                zIndex: "100",
            });

            // Store the mode explicitly for later use
            this.editingInput.dataset.mode = mode;

            this.containerEl.appendChild(this.editingInput);
        }

        const { centerX, centerY, startAngle, endAngle, innerRadius, outerRadius } = this.selectedSection;

        // Calculate optimal position for the input
        // For child headers, position it a bit deeper
        // For siblings, position it at the same level but to the side
        let textRadius, midAngle;

        if (mode === "child") {
            // For child: position deeper than parent
            textRadius = outerRadius + (outerRadius - innerRadius) * 0.35;
            midAngle = (startAngle + endAngle) / 2;
        } else {
            // For sibling: position at same level but to the right
            textRadius = (outerRadius - (outerRadius - innerRadius) * 0.35);
            midAngle = endAngle + 0.1; // Just to the right of this section
        }

        const textX = centerX + textRadius * Math.cos(midAngle);
        const textY = centerY + textRadius * Math.sin(midAngle);

        // Get canvas bounds relative to the window
        const canvasRect = this.canvas.getBoundingClientRect();

        // Use pixel coordinates relative to the container
        const inputLeft = canvasRect.left + textX;
        const inputTop = canvasRect.top + textY;

        // Set a placeholder according to the mode
        this.editingInput.value = "";
        this.editingInput.placeholder = mode === "child"
            ? "New child header..."
            : "New sibling header...";

        // Calculate width
        const width = 150; // Fixed width for new header input

        // Position the input centered on the calculated point
        Object.assign(this.editingInput.style, {
            left: `${inputLeft - width / 2}px`,
            top: `${inputTop - 15}px`, // Offset to center vertically
            width: `${width}px`
        });

        // Store the creation mode for later use
        this.editingInput.dataset.mode = mode;

        // Show and focus the input
        this.editingInput.style.display = "block";
        this.editingInput.focus();
    }

    // Create a new header based on the provided mode
    private async createNewHeader(mode: "child" | "sibling") {
        if (!this.editingInput || !this.editStartNode) {
            this.hideEditInput();
            return;
        }

        const newTitle = this.editingInput.value.trim();
        if (!newTitle) {
            // Empty title, just hide input
            this.hideEditInput();
            return;
        }

        try {
            // Determine the new header's level
            let newLevel: number;
            if (mode === "child") {
                newLevel = this.editStartNode.level + 1;
            } else { // sibling
                newLevel = this.editStartNode.level;
            }

            // Create the new header in the markdown file
            await this.insertNewHeader(newLevel, newTitle, this.editStartNode, mode);

            // Hide input
            this.hideEditInput();

            // Refresh the view to show the new header
            if (this.markdownFile) {
                const markdown = await this.app.vault.read(this.markdownFile);
                const children = parseHeaders(markdown);
                this.root = { level: 0, title: this.markdownFile.basename || "Root", children: children };

                // Clear section hitboxes before redrawing
                this.sectionHitboxes = [];
                this.redraw();

                if (mode === "child") {
                    // Selet the first child of the previously selected node
                    const parentNode = this.findNodeBySection(this.root, this.editStartNode.title);
                    if (parentNode && parentNode.children && parentNode.children.length > 0) {
                        // Find the newly added child (should be the one with our title)
                        const newChildNode = parentNode.children.find(child => child.title === newTitle);
                        if (newChildNode) {
                            // Find its section hitboxes
                            const newSection = this.sectionHitboxes.find(section => section.title === newTitle);
                            if (newSection) {
                                this.selectedSection = newSection;
                                this.redraw();
                            }
                        }
                    }
                } else if (mode === "sibling") {
                    // Try to select the newly created sibling
                    const newSection = this.sectionHitboxes.find(section => section.title === newTitle);
                    if (newSection) {
                        this.selectedSection = newSection;
                        this.redraw();
                    }
                }
            }
        } catch (error) {
            console.error("Failed to create new header:", error);
            this.hideEditInput();
        }
    }

    // Insert a new header into the markdown file
    private async insertNewHeader(level: number, title: string, relativeTo: Node, mode: "child" | "sibling") {
        const file = this.markdownFile;
        if (!file) {
            console.error("No active file to update");
            throw new Error("No active file");
        }

        try {
            // Read the file content
            console.log(`Creating new ${mode} header with title: "${title}"`);
            const content = await this.app.vault.read(file);
            const lines = content.split("\n");

            // Find the position to insert the new header
            const headerPrefix = "#".repeat(relativeTo.level) + " ";
            let insertPosition = -1;

            // Find the position of the reference node
            for (let i = 0; i < lines.length; ++i) {
                const line = lines[i];
                if (line.startsWith(headerPrefix) && line.substring(headerPrefix.length).trim() === relativeTo.title) {
                    insertPosition = i;
                    break;
                }
            }

            if (insertPosition === -1) {
                throw new Error(`Could not find relative header "${relativeTo.title}" in file`);
            }

            // For a child, we insert right after the reference header
            // For a sibling, we need to find where the next header of the same or lower level appears
            if (mode === "child") {
                insertPosition++; // Insert right after the parent header
            } else {
                // For siblings, we need to find where the current section ends
                // We look for the next header with same or lower level
                let nextSectionStart = lines.length;
                for (let i = insertPosition + 1; i < lines.length; ++i) {
                    const line = lines[i];
                    if (line.startsWith("#")) {
                        // Count the number of # characters
                        let count = 0;
                        while (line[count] === "#") count++;

                        if (count <= relativeTo.level) {
                            // Found next section of same or lower level
                            nextSectionStart = i;
                            break;
                        }
                    }
                }
                insertPosition = nextSectionStart;
            }

            // Create the new header line
            const newHeaderLine = "#".repeat(level) + " " + title;

            // Insert the new line
            lines.splice(insertPosition, 0, newHeaderLine);

            // Write the updated content back to the file
            const newContent = lines.join("\n");
            await this.app.vault.modify(file, newContent);

            console.log(`Created new ${mode} header at level ${level}: "${title}"`);
        } catch (error) {
            console.error("Failed to update file:", error);
            throw error;
        }
    }

    public isEditingActive(): boolean {
        return this.editingInput !== null && this.editingInput.style.display !== "none";
    }

    public commitChanges() {
        if (!this.editingInput) {
            return;
        }

        // TODO: add a proper mode enum
        const editingMode = this.editingInput.dataset.mode;
        switch (editingMode) {
            case "edit":
                this.saveEditChanges();
                break;
            case "sibling":
                this.createNewHeader("sibling");
                break;
            case "child":
                this.createNewHeader("child");
                break;
            default:
                break;
        }
    }

    public cancelChanges() {
        this.hideEditInput();
    }

    public showEditInput = () => {
        if (!this.selectedSection || !this.canvas) {
            return;
        }

        const { title, centerX, centerY, startAngle, endAngle, innerRadius, outerRadius } = this.selectedSection;

        // Fin the corresponding node in our hierarchy
        const selectedNode = this.findNodeBySection(this.root!, title);
        if (!selectedNode) {
            return;
        }

        this.editStartNode = selectedNode;

        // Create or reuse input element
        if (!this.editingInput) {
            this.editingInput = document.createElement("input");
            this.editingInput.type = "text";
            this.editingInput.className = "circle-edit-input";

            // Style the input
            Object.assign(this.editingInput.style, {
                position: "absolute",
                boxSizing: "border-box",
                padding: "4px 8px",
                background: "rgba(255, 255, 255, 0.9)",
                border: "2px solid var(--interactive-accent)",
                borderRadius: "4px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                fontSize: "14px",
                color: "#000",
                zIndex: "100",
            });

            this.containerEl.appendChild(this.editingInput);
        }

        // Set mode explicitly to avoid confusion
        this.editingInput.dataset.mode = "edit";

        // Calculate optimal position for the input
        // For text position, we use the same logic used for text rendering
        const textRadius = (outerRadius - (outerRadius - innerRadius) * 0.35);
        const midAngle = (startAngle + endAngle) / 2;
        const textX = centerX + textRadius * Math.cos(midAngle);
        const textY = centerY + textRadius * Math.sin(midAngle);

        // Get canvas bounds relative to the window
        const canvasRect = this.canvas.getBoundingClientRect();

        // Use pixel coordinates relative to the container
        const inputLeft = canvasRect.left + textX;
        const inputTop = canvasRect.top + textY;

        // Set input value and position
        this.editingInput.value = title;

        // Calculate width based on the context
        const minWidth = 100;
        const textWidth = title.length * 8; // rough estimate
        const width = Math.max(minWidth, Math.min(300, textWidth));

        // Position the input centered on the text point
        Object.assign(this.editingInput.style, {
            left: `${inputLeft - width / 2}px`,
            top: `${inputTop - 15}px`, // Offset to center vertically
            width: `${width}px`,
        });

        // Show and focus on the input
        this.editingInput.style.display = "block";
        this.editingInput.focus();
        this.editingInput.select(); // Select all text
    }

    private hideEditInput() {
        if (this.editingInput) {
            this.editingInput.style.display = "none";
            this.canvas?.focus(); // Return focus to the canvas

            // Make sure our edit mode variables are reset
            this.editingInput.dataset.mode = "";
        }

        // Make sure we clear the edit state
        this.editStartNode = null;
    }

    private async saveEditChanges() {
        if (!this.editingInput || !this.editStartNode || !this.selectedSection) {
            this.hideEditInput();
            return;
        }

        const newTitle = this.editingInput.value.trim();
        if (!newTitle || newTitle === this.editStartNode.title) {
            // No changes or empty title, just hide the input
            this.hideEditInput();
            return;
        }

        try {
            // Update the markdown file
            await this.updateMarkdownFile(this.editStartNode, newTitle);

            // Update the node title
            this.editStartNode.title = newTitle;

            // Update the selected section title
            this.selectedSection.title = newTitle;

            // Hide input and redraw visualization
            this.hideEditInput();
            this.redraw();
        } catch (error) {
            console.error("Failed to update hedar: ", error);
            // TODO: we should show a notice to the user
            this.hideEditInput();
        }
    }

    private findNodeBySection(node: Node, title: string): Node | null {
        if (node.title === title) {
            return node;
        }

        if (node.children) {
            for (const child of node.children) {
                const found = this.findNodeBySection(child, title);
                if (found) {
                    return found;
                }
            }
        }

        return null;
    }

    // TODO: Could this be simpler if we keep the line number of the header in the node?
    // TODO: How do we handle duplicate headers?
    // TODO: How do we handle inline metadata or tags in the header?
    private async updateMarkdownFile(node: Node, newTitle: string) {
        // Get the current file
        const file = this.markdownFile;// this.app.workspace.getActiveFile();
        if (!file) {
            console.error("No active file to update");
            return;
        }

        try {

            // Read the file content
            const content = await this.app.vault.read(file);
            const lines = content.split("\n");

            // Find the header line with the matching title
            let headerLine = -1;
            const headerPrefix = "#".repeat(node.level) + " ";
            for (let i = 0; i < lines.length; ++i) {
                const line = lines[i];
                if (line.startsWith(headerPrefix) && line.substring(headerPrefix.length).trim() === node.title) {
                    headerLine = i;
                    break;
                }
            }

            if (headerLine >= 0) {
                // Update the line
                lines[headerLine] = headerPrefix + newTitle;

                // Write the updated content back to the file
                const newContent = lines.join("\n");
                await this.app.vault.modify(file, newContent);

                // Maybe update the view to reflect changes?
            }

        } catch (error) {
            console.error("Failed to update file: ", error);
            throw error; // rethrow the error
        }
    }

    // Navigate between sections at the same level (left/right)
    private navigateHorizontally(direction: number) {
        if (!this.selectedSection) {
            return;
        }

        // Find sections at the same level (same inner and outer radius)
        const sameLevelSections = this.sectionHitboxes.filter(section =>
            section.innerRadius === this.selectedSection!.innerRadius &&
            section.outerRadius === this.selectedSection!.outerRadius
        );

        if (sameLevelSections.length <= 1) {
            // No other sections at this level
            return;
        }

        // Find the index of the current section in the filtered list
        const currentIndex = sameLevelSections.findIndex(section =>
            section.startAngle === this.selectedSection!.startAngle &&
            section.endAngle === this.selectedSection!.endAngle
        );

        if (currentIndex === -1) {
            return;
        }

        // Calculate the next index with wrap-around
        const nextIndex = (currentIndex + direction + sameLevelSections.length) % sameLevelSections.length;

        // Select the new section
        this.selectedSection = sameLevelSections[nextIndex];
        this.redraw();
    }

    // Navigate deeper into the hierarchy or back up (down/up)
    private navigateVertically(direction: number) {
        if (!this.selectedSection) {
            return;
        }

        if (direction > 0) {
            // Moving deeper (down)
            // Find child sections (sections whose arc is contained within the current section's arc)
            const childSections = this.sectionHitboxes.filter(section =>
                // Check if this section is at the next level down
                Math.abs(section.innerRadius - this.selectedSection!.outerRadius) < 1 &&
                // Check if this section is contained within the arc of the current section
                section.startAngle >= this.selectedSection!.startAngle &&
                section.endAngle < this.selectedSection!.endAngle
            );
            if (childSections.length > 0) {
                // Find the child section that's most centered within th current section's arc
                const currentMidAngle = (this.selectedSection!.startAngle + this.selectedSection!.endAngle) / 2;
                let bestChild = childSections[0];
                let bestDiff = Math.abs(bestChild.startAngle + bestChild.endAngle) / 2 - currentMidAngle;

                for (const child of childSections) {
                    const childMidAngle = (child.startAngle + child.endAngle) / 2;
                    const diff = Math.abs(childMidAngle - currentMidAngle);
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestChild = child;
                    }
                }

                this.selectedSection = bestChild;
                this.redraw();
            }
        } else {
            // Moving outward (up)
            // Find parent section (section whose arc contains the current section's arc)
            const parentSections = this.sectionHitboxes.filter(section =>
                Math.abs(section.outerRadius - this.selectedSection!.innerRadius) < 1 &&
                section.startAngle <= this.selectedSection!.startAngle &&
                section.endAngle >= this.selectedSection!.endAngle
            );

            if (parentSections.length > 0) {
                // Just take the first parent (there should usually be only one).
                this.selectedSection = parentSections[0];
                this.redraw();
            }
        }
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

        // Clear out the hitboxes before redrawing
        this.sectionHitboxes = [];

        const { width, height } = canvas;
        const [centerX, centerY] = [width / 2, height / 2];

        ctx.clearRect(0, 0, width, height);

        // Draw Background
        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(0, 0, width, height);

        // Calculate max depth to determine circle spacing
        const maxDepth = this.findMaxDepth(root);
        const maxRadius = Math.max(width, height) / 2 * 0.95; // leave some padding
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
                this.selectedSection.endAngle === childEndAngle &&
                this.selectedSection.innerRadius === innerRadius &&
                this.selectedSection.outerRadius === radius;

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
            ctx.strokeStyle = isSelected ? "#000" : "#333";
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

