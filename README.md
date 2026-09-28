# FreshGuard — IoT Smart Refrigerator Monitoring System

FreshGuard is a complete, production-grade IoT Refrigerator Monitoring and Inventory System connecting physical ESP32 hardware to a modern MERN stack real-time dashboard via Socket.IO and MongoDB Atlas.

---

## System Architecture

```text
+---------------------------------------------------------------+
|                      PHYSICAL SENSORS                         |
|  DHT11 (Temp/Hum) | MQ135 (Gas ADC) | Reed Switch (Door)      |
|  RC522 (RFID)     | DS3231 (RTC)    | LEDs & Buzzer | LCD     |
+---------------------------------------------------------------+
                               |
                               v
+---------------------------------------------------------------+
|                      ESP32 HARDWARE                           |
|  - Autonomous local loop (Non-blocking alarm & LCD switching) |
|  - Safe 4-byte RFID UID matching (Beef & Mutton toggles)      |
|  - HTTPS Telemetry Dispatch (~2s interval via millis())       |
+---------------------------------------------------------------+
                               |
                               | HTTPS POST /api/device/data
                               | Header: X-Device-Key
                               v
+---------------------------------------------------------------+
|                   DEPLOYED NODE/EXPRESS API                   |
|  - Device API Key verification                                |
|  - Payload validation & state transition engine               |
|  - Deduplication: Prevents repeated food history entries      |
+---------------------------------------------------------------+
                 |                                |
                 | Mongoose                       | Socket.IO
                 v                                v
+---------------------------------+   +-------------------------+
|          MONGODB ATLAS          |   |     REACT DASHBOARD     |
|  - DeviceState (Single record)  |   |  - Real-time live pulse |
|  - FoodItem (Active inventory)  |   |  - Hardware RTC clock   |
|  - FoodHistory (RFID logs)      |   |  - Mobile responsive    |
+---------------------------------+   +-------------------------+
```

---

## Final Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, JavaScript, Tailwind CSS, Lucide React, Socket.IO Client, Axios |
| **Backend** | Node.js, Express.js, JavaScript (ESM), Mongoose, Socket.IO, CORS, dotenv |
| **Database** | MongoDB Atlas (Persistent cloud store) |
| **Hardware** | ESP32-WROOM-32, Arduino C++, FreeRTOS/millis() non-blocking architecture |

---

## Directory Structure

```text
FreshGuard/
|-- client/                         # React + Vite Frontend Application
|   |-- src/
|   |   |-- components/
|   |   |   |-- AlarmBanner.jsx     # Door open > 30s & High gas warning alerts
|   |   |   |-- ConnectionStatus.jsx# Backend health/reconnect indicators
|   |   |   |-- FoodHistory.jsx     # Persistent RFID event log (Atlas-backed)
|   |   |   |-- FoodInventory.jsx   # Active items physically inside fridge
|   |   |   |-- Header.jsx          # Live/Offline badge & telemetry timestamp
|   |   |   `-- MetricsGrid.jsx     # Temp, Humidity, Gas ADC, Door, RTC DS3231
|   |   |-- hooks/
|   |   |   `-- useFreshGuard.js    # State, Socket.IO binding & offline detection
|   |   |-- services/
|   |   |   |-- api.js              # Axios REST client
|   |   |   `-- socket.js           # Socket.IO connection manager
|   |   |-- utils/
|   |   |   `-- formatters.js       # Formatting & color-coding helpers
|   |   |-- App.jsx
|   |   |-- index.css
|   |   `-- main.jsx
|   |-- .env.example
|   |-- index.html
|   |-- package.json
|   |-- postcss.config.js
|   |-- tailwind.config.js
|   `-- vite.config.js
|
|-- server/                         # Node.js + Express + Socket.IO Backend
|   |-- config/
|   |   `-- db.js                   # MongoDB Atlas connection manager
|   |-- controllers/
|   |   `-- deviceController.js     # Telemetry ingest & dashboard endpoints
|   |-- middleware/
|   |   `-- auth.js                 # X-Device-Key verification & payload checks
|   |-- models/
|   |   |-- DeviceState.js          # Current refrigerator state (1 doc per device)
|   |   |-- FoodHistory.js          # Persistent RFID log (ADDED / REMOVED)
|   |   `-- FoodItem.js             # Active food inventory inside fridge
|   |-- routes/
|   |   `-- apiRoutes.js            # Express REST route definitions
|   |-- services/
|   |   `-- stateService.js         # Transition detection & Socket.IO broadcasts
|   |-- socket/
|   |   `-- socketHandler.js        # Socket.IO lifecycle & offline background monitor
|   |-- .env.example
|   |-- package.json
|   `-- server.js                   # Main application entry point
|
|-- esp32/
|   |-- ORIGINAL_FIRMWARE_REFERENCE.ino # Verbatim copy of original working code
|   `-- FreshGuard_ESP32_Cloud.ino      # Cloud-connected firmware (Non-blocking)
|
|-- .gitignore
`-- README.md
```

