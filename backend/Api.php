<?php

namespace App\Controllers;

/**
 * Api Controller
 * ---------------------------------------------------------
 * JSON API layer for the FU-UBRA Expo mobile app.
 * Place at: app/Controllers/Api.php
 *
 * Add to app/Config/Routes.php:
 *
 *   $routes->group('api', function ($routes) {
 *       $routes->post('auth/login', 'Api::login');
 *       $routes->get('tools', 'Api::tools');
 *       $routes->post('tools/scan-borrow', 'Api::toolsScanBorrow');
 *       $routes->post('tools/scan-return', 'Api::toolsScanReturn');
 *       $routes->get('vehicles', 'Api::vehicles');
 *       $routes->post('vehicles', 'Api::addVehicle');
 *       $routes->get('vehicles/(:any)/location', 'Api::vehicleLocation/$1');
 *       $routes->get('trip-tickets/next', 'Api::nextTripTicket');
 *       $routes->post('trip-tickets/(:num)/scan-in', 'Api::tripScanIn/$1');
 *       $routes->post('trip-tickets/(:num)/scan-out', 'Api::tripScanOut/$1');
 *       $routes->get('safety/buildings', 'Api::safetyBuildings');
 *       $routes->get('safety/aircon', 'Api::safetyAircon');
 *       $routes->post('safety/fire-extinguishers', 'Api::saveExtinguisher');
 *       $routes->get('janitorial/zones', 'Api::janitorialZones');
 *       $routes->get('janitorial/checklist/(:num)', 'Api::janitorialChecklist/$1');
 *       $routes->post('janitorial/checklist/(:num)', 'Api::saveJanitorialChecklist/$1');
 *       $routes->get('guard/keylog', 'Api::guardKeylog');
 *       $routes->post('guard/keylog/scan-borrow', 'Api::guardScanBorrow');
 *       $routes->post('guard/keylog/scan-return', 'Api::guardScanReturn');
 *       $routes->get('guard/trip-tickets/today', 'Api::guardTripTicketsToday');
 *   });
 *
 * All methods below use placeholder data shaped exactly like what the
 * mobile app expects — replace the TODOs with real Model calls.
 * Add a real auth filter (JWT/session token check) before shipping.
 * ---------------------------------------------------------
 */
class Api extends BaseController
{
    // ---------- AUTH ----------

    public function login()
    {
        $employeeId = $this->request->getJSON()->employee_id ?? '';
        $password   = $this->request->getJSON()->password ?? '';

        // TODO: verify against your personnel table (hashed password check)
        // $model = new \App\Models\PersonnelModel();
        // $user = $model->verifyLogin($employeeId, $password);
        // if (!$user) return $this->response->setJSON(['message' => 'Invalid credentials'])->setStatusCode(401);

        if (empty($employeeId) || empty($password)) {
            return $this->response->setStatusCode(401)->setJSON(['message' => 'Invalid credentials']);
        }

        // TODO: generate a real signed token (e.g. firebase/php-jwt) instead of this placeholder
        $token = bin2hex(random_bytes(24));

        return $this->response->setJSON([
            'token' => $token,
            'user' => [
                'name'        => 'Engr. James Diaz',
                'employee_id' => $employeeId,
                'department'  => 'Facilities',
                'is_guard'    => false,
            ],
        ]);
    }

    // ---------- TOOLS ----------

    public function tools()
    {
        $category = $this->request->getGet('category');
        // TODO: $model = new \App\Models\ToolsModel(); return $model->getByCategory($category);
        return $this->response->setJSON([
            'tools' => [
                ['asset_id' => 'CT-001', 'tool_name' => 'Hammer (claw)', 'condition' => 'Good', 'status' => 'Available', 'qty' => 5],
                ['asset_id' => 'CT-002', 'tool_name' => 'Hand saw', 'condition' => 'Good', 'status' => 'Borrowed', 'qty' => 2],
            ],
            'category' => $category,
        ]);
    }

    public function toolsScanBorrow()
    {
        $code = $this->request->getJSON()->code ?? '';
        // TODO: look up tool + borrower by scanned code, insert borrow record
        return $this->response->setJSON([
            'action'        => 'borrow confirmed',
            'borrower_name' => 'Dela Cruz, Juan M.',
            'tool_name'     => 'Hand Saw',
            'asset_id'      => 'CT-002',
            'timestamp'     => date('M j, Y — h:i A'),
        ]);
    }

