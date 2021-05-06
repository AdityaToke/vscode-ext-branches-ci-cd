
var app = angular.module('myApp', []);

app.controller('customersCtrl', function ($scope, $http) {
    window.addEventListener('message', event => {
        $scope.applicationData = event.data;
        $scope.$apply();
    });
    $scope.isMultiSelected = false;
    $scope.showAddSection = false;
    $scope.lastRefreshedOn = new Date();
    $scope.refreshTable = function () {
        $scope.lastRefreshedOn = new Date();
    };
    $scope.showAddModal = function () {
        $scope.showAddSection = !$scope.showAddSection;
    }
});


const dummyJson = [
    {
        name: "Merging",
        id: "merging",
        branch_data: [
            {
                is_checked: false,
                parent_branch: "develop",
                child_branch: "feature/trailing-slash",
                status: "Merging"
            }
        ]
    },
    {
        name: "Ready to Merge",
        id: "ready_to_merge",
        branch_data: [
            {
                is_checked: false,
                parent_branch: "develop",
                child_branch: "feature/trailing-slash-v2",
                status: "The branch is ready to merge in parent branch."
            }
        ]
    },
    {
        name: "Merge Conflicts",
        id: "merge_conflicts",
        branch_data: [
            {
                is_checked: false,
                parent_branch: "develop",
                child_branch: "feature/trailing-slash-v3",
                status: "Their are total 23 merge conflicts, please manually merge the branch and resolve the conflicts."
            }
        ]
    },
    {
        name: "Up to Date",
        id: "up_to_date",
        branch_data: [
            {
                is_checked: false,
                parent_branch: "develop",
                child_branch: "feature/trailing-slash",
                status: "Your branch is up to date."
            }
        ]
    }
]