var app = angular.module('myApp', []);
        app.controller('customersCtrl', function ($scope, $http) {
            $scope.names = [
                {
                    Name: "aditya",
                    Country: "India"
                },
                {
                    Name: "aditya 2",
                    Country: "India 2"
                },
                {
                    Name: "aditya 3",
                    Country: "India 3"
                },
                {
                    Name: "aditya 6",
                    Country: "India 6"
                }
            ]
        });