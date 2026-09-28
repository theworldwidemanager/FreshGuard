// =========================================================================
// FreshGuard - ORIGINAL WORKING ESP32 REFRIGERATOR FIRMWARE REFERENCE
// (Preserved verbatim as provided by the user)
// =========================================================================

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>
#include <DHT.h>
#include <SPI.h>
#include <MFRC522.h>

// --- PIN DEFINITIONS ---
#define DHTPIN        4
#define DHTTYPE       DHT11
#define MQ135_PIN     34
#define REED_PIN      14
#define GREEN_LED_PIN 26
#define RED_LED_PIN   27
#define BUZZER_PIN    12

#define SS_PIN        5
#define RST_PIN       16

// Active-LOW helper macros (Since one leg is connected to 5V)
#define TURN_ON  LOW
#define TURN_OFF HIGH

// --- OBJECT INITIALIZATION ---
LiquidCrystal_I2C lcd(0x27, 16, 2);
RTC_DS3231 rtc;
DHT dht(DHTPIN, DHTTYPE);
MFRC522 rfid(SS_PIN, RST_PIN);

// --- CONFIGURATION & UID SETUP ---
byte beefTagUID[4]   = {0xAC, 0xBF, 0x63, 0x06}; // Tag 1: Beef
byte muttonTagUID[4] = {0x9C, 0x94, 0x02, 0x07}; // Tag 2: Mutton

// --- ITEM STATUS TRACKING ---
struct ItemStatus {
  int qty;
  String timeStr;
};

ItemStatus beef = {0, "--:--"};
ItemStatus mutton = {0, "--:--"};

// --- TIMING & ALARM LOGGING VARIABLES ---
unsigned long doorOpenStart = 0;
bool doorWasOpen = false;
bool doorAlarmActive = false;

bool gasAlarmActive = false;
bool gasAlarmPrinted = false;
bool doorAlarmPrinted = false;

unsigned long alarmBlinkTimer = 0;
bool alarmBlinkState = false;

unsigned long screen1Start = 0;
unsigned long screen2Start = 0;
unsigned long rfidDisplayStart = 0;
unsigned long serialLogTimer = 0;

int currentScreen = 1; // 1: Main Temp/Humidity/Gate/Time, 2: Gas Level, 3: RFID Item Status
bool rfidActiveScreen = false;
String lastScannedItem = "";

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=================================");
  Serial.println("  ESP32 Refrigerator System Init ");
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
  lcd.print("System Ready");
  delay(1500);
  lcd.clear();

  Serial.println("[OK] RFID Tags Set:");
  Serial.println("     Beef Tag: AC BF 63 06");
  Serial.println("     Mutton Tag: 9C 94 02 07");
  Serial.println("[OK] System Ready. Monitoring active...");
  Serial.println("---------------------------------\n");

  screen1Start = millis();
}

