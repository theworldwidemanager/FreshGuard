#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <RTClib.h>
#include <DHT.h>
#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "TP-Link_2.0";
const char* WIFI_PASSWORD = "Itskills";

const char* SERVER_URL =
  "http://192.168.0.107:5000/api/device/data";

const char* DEVICE_API_KEY =
  "FreshGuard_Key_2026_Secure";

const char* DEVICE_ID =
  "freshguard-fridge-01";

const unsigned long TELEMETRY_INTERVAL = 2000;

const float HIGH_TEMP_THRESHOLD_C = 25.0;
const float HIGH_HUMIDITY_THRESHOLD = 80.0;

const unsigned long EXPIRED_FOOD_DELAY_MS = 100000;

const int COLD_DRINK_EXP_YEAR = 2026;
const int COLD_DRINK_EXP_MONTH = 9;
const int COLD_DRINK_EXP_DAY = 29;

const int JUICE_EXP_YEAR = 2026;
const int JUICE_EXP_MONTH = 9;
const int JUICE_EXP_DAY = 27;

#define DHTPIN         4
#define DHTTYPE        DHT11

#define MQ135_PIN      34
#define REED_PIN       14

#define GREEN_LED_PIN  26
#define RED_LED_PIN    27

#define BUZZER_PIN     12

#define SS_PIN         5
#define RST_PIN        16

#define TURN_ON        LOW
#define TURN_OFF       HIGH

LiquidCrystal_I2C lcd(0x27, 16, 2);
RTC_DS3231 rtc;
DHT dht(DHTPIN, DHTTYPE);
MFRC522 rfid(SS_PIN, RST_PIN);

const byte COLD_DRINK_TAG_UID[4] =
{
  0xAC, 0xBF, 0x63, 0x06
};

const byte JUICE_TAG_UID[4] =
{
  0x9C, 0x94, 0x02, 0x07
};

struct ItemStatus
{
  int qty;
  String timeStr;
};

ItemStatus coldDrink = {0, "--:--"};
ItemStatus juice = {0, "--:--"};

unsigned long doorOpenStart = 0;

bool doorWasOpen = false;
bool doorAlarmActive = false;

bool gasAlarmActive = false;
bool temperatureAlarmActive = false;
bool humidityAlarmActive = false;
bool expiredFoodAlarmActive = false;

bool gasAlarmPrinted = false;
bool temperatureAlarmPrinted = false;
bool humidityAlarmPrinted = false;
bool expiredFoodAlarmPrinted = false;
bool doorAlarmPrinted = false;

unsigned long coldDrinkAddedMillis = 0;
unsigned long juiceAddedMillis = 0;

unsigned long alarmBlinkTimer = 0;
bool alarmBlinkState = false;

unsigned long screen1Start = 0;
unsigned long screen2Start = 0;
unsigned long rfidDisplayStart = 0;

unsigned long serialLogTimer = 0;
unsigned long lastTelemetryTimer = 0;
unsigned long lastWifiCheckTimer = 0;

int currentScreen = 1;

bool rfidActiveScreen = false;

String lastScannedItem = "";

void renderScreen1(DateTime now, bool isGateClosed, float temp, float hum);
void renderScreen2(int rawGas);
void renderRFIDScreen();

bool isSame4ByteUID(
  byte* scannedUID,
  byte scannedSize,
  const byte* targetUID
);

void printHexUID(
  byte* buffer,
  byte bufferSize
);

String formatTime(DateTime dt);
String getGasStatus(int rawGas);

void sendTelemetry(
  float temp,
  float hum,
  int rawGas,
  const String& gasStatus,
  bool isGateClosed,
  bool doorAlarm,
  bool gasAlarm,
  const String& rtcTimeStr
);

