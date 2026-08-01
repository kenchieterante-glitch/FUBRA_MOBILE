<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = rtrim($path, '/');

if ($path === '' || $path === '/') {
    echo json_encode(['message' => 'FU-UBRA API ready']);
    exit;
}

if ($path === '/api/tools') {
    echo json_encode([
        'tools' => [
            ['asset_id' => 'CT-001', 'tool_name' => 'Hammer (claw)', 'condition' => 'Good', 'status' => 'Available', 'qty' => 5],
            ['asset_id' => 'CT-002', 'tool_name' => 'Hand saw', 'condition' => 'Good', 'status' => 'Borrowed', 'qty' => 2],
        ],
        'category' => null,
    ]);
    exit;
}

if ($path === '/api/vehicles') {
    echo json_encode([
        'vehicles' => [
            ['plate' => 'FUA-8802', 'name' => 'Toyota Coaster', 'type' => '30-seater bus', 'driver' => 'Juan Santos', 'department' => 'Athletics', 'license_expiry' => 'Oct 12, 2026', 'status' => 'available'],
            ['plate' => 'FUA-4311', 'name' => 'Toyota Hilux', 'type' => '4x4 utility truck', 'driver' => 'Carlo Dalisay', 'department' => 'Property & Gen', 'license_expiry' => 'Aug 3, 2026', 'status' => 'available'],
        ],
    ]);
    exit;
}

if ($path === '/api/auth/login') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    echo json_encode([
        'token' => 'demo-token',
        'user' => [
            'name' => 'Engr. James Diaz',
            'employee_id' => $body['employee_id'] ?? 'demo',
            'department' => 'Facilities',
            'is_guard' => false,
        ],
    ]);
    exit;
}

if ($path === '/api/safety/buildings') {
    echo json_encode([
        'buildings' => [
            ['key' => 'admin', 'name' => 'Admin Bldg', 'extinguisher_count' => 6],
            ['key' => 'ccs', 'name' => 'CCS Bldg', 'extinguisher_count' => 4],
        ],
    ]);
    exit;
}

if ($path === '/api/janitorial/zones') {
    echo json_encode([
        'zones' => [
            ['id' => 1, 'name' => 'Admin CR', 'status' => 'done'],
            ['id' => 2, 'name' => 'CCS CR 1F', 'status' => 'pending'],
        ],
    ]);
    exit;
}

if ($path === '/api/guard/keylog') {
    echo json_encode([
        'logs' => [
            ['log_no' => 'KL-001', 'name' => 'Dela Cruz, J.', 'department' => 'Library', 'key_borrowed' => 'Library storeroom key', 'scan_in' => '07:30 AM', 'scan_out' => '12:00 PM', 'status' => 'Returned'],
        ],
    ]);
    exit;
}

http_response_code(404);
echo json_encode(['message' => 'Route not found']);
