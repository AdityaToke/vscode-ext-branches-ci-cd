import * as vscode from 'vscode';
import * as path from 'path'
import * as fs from 'fs'
let currentPanel: vscode.WebviewPanel | undefined = undefined;
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('git-branches-ci-cd.initBranchTask', () => {
		vscode.window.showInformationMessage('Hello World from Git Branches CI/CD!');


		const columnToShowIn = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (currentPanel) {
			currentPanel.reveal(columnToShowIn);
		} else {
			currentPanel = vscode.window.createWebviewPanel(
				'parentWebViewScreen',
				'Git: Branch CI/CD',
				vscode.ViewColumn.One,
				{
					enableScripts: true
				}
			);
			currentPanel.webview.html = getWebviewContent(context);
		}
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent(context: vscode.ExtensionContext): string {
	const filePath: vscode.Uri = vscode.Uri.file(path.join(context.extensionPath, 'src', 'website', 'index.html'));
	return fs.readFileSync(filePath.fsPath, 'utf8');
}
// this method is called when your extension is deactivated
export function deactivate() { }