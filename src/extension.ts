import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { GlobalDetails } from "./models/enum/global.enum";
import { baseDataStructure } from "./models/data/base-data-structure";
import { ReceiveAction } from "./models/enum/receive-action.enum";
import { SendActionEnum } from "./models/enum/send-action.enum";
import { StatusIdentifierEnum } from "./models/enum/status.enum";
import { IBaseDataStructure } from "./models/interface/base_data_structure.interface";
import { IVerifyBranch } from "./models/interface/verify_branch.interface";
import { IBranchDetails } from "./models/interface/branch_data.interface";
let currentPanel: vscode.WebviewPanel | undefined = undefined;
let globalContext: vscode.ExtensionContext;
const util = require("util");
const exec = util.promisify(require("child_process").exec);
export function activate(context: vscode.ExtensionContext) {
  globalContext = context;
  let disposable = vscode.commands.registerCommand(
    "git-branches-ci-cd.initBranchTask",
    () => {
      try {
        const columnToShowIn = vscode.window.activeTextEditor
          ? vscode.window.activeTextEditor.viewColumn
          : undefined;

        if (currentPanel && columnToShowIn) {
          currentPanel.reveal(columnToShowIn);
        } else {
          vscode.window.showInformationMessage("Starting Git Branches CI/CD");
          currentPanel = vscode.window.createWebviewPanel(
            "parentWebViewScreen",
            "Git: Branch CI/CD",
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              localResourceRoots: [
                vscode.Uri.file(
                  path.join(globalContext.extensionPath, "website")
                ),
              ],
            }
          );
          receiveMessage();
          let ext_data: IBaseDataStructure | undefined =
            globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
          if (!ext_data) {
            globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY, "");
            updateApplicationData(
              baseDataStructure(vscode.workspace.name ?? "")
            );
            ext_data = baseDataStructure(vscode.workspace.name ?? "");
          }
          currentPanel.webview.html = getWebviewContent();
          sendMessage(SendActionEnum.APPLICATION_DATA, {
            ...ext_data,
            current_projects: vscode.workspace?.workspaceFolders?.map(
              (x) => x.name
            ),
          });
        }
      } catch (error) {
        vscode.window.showInformationMessage(
          `error in main message ${JSON.stringify(error)}`
        );
      }
    }
  );

  globalContext.subscriptions.push(disposable);
}

function receiveMessage() {
  currentPanel?.webview.onDidReceiveMessage(
    (message) => {
      const { action, data } = message;
      switch (action) {
        case ReceiveAction.IS_STASH:
          changesIsStashed(data, true);
          return;
        case ReceiveAction.UPDATE_DATA:
          updateApplicationData(data);
          return;

        case ReceiveAction.ADD_DATA:
          addAndRefreshDataToStorage(data);
          return;

        case ReceiveAction.VERIFY_BRANCH:
          verifyBranch(data);
          return;

        case ReceiveAction.VERIFY_PROJECT:
          verifyProject(data);
          return;

        case ReceiveAction.DELETE_DATA:
          deleteData(data);
          return;

        case ReceiveAction.MERGE:
          mergeData(data);
          return;

        case ReceiveAction.REFRESH:
          refreshData(data);
          return;

        case ReceiveAction.RESOLVE_CONFLICTS:
          resolveConflicts(data);
          return;

        default:
          break;
      }
    },
    undefined,
    globalContext.subscriptions
  );
}

