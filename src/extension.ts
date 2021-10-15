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
import { LogsTypeEnum } from "./models/enum/logs.enum";
let currentPanel: vscode.WebviewPanel | undefined = undefined;
let globalContext: vscode.ExtensionContext;
const util = require("util");
const exec = util.promisify(require("child_process").exec);
export function activate(context: vscode.ExtensionContext) {
  globalContext = context;
  log(LogsTypeEnum.INFO, "activate", "Git extension activated successfully");
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
          if (ext_data) {
            const currentWorkspaceProjects =
              vscode.workspace?.workspaceFolders?.map((x) => x.name);
            const projectsDetailList = Object.keys(ext_data.branch_data);
            ext_data.currentWorkspaceProjects = <string[]>(
              currentWorkspaceProjects
            );
            ext_data.projectsDetailList = projectsDetailList;
            updateApplicationData(ext_data);
          }
          if (!ext_data) {
            globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY, "");
            updateApplicationData(
              baseDataStructure(vscode.workspace.name ?? "")
            );
            ext_data = baseDataStructure(vscode.workspace.name ?? "");
          }

          if (vscode.workspace?.workspaceFolders) {
            const currentProject = vscode.workspace?.workspaceFolders[0].name;

            if (!Object.keys(ext_data.branch_data).includes(currentProject)) {
              ext_data = addProjectData(currentProject, ext_data);
            }
            currentPanel.webview.html = getWebviewContent();
            sendMessage(SendActionEnum.APPLICATION_DATA, {
              ...ext_data,
              current_projects: currentProject,
            });
          }
        }
      } catch (error) {
        log(LogsTypeEnum.ERROR, "activate", "Error", error);
        vscode.window.showInformationMessage(
          `error in main message ${JSON.stringify(error)}`
        );
      }
    }
  );

  globalContext.subscriptions.push(disposable);
}

function addProjectData(currentProject: string, applicationData: IBaseDataStructure ): IBaseDataStructure  {
  const tempBranchData = {
    [StatusIdentifierEnum.MERGING]: <any>[],
    [StatusIdentifierEnum.MERGE_CONFLICTS]: <any>[],
    [StatusIdentifierEnum.READY_FOR_MERGE]: <any>[],
    [StatusIdentifierEnum.UP_TO_DATE]: <any>[],
  };

  log(
    LogsTypeEnum.INFO,
    "addAndRefreshDataToStorage",
    "fresh data adding to project"
  );
  applicationData.branch_data[currentProject] = tempBranchData;
  return applicationData;
}
function receiveMessage() {
  log(LogsTypeEnum.INFO, "receiveMessage", "called successfully");
  currentPanel?.webview.onDidReceiveMessage(
    (message) => {
      const { action, data } = message;
      log(
        LogsTypeEnum.INFO,
        "receiveMessage",
        "extension message receiver",
        message
      );
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

        case ReceiveAction.LOGS:
          sendLogsToExtension();
          return;

        default:
          break;
      }
    },
    undefined,
    globalContext.subscriptions
  );
}

