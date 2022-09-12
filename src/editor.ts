
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
        const header = "CS50 Lab";
        const options: vscode.MessageOptions = { detail: 'Open as CS50 Lab?', modal: true };
        vscode.window.showInformationMessage(header, options, ...["OK"]).then((item)=>{
            if (item === 'OK') {
                this.labViewHandler({path: document['fileName']});
            } else {
                try {
                    vscode.window.showTextDocument(document);
                } catch (error) {
                    console.error(error);
                }
            }
        });
    }
}