    public function toolsScanReturn()
    {
        $code = $this->request->getJSON()->code ?? '';
        // TODO: mark the borrow record as returned
        return $this->response->setJSON([
            'action'        => 'return confirmed',
            'borrower_name' => 'Dela Cruz, Juan M.',
            'tool_name'     => 'Hand Saw',
            'asset_id'      => 'CT-002',
            'timestamp'     => date('M j, Y — h:i A'),
        ]);
    }

    // ---------- VEHICLES ----------

    public function vehicles()
    {
        // TODO: $model = new \App\Models\VehicleModel(); return $model->all();
        return $this->response->setJSON([
            'vehicles' => [
                ['plate' => 'FUA-8802', 'name' => 'Toyota Coaster', 'type' => '30-seater bus', 'driver' => 'Juan Santos', 'department' => 'Athletics', 'license_expiry' => 'Oct 12, 2026', 'status' => 'available'],
                ['plate' => 'FUA-4311', 'name' => 'Toyota Hilux', 'type' => '4x4 utility truck', 'driver' => 'Carlo Dalisay', 'department' => 'Property & Gen', 'license_expiry' => 'Aug 3, 2026', 'status' => 'available'],
            ],
        ]);
    }

    public function addVehicle()
    {
        $data = $this->request->getJSON(true);
        // TODO: validate + insert into vehicles table
        return $this->response->setJSON(['message' => 'Vehicle saved', 'vehicle' => $data]);
    }

    public function nextTripTicket()
    {
        // TODO: fetch the logged-in driver's next active/pending trip ticket
        return $this->response->setJSON([
            'ticket' => [
                'id' => 1,
                'ticket_no'   => 'TKT-2026-0843',
                'driver'      => 'Rodrigo S. Cruz',
                'vehicle'     => 'Toyota Hiace (SDF-4810)',
                'destination' => 'District 4 Campus',
                'departure'   => '08:30 AM',
                'return_time' => '05:30 PM',
            ],
        ]);
    }

    public function tripScanIn($id)
    {
        // TODO: log scan-in time for trip ticket $id
        return $this->response->setJSON(['message' => "Trip ticket {$id} scanned in"]);
    }

    public function tripScanOut($id)
    {
        // TODO: log scan-out time for trip ticket $id
        return $this->response->setJSON(['message' => "Trip ticket {$id} scanned out"]);
    }

    public function vehicleLocation($plate)
    {
        // TODO: replace with a real call to the Traccar server once the Sinotrack
        // ST-901L units are deployed, e.g.:
        //   GET {TRACCAR_URL}/api/positions?deviceId={id mapped from $plate}
        //   (HTTP Basic Auth with a Traccar account — see traccar.org/api-reference)
        // Traccar reports speed in knots — convert with speed_kmh = position.speed * 1.852,
        // and ignition/battery/power live under position.attributes.
        $baseLat = 9.3097; // Foundation University, Dumaguete
        $baseLng = 123.3080;
        return $this->response->setJSON([
            'plate'          => $plate,
            'lat'            => $baseLat + (mt_rand(-50, 50) / 10000),
            'lng'            => $baseLng + (mt_rand(-50, 50) / 10000),
            'speed_kmh'      => mt_rand(0, 60),
            'course'         => mt_rand(0, 359),
            'ignition'       => (bool) mt_rand(0, 1),
            'battery_level'  => mt_rand(60, 100),
            'external_power' => true,
            'last_update'    => date('c'),
        ]);
    }

    // ---------- SAFETY ----------

    public function safetyBuildings()
    {
        // TODO: $model = new \App\Models\SafetyModel(); return $model->buildingsWithCounts();
        return $this->response->setJSON([
            'buildings' => [
                ['key' => 'admin', 'name' => 'Admin Bldg', 'extinguisher_count' => 6],
                ['key' => 'ccs', 'name' => 'CCS Bldg', 'extinguisher_count' => 4],
                ['key' => 'science', 'name' => 'Science Bldg', 'extinguisher_count' => 3],
                ['key' => 'gym', 'name' => 'Gym', 'extinguisher_count' => 2],
                ['key' => 'library', 'name' => 'Library', 'extinguisher_count' => 3],
                ['key' => 'nursing', 'name' => 'Nursing Bldg', 'extinguisher_count' => 3],
            ],
        ]);
    }

    public function safetyAircon()
    {
        $building = $this->request->getGet('building');
        // TODO: fetch real aircon unit record for $building
        return $this->response->setJSON([
            'unit' => [
                'unit' => 'Carrier 2.5HP',
                'location' => 'CCS Lab 3',
                'last_cleaning' => 'Jun 1, 2026',
                'next_schedule' => 'Aug 1, 2026',
                'condition' => 'Operational',
                'assigned_tech' => 'J. Diaz',
            ],
        ]);
    }

