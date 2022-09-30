
import * as vscode from 'vscode';
import * as fs from 'fs';

class LabMarkdown implements vscode.CustomDocument {
    uri: vscode.Uri;

    public constructor(uri: vscode.Uri) {
		this.uri = uri;
	}

    dispose(): void {
        return;
    }
}

export class LabEditorProvider implements vscode.CustomEditorProvider {

    public static register(labViewHandler): vscode.Disposable {
        const provider = new LabEditorProvider(labViewHandler);
        const providerRegistration = vscode.window.registerCustomEditorProvider(LabEditorProvider.viewType, provider);
        return providerRegistration;
    }

    private static readonly viewType = 'lab50.editor';

    constructor(private readonly labViewHandler: any) {}

    openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): vscode.CustomDocument | Thenable<vscode.CustomDocument> {
        if (!fs.existsSync(uri['fsPath'])) {
            fs.writeFileSync(uri['fsPath'], '');
        }
        return new LabMarkdown(uri);
    }

    resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        const header = "CS50 Lab";
        const options: vscode.MessageOptions = { detail: 'Open in CS50 Lab?', modal: true };
        vscode.window.showInformationMessage(header, options, ...["Yes"]).then(async (item)=>{
            if (item === 'Yes') {
                this.labViewHandler({path: document['uri']['path']});
            } else {
                try {
                    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                    vscode.window.showTextDocument(document['uri']);
                } catch (error) {
                    console.error(error);
                }
            }
        });
    }

    onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentEditEvent<vscode.CustomDocument>> | vscode.Event<vscode.CustomDocumentContentChangeEvent<vscode.CustomDocument>>;

    saveCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        throw new Error('Method not implemented.');
    }

    saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
        throw new Error('Method not implemented.');
    }

    revertCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
        throw new Error('Method not implemented.');
    }

    backupCustomDocument(document: vscode.CustomDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
        throw new Error('Method not implemented.');
    }
}
