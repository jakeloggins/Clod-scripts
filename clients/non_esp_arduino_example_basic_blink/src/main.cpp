
// --
// THIS IS THE EXAMPLE SKETCH FOR USING CLOD ON A BASIC ARDUINO BOARD LIKE THE UNO.
// In general, just use an esp chip instead.
// This sketch just provides a basic outline, there is still significant work you need to complete based on the type of board and manner of internet connection.
// The only changes I have made is to comment out the ESP libraries and note where you need to change the code. 
// This is adapted from the basic blink example in the Clod Sketch Library.
// --



//#include <ESP8266WiFi.h>
//#include <ESP8266mDNS.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <TimeLib.h>

//for LED status
#include <Ticker.h>
Ticker ticker;


// -- global info --
  #include <namepins.h>
    // namepins stores
      // device name global variable - thisDeviceName
      // device path global variable - thisDevicePath
      // subscribe path global variable - subscribe_path (thisDevicePath += "/#")
      // startup pins according to board type
      // the lookup function for associating user defined endpoint names with endpoint_static_id during compile time

  // --
  // INSERT THE LIBRARY YOU NEED TO CONNECT TO THE INTERNET HERE
  // --

  //#include <wifilogin.h>
    // located in platformio library folder (usually [home]/.platformio/lib)
    // stores const char ssid and const char password


//String chip_id = String(ESP.getChipId());
String confirmPath = "";
String confirmPayload = "";
String local_ip_str = "";

String error_path = "";

static uint32_t MQTTtick = 0;
static uint32_t MQTTlimit = 300;


// MQTT server setup
  #include <PubSubClient.h>
  IPAddress server(192, 168, 1, 140);
  
  #define BUFFER_SIZE 100
  
  WiFiClient espClient;
  PubSubClient client(espClient, server, 1883);
  boolean sendConfirm = false;



// TICK FUNTION
  void tick_fnc()
  {
    //toggle state
    int state = digitalRead(BUILTIN_LED);  // get the current state of GPIO1 pin
    digitalWrite(BUILTIN_LED, !state);     // set pin to the opposite state
  }

// MQTT functions

  String getValue(String data, char separator, int index)
  {
   yield();
   int found = 0;
    int strIndex[] = {0, -1  };
    int maxIndex = data.length()-1;
    for(int i=0; i<=maxIndex && found<=index; i++){
      if(data.charAt(i)==separator || i==maxIndex){
        found++;
        strIndex[0] = strIndex[1]+1;
        strIndex[1] = (i == maxIndex) ? i+1 : i;
      }
   }
    return found>index ? data.substring(strIndex[0], strIndex[1]) : "";
  }

  // --------------------------------------------------------
  // HIGH LEVEL OVERVIEW OF ESP AND PERSISTENCE COMMUNICATION
  // --------------------------------------------------------
  // ask persistence/control/device_name/chipID "request states" --  do you have any states with my device_name or chipID
    // if not, receive reply from deviceInfo/control/device_name "no states" 
      // send deviceInfo/confirm/device_name {default object} -- send the device info object with default endpoints included
        // NOTE: This step probably isn't necessary. persistence should always have 

    // if yes, receive each endpoint from [device path]/control/[device_name]/[endpoint_key] (camelized card title) 
      // receive each endpoint one by one and it's corresponding value

        // send endpoint_key to function stored in namepins.h at compile time
        // function returns static_endpoint_id associated with that endpoint
        // sketch acts on that value as it normally would, using the static_endpoint_id to know for sure what it should do (turn output pin on/off, adjust RGB light, etc)
        // sketch confirms the value by sending it back on /[path]/[confirm]/[device_name]/[endpoint_key]



  String topic;
  String payload;
  void callback(const MQTT::Publish& pub) {
    yield();
    if (millis() - MQTTtick > MQTTlimit) {
      MQTTtick = millis();
    

      int commandLoc;
      String command = "";
      String deviceName = "";
      String endPoint = "";

      topic = pub.topic();
      payload = pub.payload_string();

      // -- topic parser
          // syntax: 
          // global: / global / path / command / function
          // device setup: / deviceInfo / command / name
          // normal: path / command / name / endpoint

      // check item 1 in getValue
      String firstItem = getValue(topic, '/', 1);
      if (firstItem == "global") {
        // -- do nothing until I change to $ prefix before command types
      }
      else if (firstItem == "deviceInfo") {
        // get name and command
        deviceName = getValue(topic, '/', 3);
        command = getValue(topic, '/', 2);
        if ((deviceName == thisDeviceName) && (command == "control")) {
          if (payload == "no states") {
            // --
            // INSERT DEFAULT DEVICE INFO OBJECT HERE
            // could be a string, or a JSON object if you want to use one of the libraries
            // but both of these options will use lots of memory and the arduino uno boards are very limited 
            // so you should probably just be using an esp chip
            // --
          }
          else if (payload == "blink on") {
            Serial.end();
            pinMode(BUILTIN_LED, OUTPUT);
            ticker.attach(0.6, tick_fnc);
          }
          else if (payload == "blink off") {
            ticker.detach();
            digitalWrite(BUILTIN_LED, HIGH);
            pinMode(BUILTIN_LED, INPUT);
            Serial.begin(115200);
          }
          else {
            // -- persistence will no longer send the default object, if it's an arduino based esp chip, or an arduino board, it will just send the control messages to /[device_path]/control/[device_name]/[endpoint_key]
            // this is b/c the arduino JSON storage library is complicated to use and performs poorly. I'd rather have the persistence script sitting on the pi do all of that work instead.
          }






        }
          
      }
      else {

        int i;
        int maxitems;
        
        // count number of items
        for (i=1; i<topic.length(); i++) {
          String chunk = getValue(topic, '/', i);
          if (chunk == NULL) {
            break;
          }
        }

        // get topic variables
        maxitems = i;
        
        for (i=1; i<maxitems; i++) {
          String chunk = getValue(topic, '/', i);
          if (chunk == "control") {
            commandLoc = i;
            command = chunk;
            deviceName = getValue(topic, '/', i + 1);
            endPoint = getValue(topic, '/', i + 2);
            break;
          }
        }

        //Serial.println("device and endpoint incoming...");
        //Serial.println(deviceName);
        //Serial.println(endPoint);

          // send endpoint_key to function stored in namepins.h at compile time
          // function returns static_endpoint_id associated with that endpoint
        
          String lookup_val = lookup(endPoint);
          //Serial.println("looking value incoming...");
          //Serial.println(lookup_val);

          // sketch acts on that value as it normally would, using the static_endpoint_id to know for sure what it should do (turn output pin on/off, adjust RGB light, etc)
          if (lookup_val == "blink") {
            // deserialize payload, get valueKey
            String findValue = getValue(payload, ':', 1);
            findValue.remove(findValue.length() - 1);

            if (findValue == "true") {
              Serial.end();
              pinMode(BUILTIN_LED, OUTPUT);
              ticker.attach(0.6, tick_fnc);
            }
            else if (findValue == "false") {
              ticker.detach();
              digitalWrite(BUILTIN_LED, HIGH);
              pinMode(BUILTIN_LED, INPUT);
              Serial.begin(115200);
            }

            //neoPixelChange = true;
          }
          /*
          else if (lookup_val == "SECOND STATIC ENDPOINT ID") {
            
          }
          else if (lookup_val == "THIRD STATIC ENDPOINT ID") {

          }
          */


          // sketch confirms the value by sending it back on /[path]/[confirm]/[device_name]/[endpoint_key]

          confirmPath = "";
          confirmPath = thisDevicePath;
          confirmPath += "/confirm/";
          confirmPath += thisDeviceName;
          confirmPath += "/";
          confirmPath += endPoint;
          confirmPayload = payload;

          //sendConfirm = true;
          client.publish(MQTT::Publish(confirmPath, confirmPayload).set_qos(2));

      }
    }




  }



