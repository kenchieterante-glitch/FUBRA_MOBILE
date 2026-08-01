<?php
// Add this block to app/Config/Routes.php

    $routes->group('api', function ($routes) {
    $routes->post('auth/login', 'Api::login');

    $routes->get('tools', 'Api::tools');
    $routes->post('tools/scan-borrow', 'Api::toolsScanBorrow');
    $routes->post('tools/scan-return', 'Api::toolsScanReturn');

    $routes->get('vehicles', 'Api::vehicles');
    $routes->post('vehicles', 'Api::addVehicle');
    $routes->get('trip-tickets/next', 'Api::nextTripTicket');
    $routes->post('trip-tickets/(:num)/scan-in', 'Api::tripScanIn/$1');
    $routes->post('trip-tickets/(:num)/scan-out', 'Api::tripScanOut/$1');

    $routes->get('safety/buildings', 'Api::safetyBuildings');
    $routes->get('safety/aircon', 'Api::safetyAircon');
    $routes->post('safety/fire-extinguishers', 'Api::saveExtinguisher');

    $routes->get('janitorial/zones', 'Api::janitorialZones');
    $routes->get('janitorial/checklist/(:num)', 'Api::janitorialChecklist/$1');
    $routes->post('janitorial/checklist/(:num)', 'Api::saveJanitorialChecklist/$1');

    $routes->get('guard/keylog', 'Api::guardKeylog');
    $routes->post('guard/keylog/scan-borrow', 'Api::guardScanBorrow');
    $routes->post('guard/keylog/scan-return', 'Api::guardScanReturn');
    $routes->get('guard/trip-tickets/today', 'Api::guardTripTicketsToday');
});
