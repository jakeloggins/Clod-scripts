Clod Walkthrough
==============

This section explains the behavior of the Clod scripts as an esp chip is added to the system and a user performs typical interactions with it. **If you just want to use Clod, you don't need to read this section.** This is intended for developers who want to improve the codebase, contribute to the sketch library, create their own GUI, or integrate Clod with 3rd party services.


Init_Config
-------------- 

* To start, you need to know what kind of esp chip you have and hard code the values into the `ESPBoardDefs.h` file within the Init_Config's `src` folder. Platformio Io needs these values within the uploader script later on in the process. To find out what you should enter in this file, go [here](http://docs.platformio.org/en/latest/platforms/espressif.html#espressif).

* After verifying the values, flash the Init_Config sketch to the chip. The sketch opens an access point with the SSID "Clod." When connected, users are prompted to enter the user/pass of their home WiFi network.

* The sketch gets more information about the chip, formats it into an object, and sends it to ` /init/control/[chipID] `

* The persistence script grabs the object and adds it to the active_init_list.json file.

active_init_list.json example:
```
{
  "16019999": {
	"current_ip": "192.168.1.141",
	"type": "esp",
    "espInfo": {
   		"chipID": "16019999",
		"board_type": "esp01_1m",
		"platform": "espressif",
		"flash_size": 1048576,
		"real_size": 1048576,
		"boot_version": 4
    }
  }
}
```

Uploader
---------

The uploader script receives information about the esp chip, the name of the sketch to be uploaded, and other information provided by the user. It writes a platformio.ini file within the sketch folder on the Pi, and some other definitional files, before executing a PlatformIO command to upload the sketch. Output from PlatformIO is logged to a file within the sketch folder and monitored. The uploader process will repeat 3 times, or until the sketch is successfully uploaded.

* Uploader takes the above object from initial config and builds the following object with provided user input.

  * Note: Although this user input is currently done with Crouton, like everything else with Clod, it will work the same way with anything that can produce and send an object over MQTT.

* Adds user input: upload_sketch, name, path, endpoint names and values if card_display_choice is custom.

* If card_display_choice is "default", it will grab the "default_endpoints.json" file from the sketch folder and insert it.

* Modifies the init_device_name def file in the sketch folder so that the esp knows its name on startup.

(link to endpoints section of MQTT standard docs)

(link to default_endpoints section of create your own sketch)


Example upload object sent to ` /deviceInfo/control/[name] `
```
{
  "deviceInfo": {
	"current_ip": "192.168.1.141",
	"type": "esp",
    "espInfo": {
   		"chipID": "16019999",
		"board_type": "esp01_1m",
		"platform": "espressif",
		"flash_size": 1048576,
		"real_size": 1048576,
		"boot_version": 4,
    	"upload_sketch": "basic_esp8266",
    },
    "device_name": "Floodlight Monitor",
    "device_name_key": "floodlightMonitor",
    "device_status": "good",
    "path": "/backyard/floodlight/",
    "card_display_choice": "custom",
    "endPoints": {
      "lastTimeTriggered": {
        "title": "Last Time Triggered",
        "card-type": "crouton-simple-input",
        "static_endpoint_id": "time_input",
        "values": {
          "value": "n/a"
        }
      },
      "alertEmail": {
        "title": "Alert Email",
        "card-type": "crouton-simple-input",
        "static_endpoint_id": "alert_input",
        "values": {
          "value": "your_email_address@gmail.com"
        }
      }
    }
  }	
}
```

If the upload is successful, the script will:

* send the same object back to ` /deviceInfo/confirm/[name] ` so that it is stored by the persistence script to all_devices.

* send a slightly different object to ` /uploader/confirm/[name] ` that can be used by a GUI to notify the user. That object will look like this:

```
{
	"device_name": "Floodlight Monitor",
	"upload_sketch": "basic_esp8266",
	"result": "success"
}
```

If the upload is not successful, the script will:

* send a retry message: ` /uploader/confirm/[name] "retry attempt # x" `

... or, when x is more than 2:

* send a failed message: ` /uploader/confirm/[name] "failed" ` 


