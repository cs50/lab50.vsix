
import * as vscode from 'vscode';


export class LabEditorProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext, labViewHandler): vscode.Disposable {
        const provider = new LabEditorProvider(context, labViewHandler);
        const providerRegistration = vscode.window.registerCustomEditorProvider(LabEditorProvider.viewType, provider);
        return providerRegistration;
    }

    private static readonly viewType = 'lab50.editor';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly labViewHandler: any
    ) { }

    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {
        this.labViewHandler({path: document['fileName']});
    }
}