void setup()
{
  Serial.begin(115200);

  delay(500);

  Serial.println();
  Serial.println("=================================");
  Serial.println(" FreshGuard ESP32 LOCAL System");
  Serial.println("=================================");

  pinMode(REED_PIN, INPUT_PULLDOWN);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(GREEN_LED_PIN, TURN_ON);
  digitalWrite(RED_LED_PIN, TURN_OFF);
  digitalWrite(BUZZER_PIN, TURN_OFF);

  Wire.begin();

  lcd.init();
  lcd.backlight();

  dht.begin();

  SPI.begin();
  rfid.PCD_Init();

if (!rtc.begin())
{
  Serial.println("[ERROR] Couldn't find RTC DS3231!");
}
else
{
  Serial.println("[OK] RTC DS3231 Initialized.");

  if (rtc.lostPower())
  {
    Serial.println("[RTC] Battery lost power! Setting compile time...");
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
  }
  else
  {
    Serial.println("[RTC] Clock running with battery backup.");
  }
}
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("FreshGuard Ready");

  delay(1200);

  lcd.clear();

  Serial.println(
    "[OK] RFID Tags Configured:"
  );

  Serial.println(
    " Cold Drink : AC BF 63 06"
  );

  Serial.println(
    " Juice      : 9C 94 02 07"
  );

  Serial.print(
    "[WIFI] Connecting"
  );

  WiFi.mode(WIFI_STA);

  WiFi.begin(
    WIFI_SSID,
    WIFI_PASSWORD
  );

  unsigned long wifiStart = millis();

  while (
    WiFi.status() != WL_CONNECTED &&
    millis() - wifiStart < 10000
  )
  {
    delay(250);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.print(
      "[WIFI] Connected! ESP32 IP: "
    );

    Serial.println(
      WiFi.localIP()
    );

    Serial.print(
      "[LOCAL] Backend URL: "
    );

    Serial.println(
      SERVER_URL
    );
  }
  else
  {
    Serial.println(
      "[WIFI] Not connected."
    );

    Serial.println(
      "[WIFI] Local hardware will continue."
    );
  }

  Serial.println(
    "[OK] System Ready."
  );

  Serial.println(
    "---------------------------------"
  );

  screen1Start = millis();
}

