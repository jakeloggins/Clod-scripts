Data Structure
==============

Initial Config
--------------

Initial config will produce this object and pass it to persistence, which stores it in the active_init_list

active_init_list example:
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

* Uploader.js takes the above object from initial config and builds the following JSON with provided user input.
  * Note: Although this is currently done with Crouton, like everything else with Clod, it will work the same way with anything that can produce and send an object over MQTT.
* Adds following user input: upload sketch, name, path, endpoint names and values if card_display_choice is custom
* If card_display_choice is "default", it will grab "default_endpoints.json" file from the sketch folder and insert it
* Modifies the init_device_name def file in the sketch folder so that the esp knows its name on startup


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

If the upload is successful, the uploader will send the above JSON to deviceInfo/confirm/[name] so that it is stored


Persistence
-----------

Persistence.js keeps track of all devices and states for persistence, uploading, deviceInfo, error messages, and helping arduino based devices

* adds the device name as the key for each object in the list

all_devices object:

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
				"backDoorLock":{
				   "function":"toggle",
				   "card-type":"crouton-simple-toggle",
				   "title":"Employee Door",
				   "labels":{
				      "false":"Unlocked",
				      "true":"Locked"
				   },
				   "values":{
				      "value":false
				   },
				   "icons":{
				      "false":"lock",
				      "true":"lock"
				   }
				},
				"reset":{
				   "card-type":"crouton-simple-button",
				   "title":"Reset Cards",
				   "values":{
				      "value":true
				   },
				   "icons":{
				      "icon":"cutlery"
				   }
				},
				"barDoor":{
				   "units":"people entered",
				   "card-type":"crouton-simple-text",
				   "values":{
				      "value":73
				   },
				   "title":"Bar Main Door"
				},
				"temperature":{
				   "card-type":"crouton-chart-line",
				   "title":"Temperature (F)",
				   "max":11,
				   "high":73,
				   "values":{
				      "series":[
				         [
				            60
				         ]
				      ],
				      "labels":[
				         1
				      ]
				   },
				   "low":58
				},
				"barLightLevel":{
				   "card-type":"crouton-simple-slider",
				   "title":"Bar Light Brightness",
				   "max":100,
				   "min":0,
				   "values":{
				      "value":30
				   },
				   "units":"percent"
				},
				"discoLights":{
				   "max":255,
				   "card-type":"crouton-rgb-slider",
				   "title":"RGB Lights",
				   "values":{
				      "blue":0,
				      "green":0,
				      "red":0
				   },
				   "min":0
				},
				"customMessage":{
				   "card-type":"crouton-simple-input",
				   "values":{
				      "value":"Happy Hour is NOW!"
				   },
				   "title":"Billboard Message"
				},
				"occupancy":{
				   "card-type":"crouton-chart-donut",
				   "title":"Occupancy",
				   "values":{
				      "series":[
				         76
				      ],
				      "labels":[

				      ]
				   },
				   "centerSum":true,
				   "units":"%",
				   "total":100
				},
				"drinksOrdered":{
				   "card-type":"crouton-chart-donut",
				   "total":100,
				   "values":{
				      "series":[
				         10,
				         20,
				         30,
				         10,
				         30
				      ],
				      "labels":[
				         "Scotch",
				         "Shiner",
				         "Rum & Coke",
				         "Margarita",
				         "Other"
				      ]
				   },
				   "centerSum":false,
				   "title":"Drinks Ordered"
				},
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
