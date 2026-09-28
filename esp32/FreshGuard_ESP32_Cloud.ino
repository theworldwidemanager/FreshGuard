// =========================================================================
// FreshGuard - Cloud-Connected Smart Refrigerator IoT Firmware (ESP32)
//
// Hardware Features Preserved:
//  - DHT11 Temperature & Humidity (GPIO 4)
//  - MQ135 Gas Analog Sensor (GPIO 34, raw ADC monitoring)
//  - Reed Switch Door Sensor (GPIO 14, INPUT_PULLDOWN, HIGH = CLOSED)
//  - Active-LOW Dual LED Indicators (Green: GPIO 26, Red: GPIO 27)
//  - Active-LOW Piezo Buzzer (GPIO 12)
//  - MFRC522 SPI RFID Reader (SS: GPIO 5, RST: GPIO 16)
//  - DS3231 I2C Real-Time Clock (SDA: GPIO 21, SCL: GPIO 22)
//  - 16x2 I2C LiquidCrystal Display (Address: 0x27)
//
// Cloud & Network Layer:
//  - Non-blocking millis() telemetry loop (~2s interval)
//  - HTTP/HTTPS POST to deployed Node.js / Express backend (/api/device/data)
//  - Secure header-based authentication: X-Device-Key
//  - Resilient local operation: Sensor reading, alarm execution, RFID toggle,
//    and LCD updates NEVER block or freeze if Wi-Fi or backend is offline.
//  - Safe 4-byte RFID UID matching to prevent buffer over-reads.
//  - Safe JSON generation handling DHT NaN values.
// =========================================================================

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>
#include <DHT.h>
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// =========================================================================
// USER CONFIGURATION (Fill these in before uploading)
// =========================================================================
const char* WIFI_SSID      = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";

// Target Deployed Backend Ingestion Endpoint:
// For Local Testing (ESP32 and PC on same Wi-Fi):
//   "http://192.168.1.xxx:5000/api/device/data"
// For Deployed Cloud Backend:
//   "https://YOUR-DEPLOYED-BACKEND-DOMAIN/api/device/data"
const char* SERVER_URL     = "https://YOUR-DEPLOYED-BACKEND-DOMAIN/api/device/data";

// Shared secret API Key matching backend process.env.ESP32_API_KEY
const char* DEVICE_API_KEY = "YOUR_ESP32_API_KEY";

// Device identifier matching backend DeviceState record
const char* DEVICE_ID      = "freshguard-fridge-01";

// Telemetry transmit interval (in milliseconds)
const unsigned long TELEMETRY_INTERVAL = 2000;

// =========================================================================
// HARDWARE PIN DEFINITIONS
// =========================================================================
#define DHTPIN        4
#define DHTTYPE       DHT11
#define MQ135_PIN     34
#define REED_PIN      14
#define GREEN_LED_PIN 26
#define RED_LED_PIN   27
#define BUZZER_PIN    12

#define SS_PIN        5
#define RST_PIN       16

// Active-LOW helper macros (Since module/indicator leg is tied to 5V)
#define TURN_ON  LOW
#define TURN_OFF HIGH

// =========================================================================
// SENSOR & PERIPHERAL OBJECT INITIALIZATION
// =========================================================================
LiquidCrystal_I2C lcd(0x27, 16, 2);
RTC_DS3231 rtc;
DHT dht(DHTPIN, DHTTYPE);
MFRC522 rfid(SS_PIN, RST_PIN);

// =========================================================================
// RFID UIDs & ITEM STATE
// Stored tags are strictly 4-byte arrays.
// =========================================================================
// Physical Tag 1: Cold Drink (Internal telemetry field: beefQty)
const byte COLD_DRINK_TAG_UID[4] = {0xAC, 0xBF, 0x63, 0x06}; 
// Physical Tag 2: Juice (Internal telemetry field: muttonQty)
const byte JUICE_TAG_UID[4]      = {0x9C, 0x94, 0x02, 0x07}; 

struct ItemStatus {
  int qty;
  String timeStr;
};

// Internal API compatibility variables
ItemStatus beef = {0, "--:--"};   // Maps to Cold Drink
ItemStatus mutton = {0, "--:--"}; // Maps to Juice

