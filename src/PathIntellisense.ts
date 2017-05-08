import { CompletionItemProvider, TextDocument, Position, CompletionItem, workspace, Range } from 'vscode';
import { isImportOrRequire, getTextWithinString, importStringRange } from './utils/text-parser';
import { getPath, extractExtension, Mapping } from './utils/fs-functions';
import { PathCompletionItem } from './completionItems/PathCompletionItem';
import { UpCompletionItem } from './completionItems/UpCompletionItem';
import { getConfig, Config } from './utils/config';

interface Request {
    config?: Config,
    fileName?: string,
    textCurrentLine?: string,
    textWithinString?: string,
    importRange?: Range,
    isImport?: boolean,
    documentExtension?: string
}

export class PathIntellisense implements CompletionItemProvider {
    
    private config: Config;

    constructor(private getChildrenOfPath: Function) {
        this.config = getConfig();
        workspace.onDidChangeConfiguration(() => this.config = getConfig());
        
    }
    
    provideCompletionItems(document: TextDocument, position: Position): Thenable<CompletionItem[]> {
        const textCurrentLine = document.getText(document.lineAt(position).range);

        const request: Request = {
            config: this.config,
            fileName: document.fileName,
            textCurrentLine,
            textWithinString: getTextWithinString(textCurrentLine, position.character),
            importRange: importStringRange(textCurrentLine, position),
            isImport: isImportOrRequire(textCurrentLine),
            documentExtension: extractExtension(document)
        };
        
        return this.shouldProvide(request) ? this.provide(request) : Promise.resolve([]);
    }

    shouldProvide(request: Request) {
        const typedAnything = request.textWithinString && request.textWithinString.length > 0;
        const startsWithDot = typedAnything && request.textWithinString[0] === '.';
        const startsWithMapping = typedAnything && request.config.mappings.some(mapping => request.textWithinString.indexOf(mapping.key) === 0);

        if (request.isImport && (startsWithDot || startsWithMapping)) {
            return true;
        }

        if (!request.isImport && typedAnything) {
            return true;
        }

        return false;
    }

    provide(request: Request) {
        const path = getPath(request.fileName, request.textWithinString, request.config.mappings);
        
        return this.getChildrenOfPath(path, request.config).then(children => ([
            new UpCompletionItem(),
            ...children.map(child => new PathCompletionItem(child, request.importRange, request.isImport, request.documentExtension, request.config))
        ]));
    }
}