async function resolveConflicts(data: any) {
  let projectDetailsTemp = searchProject(data.currentProject);
  const cmd =
  "cd " +
  projectDetailsTemp?.uri.fsPath +
  ` && git checkout ${data.parent_branch} && git pull && git checkout ${data.child_branch} && git pull && git add . && git merge ${data.parent_branch} --no-edit && git diff --name-only --diff-filter=U`;
  try {
    await exec(cmd);
    // TODO: need to find logic on if error is not thorwn in merge conflicts.
    // if error is thrown means it have Merge conflicts.

  } catch (error) {
    if (error.stdout.toLowerCase().includes("automatic merge failed")) {
      try {
        const cmd =
          "cd " +
          projectDetailsTemp?.uri.fsPath +
          ` && git diff --name-only --diff-filter=U`;

        const { stdout } = await exec(cmd);

        const conflictsFilesList = stdout.split("\n").filter(Boolean);
        for (const filesPath of conflictsFilesList) {
          await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(projectDetailsTemp?.uri.fsPath+"/"+filesPath)
          );
        }
        showMessageOnScreen("After resolving merge conflicts click on refresh icon to update the extension.")
        const tempApplicationData: IBaseDataStructure | undefined =
        globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
        updateApplicationData(tempApplicationData);
        sendMessage(SendActionEnum.APPLICATION_DATA, {
          ...tempApplicationData,
          current_projects: [data.currentProject]
        });
      } catch (error) {
        console.log(error, "error");
      }
    }
  }
}
async function changesIsStashed(data: any, sendReturnResponseToWeb = false) {
  const projectDetailsTemp = searchProject(data.currentProject);
  const cmd = "cd " + projectDetailsTemp?.uri.fsPath + ` && git status`;
  const { stdout } = await exec(cmd);
  if (stdout.toLowerCase().includes("changes not staged for commit")) {
    sendMessage(SendActionEnum.STASH_ERROR, true);
    return false;
  }
  if (sendReturnResponseToWeb) {
    if (data.from === "refresh") {
      sendMessage(SendActionEnum.START_REFRESHING, true);
    } else {
      if (data.from === "merge") {
        sendMessage(SendActionEnum.READY_TO_START_MERGING, true);
      } else {
        if (data.from === "conflicts") {
          sendMessage(SendActionEnum.START_FIXING_CONFLICTS, data);
        }
      }
    }
  }
  return true;
}
async function refreshData(data: any) {
  if (await changesIsStashed(data)) {
    try {
      const tempApplicationData: IBaseDataStructure | undefined =
        globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
      if (tempApplicationData) {
        let cacheApplicationData = JSON.parse(
          JSON.stringify(tempApplicationData)
        );
        cacheApplicationData.branch_data[data.currentProject].merge_conflicts =
          [];
        cacheApplicationData.branch_data[data.currentProject].merging = [];
        cacheApplicationData.branch_data[data.currentProject].ready_to_merge =
          [];
        cacheApplicationData.branch_data[data.currentProject].up_to_date = [];
        const sectionList = <StatusIdentifierEnum[]>(
          Object.keys(tempApplicationData?.branch_data[data.currentProject])
        );
        for (const sectionName of sectionList) {
          for (const iterator of tempApplicationData.branch_data[
            data.currentProject
          ][sectionName]) {
            const projectDetails = await addAndRefreshDataToStorage(
              { ...iterator, project_name: data.currentProject },
              true,
              cacheApplicationData
            );
            if (projectDetails) {
              cacheApplicationData = projectDetails;
            }
          }
        }
        updateApplicationData(cacheApplicationData);
        sendMessage(SendActionEnum.APPLICATION_DATA, {
          ...cacheApplicationData,
          current_projects: [data.currentProject],
        });
      }
    } catch (error) {
      console.log(error, "Error");
    }
  }
}
async function mergeData(data: any) {
  let projectDetailsTemp = searchProject(data.currentProject);
  const tempApplicationData: IBaseDataStructure | undefined =
    globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
  let element: IBranchDetails;
  for (let index = 0; index < data.items.length; index++) {
    element = data.items[index];
    if (tempApplicationData) {
      tempApplicationData.branch_data[data.currentProject].ready_to_merge =
        tempApplicationData.branch_data[
          data.currentProject
        ].ready_to_merge.filter((x) => x.id !== element.id);
    }
    try {
      const cmd =
        "cd " +
        projectDetailsTemp?.uri.fsPath +
        ` && git checkout ${element.parent_branch} && git pull && git checkout ${element.child_branch} && git pull && git add . && git merge ${element.parent_branch} --no-edit && git commit -m "Merged branch '${element.parent_branch}' into ${element.child_branch}"`;

      const { stdout } = await exec(cmd);
      if (stdout) {
        element.is_checked = false;
        tempApplicationData?.branch_data[data.currentProject].up_to_date.push(
          element
        );
      }
    } catch (error) {
      if (error.stdout.toLowerCase().includes("automatic merge failed")) {
        // before abort we will extract all the info using diff
        // abort the git merge
        element.status = await getTheMergeConflictDiff(
          projectDetailsTemp?.uri.fsPath
        );
        // add it in merge conflicts
        element.is_checked = false;
        tempApplicationData?.branch_data[
          data.currentProject
        ].merge_conflicts.push(element);
      }
      if (
        error.stdout
          .toLowerCase()
          .includes('use "git push" to publish your local commits')
      ) {
        // again add the git push command
        // and after that we will add it to up to date.
        const cmd = "cd " + projectDetailsTemp?.uri.fsPath + ` && git push`;
        await exec(cmd);
        // add it in up to date
        element.is_checked = false;
        element.status = "The branch is up to date.";
        tempApplicationData?.branch_data[data.currentProject].up_to_date.push(
          element
        );
      }
    }
  }
  updateApplicationData(tempApplicationData);
  sendMessage(SendActionEnum.APPLICATION_DATA, {
    ...tempApplicationData,
    current_projects: vscode.workspace?.workspaceFolders?.map((x) => x.name),
  });
}

