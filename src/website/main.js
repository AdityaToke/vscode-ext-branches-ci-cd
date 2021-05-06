
var app = angular.module('myApp', []);

app.controller('customersCtrl', function ($scope, $http) {
    window.addEventListener('message', event => {
        const { action, data } = event.data;
        switch (action) {
            case "APPLICATION_DATA":
                $scope.applicationData = data;
                break;

            default:
                break;
        }
        $scope.$apply();
    });
    $scope.isMultiSelected = false;
    $scope.showAddSection = false;
    $scope.showWorkspaceDropdown = false;
    $scope.toggleWorkspaceDropdownInAddModal = function () {
        $scope.showWorkspaceDropdown = !$scope.showWorkspaceDropdown;
    };
    $scope.refreshTable = function () {
        $scope.applicationData.last_refreshed_on = new Date().toString();
    };
    $scope.showAddModal = function () {
        $scope.showAddSection = !$scope.showAddSection;
    }
});