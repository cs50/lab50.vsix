
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';
import { decode } from 'html-entities';
import { Liquid } from 'liquidjs';
import MarkdownIt = require('markdown-it');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const CONFIG_FILE_NAME = '.cs50.yml';           // Default config yml file name
    const LAB_WEBVIEW_SCRIPT = 'lab50.js';     // Script
    const LAB_WEBVIEW_STYLESHEET = 'lab50.css'; // Styleshet
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

        initWebview(fileUri);
        currentLabFolderUri = fileUri;

        // Inspect folder structure and look for configuration file
        const configFilePath = `${fileUri['path']}/${CONFIG_FILE_NAME}`;
        if (fs.existsSync(configFilePath)) {

            // Load config file
            const configFile = yaml.load(fs.readFileSync(configFilePath, 'utf8'));

            // Read slug
            const slug = configFile['vscode']['slug'];

            // Generate GitHub raw base url
            const githubRawURL = `https://raw.githubusercontent.com/${slug}`;

            // Get a list of files that we wish to update
            //
            // TODO:
            // Handle the scenario where lab source is not reachable or timeout
            // perhaps try downloading files to tmp folder first then move it back
            // to user's workspace

            if (forceUpdate) {
                const filesToUpdate = configFile['vscode']['filesToUpdate'];
                filesToUpdate.forEach((file: string) => {
                    const fileURL = `${fileUri['path']}/${file}`;
                    const command = `wget ${githubRawURL}/${file} -O ${fileURL}`;
                    try {
                        const stdout = execSync(command, {timeout: 5000}).toString();
                        console.log(stdout);
                    } catch (e) {
                        console.log(e);
                    }
                });
            }

            // Close all text editors and open files for users
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            const filesToOpen = configFile['vscode']['starterFiles'];
            filesToOpen.forEach((file: string) => {
                const fileURL = `${fileUri['path']}/${file}`;
                vscode.window.showTextDocument(vscode.Uri.file(fileURL));
            });

            // // Focus terminal and change working directory to lab folder
            setTimeout(() => {
                vscode.window.terminals.forEach((each) => { each.dispose(); });
                vscode.window.createTerminal('bash', 'bash', ['--login'],).show();
                vscode.window.activeTerminal.sendText(`cd ${fileUri['path']} && clear`);
            }, 500);

            // Parse and render README.md
            const engine = new Liquid();

            // Register a next tag
            engine.registerTag('next', {
                render: async function(ctx) {
                    const htmlString = `<button class="btn btn-success" data-next type="button">Next</button>`;
                    return htmlString.trim();
                }
            });

            // Register a video tag
            engine.registerTag('video', {
                parse: function(tagToken) {
                    this.url = tagToken.args.replaceAll('"', "").trim();
                },
                render: async function() {
                    const ytEmbedLink = `https://www.youtube.com/embed/${yt_parser(this.url)}`;
                    const htmlString = `<div class="ratio ratio-16x9"><iframe sandbox="allow-forms allow-scripts allow-pointer-lock allow-same-origin allow-top-navigation allow-presentation" width="560" height="315" src="${ytEmbedLink}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;

                    return htmlString.trim();
                }
            });

            // Register a spoiler tag (ends with endspoiler)
            engine.registerTag('spoiler', {
                parse: function(tagToken, remainTokens) {
                    this.tpls = [];
                    this.args = tagToken.args;

                    // Parse spoiler summary (default to "Spoiler")
                    this.summary = this.args.replaceAll('"', "").trim();
                    if (this.summary == '') {
                        this.summary = 'Spoiler';
                    }

                    let closed = false;
                    while(remainTokens.length) {
                        const token = remainTokens.shift();

                        // we got the end tag! stop taking tokens
                        if (token.getText() === '{% endspoiler %}') {
                            closed = true;
                            break;
                        }

                        // parse token into template
                        // parseToken() may consume more than 1 tokens
                        // e.g. {% if %}...{% endif %}
                        const tpl = this.liquid.parser.parseToken(token, remainTokens);
                        this.tpls.push(tpl);
                    }
                    if (!closed) throw new Error(`tag ${tagToken.getText()} not closed`);
                },
                * render(context, emitter) {
                emitter.write(`<details class='spoiler'>`);
                emitter.write(`<summary>${this.summary}</summary>`);
                yield this.liquid.renderer.renderTemplates(this.tpls, context, emitter);
                emitter.write("</details>");
                }
            });

            // Have liquidJS make the first pass to convert all tags to html equivalents
            const readmePath = `${fileUri['path']}/README.md`;
            const markdown = fs.readFileSync(readmePath, {encoding: 'utf-8'});
            engine.parseAndRender(markdown).then(async parsedMarkdown => {

                // Have MarkDoc re-parse everything
                const md = new MarkdownIt();
                const parsedHtml = md.render(parsedMarkdown);
                const decodedHtml = decode(parsedHtml);

                const scriptUri = webViewGlobal.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extension.extensionUri, STATIC_FOLDER, LAB_WEBVIEW_SCRIPT));

                const styleUri = webViewGlobal.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extension.extensionUri, STATIC_FOLDER, LAB_WEBVIEW_STYLESHEET));

                const base = webViewGlobal.webview.asWebviewUri(vscode.Uri.file(readmePath));

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

    function initWebview(fileUri: vscode.Uri) {
        if (webViewGlobal == undefined) {
            vscode.commands.executeCommand('lab50.focus');
            setTimeout(() => {labViewHandler(fileUri);}, 500);
            return;
        }
    }

    // Helper function to parse youtube id from url
    function yt_parser(url: string){
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match&&match[7].length==11)? match[7] : false;
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

            // Force create terminal with login profile
            vscode.window.terminals.forEach((each) => { each.dispose(); });
            vscode.window.createTerminal('bash', 'bash', ['--login']).show();

            // Reset global variables
            webViewGlobal.webview.html = "Please open a lab.";
        })
    );


}


export function deactivate() {}
