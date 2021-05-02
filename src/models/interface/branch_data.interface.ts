import { StatusIdentifierEnum } from "../enum/status.enum";

export interface IBranchDetails {
    parent_branch: string;
    child_branch: string;
    status: string;
    pills: string;
    is_checked: boolean;
}

export interface IBranchData {
    [StatusIdentifierEnum.MERGING]: IBranchDetails[],
    [StatusIdentifierEnum.MERGE_CONFLICTS]: IBranchDetails[],
    [StatusIdentifierEnum.READY_FOR_MERGE]: IBranchDetails[],
    [StatusIdentifierEnum.UP_TO_DATE]: IBranchDetails[],
}