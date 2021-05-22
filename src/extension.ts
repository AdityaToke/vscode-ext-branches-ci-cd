import * as vscode from 'vscode';
import * as path from 'path'
import * as fs from 'fs'
import { GlobalDetails } from './models/enum/global.enum';
import { baseDataStructure } from './models/data/base-data-structure';
import { ReceiveAction } from './models/enum/receive-action.enum';
import { SendActionEnum } from './models/enum/send-action.enum';
import { StatusIdentifierEnum } from './models/enum/status.enum';
import { IBaseDataStructure } from './models/interface/base_data_structure.interface';
import { IVerifyBranch } from './models/interface/verify_branch.interface';
let currentPanel: vscode.WebviewPanel | undefined = undefined;
let globalContext: vscode.ExtensionContext;
const util = require('util');
const exec = util.promisify(require('child_process').exec);
export function activate(context: vscode.ExtensionContext) {
	globalContext = context;
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
						vscode.Uri.file(path.join(globalContext.extensionPath, 'src', 'website', 'main.js'))
					]
				}
			);
			receiveMessage();
			let ext_data: IBaseDataStructure | undefined = globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
			if (!ext_data) {
				globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY, "");
				updateApplicationData(baseDataStructure(vscode.workspace.name ?? ""));
				ext_data = baseDataStructure(vscode.workspace.name ?? "");
			}
			currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(globalContext.extensionPath, 'src', 'website', 'main.js')))
			currentPanel.webview.html = getWebviewContent();
			sendMessage(SendActionEnum.APPLICATION_DATA, { ...ext_data, current_projects: vscode.workspace?.workspaceFolders?.map(x => x.name) });
		}
	});

	globalContext.subscriptions.push(disposable);
}

function receiveMessage() {
	currentPanel?.webview.onDidReceiveMessage(
		message => {
			const { action, data } = message;
			switch (action) {
				case ReceiveAction.UPDATE_DATA:
					updateApplicationData(data);
					return;

				case ReceiveAction.ADD_DATA:
					addDataToStorage(data)
					return;

				case ReceiveAction.VERIFY_BRANCH:
					verifyBranch(data);
					return;

				case ReceiveAction.VERIFY_PROJECT:
					verifyProject(data);
					return;

				default:
					break;
			}
		},
		undefined,
		globalContext.subscriptions
	);
}

function verifyProject(projectName: string) {
	sendMessage(SendActionEnum.VERIFY_PROJECT, { branch_name: projectName, branch_data: searchProject(projectName) });
}

function searchProject(projectName: string) {
	return vscode?.workspace?.workspaceFolders?.find(x => x.name.toLowerCase() === projectName.toLowerCase())
}
async function verifyBranch(verifyBranchObj: IVerifyBranch) {
	try {
		let projectDetailsTemp: vscode.WorkspaceFolder | undefined = verifyBranchObj.project_details;
		if (!projectDetailsTemp) {
			projectDetailsTemp = searchProject(verifyBranchObj.project_name);
		}
		const cmd = 'cd ' + projectDetailsTemp?.uri.fsPath + ` && git rev-parse --verify ${verifyBranchObj.branch_name}`;
		const { stdout, stderr } = await exec(cmd);
		if (stderr) {
			sendMessage(SendActionEnum.VERIFY_BRANCH, { verifiedFor: verifyBranchObj.verifyFor, value: true });
		} else {
			sendMessage(SendActionEnum.VERIFY_BRANCH, { verifiedFor: verifyBranchObj.verifyFor, value: false });
		}
	} catch (error) {
		sendMessage(SendActionEnum.VERIFY_BRANCH, { verifiedFor: verifyBranchObj.verifyFor, value: true });
	}
}

async function addDataToStorage(dataToAdd: any) {
	try {
		const tempApplicationData: IBaseDataStructure | undefined = globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
		// TODO: we are ignoring the merge request things
		let currentStatus;
		let numberOfCommits = 0;
		let projectDetailsTemp: vscode.WorkspaceFolder | undefined = dataToAdd.project_details;
		if (!projectDetailsTemp) {
			projectDetailsTemp = searchProject(dataToAdd.project_name);
		}
		const cmd = 'cd ' + projectDetailsTemp?.uri.fsPath + ` && git rev-list --right-only --count ${dataToAdd.child_branch}...${dataToAdd.parent_branch}`;
		const { stdout, stderr } = await exec(cmd);
		if (stderr) {
			console.error(`error: ${stderr}`);
		} else {
			numberOfCommits = stdout;
		}

		if (numberOfCommits) {
			currentStatus = {
				id: StatusIdentifierEnum.READY_FOR_MERGE,
				status: `The source branch is ${numberOfCommits} commits behind the target branch`
			};
		} else {
			currentStatus = {
				id: StatusIdentifierEnum.UP_TO_DATE,
				status: "The branch is up to date."
			};
		}
		if (tempApplicationData) {
			if (Object.keys(tempApplicationData.branch_data).includes(dataToAdd.project_name)) {
				tempApplicationData.branch_data[dataToAdd.project_name][currentStatus.id].push(
					{
						"is_checked": false,
						"parent_branch": dataToAdd.parent_branch,
						"child_branch": dataToAdd.child_branch,
						"status": currentStatus.status
					}
				)
			} else {
				const tempBranchData = {
					[StatusIdentifierEnum.MERGING]: <any>[],
					[StatusIdentifierEnum.MERGE_CONFLICTS]: <any>[],
					[StatusIdentifierEnum.READY_FOR_MERGE]: <any>[],
					[StatusIdentifierEnum.UP_TO_DATE]: <any>[],
				};
				tempBranchData[currentStatus.id].push(
					{
						"is_checked": false,
						"parent_branch": dataToAdd.parent_branch,
						"child_branch": dataToAdd.child_branch,
						"status": currentStatus.status
					}
				);
				tempApplicationData.branch_data[dataToAdd.project_name] = tempBranchData;
			}
			updateApplicationData(tempApplicationData);
			sendMessage(SendActionEnum.APPLICATION_DATA, tempApplicationData);
		}
	} catch (error) {
		console.error("___error___", error)
	}
}

function updateApplicationData(data: any): void {
	globalContext.globalState.update(GlobalDetails.PARENT_CACHE_KEY, data);
}
function sendMessage(action: string, data: any): void {
	if (currentPanel) {
		console.log(action, data, "data from update applixationdata");
		currentPanel.webview.postMessage({ action, data });
	}
}
function getWebviewContent(): string {

	const htmlBodyData = fs.readFileSync(vscode.Uri.file(path.join(globalContext.extensionPath, 'src', 'website', 'content.html')).fsPath, 'utf8');
	const jsFileData = fs.readFileSync(vscode.Uri.file(path.join(globalContext.extensionPath, 'src', 'website', 'main.js')).fsPath, 'utf8');
	const globalStyleFileData = fs.readFileSync(vscode.Uri.file(path.join(globalContext.extensionPath, 'src', 'website', 'css', 'global.css')).fsPath, 'utf8');
	const styleFileData = fs.readFileSync(vscode.Uri.file(path.join(globalContext.extensionPath, 'src', 'website', 'css', 'style.css')).fsPath, 'utf8');

	return `
	<!DOCTYPE html>
<html>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.6.9/angular.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
<style>
    ${globalStyleFileData}
</style>
<style>
    ${styleFileData}
</style>
<body>
    ${htmlBodyData}
<script>
const vscode = acquireVsCodeApi();
	${jsFileData}
</script>
</body>
</html>
	`;
}
// this method is called when your extension is deactivated
export function deactivate() { }