void loop()
{
  DateTime now = rtc.now();

  bool isGateClosed =
    (digitalRead(REED_PIN) == HIGH);

  int rawGas =
    analogRead(MQ135_PIN);

  float currentTemp =
    dht.readTemperature();

  float currentHum =
    dht.readHumidity();

  String gasStatus =
    getGasStatus(rawGas);

  String currentTimeStr =
    formatTime(now);

  if (!isGateClosed)
  {
    if (!doorWasOpen)
    {
      doorWasOpen = true;

      doorOpenStart =
        millis();

      Serial.println(
        "[EVENT] Refrigerator Door OPENED!"
      );
    }

    if (
      millis() - doorOpenStart >= 30000
    )
    {
      doorAlarmActive = true;

      if (!doorAlarmPrinted)
      {
        Serial.println(
          "[ALARM] Door open 30+ seconds!"
        );

        doorAlarmPrinted = true;
      }
    }
  }
  else
  {
    if (doorWasOpen)
    {
      Serial.println(
        "[EVENT] Refrigerator Door CLOSED."
      );

      doorWasOpen = false;
    }

    doorAlarmActive = false;
    doorAlarmPrinted = false;
  }

  if (rawGas >= 800)
  {
    gasAlarmActive = true;

    if (!gasAlarmPrinted)
    {
      Serial.print(
        "[ALARM] HIGH GAS LEVEL: "
      );

      Serial.print(rawGas);

      Serial.println(
        " ADC"
      );

      gasAlarmPrinted = true;
    }
  }
  else
  {
    if (gasAlarmActive)
    {
      Serial.println(
        "[OK] Gas returned below warning level."
      );
    }

    gasAlarmActive = false;
    gasAlarmPrinted = false;
  }

  if (
    !isnan(currentTemp) &&
    currentTemp >= HIGH_TEMP_THRESHOLD_C
  )
  {
    temperatureAlarmActive = true;

    if (!temperatureAlarmPrinted)
    {
      Serial.print(
        "[ALARM] HIGH TEMPERATURE: "
      );

      Serial.print(
        currentTemp,
        1
      );

      Serial.println(" C");

      temperatureAlarmPrinted = true;
    }
  }
  else
  {
    temperatureAlarmActive = false;
    temperatureAlarmPrinted = false;
  }

  if (
    !isnan(currentHum) &&
    currentHum >= HIGH_HUMIDITY_THRESHOLD
  )
  {
    humidityAlarmActive = true;

    if (!humidityAlarmPrinted)
    {
      Serial.print(
        "[ALARM] HIGH HUMIDITY: "
      );

      Serial.print(
        currentHum,
        1
      );

      Serial.println(" %");

      humidityAlarmPrinted = true;
    }
  }
  else
  {
    humidityAlarmActive = false;
    humidityAlarmPrinted = false;
  }

  auto dateIsAfter =
    [](DateTime d, int y, int m, int day) -> bool
  {
    if (d.year() != y)
    {
      return d.year() > y;
    }

    if (d.month() != m)
    {
      return d.month() > m;
    }

    return d.day() > day;
  };

  bool coldDrinkExpired =
    dateIsAfter(
      now,
      COLD_DRINK_EXP_YEAR,
      COLD_DRINK_EXP_MONTH,
      COLD_DRINK_EXP_DAY
    );

  bool juiceExpired =
    dateIsAfter(
      now,
      JUICE_EXP_YEAR,
      JUICE_EXP_MONTH,
      JUICE_EXP_DAY
    );

  bool coldDrinkExpiredTooLong =
    coldDrink.qty > 0 &&
    coldDrinkExpired &&
    coldDrinkAddedMillis > 0 &&
    (
      millis() - coldDrinkAddedMillis >=
      EXPIRED_FOOD_DELAY_MS
    );

  bool juiceExpiredTooLong =
    juice.qty > 0 &&
    juiceExpired &&
    juiceAddedMillis > 0 &&
    (
      millis() - juiceAddedMillis >=
      EXPIRED_FOOD_DELAY_MS
    );

  expiredFoodAlarmActive =
    coldDrinkExpiredTooLong ||
    juiceExpiredTooLong;

  if (
    expiredFoodAlarmActive &&
    !expiredFoodAlarmPrinted
  )
  {
    Serial.println(
      "[ALARM] EXPIRED FOOD remained inside for 100 seconds!"
    );

    expiredFoodAlarmPrinted = true;
  }
  else if (!expiredFoodAlarmActive)
  {
    expiredFoodAlarmPrinted = false;
  }

  bool anyAlarm =
    doorAlarmActive ||
    gasAlarmActive ||
    temperatureAlarmActive ||
    humidityAlarmActive ||
    expiredFoodAlarmActive;

  if (anyAlarm)
  {
    digitalWrite(
      GREEN_LED_PIN,
      TURN_OFF
    );

    if (
      millis() - alarmBlinkTimer >= 250
    )
    {
      alarmBlinkTimer =
        millis();

      alarmBlinkState =
        !alarmBlinkState;

      digitalWrite(
        RED_LED_PIN,
        alarmBlinkState
          ? TURN_ON
          : TURN_OFF
      );

      digitalWrite(
        BUZZER_PIN,
        alarmBlinkState
          ? TURN_ON
          : TURN_OFF
      );
    }
  }
  else
  {
    alarmBlinkState = false;

    digitalWrite(
      GREEN_LED_PIN,
      TURN_ON
    );

    digitalWrite(
      RED_LED_PIN,
      TURN_OFF
    );

    digitalWrite(
      BUZZER_PIN,
      TURN_OFF
    );
  }

  if (
    rfid.PICC_IsNewCardPresent() &&
    rfid.PICC_ReadCardSerial()
  )
  {
    Serial.print(
      "[RFID] Tag Detected | UID:"
    );

    printHexUID(
      rfid.uid.uidByte,
      rfid.uid.size
    );

    if (
      isSame4ByteUID(
        rfid.uid.uidByte,
        rfid.uid.size,
        COLD_DRINK_TAG_UID
      )
    )
    {
      coldDrink.qty =
        (coldDrink.qty == 0)
          ? 1
          : 0;

      coldDrink.timeStr =
        currentTimeStr;

      if (coldDrink.qty == 1)
      {
        coldDrinkAddedMillis =
          millis();
      }
      else
      {
        coldDrinkAddedMillis = 0;
      }

      lastScannedItem =
        "Cold Drink";

      rfidActiveScreen =
        true;

      rfidDisplayStart =
        millis();

      Serial.println(
        " -> Matched: COLD DRINK"
      );

      Serial.print(
        " -> Quantity: "
      );

      Serial.println(
        coldDrink.qty
      );
    }

    else if (
      isSame4ByteUID(
        rfid.uid.uidByte,
        rfid.uid.size,
        JUICE_TAG_UID
      )
    )
    {
      juice.qty =
        (juice.qty == 0)
          ? 1
          : 0;

      juice.timeStr =
        currentTimeStr;

      if (juice.qty == 1)
      {
        juiceAddedMillis =
          millis();
      }
      else
      {
        juiceAddedMillis = 0;
      }

      lastScannedItem =
        "Juice";

      rfidActiveScreen =
        true;

      rfidDisplayStart =
        millis();

      Serial.println(
        " -> Matched: JUICE"
      );

      Serial.print(
        " -> Quantity: "
      );

      Serial.println(
        juice.qty
      );
    }

    else
    {
      Serial.println(
        " -> Unknown RFID Tag"
      );
    }

    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  }

  if (
    rfidActiveScreen &&
    millis() - rfidDisplayStart > 5000
  )
  {
    rfidActiveScreen =
      false;

    lcd.clear();

    currentScreen = 1;

    screen1Start =
      millis();

    Serial.println(
      "[LCD] Returning to main screen"
    );
  }

  if (!rfidActiveScreen)
  {
    if (
      currentScreen == 1 &&
      millis() - screen1Start >= 10000
    )
    {
      currentScreen = 2;

      screen2Start =
        millis();

      lcd.clear();

      Serial.println(
        "[LCD] Screen 2 - Gas"
      );
    }
    else if (
      currentScreen == 2 &&
      millis() - screen2Start >= 10000
    )
    {
      currentScreen = 1;

      screen1Start =
        millis();

      lcd.clear();

      Serial.println(
        "[LCD] Screen 1 - Main"
      );
    }
  }

  if (rfidActiveScreen)
  {
    renderRFIDScreen();
  }
  else if (currentScreen == 1)
  {
    renderScreen1(
      now,
      isGateClosed
    );
  }
  else
  {
    renderScreen2(
      rawGas
    );
  }

  if (
    millis() - serialLogTimer >= 2000
  )
  {
    serialLogTimer =
      millis();

    Serial.print(
      "[STATUS] "
    );

    Serial.print(
      now.year()
    );

    Serial.print("/");

    Serial.print(
      now.month()
    );

    Serial.print("/");

    Serial.print(
      now.day()
    );

    Serial.print(" ");

    Serial.print(
      currentTimeStr
    );

    Serial.print(
      " | Temp: "
    );

    Serial.print(
      currentTemp,
      1
    );

    Serial.print("C");

    Serial.print(
      " | Hum: "
    );

    Serial.print(
      currentHum,
      1
    );

    Serial.print("%");

    Serial.print(
      " | Gas: "
    );

    Serial.print(
      rawGas
    );

    Serial.print(" (");

    Serial.print(
      gasStatus
    );

    Serial.print(")");

    Serial.print(
      " | Gate: "
    );

    Serial.print(
      isGateClosed
        ? "CLOSED"
        : "OPEN"
    );

    Serial.print(
      " | Cold Drink Qty: "
    );

    Serial.print(
      coldDrink.qty
    );

    Serial.print(
      " | Juice Qty: "
    );

    Serial.println(
      juice.qty
    );
  }

  if (
    millis() - lastWifiCheckTimer >= 15000
  )
  {
    lastWifiCheckTimer =
      millis();

    if (
      WiFi.status() != WL_CONNECTED
    )
    {
      Serial.println(
        "[WIFI] Reconnecting..."
      );

      WiFi.reconnect();
    }
  }

  if (
    millis() - lastTelemetryTimer >=
    TELEMETRY_INTERVAL
  )
  {
    lastTelemetryTimer =
      millis();

    sendTelemetry(
      currentTemp,
      currentHum,
      rawGas,
      gasStatus,
      isGateClosed,
      doorAlarmActive,
      gasAlarmActive,
      currentTimeStr
    );
  }

  delay(50);
}

