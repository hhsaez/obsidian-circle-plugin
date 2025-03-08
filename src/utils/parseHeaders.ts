import { TFile } from "obsidian";

export interface Node {
    level: number;
    title: string;
    children: Node[];
}

function buildHeaderHierarchy(headers: Node[]): Node[] {
    if (headers.length === 0) {
        return [];
    }

    const result: Node[] = [];
    let currentParents = [{ level: 0, title: "root", children: result }];
    for (const header of headers) {
        while (currentParents[currentParents.length - 1].level >= header.level) {
            currentParents.pop();
        }
        currentParents[currentParents.length - 1].children.push(header);
        currentParents.push(header);
    }
    return result;
}

export function parseHeaders(markdown: string) {
    const lines = markdown.split("\n");
    const headers: Node[] = [];

    const headerRegex = /^(#{1,6})\s+(.+)$/;

    for (const line of lines) {
        const match = line.match(headerRegex);
        if (match) {
            const level = match[1].length;
            const title = match[2];
            headers.push({ level, title, children: [] });
        }
    }

    // TODO: We can use inline metadata to give each header a unique ID
    return buildHeaderHierarchy(headers);
}

export async function parseFileHeaders(file: TFile) {
    const markdownFile = await this.app.vault.getAbstractFileByPath(file) as TFile;
    const markdown = await this.app.vault.read(markdownFile);
    return parseHeaders(markdown);
}