    public function saveExtinguisher()
    {
        $data = $this->request->getJSON(true);
        // TODO: insert into fire_extinguishers table
        return $this->response->setJSON(['message' => 'Fire extinguisher record saved', 'data' => $data]);
    }

    // ---------- JANITORIAL ----------

    public function janitorialZones()
    {
        // TODO: $model = new \App\Models\JanitorialModel(); return $model->zonesWithStatus();
        return $this->response->setJSON([
            'zones' => [
                ['id' => 1, 'name' => 'Admin CR', 'status' => 'done'],
                ['id' => 2, 'name' => 'CCS CR 1F', 'status' => 'pending'],
                ['id' => 3, 'name' => 'CCS CR 2F', 'status' => 'pending'],
                ['id' => 4, 'name' => 'Main lobby', 'status' => 'done'],
                ['id' => 5, 'name' => 'Gym CR', 'status' => 'missed'],
                ['id' => 6, 'name' => 'Library CR', 'status' => 'done'],
                ['id' => 7, 'name' => 'Canteen', 'status' => 'pending'],
                ['id' => 8, 'name' => 'Nursing CR', 'status' => 'done'],
            ],
        ]);
    }

    public function janitorialChecklist($zoneId)
    {
        // TODO: fetch real checklist tasks for this zone/shift
        return $this->response->setJSON([
            'tasks' => [
                ['id' => 1, 'task' => 'Floor mopping', 'done' => true, 'time' => '07:15 AM'],
                ['id' => 2, 'task' => 'Toilet bowl cleaning', 'done' => true, 'time' => '07:22 AM'],
                ['id' => 3, 'task' => 'Urinal cleaning', 'done' => true, 'time' => '07:28 AM'],
                ['id' => 4, 'task' => 'Tissue and soap refilling', 'done' => false, 'time' => null],
                ['id' => 5, 'task' => 'Trash collection', 'done' => false, 'time' => null],
                ['id' => 6, 'task' => 'Mirror and sink wiping', 'done' => false, 'time' => null],
                ['id' => 7, 'task' => 'Deodorizing / air freshener', 'done' => false, 'time' => null],
            ],
        ]);
    }

    public function saveJanitorialChecklist($zoneId)
    {
        $data = $this->request->getJSON(true);
        // TODO: update task completion status + timestamps for $zoneId
        return $this->response->setJSON(['message' => "Checklist for zone {$zoneId} saved", 'tasks' => $data['tasks'] ?? []]);
    }

    // ---------- GUARD ----------

    public function guardKeylog()
    {
        // TODO: $model = new \App\Models\GuardModel(); return $model->keylog();
        return $this->response->setJSON([
            'logs' => [
                ['log_no' => 'KL-001', 'name' => 'Dela Cruz, J.', 'department' => 'Library', 'key_borrowed' => 'Library storeroom key', 'scan_in' => '07:30 AM', 'scan_out' => '12:00 PM', 'status' => 'Returned'],
                ['log_no' => 'KL-002', 'name' => 'Magsaysay, R.', 'department' => 'CCS', 'key_borrowed' => 'Server room key', 'scan_in' => '08:15 AM', 'scan_out' => null, 'status' => 'Active'],
            ],
        ]);
    }

    public function guardScanBorrow()
    {
        $code = $this->request->getJSON()->code ?? '';
        // TODO: verify faculty/staff (block students), log key borrow
        return $this->response->setJSON(['message' => 'Key borrow logged']);
    }

    public function guardScanReturn()
    {
        $code = $this->request->getJSON()->code ?? '';
        // TODO: mark key as returned
        return $this->response->setJSON(['message' => 'Key return logged']);
    }

    public function guardTripTicketsToday()
    {
        // TODO: fetch today's trip tickets
        return $this->response->setJSON([
            'tickets' => [
                ['trip_id' => 'TR-2026-085', 'driver' => 'Juan Santos', 'vehicle' => 'Toyota Coaster', 'plate' => 'FUA-8802', 'destination' => 'Bacolod Coliseum', 'departure' => '07:00 AM', 'return_time' => null, 'status' => 'In transit'],
                ['trip_id' => 'TR-2026-086', 'driver' => 'Rodrigo S. Cruz', 'vehicle' => 'Toyota Hiace', 'plate' => 'SDF-4810', 'destination' => 'District 4 Campus', 'departure' => '08:30 AM', 'return_time' => null, 'status' => 'Pending'],
            ],
        ]);
    }
}