void sendTelemetry(
  float temp,
  float hum,
  int rawGas,
  const String& gasStatus,
  bool isGateClosed,
  bool doorAlarm,
  bool gasAlarm,
  const String& rtcTimeStr
)
{
  if (
    WiFi.status() != WL_CONNECTED
  )
  {
    Serial.println(
      "[LOCAL] Skipped - WiFi not connected"
    );

    return;
  }

  String jsonPayload = "{";

  jsonPayload +=
    "\"deviceId\":\"" +
    String(DEVICE_ID) +
    "\",";

  if (isnan(temp))
  {
    jsonPayload +=
      "\"temperature\":null,";
  }
  else
  {
    jsonPayload +=
      "\"temperature\":" +
      String(temp, 1) +
      ",";
  }

  if (isnan(hum))
  {
    jsonPayload +=
      "\"humidity\":null,";
  }
  else
  {
    jsonPayload +=
      "\"humidity\":" +
      String(hum, 1) +
      ",";
  }

  jsonPayload +=
    "\"gasValue\":" +
    String(rawGas) +
    ",";

  jsonPayload +=
    "\"gasStatus\":\"" +
    gasStatus +
    "\",";

  jsonPayload +=
    "\"doorStatus\":\"" +
    String(
      isGateClosed
        ? "CLOSED"
        : "OPEN"
    ) +
    "\",";

  jsonPayload +=
    "\"doorAlarm\":" +
    String(
      doorAlarm
        ? "true"
        : "false"
    ) +
    ",";

  jsonPayload +=
    "\"gasAlarm\":" +
    String(
      gasAlarm
        ? "true"
        : "false"
    ) +
    ",";

  jsonPayload +=
    "\"temperatureAlarm\":" +
    String(
      temperatureAlarmActive
        ? "true"
        : "false"
    ) +
    ",";

  jsonPayload +=
    "\"humidityAlarm\":" +
    String(
      humidityAlarmActive
        ? "true"
        : "false"
    ) +
    ",";

  jsonPayload +=
    "\"beefQty\":" +
    String(coldDrink.qty) +
    ",";

  jsonPayload +=
    "\"muttonQty\":" +
    String(juice.qty) +
    ",";

  jsonPayload +=
    "\"rtcTime\":\"" +
    rtcTimeStr +
    "\"";

  jsonPayload += "}";

  WiFiClient client;

  HTTPClient http;

  http.setTimeout(5000);

  http.setReuse(false);

  Serial.println(
    "[LOCAL] Connecting to local backend..."
  );

  if (
    !http.begin(
      client,
      SERVER_URL
    )
  )
  {
    Serial.println(
      "[LOCAL] ERROR: http.begin() failed"
    );

    return;
  }

  http.addHeader(
    "Content-Type",
    "application/json"
  );

  http.addHeader(
    "X-Device-Key",
    DEVICE_API_KEY
  );

  http.addHeader(
    "Connection",
    "close"
  );

  int httpResponseCode =
    http.POST(jsonPayload);

  Serial.print(
    "[LOCAL] HTTP response: "
  );

  Serial.println(
    httpResponseCode
  );

  if (httpResponseCode > 0)
  {
    String response =
      http.getString();

    Serial.print(
      "[LOCAL] Server response: "
    );

    Serial.println(
      response
    );

    if (
      httpResponseCode == 200 ||
      httpResponseCode == 201
    )
    {
      Serial.println(
        "[LOCAL] Telemetry sent successfully!"
      );
    }
    else
    {
      Serial.println(
        "[LOCAL] Backend rejected telemetry."
      );
    }
  }
  else
  {
    Serial.print(
      "[LOCAL] POST failed, error: "
    );

    Serial.println(
      http
        .errorToString(
          httpResponseCode
        )
        .c_str()
    );

    Serial.print(
      "[LOCAL] WiFi RSSI: "
    );

    Serial.print(
      WiFi.RSSI()
    );

    Serial.println(
      " dBm"
    );
  }

  http.end();

  client.stop();
}