// =========================================================================
// TIMING & STATE VARIABLES
// =========================================================================
unsigned long doorOpenStart = 0;
bool doorWasOpen = false;
bool doorAlarmActive = false;

bool gasAlarmActive = false;
bool gasAlarmPrinted = false;
bool doorAlarmPrinted = false;

// Temperature and Humidity Alarm flags
bool tempAlarmActive = false;
bool humAlarmActive = false;
bool tempAlarmPrinted = false;
bool humAlarmPrinted = false;

// Expired Food Alarm tracking
unsigned long expiredFoodTimerStart = 0;
bool expiredFoodAlarmActive = false;
bool expiredFoodAlarmPrinted = false;

unsigned long alarmBlinkTimer = 0;
bool alarmBlinkState = false;

unsigned long screen1Start = 0;
unsigned long screen2Start = 0;
unsigned long rfidDisplayStart = 0;
unsigned long serialLogTimer = 0;
unsigned long lastTelemetryTimer = 0;
unsigned long lastWifiCheckTimer = 0;

int currentScreen = 1; // 1: Main Temp/Humidity/Gate/Time, 2: Gas Level, 3: RFID Item Status
bool rfidActiveScreen = false;
String lastScannedItem = "";

// =========================================================================
// FORWARD DECLARATIONS
// =========================================================================
void renderScreen1(DateTime now, bool isGateClosed);
void renderScreen2(int rawGas);
void renderRFIDScreen();
bool isSame4ByteUID(byte *scannedUID, byte scannedSize, const byte *targetUID);
void printHexUID(byte *buffer, byte bufferSize);
String formatTime(DateTime dt);
String getGasStatus(int rawGas);
void sendTelemetry(float temp, float hum, int rawGas, const String& gasStatus,
                   bool isGateClosed, bool doorAlarm, bool gasAlarm,
                   bool tempAlarm, bool humAlarm, const String& rtcTimeStr);

// =========================================================================
// SETUP
// =========================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=================================");
  Serial.println("  FreshGuard ESP32 System Init   ");
  Serial.println("=================================");

  // Initialize Pins
  pinMode(REED_PIN, INPUT_PULLDOWN); // HIGH when door is closed (5V sensed)
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // Default LED & Buzzer States (Active-LOW)
  digitalWrite(GREEN_LED_PIN, TURN_ON);  // Green LED ON by default
  digitalWrite(RED_LED_PIN, TURN_OFF);
  digitalWrite(BUZZER_PIN, TURN_OFF);

  // Initialize I2C, LCD, DHT, RTC, SPI, RFID
  Wire.begin();
  lcd.init();
  lcd.backlight();
  dht.begin();
  SPI.begin();
  rfid.PCD_Init();

  if (!rtc.begin()) {
    Serial.println("[ERROR] Couldn't find RTC DS3231 module!");
  } else {
    Serial.println("[OK] RTC DS3231 Initialized.");
  }

  // Uncomment line below ONCE if RTC time is incorrect, upload, then comment out & upload again:
  // rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("FreshGuard Ready");
  delay(1200);
  lcd.clear();

  Serial.println("[OK] RFID Tags Configured:");
  Serial.println("     Tag 1 (Cold Drink) : AC BF 63 06 (Manufacture: 23-Sep-2026, Expiry: 29-Sep-2026)");
  Serial.println("     Tag 2 (Juice)      : 9C 94 02 07 (Manufacture: 22-Sep-2026, Expiry: 27-Sep-2026)");

  // Non-blocking Wi-Fi initialization attempt
  Serial.print("[WIFI] Connecting to SSID: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Give Wi-Fi up to 5 seconds to connect at boot; if not ready, proceed locally
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - wifiStart < 5000)) {
    delay(200);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WIFI] Connected! IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WIFI] Not connected at boot. Continuing local refrigerator control...");
  }

  Serial.println("[OK] System Ready. Monitoring active...");
  Serial.println("---------------------------------\n");

  screen1Start = millis();
}