Persistence
-----------

Persistence.js keeps track of all devices and states for persistence, uploading, deviceInfo, error messages, and helping arduino based devices

* adds the device name as the key for each object in the list

example all_devices object:

```
{
	"crouton-demo-new":{
		"deviceInfo":{
			"current_ip": "192.168.1.135",
			"type":"python script on pi",
			"device_status":"good",
			"device_name":"crouton-demo-new",
			"device_name_key": "crouton-demo-new",
			"description":"Kroobar's IOT devices",
			"color":"#4D90FE",
			"path":"/house/downstairs/office/test",
			"card_display_choice": "default",
			"endPoints":{
				"lastCall":{
				   "card-type":"crouton-simple-button",
				   "title":"Last Call Bell",
				   "values":{
				      "value":true
				   },
				   "icons":{
				      "icon":"bell"
				   }
				},
				"danceLights":{
				   "function":"toggle",
				   "card-type":"crouton-simple-toggle",
				   "labels":{
				      "false":"OFF",
				      "true":"ON"
				   },
				   "values":{
				      "value":true
				   },
				   "title":"Dance Floor Lights"
				},
				"drinks":{
				   "units":"drinks",
				   "card-type":"crouton-simple-text",
				   "values":{
				      "value":83
				   },
				   "title":"Drinks Ordered"
				}
			}
		}
	},
	"esp-uploaded-example": {
		"deviceInfo":{
			"current_ip": "192.168.1.141",
			"type": "esp",
			"espInfo": {
				"chipID": "16013813",
				"board_type": "esp01_1m",
				"platform": "espressif",
				"flash_size": 1048576,
				"real_size": 1048576,
				"boot_version": 4,
				"upload_sketch": "basic_esp8266",
    		},
			"device_status": "good",
			"device_name": "esp-uploaded-example",
			"description": "testing new uploader",
			"color":"#4D90FE",
			"path":"/house/upstairs/spare-room/test",
			"card_display_choice": "custom",
			"endPoints":{
				"lastTimeTriggered": {
					"title": "Last Time Triggered",
					"card-type": "crouton-simple-input",
					"static_endpoint_id": "time_input",
					"values":{
						"value": "n/a"
					}
				},
				"alertEmail": {
					"title": "Alert Email",
					"card-type": "crouton-simple-input",
					"static_endpoint_id": "email_input",
					"values": {
						"value": "blah.blah@gmail.com"
					}
				}
			}
		}
	}
}

```
### ESP Startup Process

1. On startup, esp devices ask persistence for its states by publishing to ``` /deviceInfo/control/[name] "get states" ```. 

2. Persistence checks active_devices for the name key, and if found, returns the stored object to the device.

3. Esp verifies that its current IP address is consistent with the one in the object it just recieved.

4. Esp sets endpoints accordingly and starts to function according to the sketch.

5. If the esp disconnects from the MQTT broker or loses power, this process will repeat.


### List of Currently Connected Devices

Persistence keeps a running list of all_devices who have a device_status of "connected" ...

active_device_list:

``` ["crouton-demo-new", "esp-uploaded-example"] ```

... and a list of devices that are "connected" and have "type:esp" (this is only for use by the uploader).

``` ["esp-uploaded-example"] ```


Scheduler
---------

Scheduler.js takes device names and endpoints and adds schedule specific information. It does not interract with any of the other device objects or arrays.

schedule_data:

```
{
	"esp-bedside-lamp":{
		"alarmLight":{
			"interval":{},
			"schedule":{
				"schedules":[{"D":[1]}],
				"exceptions":[],
				"error":6
			},
		"plain_language":"every day at 5pm",
		"action":"toggle",
		"path":"/house/upstairs/bedroom/",
		"value":"off"}
	},
	"idk":{
		"the endpoint":{
			"interval":{},
			"schedule":{
				"schedules":[],
				"exceptions":[],
				"error":6
			},
		"plain_language":"every morning at 8am",
		"action":"toggle",
		"path":"/whatever/man/",
		"value":"45"
		}
	}
}
```
