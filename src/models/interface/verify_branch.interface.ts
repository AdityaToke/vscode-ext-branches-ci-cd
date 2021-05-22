import * as vscode from 'vscode';
export interface IVerifyBranch {
    project_details : vscode.WorkspaceFolder;
    branch_name: string;
    project_name: string;
    verifyFor: "parent" | "child";
}