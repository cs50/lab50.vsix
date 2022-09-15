import axios from 'axios';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import MarkdownIt = require('markdown-it');
import markdownItAttrs = require('markdown-it-attrs');
import { decode } from 'html-entities';
import { liquidEngine } from './engine';
import { LabEditorProvider } from './editor';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	const CONFIG_FILE_NAME = 'README.md';           // Default config yml file name
    const LAB_WEBVIEW_SCRIPT = 'lab50.js';          // Script
    const LAB_WEBVIEW_STYLESHEET = 'lab50.css';     // Styleshet
    const STATIC_FOLDER = 'static';                 // Statics

    let webViewGlobal: vscode.WebviewView;         // Global reference to a webview
    let currentLabFolderPath: any;                  // Current opened lab folder
    let didOpenLab = false;

    // Expose public facing API for other extensions to use (e.g., cs50.vsix)
    const api = {
        didOpenLab() {
            return didOpenLab;
        }
      };

    // Default timeout to 10s for axios request
    axios.defaults.timeout = 10000;

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

    context.subscriptions.push(LabEditorProvider.register(context, labViewHandler));


    async function labViewHandler(fileUri: any, forceUpdate=true) {

        // Determine lab folder path
        currentLabFolderPath = fileUri['path'];
        if (currentLabFolderPath.includes('.md')) {

            // If user clicks on a README.md file, derive its parent folder path
            currentLabFolderPath = currentLabFolderPath.substring(0, currentLabFolderPath.lastIndexOf('/'));
        }

        // Inspect folder structure and look for configuration file
        const configFilePath = `${currentLabFolderPath}/${CONFIG_FILE_NAME}`;
        if (fs.existsSync(configFilePath)) {

            let markdown: string;
            let yamlConfig;

            // extract yaml configuration from README.md
            const result = extractYaml(configFilePath);

            // if yaml config was corrupted or invalid
            if (result == undefined) {
                await vscode.commands.executeCommand('workbench.explorer.fileView.focus');
                vscode.window.showWarningMessage('Invalid YAML front matter from README.md');
                return;
            }

            // if yaml config is empty
            if (result[0] === '') {
                markdown = result[1];
            } else {
                yamlConfig = result[0];
                markdown = result[1];
            }

            // attempt to update README.md
            if (forceUpdate && yamlConfig != undefined) {
                if ('url' in yamlConfig) {

                    // attemp to download README.md file from repo
                    try {
                        const githubRawURL = yamlConfig['url'];
                        const fileURL = `${currentLabFolderPath}/${CONFIG_FILE_NAME}`;

                        // authenticate request if on Codespaces
                        let headers = {};
                        if (process.env['CODESPACES'] != undefined) {
                            headers = {
                                headers: {
                                    Accept: 'application/vnd.github.v3+json',
                                    Authorization: `token ${process.env['GITHUB_TOKEN']}`
                                }
                            }
                        }

                        // first download the file to "README.md.download", then replace
                        // current "README.md" file only if curl command succeed
                        const res = await axios.get(`${githubRawURL}`, headers);
                        if (res.status === 200) {
                            fs.writeFile(configFilePath, res.data, () => {
                                console.log(`updated ${configFilePath}`);

                                // retrieve the latest markdown content
                                markdown = extractYaml(configFilePath)[1];
                            });
                        } else {
                            vscode.window.showErrorMessage(
                                `Failed to download README.md. HTTP Status Code: ${res.status})`);
                        }
                    } catch (error) {
                        console.log(error);
                        vscode.window.showErrorMessage(`${error}`);
                        vscode.window.showInformationMessage(`Using local version of README.md`);
                    }
                }
            }

            // Prepare layout
            await initWebview();

            // Have liquidJS make the first pass to convert all tags to html equivalents
            const engine = liquidEngine();
            engine.parseAndRender(markdown).then(async parsedMarkdown => {

                const md = new MarkdownIt();
                md.use(markdownItAttrs, {
                    leftDelimiter: "{:",
                    rightDelimiter: "}"
                });

                const parsedHtml = md.render(parsedMarkdown);
                const decodedHtml = decode(parsedHtml);

                const scriptUri = webViewGlobal.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extension.extensionUri, STATIC_FOLDER, LAB_WEBVIEW_SCRIPT));

                const styleUri = webViewGlobal.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extension.extensionUri, STATIC_FOLDER, LAB_WEBVIEW_STYLESHEET));

                const base = webViewGlobal.webview.asWebviewUri(vscode.Uri.file(configFilePath));

                // Render webview
                const html = htmlTemplate(base, scriptUri, styleUri, decodedHtml);
                await prepareLayout(yamlConfig, html);

            });
        } else {
            await vscode.commands.executeCommand(
                "setContext",
                "lab50:showReadme",
                false
              );
            webViewGlobal = undefined;
            vscode.window.showWarningMessage(`Unable to locate ${CONFIG_FILE_NAME}`);
        }
    }

    function htmlTemplate(base, scriptUri, styleUri, html) {

        const fontawesomeUri = webViewGlobal.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extension.extensionUri, `${STATIC_FOLDER}/vendor/fontawesome/css`, 'all.min.css'));

        const mathjaxUri = webViewGlobal.webview.asWebviewUri(
            vscode.Uri.joinPath(context.extension.extensionUri, `${STATIC_FOLDER}/vendor/mathjax/js`, 'tex-chtml.js'));

        const htmlString =
        `<!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <base href="${base}">
                <link href="${fontawesomeUri}" rel="stylesheet">
                <link href="${styleUri}" rel="stylesheet">
                <script src="https://asciinema.org/a/14.js" id="asciicast-14" async data-size="big"></script>
            </head>
            <body>
                ${html}
            </body>
            <script>
                MathJax = {
                chtml: {
                        displayAlign: "left"
                    }
                };
            </script>
            <script crossorign="anonymous" src="${mathjaxUri}"></script>
            <script src="${scriptUri}"></script>
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

        let markdown;
        try {
            const yamlConfig = yaml.load(yamlFrontMatter);

            // If yaml is empty or appears to be empty, render content from readme
            if (yamlConfig == null || yamlFrontMatter.length === 0) {
                markdown = readmeFile;
                return ['', markdown] as const;
            }

            // If yaml is invalid (yaml front matter detected)
            if (yamlConfig == undefined || !validate(yamlConfig)) {
                return undefined;
            }

            markdown = readmeFile.slice(yamlEnd + divider.length);
            return [yamlConfig, markdown] as const;
        } catch (error) {
            console.log(error);
            return undefined;
        }
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

    async function prepareLayout(yamlConfig, html) {

        // close all editors
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        // open files for users, if any
        if (yamlConfig != undefined && yamlConfig != '') {
            const filesToOpen = yamlConfig['files'];
            filesToOpen.forEach((file: string) => {
                const fileURL = `${currentLabFolderPath}/${file}`;
                vscode.window.showTextDocument(vscode.Uri.file(fileURL));
            });
        } else {
            await vscode.commands.executeCommand('workbench.action.files.newUntitledFile');
        }

        // reset terminal, change working directory to lab folder
        setTimeout(async () => {
            await resetTerminal(`cd ${currentLabFolderPath} && clear`);
        }, 500);

        webViewGlobal.webview.html = html;

        // Focus labview
        await vscode.commands.executeCommand('lab50.focus');
        didOpenLab = true;
    }

    async function resetTerminal(cmd=undefined) {
        let newTerm: vscode.Terminal;
        if (process.env['CODESPACE']) {
            newTerm = vscode.window.createTerminal('bash', 'bash', ['--login'],);
        } else {
            newTerm = vscode.window.createTerminal();
        }
        vscode.window.terminals.forEach((each) => {
            if (each.processId != newTerm.processId) {
                each.dispose();
            }
        });
        if (cmd) { newTerm.sendText(cmd); }
        await vscode.commands.executeCommand('workbench.action.terminal.focus');
    }

    async function initWebview() {
        if (webViewGlobal === undefined) {
            await vscode.commands.executeCommand(
                "setContext",
                "lab50:showReadme",
                true
              );
            await vscode.commands.executeCommand('lab50.focus');
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
            labViewHandler({path: currentLabFolderPath}, false);
            webViewGlobal.webview.postMessage({ command: 'reload'});
        })
    );

    // Command: Close Lab
    context.subscriptions.push(
        vscode.commands.registerCommand('lab50.closeLab', async () => {

            // Update context
            await vscode.commands.executeCommand(
                "setContext",
                "lab50:showReadme",
                false
              );

            // Close all text editors
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');

            // Force create terminal with login profile
            resetTerminal();

            // Reset global variables
            webViewGlobal = undefined;
            didOpenLab = false;
        })
    );

    await vscode.commands.executeCommand("setContext", "lab50:didActivateExtension", true);

    // 'export' public api-surface
    return api;
}