async function getTheMergeConflictDiff(
  projectPath: string | undefined
): Promise<string> {
  let status = "";
  const cmd =
    "cd " +
    projectPath +
    " && git diff --name-only --diff-filter=U && git merge --abort";
  const { stdout } = await exec(cmd);
  status = "Conflicted Files - ";
  const conflictsFilesList = stdout.split("\n").filter(Boolean);
  if (conflictsFilesList.length < 5) {
    conflictsFilesList.forEach((fileName: string, index: number) => {
      if (fileName.includes("/")) {
        const splitedText = fileName.split("/");
        if (index !== 0) {
          status += ", ";
        }
        status += splitedText[splitedText.length - 1];
      } else {
        status += fileName;
      }
    });
  } else {
    status = `Total ${conflictsFilesList.length} conflicted files.`;
  }
  return status;
}
function verifyProject(projectName: string) {
  sendMessage(SendActionEnum.VERIFY_PROJECT, {
    branch_name: projectName,
    branch_data: searchProject(projectName),
  });
}
function searchProject(projectName: string) {
  return vscode?.workspace?.workspaceFolders?.find(
    (x) => x.name.toLowerCase() === projectName.toLowerCase()
  );
}
async function verifyBranch(verifyBranchObj: IVerifyBranch) {
  try {
    let projectDetailsTemp: vscode.WorkspaceFolder | undefined =
      verifyBranchObj.project_details;
    if (!projectDetailsTemp) {
      projectDetailsTemp = searchProject(verifyBranchObj.project_name);
    }
    const cmd =
      "cd " +
      projectDetailsTemp?.uri.fsPath +
      ` && git ls-remote origin ${verifyBranchObj.branch_name}`;
    const { stdout, stderr } = await exec(cmd);
    if (stdout) {
      sendMessage(SendActionEnum.VERIFY_BRANCH, {
        verifiedFor: verifyBranchObj.verifyFor,
        value: false,
      });
    } else {
      sendMessage(SendActionEnum.VERIFY_BRANCH, {
        verifiedFor: verifyBranchObj.verifyFor,
        value: true,
      });
    }
  } catch (error) {
    sendMessage(SendActionEnum.VERIFY_BRANCH, {
      verifiedFor: verifyBranchObj.verifyFor,
      value: true,
    });
  }
}
async function addAndRefreshDataToStorage(
  dataToAdd: any,
  refresh: boolean = false,
  refreshApplicationData: IBaseDataStructure | undefined = undefined
) {
  try {
    let tempApplicationData: IBaseDataStructure | undefined =
      globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
    if (refresh) {
      tempApplicationData = JSON.parse(JSON.stringify(refreshApplicationData));
    }
    let currentStatus;
    let numberOfCommits = 0;
    let projectDetailsTemp: vscode.WorkspaceFolder | undefined =
      dataToAdd.project_details;
    if (!projectDetailsTemp) {
      projectDetailsTemp = searchProject(dataToAdd.project_name);
    }
    const cmd =
      "cd " +
      projectDetailsTemp?.uri.fsPath +
      ` && git rev-list --right-only --count origin/${dataToAdd.child_branch}...origin/${dataToAdd.parent_branch}`;
    const { stdout, stderr } = await exec(cmd);
    if (stderr) {
      console.error(`error: ${stderr}`);
    } else {
      numberOfCommits = stdout;
    }

    if (+numberOfCommits) {
      // this will be based on the condition we will
      // wheather it has merge conflicts
      try {
        const cmd =
          "cd " +
          projectDetailsTemp?.uri.fsPath +
          ` && git checkout ${dataToAdd.parent_branch} && git pull && git checkout ${dataToAdd.child_branch} && git pull && git add . && git merge ${dataToAdd.parent_branch} --no-edit --no-verify`;

        await exec(cmd);
        currentStatus = {
          id: StatusIdentifierEnum.READY_FOR_MERGE,
          status: `The source branch is ${numberOfCommits} commits behind the target branch`,
        };
      } catch (error) {
        if (
          error.stderr.includes("from the remote, but no such ref was fetched")
        ) {
          showMessageOnScreen(
            `Either of branch is not present on remote ${dataToAdd.parent_branch} and ${dataToAdd.child_branch}.`
          );
          return false;
        }
        const statusDetails = await getTheMergeConflictDiff(
          projectDetailsTemp?.uri.fsPath
        );
        currentStatus = {
          id: StatusIdentifierEnum.MERGE_CONFLICTS,
          status: statusDetails,
        };
      }
    } else {
      currentStatus = {
        id: StatusIdentifierEnum.UP_TO_DATE,
        status: "The branch is up to date.",
      };
    }
    if (tempApplicationData) {
      if (
        Object.keys(tempApplicationData.branch_data).includes(
          dataToAdd.project_name
        )
      ) {
        tempApplicationData.branch_data[dataToAdd.project_name][
          currentStatus.id
        ].push({
          is_checked: false,
          parent_branch: dataToAdd.parent_branch,
          child_branch: dataToAdd.child_branch,
          status: currentStatus.status,
          id: new Date().getTime(),
        });
      } else {
        const tempBranchData = {
          [StatusIdentifierEnum.MERGING]: <any>[],
          [StatusIdentifierEnum.MERGE_CONFLICTS]: <any>[],
          [StatusIdentifierEnum.READY_FOR_MERGE]: <any>[],
          [StatusIdentifierEnum.UP_TO_DATE]: <any>[],
        };
        tempBranchData[currentStatus.id].push({
          is_checked: false,
          parent_branch: dataToAdd.parent_branch,
          child_branch: dataToAdd.child_branch,
          status: currentStatus.status,
        });
        tempApplicationData.branch_data[dataToAdd.project_name] =
          tempBranchData;
      }
      if (refresh) {
        refreshApplicationData = JSON.parse(
          JSON.stringify(tempApplicationData)
        );
        return refreshApplicationData;
      } else {
        updateApplicationData(tempApplicationData);
        sendMessage(SendActionEnum.APPLICATION_DATA, {
          ...tempApplicationData,
          current_projects: vscode.workspace?.workspaceFolders?.map(
            (x) => x.name
          ),
        });
      }
    }
  } catch (error) {
    console.error("___error___", error);
  }
}