void loop() {
  DateTime now = rtc.now();
  bool isGateClosed = (digitalRead(REED_PIN) == HIGH);
  int rawGas = analogRead(MQ135_PIN);

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
  // Below 800: Safe/Mild range (Only Green LED remains ON)
  // 800 and above: Warning (Red LED blinks & Buzzer beeps)
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

  // ---------------------------------------------------
  // 2. LED & BUZZER EXECUTION
  // ---------------------------------------------------
  if (doorAlarmActive || gasAlarmActive) {
    digitalWrite(GREEN_LED_PIN, TURN_OFF); // Green LED OFF during any alarm

    // Blink Red LED and beep Buzzer every 250ms
    if (millis() - alarmBlinkTimer >= 250) {
      alarmBlinkTimer = millis();
      alarmBlinkState = !alarmBlinkState;

      digitalWrite(RED_LED_PIN, alarmBlinkState ? TURN_ON : TURN_OFF);
      digitalWrite(BUZZER_PIN, alarmBlinkState ? TURN_ON : TURN_OFF);
    }
  } else {
    // Normal operation (< 800 ADC): Green LED ON, Red LED & Buzzer OFF
    digitalWrite(GREEN_LED_PIN, TURN_ON);
    digitalWrite(RED_LED_PIN, TURN_OFF);
    digitalWrite(BUZZER_PIN, TURN_OFF);
  }

  // ---------------------------------------------------
  // 3. RFID SCAN LOGIC
  // ---------------------------------------------------
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String currentTimeStr = formatTime(now);

    Serial.print("[RFID] Tag Detected! UID: ");
    printHexUID(rfid.uid.uidByte, rfid.uid.size);

    if (isSameUID(rfid.uid.uidByte, beefTagUID, rfid.uid.size)) {
      beef.qty = (beef.qty == 0) ? 1 : 0;
      beef.timeStr = currentTimeStr;
      lastScannedItem = "Beef";
      rfidActiveScreen = true;
      rfidDisplayStart = millis();

      Serial.println("  -> Matched: [BEEF TAG]");
      Serial.print("  -> New Status: Beef Qty = ");
      Serial.print(beef.qty);
      Serial.print(" at ");
      Serial.println(beef.timeStr);
    } 
    else if (isSameUID(rfid.uid.uidByte, muttonTagUID, rfid.uid.size)) {
      mutton.qty = (mutton.qty == 0) ? 1 : 0;
      mutton.timeStr = currentTimeStr;
      lastScannedItem = "Mutton";
      rfidActiveScreen = true;
      rfidDisplayStart = millis();

      Serial.println("  -> Matched: [MUTTON TAG]");
      Serial.print("  -> New Status: Mutton Qty = ");
      Serial.print(mutton.qty);
      Serial.print(" at ");
      Serial.println(mutton.timeStr);
    } 
    else {
      Serial.println("  -> Unknown Tag Detected!");
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
  // 5. DISPLAY RENDERING & PERIODIC SERIAL LOGGING
  // ---------------------------------------------------
  if (rfidActiveScreen) {
    renderRFIDScreen();
  } else if (currentScreen == 1) {
    renderScreen1(now, isGateClosed);
  } else if (currentScreen == 2) {
    renderScreen2(rawGas);
  }

  // Log sensor data to Serial every 2 seconds
  if (millis() - serialLogTimer >= 2000) {
    serialLogTimer = millis();
    
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    Serial.print("[STATUS] ");
    Serial.print(now.year(), DEC); Serial.print('/');
    Serial.print(now.month(), DEC); Serial.print('/');
    Serial.print(now.day(), DEC); Serial.print(" ");
    Serial.print(formatTime(now));
    
    Serial.print(" | Temp: "); Serial.print(temp, 1); Serial.print("C");
    Serial.print(" | Hum: "); Serial.print(hum, 1); Serial.print("%");
    Serial.print(" | Gas: "); Serial.print(rawGas);
    Serial.print(" | Gate: "); Serial.print(isGateClosed ? "CLOSED" : "OPEN");
    Serial.print(" | Beef Qty: "); Serial.print(beef.qty);
    Serial.print(" | Mutton Qty: "); Serial.println(mutton.qty);
  }

  delay(50); // Fast cycle for smooth LED blinking
}

// --- HELPER DISPLAY FUNCTIONS ---

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
  
  // Categorized Gas Status Display
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
  if (lastScannedItem == "Beef") {
    lcd.print("Beef Qty: ");
    lcd.print(beef.qty);
    lcd.print("     ");
    lcd.setCursor(0, 1);
    lcd.print("Time: ");
    lcd.print(beef.timeStr);
    lcd.print("    ");
  } else if (lastScannedItem == "Mutton") {
    lcd.print("Mutton Qty: ");
    lcd.print(mutton.qty);
    lcd.print("   ");
    lcd.setCursor(0, 1);
    lcd.print("Time: ");
    lcd.print(mutton.timeStr);
    lcd.print("    ");
  }
}

// --- UTILITY FUNCTIONS ---

bool isSameUID(byte *u1, byte *u2, byte size) {
  for (byte i = 0; i < size; i++) {
    if (u1[i] != u2[i]) return false;
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