String getGasStatus(int rawGas)
{
  if (rawGas >= 800)
  {
    return "WARNING";
  }
  else if (rawGas >= 700)
  {
    return "MILD";
  }
  else
  {
    return "GOOD";
  }
}

void renderScreen1(
  DateTime now,
  bool isGateClosed
)
{
  float temp =
    dht.readTemperature();

  float hum =
    dht.readHumidity();

  lcd.setCursor(0, 0);

  if (
    isnan(temp) ||
    isnan(hum)
  )
  {
    lcd.print(
      "T:--C H:--%    "
    );
  }
  else
  {
    lcd.print("T:");

    lcd.print(
      (int)temp
    );

    lcd.print("C H:");

    lcd.print(
      (int)hum
    );

    lcd.print("%  ");
  }

  lcd.setCursor(0, 1);

  if (isGateClosed)
  {
    lcd.print(
      "CLSD "
    );
  }
  else
  {
    lcd.print(
      "OPEN "
    );
  }

  lcd.print(
    formatTime(now)
  );

  lcd.print(
    "   "
  );
}

void renderScreen2(int rawGas)
{
  lcd.setCursor(0, 0);

  if (rawGas >= 800)
  {
    lcd.print(
      "Gas: WARNING!! "
    );
  }
  else if (rawGas >= 700)
  {
    lcd.print(
      "Gas: MILD      "
    );
  }
  else
  {
    lcd.print(
      "Gas: GOOD      "
    );
  }

  lcd.setCursor(0, 1);

  lcd.print(
    "Val: "
  );

  lcd.print(
    rawGas
  );

  lcd.print(
    " ADC     "
  );
}