// =========================================================================
// MAIN LOOP
// =========================================================================
void loop() {
  DateTime now = rtc.now();
  bool isGateClosed = (digitalRead(REED_PIN) == HIGH);
  int rawGas = analogRead(MQ135_PIN);
  String gasStatus = getGasStatus(rawGas);
  String currentTimeStr = formatTime(now);
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // ---------------------------------------------------
  // 1. ALARM EVALUATION LOGIC
  // ---------------------------------------------------

  // A. Check Door Open Timer (30-second threshold)
  if (!isGateClosed) {
    if (!doorWasOpen) {
      doorWasOpen = true;
      doorOpenStart = millis();
      Serial.println("[EVENT] Refrigerator Door OPENED!");
    }
    if (millis() - doorOpenStart >= 30000) {
      doorAlarmActive = true;
      if (!doorAlarmPrinted) {
        Serial.println("[ALARM] Door open 30+ secs! Blinking Red LED & Buzzer!");
        doorAlarmPrinted = true;
      }
    }
  } else {
    if (doorWasOpen) {
      Serial.println("[EVENT] Refrigerator Door CLOSED.");
      doorWasOpen = false;
    }
    doorAlarmActive = false;
    doorAlarmPrinted = false;
  }

  // B. Check Gas Level (Warning threshold set to 800+)
  // < 700: GOOD, 700-799: MILD, 800+: WARNING
  if (rawGas >= 800) {
    gasAlarmActive = true;
    if (!gasAlarmPrinted) {
      Serial.print("[ALARM] HIGH GAS LEVEL DETECTED: ");
      Serial.print(rawGas);
      Serial.println(" ADC (800+ Threshold Exceeded)!");
      gasAlarmPrinted = true;
    }
  } else {
    if (gasAlarmActive) {
      Serial.println("[OK] Gas level returned to safe range (< 800).");
    }
    gasAlarmActive = false;
    gasAlarmPrinted = false;
  }

  // C. Check Temperature (8°C or above -> HIGH TEMPERATURE ALARM)
  if (!isnan(temp) && temp >= 8.0) {
    tempAlarmActive = true;
    if (!tempAlarmPrinted) {
      Serial.print("[ALARM] HIGH TEMPERATURE DETECTED: ");
      Serial.print(temp, 1);
      Serial.println("C (8C Threshold Exceeded)!");
      tempAlarmPrinted = true;
    }
  } else {
    tempAlarmActive = false;
    tempAlarmPrinted = false;
  }

  // D. Check Humidity (80% RH or above -> HIGH HUMIDITY ALARM)
  if (!isnan(hum) && hum >= 80.0) {
    humAlarmActive = true;
    if (!humAlarmPrinted) {
      Serial.print("[ALARM] HIGH HUMIDITY DETECTED: ");
      Serial.print(hum, 1);
      Serial.println("% RH (80% RH Threshold Exceeded)!");
      humAlarmPrinted = true;
    }
  } else {
    humAlarmActive = false;
    humAlarmPrinted = false;
  }

  // E. Expired Food Alarm Evaluation (RTC Date vs Expiry Dates)
  // Cold Drink Expiry: 29-Sep-2026
  bool coldDrinkExpired = (now.year() > 2026) ||
                          (now.year() == 2026 && now.month() > 9) ||
                          (now.year() == 2026 && now.month() == 9 && now.day() > 29);

  // Juice Expiry: 27-Sep-2026
  bool juiceExpired = (now.year() > 2026) ||
                      (now.year() == 2026 && now.month() > 9) ||
                      (now.year() == 2026 && now.month() == 9 && now.day() >= 28);

  bool expiredFoodInside = (beef.qty > 0 && coldDrinkExpired) || (mutton.qty > 0 && juiceExpired);

  if (expiredFoodInside) {
    if (expiredFoodTimerStart == 0) {
      expiredFoodTimerStart = millis();
      Serial.println("[WARNING] Expired food detected inside refrigerator. 100s timer started.");
    }
    if (millis() - expiredFoodTimerStart >= 100000) { // 100 seconds
      expiredFoodAlarmActive = true;
      if (!expiredFoodAlarmPrinted) {
        Serial.println("[ALARM] Expired food remained inside for 100 seconds! Activating Red LED & Buzzer!");
        expiredFoodAlarmPrinted = true;
      }
    }
  } else {
    // If food is removed before 100 seconds (or no expired food inside), alarm clears
    if (expiredFoodTimerStart != 0 && !expiredFoodAlarmActive) {
      Serial.println("[OK] Expired food removed before 100 seconds elapsed. Pending alarm cleared.");
    }
    expiredFoodAlarmActive = false;
    expiredFoodAlarmPrinted = false;
    expiredFoodTimerStart = 0;
  }

  // ---------------------------------------------------
  // 2. LED & BUZZER EXECUTION
  // ---------------------------------------------------
  bool anyAlarmActive = doorAlarmActive || gasAlarmActive || tempAlarmActive || humAlarmActive || expiredFoodAlarmActive;

  if (anyAlarmActive) {
    digitalWrite(GREEN_LED_PIN, TURN_OFF); // Green LED OFF during any alarm

    // Blink Red LED and beep Buzzer every 250ms
    if (millis() - alarmBlinkTimer >= 250) {
      alarmBlinkTimer = millis();
      alarmBlinkState = !alarmBlinkState;

      digitalWrite(RED_LED_PIN, alarmBlinkState ? TURN_ON : TURN_OFF);
      digitalWrite(BUZZER_PIN, alarmBlinkState ? TURN_ON : TURN_OFF);
    }
  } else {
    // Normal operation: Green LED ON, Red LED & Buzzer OFF
    digitalWrite(GREEN_LED_PIN, TURN_ON);
    digitalWrite(RED_LED_PIN, TURN_OFF);
    digitalWrite(BUZZER_PIN, TURN_OFF);
  }

  // ---------------------------------------------------
  // 3. RFID SCAN LOGIC (With Safe 4-Byte UID Validation)
  // ---------------------------------------------------
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    Serial.print("[RFID] Tag Detected! Length: ");
    Serial.print(rfid.uid.size);
    Serial.print(" bytes | UID: ");
    printHexUID(rfid.uid.uidByte, rfid.uid.size);

    // Safe comparison: strictly checks that tag is 4 bytes and matches known UID
    if (isSame4ByteUID(rfid.uid.uidByte, rfid.uid.size, COLD_DRINK_TAG_UID)) {
      beef.qty = (beef.qty == 0) ? 1 : 0;
      beef.timeStr = currentTimeStr;
      lastScannedItem = "Cold Drink";
      rfidActiveScreen = true;
      rfidDisplayStart = millis();

      Serial.println("  -> Matched: [TAG 1: COLD DRINK]");
      Serial.print("  -> New Status: Cold Drink (beefQty) = ");
      Serial.print(beef.qty);
      Serial.print(" at ");
      Serial.println(beef.timeStr);
    } 
    else if (isSame4ByteUID(rfid.uid.uidByte, rfid.uid.size, JUICE_TAG_UID)) {
      mutton.qty = (mutton.qty == 0) ? 1 : 0;
      mutton.timeStr = currentTimeStr;
      lastScannedItem = "Juice";
      rfidActiveScreen = true;
      rfidDisplayStart = millis();

      Serial.println("  -> Matched: [TAG 2: JUICE]");
      Serial.print("  -> New Status: Juice (muttonQty) = ");
      Serial.print(mutton.qty);
      Serial.print(" at ");
      Serial.println(mutton.timeStr);
    } 
    else {
      Serial.println("  -> Unknown Tag Detected! Quantities unchanged.");
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  // ---------------------------------------------------
  // 4. DISPLAY STATE MACHINE (Screen Switching Logic)
  // ---------------------------------------------------
  
  // Timeout for RFID display (Switch back after 5 seconds)
  if (rfidActiveScreen && (millis() - rfidDisplayStart > 5000)) {
    rfidActiveScreen = false;
    lcd.clear();
    currentScreen = 1;
    screen1Start = millis();
    Serial.println("[LCD] Exiting RFID View -> Switching to Screen 1");
  }

  // Regular Display Switching (Screen 1 for 10s, Screen 2 for 10s)
  if (!rfidActiveScreen) {
    if (currentScreen == 1 && (millis() - screen1Start >= 10000)) {
      currentScreen = 2;
      screen2Start = millis();
      lcd.clear();
      Serial.println("[LCD] Switching to Screen 2 (Gas Level)");
    } else if (currentScreen == 2 && (millis() - screen2Start >= 10000)) {
      currentScreen = 1;
      screen1Start = millis();
      lcd.clear();
      Serial.println("[LCD] Switching to Screen 1 (Temp / Humidity / Gate / Time)");
    }
  }

  // ---------------------------------------------------
  // 5. DISPLAY RENDERING
  // ---------------------------------------------------
  if (rfidActiveScreen) {
    renderRFIDScreen();
  } else if (currentScreen == 1) {
    renderScreen1(now, isGateClosed);
  } else if (currentScreen == 2) {
    renderScreen2(rawGas);
  }

  // ---------------------------------------------------
  // 6. PERIODIC SERIAL LOGGING (Every 2 seconds)
  // ---------------------------------------------------
  if (millis() - serialLogTimer >= 2000) {
    serialLogTimer = millis();

    Serial.print("[STATUS] ");
    Serial.print(now.year(), DEC); Serial.print('/');
    Serial.print(now.month(), DEC); Serial.print('/');
    Serial.print(now.day(), DEC); Serial.print(" ");
    Serial.print(currentTimeStr);
    
    Serial.print(" | Temp: "); Serial.print(temp, 1); Serial.print("C");
    Serial.print(" | Hum: "); Serial.print(hum, 1); Serial.print("%");
    Serial.print(" | Gas: "); Serial.print(rawGas);
    Serial.print(" ("); Serial.print(gasStatus); Serial.print(")");
    Serial.print(" | Gate: "); Serial.print(isGateClosed ? "CLOSED" : "OPEN");
    Serial.print(" | Cold Drink Qty: "); Serial.print(beef.qty);
    Serial.print(" | Juice Qty: "); Serial.println(mutton.qty);
  }

  // ---------------------------------------------------
  // 7. NON-BLOCKING WI-FI HEALTH CHECK
  // ---------------------------------------------------
  if (millis() - lastWifiCheckTimer >= 15000) {
    lastWifiCheckTimer = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Reconnecting in background...");
      WiFi.reconnect();
    }
  }

  // ---------------------------------------------------
  // 8. NON-BLOCKING CLOUD TELEMETRY TRANSMISSION (~2s)
  // ---------------------------------------------------
  if (millis() - lastTelemetryTimer >= TELEMETRY_INTERVAL) {
    lastTelemetryTimer = millis();

    sendTelemetry(temp, hum, rawGas, gasStatus, isGateClosed,
                  doorAlarmActive, gasAlarmActive, tempAlarmActive, humAlarmActive, currentTimeStr);
  }

  delay(50); // Fast cycle for smooth LED blinking and instant RFID responsiveness
}