void setup() {

  Serial.begin(115200);
  Serial.println("Booting");

  // -- 
  // CONNECT TO INTERNET HERE
  // See below for how it is done on an esp board
  // --

  //Serial.println(ESP.getResetInfo());
  /*WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.waitForConnectResult() != WL_CONNECTED) {
    Serial.println("Connection Failed! Rebooting...");
    delay(5000);
    ESP.restart();
  }
  */
  Serial.println("Starting UDP");
  udp.begin(localPort);
  Serial.print("Local port: ");
  Serial.println(udp.localPort());


  // -- OTA
    // OTA options
    // Port defaults to 8266
    // ArduinoOTA.setPort(8266);
    // Hostname defaults to esp8266-[ChipID]
    // ArduinoOTA.setHostname("myesp8266");
    // No authentication by default
    // ArduinoOTA.setPassword((const char *)"123");

    ArduinoOTA.onStart([]() {
      Serial.println("Start");
    });
    ArduinoOTA.onEnd([]() {
      Serial.println("\nEnd");
    });
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
      Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    });
    ArduinoOTA.onError([](ota_error_t error) {
      Serial.printf("Error[%u]: ", error);
      if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
      else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
      else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
      else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
      else if (error == OTA_END_ERROR) Serial.println("End Failed");
    });
    ArduinoOTA.begin();

  Serial.println("Ready");
  Serial.print("IP address: ");
  // -- print IP string here
  //local_ip_str = WiFi.localIP().toString();
  //Serial.println(local_ip_str);


}





void loop() {
  ArduinoOTA.handle();

  // -- MQTT connect
    if (!client.connected()) {
      error_path += thisDevicePath;
      error_path += "/";
      error_path += "errors/";
      error_path += thisDeviceName;
      if (client.connect(MQTT::Connect(thisDeviceName).set_will(error_path, "disconnected"))) {
        Serial.println("MQTT connected");
        client.set_callback(callback);
        client.subscribe(MQTT::Subscribe()
          .add_topic("/deviceInfo/#")
          .add_topic("/global/#")
          .add_topic(subscribe_path)
                 );
        // notify persistence of device IP
          String persistence_ip_path = "/persistence/control/";
          persistence_ip_path += thisDeviceName;
          persistence_ip_path += "/ip";
          client.publish(MQTT::Publish(persistence_ip_path, local_ip_str).set_qos(2));

        // ask persistence/control/device_name/chipID "request states" --  do you have any states with my device_name or chipID
          String persistence_path = "/persistence/control/";
          persistence_path += thisDeviceName;
          persistence_path += "/";
          //persistence_path += chip_id;
          client.publish(MQTT::Publish(persistence_path, "request states").set_qos(2));
          Serial.println("request states sent");
      }
    }

    if (client.connected()) {
      client.loop();
    }




  
  // Do things every NTPLimit seconds
  if ( millis() - tick > NTPlimit) {
    tick = millis();

    
  } 
  

  yield();
}