void renderRFIDScreen()
{
  lcd.setCursor(0, 0);

  if (
    lastScannedItem ==
    "Cold Drink"
  )
  {
    lcd.print(
      "ColdDrink Q:"
    );

    lcd.print(
      coldDrink.qty
    );

    lcd.print(
      "    "
    );

    lcd.setCursor(
      0,
      1
    );

    lcd.print(
      "Time: "
    );

    lcd.print(
      coldDrink.timeStr
    );

    lcd.print(
      "   "
    );
  }

  else if (
    lastScannedItem ==
    "Juice"
  )
  {
    lcd.print(
      "Juice Qty: "
    );

    lcd.print(
      juice.qty
    );

    lcd.print(
      "   "
    );

    lcd.setCursor(
      0,
      1
    );

    lcd.print(
      "Time: "
    );

    lcd.print(
      juice.timeStr
    );

    lcd.print(
      "   "
    );
  }
}

bool isSame4ByteUID(
  byte* scannedUID,
  byte scannedSize,
  const byte* targetUID
)
{
  if (scannedSize != 4)
  {
    return false;
  }

  for (
    byte i = 0;
    i < 4;
    i++
  )
  {
    if (
      scannedUID[i] !=
      targetUID[i]
    )
    {
      return false;
    }
  }

  return true;
}

void printHexUID(
  byte* buffer,
  byte bufferSize
)
{
  for (
    byte i = 0;
    i < bufferSize;
    i++
  )
  {
    Serial.print(
      buffer[i] < 0x10
        ? " 0"
        : " "
    );

    Serial.print(
      buffer[i],
      HEX
    );
  }

  Serial.println();
}

String formatTime(DateTime dt)
{
  char buffer[6];

  snprintf(
    buffer,
    sizeof(buffer),
    "%02d:%02d",
    dt.hour(),
    dt.minute()
  );

  return String(buffer);
}