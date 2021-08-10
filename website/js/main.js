var app = angular.module("myApp", []);

app.controller("customersCtrl", function ($scope, $http) {
  $scope.currentProject = "";
  $scope.globalApplicationData;
  $scope.add_project_details_button = true;
  window.addEventListener("message", (event) => {
    const { action, data } = event.data;
    switch (action) {
      case "application_data":
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
  $scope.refreshTable = function () {
    $scope.applicationData.last_refreshed_on = new Date().toString();
  };
  //search
  $scope.searchText = "";
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
              branchDetails.parent_branch.includes($scope.searchText) ||
              branchDetails.child_branch.includes($scope.searchText)
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
  $scope.showAddSection = false;
  $scope.addFormObject = {
    project_name: "",
    parent_branch: "",
    child_branch: "",
  };
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
    sendMessageToExtension("verify_branch", {
      verifyFor: from,
      branch_name: branchName,
      project_details: $scope.add_project_details_inputs,
      project_name: $scope.addFormObject.project_name,
    });
  };

  $scope.setProjectName = function () {
    $scope.add_project_details_inputs = $scope.addFormObject.project_name
      ? false
      : true;
    setAddDetailsButton();
  };
  resetAddSectionValue = () => {
    $scope.showAddSection = false;
    $scope.is_parent_branch_exists = null;
    $scope.is_child_branch_exists = null;
    $scope.addFormObject = {
      project_name: "",
      parent_branch: "",
      child_branch: "",
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
});

function sendMessageToExtension(action, data) {
  vscode.postMessage({
    action,
    data,
  });
}
