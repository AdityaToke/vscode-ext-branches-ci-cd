import { IBranchData } from "./branch_data.interface";
import { ICurrentBranch } from "./current_branch.interface";
import { IStatusDetails } from "./status_detail.interface";

export interface IBaseDataStructure {
    last_refreshed_on: string;
    current_branch_details: Partial<ICurrentBranch>;
    status_details: IStatusDetails[];
    branch_data: IBranchData;
}