function deleteData(recordToBeDeleted: any): void {
  let tempApplicationData: IBaseDataStructure | any =
    globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
  recordToBeDeleted.items.forEach((element: any) => {
    tempApplicationData.branch_data[recordToBeDeleted.currentProject][
      recordToBeDeleted.sectionName
    ] = tempApplicationData.branch_data[recordToBeDeleted.currentProject][
      recordToBeDeleted.sectionName
    ].filter((x: { id: string }) => x.id !== element.id);
  });
  updateApplicationData(tempApplicationData);
  sendMessage(SendActionEnum.APPLICATION_DATA, {
    ...tempApplicationData,
    current_projects: [recordToBeDeleted.currentProject],
  });
}

function updateApplicationData(data: any): void {
  globalContext.globalState.update(GlobalDetails.PARENT_CACHE_KEY, data);
}
function sendMessage(action: string, data: any): void {
  if (currentPanel) {
    currentPanel.webview.postMessage({ action, data });
  }
}
function getWebviewContent(): any {
  try {
    const htmlBodyData = fs.readFileSync(
      currentPanel?.webview.asWebviewUri(
        vscode.Uri.file(
          path.join(globalContext.extensionPath, "website", "content.html")
        )
      )?.path ?? "",
      "utf8"
    );
    const mainJSFileData = fs.readFileSync(
      currentPanel?.webview.asWebviewUri(
        vscode.Uri.file(
          path.join(globalContext.extensionPath, "website", "js", "main.js")
        )
      )?.path ?? "",
      "utf8"
    );
    const globalStyleFileData = fs.readFileSync(
      currentPanel?.webview.asWebviewUri(
        vscode.Uri.file(
          path.join(globalContext.extensionPath, "website", "css", "global.css")
        )
      )?.path ?? "",
      "utf8"
    );
    const styleFileData = fs.readFileSync(
      currentPanel?.webview.asWebviewUri(
        vscode.Uri.file(
          path.join(globalContext.extensionPath, "website", "css", "style.css")
        )
      )?.path ?? "",
      "utf8"
    );

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
	${mainJSFileData}
</script>
</body>
</html>
	`;
  } catch (error) {
    showMessageOnScreen(
      `there is an error in the view html ${JSON.stringify(error)}`
    );
  }
}

function showMessageOnScreen(message: string) {
  vscode.window.showInformationMessage(message);
}
// this method is called when your extension is deactivated
export function deactivate() {}
