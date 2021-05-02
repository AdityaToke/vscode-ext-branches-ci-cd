import { IBaseDataStructure } from "../interface/base_data_structure.interface";
import { StatusIdentifierEnum, StatusNameEnum } from "../enum/status.enum";

export const baseDataStructure: IBaseDataStructure = {
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
        [StatusIdentifierEnum.MERGING]: [],
        [StatusIdentifierEnum.MERGE_CONFLICTS]: [],
        [StatusIdentifierEnum.READY_FOR_MERGE]: [],
        [StatusIdentifierEnum.UP_TO_DATE]: [],
    }
}