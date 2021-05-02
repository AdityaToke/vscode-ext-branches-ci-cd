import * as vscode from 'vscode';
import * as path from 'path'
import * as fs from 'fs'
import { GlobalDetails } from './models/enum/global.enum';
import { baseDataStructure } from './models/data/base-data-structure';
let currentPanel: vscode.WebviewPanel | undefined = undefined;
export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('git-branches-ci-cd.initBranchTask', () => {

		const columnToShowIn = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (currentPanel) {
			currentPanel.reveal(columnToShowIn);
		} else {
			vscode.window.showInformationMessage('Hello World from Git Branches CI/CD!');
			currentPanel = vscode.window.createWebviewPanel(
				'parentWebViewScreen',
				'Git: Branch CI/CD',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					localResourceRoots: [
						vscode.Uri.file(path.join(context.extensionPath, 'src', 'website', 'main.js'))
					]
				}
			);
			// add the remove this cmd to start with fresh data
			//context.globalState.update(GlobalDetails.PARENT_CACHE_KEY, "");
			let ext_data;
			if (!context.globalState.get(GlobalDetails.PARENT_CACHE_KEY)) {
				context.globalState.get(GlobalDetails.PARENT_CACHE_KEY,"");
				context.globalState.update(GlobalDetails.PARENT_CACHE_KEY, baseDataStructure);
				ext_data = baseDataStructure;
			}
			ext_data = context.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
			console.log(ext_data, "asd");
			
			currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'src', 'website', 'main.js')))
			currentPanel.webview.html = getWebviewContent(context);
		}
	});

	context.subscriptions.push(disposable);
}

function getWebviewContent(context: vscode.ExtensionContext): string {

	const htmlBodyData = fs.readFileSync(vscode.Uri.file(path.join(context.extensionPath, 'src', 'website', 'content.html')).fsPath, 'utf8');
	const jsFileData = fs.readFileSync(vscode.Uri.file(path.join(context.extensionPath, 'src', 'website', 'main.js')).fsPath, 'utf8');
	const styleFileData = fs.readFileSync(vscode.Uri.file(path.join(context.extensionPath, 'src', 'website', 'style.css')).fsPath, 'utf8');

	return `
	<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.9/angular.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
<style>
    ${styleFileData}
</style>
<body>
    ${htmlBodyData}
<script>
	${jsFileData}
</script>
</body>
</html>
	`;
}
// this method is called when your extension is deactivated
export function deactivate() { }