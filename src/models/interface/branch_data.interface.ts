import { StatusIdentifierEnum } from "../enum/status.enum";

export interface IBranchDetails {
    id: number;
    parent_branch: string;
    child_branch: string;
    status: string;
    is_checked: boolean;
    conflictsFilesPath?: string[];
}

export interface IBranchData {
    [project_name: string]: {
        [StatusIdentifierEnum.MERGING]: IBranchDetails[],
        [StatusIdentifierEnum.MERGE_CONFLICTS]: IBranchDetails[],
        [StatusIdentifierEnum.READY_FOR_MERGE]: IBranchDetails[],
        [StatusIdentifierEnum.UP_TO_DATE]: IBranchDetails[],
    }
}