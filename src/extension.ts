
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';
import { decode } from 'html-entities';
import { Liquid } from 'liquidjs';
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

        initWebview(fileUri);
        currentLabFolderUri = fileUri;

        // Inspect folder structure and look for configuration file
        const configFilePath = `${fileUri['path']}/${CONFIG_FILE_NAME}`;
        if (fs.existsSync(configFilePath)) {

            const result = extractYaml(configFilePath);
            if (result == undefined) {
                await vscode.commands.executeCommand('workbench.explorer.fileView.focus');
                return;
            }

            const yamlConfig = result[0];
            const markdown = result[1];

            // Generate GitHub raw base url
            const githubRawURL = yamlConfig['url'];

            // Get a list of files that we wish to update
            //
            // TODO:
            // Handle the scenario where lab source is not reachable or timeout
            // perhaps try downloading files to tmp folder first then move it back
            // to user's workspace

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

            // Close all text editors and open files for users
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            const filesToOpen = yamlConfig['files'];
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
                emitter.write(`<summary style="cursor: pointer;">${this.summary}</summary>`);
                yield this.liquid.renderer.renderTemplates(this.tpls, context, emitter);
                emitter.write("</details>");
                }
            });

            // Have liquidJS make the first pass to convert all tags to html equivalents
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

            // Force create terminal with login profile
            vscode.window.terminals.forEach((each) => { each.dispose(); });
            vscode.window.createTerminal('bash', 'bash', ['--login']).show();

            // Reset global variables
            webViewGlobal.webview.html = "Please open a lab.";
        })
    );
}
