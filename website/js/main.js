var app = angular.module("myApp", []);

app.controller("customersCtrl", function ($scope, $http) {
  $scope.currentProject = "";
  $scope.globalApplicationData;
  $scope.add_project_details_button = true;
  window.addEventListener("message", (event) => {
    const { action, data } = event.data;

    switch (action) {
      case "start_refreshing":
        $scope.startRefreshing();
        break;
      case "ready_to_start_merging":
        $scope.startMerging("ready_to_merge");
        break;
      case "stash_error":
        if (data) {
          $scope.disableAllAction = false;
          $scope.stashError = data;
        }
        break;
      case "application_data":
        $scope.disableAllAction = false;
        $scope.stashError = false;
        $scope.applicationData = JSON.parse(JSON.stringify(data));
        $scope.globalApplicationData = JSON.parse(JSON.stringify(data));
        $scope.project_dropdown_value = Array.from(
          new Set([...Object.keys(data.branch_data), ...data.current_projects])
        ).filter(Boolean);
        if ($scope.project_dropdown_value.length === 1) {
          $scope.currentProject = $scope.project_dropdown_value[0];
        } else {
          $scope.currentProject = Object.keys(data.branch_data)[0];
        }
        // initi variable
        initializedAppVariable();
        // add
        resetAddSectionValue();
        break;

      case "verify_project":
        $scope.addFormObject.project_name = data.branch_name;
        $scope.add_project_details_inputs = !data.branch_data;
        break;

      case "verify_branch":
        if (data.verifiedFor === "parent") {
          $scope.is_parent_branch_exists = data.value;
        } else {
          $scope.is_child_branch_exists = data.value;
        }
        setAddDetailsButton();
        break;
      default:
        break;
    }
    $scope.$apply();
  });

  $scope.startRefreshing = function () {
    $scope.applicationData.last_refreshed_on = new Date().toString();
    $scope.disableAllAction = true;
    sendMessageToExtension("refresh_data", {
      currentProject: $scope.currentProject,
    });
  };
  $scope.refreshTable = function () {
    sendMessageToExtension("is_stash", {
      currentProject: $scope.currentProject,
      from: "refresh",
    });
  };
  //search
  $scope.search = function () {
    // if application data is not present then we dont search
    if (
      $scope.globalApplicationData.branch_data[$scope.currentProject] &&
      $scope.searchText
    ) {
      let tempApplicationData = {};
      $scope.globalApplicationData.status_details.forEach((res) => {
        tempApplicationData[res.id] = [];
        // if the state has no data then we dont search
        if (
          $scope.globalApplicationData.branch_data[$scope.currentProject][
            res.id
          ].length
        ) {
          $scope.globalApplicationData.branch_data[$scope.currentProject][
            res.id
          ].forEach((branchDetails) => {
            if (
              branchDetails.parent_branch
                .toLowerCase()
                .includes($scope.searchText.toLowerCase()) ||
              branchDetails.child_branch
                .toLowerCase()
                .includes($scope.searchText.toLowerCase())
            ) {
              tempApplicationData[res.id].push(branchDetails);
            }
          });
        }
      });
      $scope.applicationData.branch_data[$scope.currentProject] =
        tempApplicationData;
    } else {
      $scope.applicationData.branch_data[$scope.currentProject] =
        $scope.globalApplicationData.branch_data[$scope.currentProject];
    }
  };
  // add section logic
  $scope.showAddModal = function () {
    $scope.showAddSection = !$scope.showAddSection;
    if ($scope.project_dropdown_value.length === 1) {
      $scope.addFormObject.project_name = $scope.project_dropdown_value[0];
      $scope.add_project_details_inputs = false;
    }
  };
  $scope.closeAddSection = function () {
    resetAddSectionValue();
  };
  $scope.addBranch = function () {
    sendMessageToExtension("add_data", {
      ...$scope.addFormObject,
      project_details: $scope.add_project_details_inputs,
    });
  };

  $scope.verifyBranch = function (branchName, from) {
    let isCurrentFieldTruthy = false;
    if (from === "child") {
      if ($scope.addFormObject.child_branch) {
        $scope.is_child_branch_exists = null;
        isCurrentFieldTruthy = true;
      } else {
        $scope.is_child_branch_exists = "";
      }
    } else {
      if ($scope.addFormObject.parent_branch) {
        isCurrentFieldTruthy = true;
        $scope.is_parent_branch_exists = null;
      } else {
        $scope.is_parent_branch_exists = "";
      }
    }
    if (isCurrentFieldTruthy) {
      sendMessageToExtension("verify_branch", {
        verifyFor: from,
        branch_name: branchName,
        project_details: $scope.add_project_details_inputs,
        project_name: $scope.addFormObject.project_name,
      });
    }
  };

  $scope.setProjectName = function () {
    $scope.add_project_details_inputs = $scope.addFormObject.project_name
      ? false
      : true;
    setAddDetailsButton();
  };
  /* Checkbox */
  $scope.checkboxHasBeenCalled = function (sectionName, selectedBranchDetails) {
    if (selectedBranchDetails.is_checked) {
      $scope.selectedBranchDetails[sectionName].push(selectedBranchDetails);
      if (
        $scope.selectedBranchDetails[sectionName].length ===
        $scope.applicationData.branch_data[$scope.currentProject][sectionName]
          .length
      ) {
        $scope.hasAllCheckboxClicked[sectionName] = true;
      }
    } else {
      $scope.selectedBranchDetails[sectionName] = $scope.selectedBranchDetails[
        sectionName
      ].filter((x) => x.id !== selectedBranchDetails.id);
      $scope.hasAllCheckboxClicked[sectionName] = false;
    }
  };
  $scope.checkAllBoxes = function (sectionName, selectedSection, currentValue) {
    if (currentValue) {
      $scope.selectedBranchDetails[sectionName] = selectedSection;
    } else {
      $scope.selectedBranchDetails[sectionName] = [];
    }
    selectedSection.forEach((res) => {
      res.is_checked = currentValue;
    });
  };
  /* Delete */
  $scope.deleteBranch = function (sectionName) {
    sendMessageToExtension("delete", {
      items: [...$scope.selectedBranchDetails[sectionName]],
      sectionName,
      currentProject: $scope.currentProject,
    });
    $scope.selectedBranchDetails[sectionName] = [];
    $scope.hasAllCheckboxClicked[sectionName] = false;
  };
  /* Merge */
  $scope.mergeBranch = function (sectionName) {
    sendMessageToExtension("is_stash", {
      currentProject: $scope.currentProject,
      from: "merge",
    });
  };
  $scope.startMerging = function (sectionName) {
    // move from 'ready to merge' to 'merging'
    $scope.applicationData.branch_data[$scope.currentProject]["merging"] = [
      ...$scope.selectedBranchDetails[sectionName],
    ];
    const deselected = [];
    $scope.applicationData.branch_data[$scope.currentProject][
      sectionName
    ].forEach((res) => {
      if (
        !$scope.selectedBranchDetails[sectionName].find((x) => x.id === res.id)
      ) {
        res.is_checked = true;
        deselected.push(res);
      }
    });
    $scope.applicationData.branch_data[$scope.currentProject][sectionName] =
      deselected;
    // then we will call the above lines
    sendMessageToExtension("merge", {
      items: [...$scope.selectedBranchDetails[sectionName]],
      currentProject: $scope.currentProject,
    });
    $scope.selectedBranchDetails[sectionName] = [];
    $scope.hasAllCheckboxClicked[sectionName] = false;
  };
  resetAddSectionValue = () => {
    $scope.showAddSection = false;
    $scope.is_parent_branch_exists = "";
    $scope.is_child_branch_exists = "";
    $scope.addFormObject = {
      project_name: "",
      parent_branch: "",
      child_branch: "",
      id: new Date().getTime(),
      is_is_checked: false,
    };
    $scope.add_project_details_inputs = true;
    $scope.add_project_details_button = true;
  };

  setAddDetailsButton = () => {
    if (
      $scope.addFormObject.parent_branch !==
        $scope.addFormObject.child_branch &&
      $scope.is_parent_branch_exists === false &&
      $scope.is_child_branch_exists === false &&
      $scope.addFormObject.project_name
    ) {
      $scope.add_project_details_button = false;
    } else {
      $scope.add_project_details_button = true;
    }
  };

  initializedAppVariable = () => {
    /* Checkbox */
    $scope.selectedBranchDetails = {
      merging: [],
      ready_to_merge: [],
      merge_conflicts: [],
      up_to_date: [],
    };
    $scope.hasAllCheckboxClicked = {
      merging: false,
      ready_to_merge: false,
      merge_conflicts: false,
      up_to_date: false,
    };
    // add section logic
    $scope.showAddSection = false;
    $scope.addFormObject = {
      project_name: "",
      parent_branch: "",
      child_branch: "",
      id: new Date().getTime(),
      is_is_checked: false,
    };

    //search
    $scope.searchText = "";
    $scope.stashError = false;
  };
});

function sendMessageToExtension(action, data) {
  vscode.postMessage({
    action,
    data,
  });
}