function sendLogsToExtension() {
  log(LogsTypeEnum.INFO, "sendLogsToExtension", "called successfully");
  const data = fs.readFileSync(
    path.join(globalContext.extensionPath, "website", "logs.txt"),
    { encoding: "utf8", flag: "r" }
  );
  sendMessage(SendActionEnum.LOGS, data.split(/\r\n|\n/));
}
async function resolveConflicts(data: any) {
  log(LogsTypeEnum.INFO, "resolveConflicts", "called successfully", data);
  let projectDetailsTemp = searchProject(data.currentProject);
  const cmd =
    "cd " +
    projectDetailsTemp?.uri.fsPath +
    ` && git checkout ${data.parent_branch} && git pull && git checkout ${data.child_branch} && git pull && git add . && git merge ${data.parent_branch} --no-edit && git diff --name-only --diff-filter=U`;
  log(LogsTypeEnum.COMMAND, "resolveConflicts", "command executed is - ", cmd);
  try {
    await exec(cmd);
    // TODO: need to find logic on if error is not thorwn in merge conflicts.
    // if error is thrown means it have Merge conflicts.
  } catch (error) {
    log(
      LogsTypeEnum.ERROR,
      "resolveConflicts",
      "Error thrown means it has merge conflicts"
    );
    if (error.stdout.toLowerCase().includes("automatic merge failed")) {
      try {
        const cmd =
          "cd " +
          projectDetailsTemp?.uri.fsPath +
          ` && git diff --name-only --diff-filter=U`;
        log(
          LogsTypeEnum.COMMAND,
          "resolveConflicts",
          "command executed is - ",
          cmd
        );

        const { stdout } = await exec(cmd);

        const conflictsFilesList = stdout.split("\n").filter(Boolean);
        log(
          LogsTypeEnum.INFO,
          "resolveConflicts",
          "List of all conflicted files",
          conflictsFilesList
        );
        for (const filesPath of conflictsFilesList) {
          await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(projectDetailsTemp?.uri.fsPath + "/" + filesPath)
          );
        }
        showMessageOnScreen(
          "After resolving merge conflicts click on refresh icon to update the extension."
        );
        const tempApplicationData: IBaseDataStructure | undefined =
          globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
        updateApplicationData(tempApplicationData);
        sendMessage(SendActionEnum.APPLICATION_DATA, {
          ...tempApplicationData,
          current_projects: [data.currentProject],
        });
      } catch (error) {
        log(
          LogsTypeEnum.ERROR,
          "resolveConflicts",
          "Error while trying to resolve conflicts",
          error
        );
      }
    }
  }
}
async function changesIsStashed(data: any, sendReturnResponseToWeb = false) {
  log(LogsTypeEnum.INFO, "changesIsStashed", "called successfully", {
    data,
    sendReturnResponseToWeb,
  });
  const projectDetailsTemp = searchProject(data.currentProject);
  const cmd = "cd " + projectDetailsTemp?.uri.fsPath + ` && git status`;
  log(LogsTypeEnum.COMMAND, "changesIsStashed", "command executed is - ", cmd);
  const { stdout } = await exec(cmd);
  if (
    stdout.toLowerCase().includes("changes not staged for commit") ||
    stdout.toLowerCase().includes("changes to be committed")
  ) {
    log(
      LogsTypeEnum.INFO,
      "changesIsStashed",
      "changes not stashed, sending stash error message to extension"
    );
    sendMessage(SendActionEnum.STASH_ERROR, true);
    return false;
  }
  if (sendReturnResponseToWeb) {
    if (data.from === "refresh") {
      log(
        LogsTypeEnum.INFO,
        "changesIsStashed",
        "sending start refreshing action to extension"
      );
      sendMessage(SendActionEnum.START_REFRESHING, true);
    } else {
      if (data.from === "merge") {
        log(
          LogsTypeEnum.INFO,
          "changesIsStashed",
          "sending merge action to extension"
        );
        sendMessage(SendActionEnum.READY_TO_START_MERGING, true);
      } else {
        if (data.from === "conflicts") {
          log(
            LogsTypeEnum.INFO,
            "changesIsStashed",
            "sending start fixing conflicts action to extension"
          );
          sendMessage(SendActionEnum.START_FIXING_CONFLICTS, data);
        } else {
          if (data.from === "add") {
            log(
              LogsTypeEnum.INFO,
              "changesIsStashed",
              "sending start add branch action to extension"
            );
            sendMessage(SendActionEnum.START_ADDING, data);
          }
        }
      }
    }
  }
  return true;
}
async function refreshData(data: any) {
  log(LogsTypeEnum.INFO, "refreshData", "called successfully", data);
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
      log(LogsTypeEnum.ERROR, "refreshData", "error found", error);
    }
  }
}
async function mergeData(data: any) {
  log(LogsTypeEnum.INFO, "mergeData", "called successfully", data);
  let projectDetailsTemp = searchProject(data.currentProject);
  const tempApplicationData: IBaseDataStructure | undefined =
    globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
  let element: IBranchDetails;
  for (let index = 0; index < data.items.length; index++) {
    element = data.items[index];
    if (tempApplicationData) {
      tempApplicationData.last_refreshed_on = new Date().toString();
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
      log(LogsTypeEnum.COMMAND, "mergeData", "command executed is - ", cmd);

      const { stdout } = await exec(cmd);
      if (stdout) {
        element.is_checked = false;
        tempApplicationData?.branch_data[data.currentProject].up_to_date.push(
          element
        );
        log(
          LogsTypeEnum.INFO,
          "mergeData",
          "added to up to date section",
          element
        );
      }
    } catch (error) {
      log(
        LogsTypeEnum.ERROR,
        "mergeData",
        "error found it can be merge conflict or push remaining",
        error
      );
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
        log(
          LogsTypeEnum.ERROR,
          "mergeData",
          "error found it is merge conflict",
          element
        );
      }
      if (
        error.stdout
          .toLowerCase()
          .includes('use "git push" to publish your local commits')
      ) {
        // again add the git push command
        // and after that we will add it to up to date.
        const cmd = "cd " + projectDetailsTemp?.uri.fsPath + ` && git push`;
        log(LogsTypeEnum.COMMAND, "mergeData", "command executed is - ", cmd);

        await exec(cmd);
        // add it in up to date
        element.is_checked = false;
        element.status = "The child branch is up to date.";
        tempApplicationData?.branch_data[data.currentProject].up_to_date.push(
          element
        );
        log(
          LogsTypeEnum.INFO,
          "mergeData",
          "pushing local commits after the normal merge",
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
  log(
    LogsTypeEnum.INFO,
    "getTheMergeConflictDiff",
    "called successfully",
    projectPath
  );
  let status = "";
  const cmd =
    "cd " +
    projectPath +
    " && git diff --name-only --diff-filter=U && git merge --abort";
  log(LogsTypeEnum.COMMAND, "getTheMergeConflictDiff", "cmd to be called", cmd);
  const { stdout } = await exec(cmd);
  status = "Conflicted Files - ";
  const conflictsFilesList = stdout.split("\n").filter(Boolean);
  log(
    LogsTypeEnum.INFO,
    "getTheMergeConflictDiff",
    "list of conflicted if",
    conflictsFilesList
  );
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
    log(
      LogsTypeEnum.INFO,
      "getTheMergeConflictDiff",
      "more than 3 conflicted files",
      status
    );
  }
  return status;
}
function verifyProject(projectName: string) {
  log(LogsTypeEnum.INFO, "verifyProject", "called successfully", projectName);
  sendMessage(SendActionEnum.VERIFY_PROJECT, {
    branch_name: projectName,
    branch_data: searchProject(projectName),
  });
}
function searchProject(projectName: string) {
  log(LogsTypeEnum.INFO, "searchProject", "called successfully", projectName);
  return vscode?.workspace?.workspaceFolders?.find(
    (x) => x.name.toLowerCase() === projectName.toLowerCase()
  );
}
async function verifyBranch(verifyBranchObj: IVerifyBranch) {
  log(
    LogsTypeEnum.INFO,
    "verifyBranch",
    "called successfully",
    verifyBranchObj
  );
  try {
    let projectDetailsTemp: vscode.WorkspaceFolder | undefined =
      verifyBranchObj.project_details;
    if (!projectDetailsTemp) {
      projectDetailsTemp = searchProject(verifyBranchObj.project_name);
    }
    log(
      LogsTypeEnum.INFO,
      "verifyProject",
      "project details info",
      projectDetailsTemp
    );
    const cmd =
      "cd " +
      projectDetailsTemp?.uri.fsPath +
      ` && git ls-remote origin ${verifyBranchObj.branch_name}`;
    log(LogsTypeEnum.COMMAND, "verifyBranch", "command executed is - ", cmd);

    const { stdout, stderr } = await exec(cmd);
    log(
      LogsTypeEnum.INFO,
      "verifyProject",
      "output after the branch verification",
      {stdout, stderr}
    );
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
    log(
      LogsTypeEnum.ERROR,
      "verifyProject",
      "error found, sending verify branch action",
      { error, verifiedFor: verifyBranchObj.verifyFor }
    );
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
  log(LogsTypeEnum.INFO, "addAndRefreshDataToStorage", "called successfully", {
    dataToAdd,
    refresh,
    refreshApplicationData,
  });
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
    log(
      LogsTypeEnum.COMMAND,
      "addAndRefreshDataToStorage",
      "command executed is - ",
      cmd
    );

    const { stdout, stderr } = await exec(cmd);
    if (stderr) {
      log(
        LogsTypeEnum.ERROR,
        "addAndRefreshDataToStorage",
        "error found while find number of commits",
        { stderr, projectDetailsTemp }
      );
    } else {
      log(
        LogsTypeEnum.INFO,
        "addAndRefreshDataToStorage",
        "found while finding number of commits",
        { stdout, projectDetailsTemp }
      );
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

        log(
          LogsTypeEnum.COMMAND,
          "addAndRefreshDataToStorage",
          "command executed is - ",
          cmd
        );
        await exec(cmd);
        currentStatus = {
          id: StatusIdentifierEnum.READY_FOR_MERGE,
          status: `The source branch is ${numberOfCommits} commits behind the target branch`,
        };
        log(
          LogsTypeEnum.INFO,
          "addAndRefreshDataToStorage",
          "normal merge with commits behind",
          numberOfCommits
        );
      } catch (error) {
        log(
          LogsTypeEnum.ERROR,
          "addAndRefreshDataToStorage",
          "error found while calculating number of commits",
          error
        );
        if (
          error.stderr.includes("from the remote, but no such ref was fetched")
        ) {
          log(
            LogsTypeEnum.INFO,
            "addAndRefreshDataToStorage",
            "either of branch is not present",
            dataToAdd
          );
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
        log(
          LogsTypeEnum.INFO,
          "addAndRefreshDataToStorage",
          "merge conflicts are there",
          statusDetails
        );
      }
    } else {
      log(
        LogsTypeEnum.INFO,
        "addAndRefreshDataToStorage",
        "setting status to up to date",
        numberOfCommits
      );
      currentStatus = {
        id: StatusIdentifierEnum.UP_TO_DATE,
        status: "The child branch is up to date.",
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
        log(
          LogsTypeEnum.INFO,
          "addAndRefreshDataToStorage",
          "data pushing to project",
          {
            is_checked: false,
            parent_branch: dataToAdd.parent_branch,
            child_branch: dataToAdd.child_branch,
            status: currentStatus.status,
            id: new Date().getTime(),
          }
        );
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
    log(LogsTypeEnum.ERROR, "addAndRefreshDataToStorage", "error found", error);
  }
}
function deleteData(recordToBeDeleted: any): void {
  log(
    LogsTypeEnum.INFO,
    "deleteData",
    "called successfully",
    recordToBeDeleted
  );
  let tempApplicationData: IBaseDataStructure | any =
    globalContext.globalState.get(GlobalDetails.PARENT_CACHE_KEY);
  recordToBeDeleted.items.forEach((element: any) => {
    tempApplicationData.branch_data[recordToBeDeleted.currentProject][
      recordToBeDeleted.sectionName
    ] = tempApplicationData.branch_data[recordToBeDeleted.currentProject][
      recordToBeDeleted.sectionName
    ].filter((x: { id: string }) => x.id !== element.id);
  });
  log(LogsTypeEnum.INFO, "deleteData", "successfully deleted the branch data");
  updateApplicationData(tempApplicationData);
  sendMessage(SendActionEnum.APPLICATION_DATA, {
    ...tempApplicationData,
    current_projects: [recordToBeDeleted.currentProject],
  });
}
function updateApplicationData(data: any): void {
  log(LogsTypeEnum.INFO, "updateApplicationData", "updated data successfully");
  globalContext.globalState.update(GlobalDetails.PARENT_CACHE_KEY, data);
}
function sendMessage(action: string, data: any): void {
  log(LogsTypeEnum.INFO, "sendMessage", "called successfully", action);
  if (currentPanel) {
    currentPanel.webview.postMessage({ action, data });
  }
}
function getWebviewContent(): any {
  try {
    log(LogsTypeEnum.INFO, "getWebviewContent", "called successfully");
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
    log(LogsTypeEnum.ERROR, "getWebviewContent", "error found", error);
    showMessageOnScreen(
      `there is an error in the view html ${JSON.stringify(error)}`
    );
  }
}
function showMessageOnScreen(message: string) {
  vscode.window.showInformationMessage(message);
}
function log(
  errorType: LogsTypeEnum,
  functionName: string,
  message: string,
  dataToLog?: any
) {
  const formattedLog = `[${errorType}] | ${new Date().toISOString()} - ${functionName} - ${message} ${
    dataToLog ? "- " + JSON.stringify(dataToLog) : ""
  } \n`;
  fs.writeFileSync(
    path.join(globalContext.extensionPath, "website", "logs.txt"),
    formattedLog,
    { flag: "a" }
  );
}
// this method is called when your extension is deactivated
export function deactivate() {}
