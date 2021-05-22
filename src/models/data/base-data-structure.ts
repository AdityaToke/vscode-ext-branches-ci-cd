import { IBaseDataStructure } from "../interface/base_data_structure.interface";
import { StatusIdentifierEnum, StatusNameEnum } from "../enum/status.enum";

export function baseDataStructure(projectName: string) : IBaseDataStructure {
    return {
        last_refreshed_on: new Date().toString(),
        current_branch_details: {},
        status_details: [
            {
                id: StatusIdentifierEnum.MERGING,
                name: StatusNameEnum.MERGING,
                is_deletable: false,
                is_mergable: false,
            },
            {
                id: StatusIdentifierEnum.MERGE_CONFLICTS,
                name: StatusNameEnum.MERGE_CONFLICTS,
                is_deletable: true,
                is_mergable: false,
            },
            {
                id: StatusIdentifierEnum.READY_FOR_MERGE,
                name: StatusNameEnum.READY_FOR_MERGE,
                is_deletable: true,
                is_mergable: true,
            },
            {
                id: StatusIdentifierEnum.UP_TO_DATE,
                name: StatusNameEnum.UP_TO_DATE,
                is_deletable: true,
                is_mergable: false,
            }
        ],
        branch_data: {
            [projectName]: {
                [StatusIdentifierEnum.MERGING]: [
                    {
                        is_checked: false,
                        parent_branch: "develop",
                        child_branch: "feature/trailing-slash",
                        status: "Merging"
                    }
                ],
                [StatusIdentifierEnum.MERGE_CONFLICTS]: [
                    {
                        is_checked: false,
                        parent_branch: "develop",
                        child_branch: "feature/trailing-slash-v3",
                        status: "Their are total 23 merge conflicts, please manually merge the branch and resolve the conflicts."
                    }
                ],
                [StatusIdentifierEnum.READY_FOR_MERGE]: [
                    {
                        is_checked: false,
                        parent_branch: "develop",
                        child_branch: "feature/trailing-slash-v2",
                        status: "The branch is ready to merge in parent branch."
                    }
                ],
                [StatusIdentifierEnum.UP_TO_DATE]: [
                    {
                        is_checked: false,
                        parent_branch: "develop",
                        child_branch: "feature/trailing-slash",
                        status: "Your branch is up to date."
                    }
                ]
            }
        }
    }
}