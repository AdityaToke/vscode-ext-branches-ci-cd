
var app = angular.module('myApp', []);

app.controller('customersCtrl', function ($scope, $http) {
    $scope.currentProject = "";
    $scope.selectProject = function (selectedWorkshop) {
        console.log(selectedWorkshop, "selectedWorkshop");
    }
    window.addEventListener('message', event => {
        const { action, data } = event.data;
        switch (action) {
            case "application_data":
                $scope.applicationData = data;
                $scope.project_dropdown_value = Array.from(new Set([...Object.keys(data.branch_data), ...data.current_projects]));
                $scope.currentProject = Object.keys(data.branch_data)[0];

                // add
                resetAddSectionValue();
                break;

            case "verify_project":
                $scope.addFormObject.project_name = data.branch_name;
                $scope.add_project_details = !data.branch_data;
                break;

            case "verify_branch":
                console.log(data, "verify data");
                if (data.verifiedFor === "parent") {
                    $scope.is_parent_branch_exists = data.value;
                } else {
                    $scope.is_child_branch_exists = data.value;
                }
                break;
            default:
                break;
        }
        $scope.$apply();
    });
    $scope.refreshTable = function () {
        $scope.applicationData.last_refreshed_on = new Date().toString();
    };
    // add section logic
    $scope.showAddSection = false;
    $scope.showProjectDropdown = false;
    $scope.addFormObject = { project_name: "", parent_branch: "", child_branch: "" };
    $scope.toggleProjectDropdownInAddModal = function () {
        $scope.showProjectDropdown = !$scope.showProjectDropdown;
        $scope.addFormObject.project_name = "";
        $scope.add_project_details = true;
        $scope.is_parent_branch_exists = false;
        $scope.is_child_branch_exists = false;
        $scope.addFormObject.parent_branch = "";
        $scope.addFormObject.child_branch = "";
    };
    $scope.showAddModal = function () {
        $scope.showAddSection = !$scope.showAddSection;
    }
    $scope.closeAddSection = function () {
        resetAddSectionValue();
    }
    $scope.addBranch = function () {
        sendMessageToExtension('add_data', { ...$scope.addFormObject, project_details: $scope.add_project_details });
    }

    $scope.verifyBranch = function (branchName, from) {
        sendMessageToExtension('verify_branch', { verifyFor: from, branch_name: branchName, project_details: $scope.add_project_details, project_name: $scope.addFormObject.project_name });
    }
    $scope.verifyProject = function (projectInputRef) {
        const projectName = projectInputRef.target.value;
        $scope.addFormObject.project_name = "";
        if (projectName)
            sendMessageToExtension('verify_project', projectInputRef.target.value);
    }
    $scope.setProjectName = function () {
        $scope.add_project_details = $scope.addFormObject.project_name ? false : true;
    }
    resetAddSectionValue = () => {
        $scope.showAddSection = false;
        $scope.is_parent_branch_exists = false;
        $scope.is_child_branch_exists = false;
        $scope.showProjectDropdown = false;
        $scope.addFormObject = { project_name: "", parent_branch: "", child_branch: "" };
        $scope.add_project_details = true;
    };
});

function sendMessageToExtension(action, data) {
    vscode.postMessage({
        action, data
    });
}