// =========================================================================
// CLOUD TELEMETRY DISPATCH (Non-Blocking / Short Timeout)
// =========================================================================
void sendTelemetry(float temp, float hum, int rawGas, const String& gasStatus,
                   bool isGateClosed, bool doorAlarm, bool gasAlarm,
                   bool tempAlarm, bool humAlarm, const String& rtcTimeStr) {
  // If Wi-Fi is not connected, do not attempt HTTP; local loop continues uninterrupted
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  // Build safe JSON payload handling DHT NaN values gracefully
  String jsonPayload = "{";
  jsonPayload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";

  if (isnan(temp)) {
    jsonPayload += "\"temperature\":null,";
  } else {
    jsonPayload += "\"temperature\":" + String(temp, 1) + ",";
  }

  if (isnan(hum)) {
    jsonPayload += "\"humidity\":null,";
  } else {
    jsonPayload += "\"humidity\":" + String(hum, 1) + ",";
  }

  jsonPayload += "\"gasValue\":" + String(rawGas) + ",";
  jsonPayload += "\"gasStatus\":\"" + gasStatus + "\",";
  jsonPayload += "\"doorStatus\":\"" + String(isGateClosed ? "CLOSED" : "OPEN") + "\",";
  jsonPayload += "\"doorAlarm\":" + String(doorAlarm ? "true" : "false") + ",";
  jsonPayload += "\"gasAlarm\":" + String(gasAlarm ? "true" : "false") + ",";
  jsonPayload += "\"temperatureAlarm\":" + String(tempAlarm ? "true" : "false") + ",";
  jsonPayload += "\"humidityAlarm\":" + String(humAlarm ? "true" : "false") + ",";
  jsonPayload += "\"beefQty\":" + String(beef.qty) + ",";
  jsonPayload += "\"muttonQty\":" + String(mutton.qty) + ",";
  jsonPayload += "\"rtcTime\":\"" + rtcTimeStr + "\"";
  jsonPayload += "}";

  // HTTP / HTTPS Client Dispatch
  HTTPClient http;
  bool isHttps = String(SERVER_URL).startsWith("https://");

  if (isHttps) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    http.begin(secureClient, SERVER_URL);
  } else {
    WiFiClient plainClient;
    http.begin(plainClient, SERVER_URL);
  }

  // Set short timeout (1200ms) so slow networks never freeze the refrigerator loop
  http.setTimeout(1200);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    if (httpResponseCode == HTTP_CODE_OK || httpResponseCode == 201) {
      // Telemetry successfully acknowledged
    } else {
      Serial.print("[CLOUD] Backend response code: ");
      Serial.println(httpResponseCode);
    }
  } else {
    Serial.print("[CLOUD] POST failed, error: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

// =========================================================================
// HELPER DISPLAY & LOGIC FUNCTIONS
// =========================================================================

String getGasStatus(int rawGas) {
  if (rawGas >= 800) {
    return "WARNING";
  } else if (rawGas >= 700) {
    return "MILD";
  } else {
    return "GOOD";
  }
}

void renderScreen1(DateTime now, bool isGateClosed) {
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // Line 1: Temp & Humidity
  lcd.setCursor(0, 0);
  if (isnan(temp) || isnan(hum)) {
    lcd.print("T:--C  H:--%   ");
  } else {
    lcd.print("T:");
    lcd.print((int)temp);
    lcd.print("C H:");
    lcd.print((int)hum);
    lcd.print("%  ");
  }

  // Line 2: Gate Status & Time
  lcd.setCursor(0, 1);
  if (isGateClosed) {
    lcd.print("CLSD ");
  } else {
    lcd.print("OPEN ");
  }

  lcd.print(formatTime(now));
  lcd.print("   ");
}

void renderScreen2(int rawGas) {
  lcd.setCursor(0, 0);
  
  if (rawGas >= 800) {
    lcd.print("Gas: WARNING!!  ");
  } else if (rawGas >= 700) {
    lcd.print("Gas: MILD LEVEL ");
  } else {
    lcd.print("Gas: GOOD LEVEL ");
  }

  lcd.setCursor(0, 1);
  lcd.print("Val: ");
  lcd.print(rawGas);
  lcd.print(" ADC   ");
}

void renderRFIDScreen() {
  lcd.setCursor(0, 0);
  if (lastScannedItem == "Cold Drink") {
    lcd.print("ColdDrink Qty:");
    lcd.print(beef.qty);
    lcd.print(" ");
    lcd.setCursor(0, 1);
    lcd.print("Time: ");
    lcd.print(beef.timeStr);
    lcd.print("    ");
  } else if (lastScannedItem == "Juice") {
    lcd.print("Juice Qty: ");
    lcd.print(mutton.qty);
    lcd.print("   ");
    lcd.setCursor(0, 1);
    lcd.print("Time: ");
    lcd.print(mutton.timeStr);
    lcd.print("    ");
  }
}

// Safe 4-byte UID comparison: Ensures length is exactly 4 and bytes match
bool isSame4ByteUID(byte *scannedUID, byte scannedSize, const byte *targetUID) {
  if (scannedSize != 4) return false;
  for (byte i = 0; i < 4; i++) {
    if (scannedUID[i] != targetUID[i]) return false;
  }
  return true;
}

void printHexUID(byte *buffer, byte bufferSize) {
  for (byte i = 0; i < bufferSize; i++) {
    Serial.print(buffer[i] < 0x10 ? " 0" : " ");
    Serial.print(buffer[i], HEX);
  }
  Serial.println();
}

String formatTime(DateTime dt) {
  char buffer[6];
  snprintf(buffer, sizeof(buffer), "%02d:%02d", dt.hour(), dt.minute());
  return String(buffer);
}
