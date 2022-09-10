
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';
import { decode } from 'html-entities';
import { liquidEngine } from './engine';
import MarkdownIt = require('markdown-it');
import markdownItAttrs = require('markdown-it-attrs');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const CONFIG_FILE_NAME = 'README.md';           // Default config yml file name
    const LAB_WEBVIEW_SCRIPT = 'lab50.js';          // Script
    const LAB_WEBVIEW_STYLESHEET = 'lab50.css';     // Styleshet
    const STATIC_FOLDER = 'static';                 // Statics

    let webViewGlobal : vscode.WebviewView;         // Global reference to a webview
    let currentLabFolderUri : any;                  // Current opened lab folder

    // Register CS50 Lab WebView view provider
    vscode.window.registerWebviewViewProvider('lab50', {
        resolveWebviewView: (webView) => {
            const workspaceFolder = vscode.workspace.workspaceFolders![0];
            webView.webview.options = {
                enableCommandUris: true,
                enableScripts: true,
                localResourceRoots: [context.extension.extensionUri, workspaceFolder.uri]
            };
            webViewGlobal = webView;
        }
    });

    async function labViewHandler(fileUri: any, forceUpdate=true) {

        await vscode.commands.executeCommand(
            "setContext",
            "lab50:showReadme",
            true
          );

        await initWebview(fileUri);
        currentLabFolderUri = fileUri;

        // Inspect folder structure and look for configuration file
        const configFilePath = `${fileUri['path']}/${CONFIG_FILE_NAME}`;
        if (fs.existsSync(configFilePath)) {

            const result = extractYaml(configFilePath);
            if (result == undefined) {
                await vscode.commands.executeCommand('workbench.explorer.fileView.focus');
                vscode.window.showWarningMessage('Invalid YAML front matter from README.md');
                return;
            }

            const yamlConfig = result[0];
            const markdown = result[1];
            const githubRawURL = yamlConfig['url'];

            if (forceUpdate) {
                const fileURL = `${fileUri['path']}/${CONFIG_FILE_NAME}`;
                const command = `wget ${githubRawURL} -O ${fileURL}`;
                try {
                    const stdout = execSync(command, {timeout: 5000}).toString();
                    console.log(stdout);
                } catch (e) {
                    console.log(e);
                }
            }

            // Prepare layout
            prepareLayout(fileUri, yamlConfig);

            // Have liquidJS make the first pass to convert all tags to html equivalents
            const engine = liquidEngine();
            engine.parseAndRender(markdown).then(async parsedMarkdown => {

                const md = new MarkdownIt();
                md.use(markdownItAttrs, {
                    leftDelimiter: "{:"
                });
                const parsedHtml = md.render(parsedMarkdown);
                const decodedHtml = decode(parsedHtml);

                const scriptUri = webViewGlobal.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extension.extensionUri, STATIC_FOLDER, LAB_WEBVIEW_SCRIPT));

                const styleUri = webViewGlobal.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extension.extensionUri, STATIC_FOLDER, LAB_WEBVIEW_STYLESHEET));

                const base = webViewGlobal.webview.asWebviewUri(vscode.Uri.file(configFilePath));

                // Render webview
                webViewGlobal.webview.html = htmlTemplate(base, scriptUri, styleUri, decodedHtml);

                // Focus labview
                await vscode.commands.executeCommand('lab50.focus');
            });
        } else {
            vscode.window.showWarningMessage(`Unable to locate ${CONFIG_FILE_NAME}`);
        }
    }

    function htmlTemplate(base, scriptUri, styleUri, html) {
        const htmlString =
        `<!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <base href="${base}">
                <link href="${styleUri}" rel="stylesheet">
                <script src="${scriptUri}"></script>
            </head>
            <body>
                ${html}
            </body>
        </html>`.trim();

        return htmlString;
    }

    function extractYaml (configFilePath) {

        // Extract YAML front matter from README.md
        const readmeFile = fs.readFileSync(configFilePath, {encoding: 'utf-8'});
        const divider = '---';
        const yamlStart = getPosition(readmeFile, divider, 1);
        const yamlEnd = getPosition(readmeFile, divider, 2);
        const yamlFrontMatter = readmeFile.slice(yamlStart, yamlEnd);

        try {
            const yamlConfig: Object = yaml.load(yamlFrontMatter);
            if (yamlConfig == undefined || !validate(yamlConfig)) {
                return undefined;
            }

            const markdown = readmeFile.slice(yamlEnd + divider.length);
            return [yamlConfig, markdown] as const;
        } catch (error) {
            console.log(error);
            return undefined;
        }
    }

    async function prepareLayout(fileUri, yamlConfig) {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        const filesToOpen = yamlConfig['files'];
        filesToOpen.forEach((file: string) => {
            const fileURL = `${fileUri['path']}/${file}`;
            vscode.window.showTextDocument(vscode.Uri.file(fileURL));
        });

        // Change working directory to lab folder
        setTimeout(() => {
            resetTerminal(`cd ${fileUri['path']} && clear`);
        }, 500);
    }

    function resetTerminal(cmd=undefined) {
        const newTerm = vscode.window.createTerminal('bash', 'bash', ['--login'],);
        vscode.window.terminals.forEach((each) => {
            if (each.processId != newTerm.processId) {
                each.dispose();
            }
        });
        if (cmd) { newTerm.sendText(cmd); }
    }

    function validate(yamlConfig) {
        let isValid = true;
        let cmdProvided = false;
        let filesProvided = false;
        let portProvided = false;
        let readmeProvided = false;
        let windowProvided = false;
        let browserProvided = false;
        let terminalProvided = false;
        let xProvided = false;

        if ('cmd' in yamlConfig) { cmdProvided = true; }
        if ('files' in yamlConfig) { filesProvided = true; }
        if ('port' in yamlConfig) { portProvided = true; }
        if ('readme' in yamlConfig) { readmeProvided = false; }
        if ('window' in yamlConfig) {
            windowProvided = true;
            if (yamlConfig['window'].includes('browser')) { browserProvided = true; }
            if (yamlConfig['window'].includes('terminal')) { terminalProvided = true; }
            if (yamlConfig['window'].includes('x')) { xProvided = true; }
        }

        if (cmdProvided && !terminalProvided) { isValid = false; console.log(`violation: "cmd" provided but not "temrinal"`); }
        if (browserProvided && xProvided) { isValid = false; console.log(`violation: "browser" and "x" cannot co-exist`); }
        if (portProvided && !browserProvided) { isValid = false; console.log(`violation: "port" provided but not "browser"`); }

        return isValid;
    }

    async function initWebview(fileUri: vscode.Uri) {
        if (webViewGlobal == undefined) {
            vscode.commands.executeCommand('lab50.focus');
            await new Promise(f => setTimeout(f, 500));
        }
    }

    function getPosition(string, subString, index) {
        return string.split(subString, index).join(subString).length;
    }

    // Command: Open Folder as CS50 Lab
    context.subscriptions.push(
        vscode.commands.registerCommand('lab50.openAsLab', labViewHandler)
    );

    // Command: Reset Lab View
    context.subscriptions.push(
        vscode.commands.registerCommand('lab50.resetLayout', () => {
            labViewHandler(currentLabFolderUri, false);
        })
    );

    // Command: Close Lab
    context.subscriptions.push(
        vscode.commands.registerCommand('lab50.closeLab', async () => {

            // Close all text editors
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');

            // Focus file explorer
            await vscode.commands.executeCommand('workbench.explorer.fileView.focus');

            // Update context
            await vscode.commands.executeCommand(
                "setContext",
                "lab50:showReadme",
                false
              );

            // Force create terminal with login profile
            resetTerminal();

            // Reset global variables
            webViewGlobal = undefined;
        })
    );
}