---

## PART A — MongoDB Atlas Setup

MongoDB Atlas is the persistent cloud database for FreshGuard.

1. **Create an Account or Log In**:
   - Visit [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. **Create a Free Cluster**:
   - Click **Create Deployment** -> Select **M0 Free** (Shared tier).
   - Choose your preferred cloud provider (AWS, GCP, or Azure) and nearest region.
   - Click **Create Deployment**.
3. **Create Database User Credentials**:
   - Go to **Security** -> **Database Access** -> **Add New Database User**.
   - Select **Password Authentication**.
   - Enter a username (e.g. `freshguard_user`) and a secure password (e.g. `FridgeSecret123!`).
   - Assign user privileges: **Read and write to any database**.
   - Click **Add User**.
4. **Configure Network Access (IP Whitelist)**:
   - Go to **Security** -> **Network Access** -> **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`).
   - *Note: Since the backend will be deployed to cloud hosting (like Render or Railway) with dynamic outgoing IPs, `0.0.0.0/0` is necessary for cloud connectivity.*
   - Click **Confirm**.
5. **Obtain Connection String**:
   - Go to **Deployment** -> **Database** -> Click **Connect** on your cluster.
   - Choose **Drivers** (Node.js).
   - Copy the SRV URI, which looks like:
     ```text
     mongodb+srv://freshguard_user:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your database user password.
   - Specify the database name by appending `freshguard` before the query parameter:
     ```text
     mongodb+srv://freshguard_user:YOUR_PASSWORD@cluster0.abcde.mongodb.net/freshguard?retryWrites=true&w=majority
     ```
   - **Important**: If your password contains special characters (`@`, `:`, `#`, `/`, `%`), you **must URL-encode** them (e.g., `#` becomes `%23`).
   - **Never commit your database credentials or URI to public repositories.**

---

## PART B — Local Backend Setup

1. **Open a terminal in the `server` directory**:
   ```bash
   cd server
   ```
2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Open `.env` and fill in your values:
     ```env
     PORT=5000
     MONGODB_URI=mongodb+srv://freshguard_user:YOUR_PASSWORD@cluster0.abcde.mongodb.net/freshguard?retryWrites=true&w=majority
     CLIENT_URL=http://localhost:5173
     ESP32_API_KEY=freshguard_secret_device_key_12345
     ```
4. **Start the Backend Server**:
   - In development mode (auto-reloads on file change):
     ```bash
     npm run dev
     ```
   - Or standard production start:
     ```bash
     npm start
     ```
   - Verify server output:
     ```text
     ✅ [DATABASE] Connected to MongoDB Atlas
     🛡️  FreshGuard Backend Server running on port 5000
     🌐  Local URL:        http://localhost:5000
     ```

---

## PART C — Local Frontend Setup

1. **Open a second terminal in the `client` directory**:
   ```bash
   cd client
   ```
2. **Install React dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - For local development, `.env` contains:
     ```env
     VITE_API_URL=http://localhost:5000
     VITE_SOCKET_URL=http://localhost:5000
     ```
4. **Start the Vite Development Server**:
   ```bash
   npm run dev
   ```
5. **Open Dashboard**:
   - Open your browser to [http://localhost:5173](http://localhost:5173).
   - Before the physical ESP32 is powered on, the dashboard will show:
     - Status: `ESP32 OFFLINE`
     - Temperature: `-- °C`
     - Humidity: `-- %`
     - Gas: `-- ADC`
     - Door: `--`
     - RTC Time: `--:--`
     - Inventory: `No food currently inside the refrigerator.`
     - History: `No food activity recorded yet.`

---

## PART D — ESP32 Physical Hardware Setup

### Hardware Wiring Reference

| Component | Pin / Signal | ESP32 GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **DHT11** | DATA | `GPIO 4` | Temperature & Relative Humidity |
| **MQ135** | AOUT | `GPIO 34` | ADC Analog Input (Raw 0–4095 ADC) |
| **Reed Switch** | Contact | `GPIO 14` | Configured as `INPUT_PULLDOWN`. High (5V) when door closed |
| **Green LED** | Cathode (-) | `GPIO 26` | Active-LOW (Anode tied to 5V via resistor) |
| **Red LED** | Cathode (-) | `GPIO 27` | Active-LOW (Anode tied to 5V via resistor) |
| **Buzzer** | Cathode (-) | `GPIO 12` | Active-LOW Piezo Buzzer |
| **RFID MFRC522** | SS / SDA | `GPIO 5` | SPI Chip Select |
| **RFID MFRC522** | SCK | `GPIO 18` | SPI Clock |
| **RFID MFRC522** | MOSI | `GPIO 23` | SPI MOSI |
| **RFID MFRC522** | MISO | `GPIO 19` | SPI MISO |
| **RFID MFRC522** | RST | `GPIO 16` | Module Reset |
| **DS3231 RTC** | SDA | `GPIO 21` | I2C Data |
| **DS3231 RTC** | SCL | `GPIO 22` | I2C Clock |
| **LCD 16x2 (I2C)**| SDA | `GPIO 21` | I2C Address: `0x27` |
| **LCD 16x2 (I2C)**| SCL | `GPIO 22` | I2C Clock |

### Required Arduino IDE Libraries

Install the following libraries via Arduino IDE Library Manager (`Ctrl + Shift + I`):
1. `MFRC522` by GithubCommunity
2. `LiquidCrystal I2C` by Frank de Brabander
3. `RTClib` by Adafruit
4. `DHT sensor library` by Adafruit
5. `Adafruit Unified Sensor` by Adafruit

### Firmware Configuration & Flashing

1. Open `esp32/FreshGuard_ESP32_Cloud.ino` in Arduino IDE.
2. Under **USER CONFIGURATION**, update the variables:
   ```cpp
   const char* WIFI_SSID      = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";

   // For local testing (use your computer's local Wi-Fi IP):
   const char* SERVER_URL     = "http://192.168.1.XXX:5000/api/device/data";
   // For deployed cloud backend (Render / Railway):
   // const char* SERVER_URL  = "https://your-backend.onrender.com/api/device/data";

   const char* DEVICE_API_KEY = "freshguard_secret_device_key_12345";
   const char* DEVICE_ID      = "freshguard-fridge-01";
   ```
3. Connect ESP32 via USB cable.
4. Select **Board**: `ESP32 Dev Module` (or `DOIT ESP32 DEVKIT V1`).
5. Select the correct **Port**.
6. Click **Upload** (`Ctrl + U`).
7. Open **Serial Monitor** at baud rate `115200`.

---

## PART E — Cloud Deployment

You can deploy FreshGuard using modern cloud application platforms (e.g. Render, Railway, Vercel, or Netlify). *Note: Hosting platforms manage their own free and paid tier policies over time.*

### 1. Backend Deployment (e.g. Render / Railway)
- Connect your GitHub repository.
- **Root Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `PORT`: Automatically provided by the host.
  - `MONGODB_URI`: Your MongoDB Atlas connection string.
  - `CLIENT_URL`: `https://YOUR-DEPLOYED-FRONTEND.vercel.app` (Your frontend URL).
  - `ESP32_API_KEY`: A secure random secret key (e.g., `FG_Key_98b7c6d5e4`).
- Deploy and note your public backend URL: `https://your-freshguard-backend.onrender.com`.

### 2. Frontend Deployment (e.g. Vercel / Netlify / Render Static)
- Connect your GitHub repository.
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_URL`: `https://your-freshguard-backend.onrender.com`
  - `VITE_SOCKET_URL`: `https://your-freshguard-backend.onrender.com`
- Deploy and note your public frontend URL: `https://your-freshguard-frontend.vercel.app`.

---

## PART F — After Deployment Configuration

Once both the frontend and backend are deployed:

1. **Update Backend CORS Environment Variable**:
   - In your backend hosting dashboard, set `CLIENT_URL` to your production frontend URL:
     ```env
     CLIENT_URL=https://your-freshguard-frontend.vercel.app
     ```
   - Trigger a redeploy or restart of the backend service.

2. **Update ESP32 Cloud Firmware**:
   - Open `esp32/FreshGuard_ESP32_Cloud.ino`.
   - Update `SERVER_URL` to your live public backend endpoint:
     ```cpp
     const char* SERVER_URL = "https://your-freshguard-backend.onrender.com/api/device/data";
     const char* DEVICE_API_KEY = "FG_Key_98b7c6d5e4";
     ```
   - Flash the updated firmware to your ESP32.
   - Now the physical refrigerator transmits telemetry to the cloud backend from anywhere in the world!

---

## PART G — Physical Hardware Verification Checklist

Follow this step-by-step checklist to test the entire end-to-end system:

- [ ] **Step 1: Open Dashboard**:
  - Open your deployed dashboard URL on your phone or laptop.
  - Confirm the badge shows `ESP32 OFFLINE`.
  - Confirm all metric cards show default values (`-- °C`, `-- %`, `-- ADC`, `--`).
  - Confirm Food Inventory shows `No food currently inside the refrigerator.`
  - Confirm Food History shows `No food activity recorded yet.`

- [ ] **Step 2: Power Up ESP32**:
  - Power the ESP32 via USB or 5V power supply.
  - Open Serial Monitor (`115200` baud).
  - Observe `[WIFI] Connected! IP Address: ...`
  - Observe successful initial sensor and I2C LCD initialization.

- [ ] **Step 3: Verify Live Telemetry Ingestion**:
  - In Serial Monitor, observe periodic telemetry dispatch.
  - Within ~2 seconds, the dashboard status badge dynamically flips to **`ESP32 LIVE`** with an animated green pulse!
  - Observe real, live physical sensor values updating:
    - **Temperature**: Real DHT11 reading (e.g. `23.4 °C`).
    - **Humidity**: Real DHT11 reading (e.g. `58 %`).
    - **Air Quality**: Real MQ135 ADC (e.g. `620 ADC`, badge `GOOD`).
    - **Door Status**: Shows `CLOSED` when reed switch is against the magnet.
    - **RTC Time**: Displays real DS3231 time (e.g. `14:28`).

- [ ] **Step 4: Door Open Alarm Test**:
  - Pull the magnet away from the reed switch.
  - Dashboard door status immediately flips to `OPEN`.
  - Leave the door open for 30 seconds.
  - Observe physical Red LED blinking and Buzzer sounding.
  - Dashboard displays the red **`DOOR OPEN TOO LONG`** alert banner!
  - Bring the magnet back: alarm stops, status returns to `CLOSED`, banner dismisses.

- [ ] **Step 5: Food RFID Ingestion (Beef Scan)**:
  - Swipe the physical Beef RFID tag (`AC BF 63 06`).
  - ESP32 Serial Monitor logs: `[RFID] Matched: [BEEF TAG] -> Beef Qty = 1`.
  - LCD switches to RFID view displaying Beef quantity `1` for 5 seconds.
  - **Dashboard Food Inventory**: Instantly updates without page reload, showing **Beef (UID: AC BF 63 06, Quantity: 1, Inside Refrigerator)**.
  - **Dashboard Food History**: Instantly records **`Beef ADDED`** with exact timestamp.
  - Notice subsequent telemetry does **NOT** duplicate the ADDED event.

- [ ] **Step 6: Food RFID Removal (Beef Scan Again)**:
  - Swipe the Beef RFID tag again.
  - Quantity toggles `1 -> 0`.
  - **Dashboard Food Inventory**: Beef card is removed. If no other items are present, reverts to clean empty state.
  - **Dashboard Food History**: Instantly records **`Beef REMOVED`**.

- [ ] **Step 7: Food RFID Testing (Mutton Scan)**:
  - Swipe the Mutton RFID tag (`9C 94 02 07`).
  - Mutton quantity toggles `0 -> 1`.
  - Dashboard displays Mutton inside inventory and logs **`Mutton ADDED`**.

- [ ] **Step 8: Persistence Verification**:
  - Refresh the browser tab or open it on a mobile device.
  - Confirm the exact inventory and food history are retrieved from MongoDB Atlas.
  - Close and restart the backend server. Re-open the dashboard: data persists without corruption!

- [ ] **Step 9: Network Fault Tolerance**:
  - Turn off your Wi-Fi router or disconnect the ESP32 from the network.
  - Observe that the ESP32 **continues to operate locally**:
    - LCD continues switching screens.
    - DHT11 and MQ135 readings continue.
    - 30-second door alarm and gas alarm continue functioning locally.
    - Green/Red LEDs and Buzzer respond immediately to physical sensors.
  - On the dashboard, after 15 seconds without telemetry, status transitions gracefully to **`ESP32 OFFLINE`**.
  - Reconnect Wi-Fi: ESP32 automatically reconnects and dashboard returns to **`ESP32 LIVE`**.
