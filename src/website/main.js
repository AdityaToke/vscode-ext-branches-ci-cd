
var app = angular.module('myApp', []);

app.controller('customersCtrl', function ($scope, $http) {
    $scope.add_project_details = true;
    $scope.is_parent_branch_exists = false;
    $scope.is_child_branch_exists = false;
    window.addEventListener('message', event => {
        const { action, data } = event.data;
        switch (action) {
            case "application_data":
                $scope.applicationData = data;
                $scope.project_dropdown_value = Object.keys(data.branch_data);
                $scope.currentProject = Object.keys(data.branch_data)[0];
                $scope.existing_project_dropdown_value = data.current_projects;
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
    $scope.isMultiSelected = false;
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
    $scope.refreshTable = function () {
        $scope.applicationData.last_refreshed_on = new Date().toString();
    };
    $scope.showAddModal = function () {
        $scope.showAddSection = !$scope.showAddSection;
    }
    $scope.addBranch = function () {
        sendMessageToExtension('add_data', { ...$scope.addFormObject, project_details: $scope.add_project_details });
    }
    $scope.currentProject = "";
    $scope.selectProject = function (selectedWorkshop) {
        console.log(selectedWorkshop, "selectedWorkshop");
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
});

function sendMessageToExtension(action, data) {
    vscode.postMessage({
        action, data
    });
}