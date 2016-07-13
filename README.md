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

The persistence script is the workhorse of the Clod system. It listens to MQTT traffic in order to update device information files, handles requests from devices, and helps Crouton function properly. 


* Manage requests from newly-added esp chips

* Manage new additions of devices to the Crouton dashboard

* Listen for Last Will and Testament ("LWT") messages to update the connection status of device.

* List to confirm messages to update endpoint states.

* Maintain all_devices.json, active_device_list.json, active_init_list.json, and active_device_list_esp.json


#### ESP chip after upload

1. Persistence adds a newly uploaded device to all_devices as seen in the `esp-uploaded-example` device object below and to the active device lists. 

2. In the Crouton connections tab, the active devices will show up in the "Select Available Device" dropdown menu. 

3. Crouton will add the device by sending ` /deviceInfo/control/[name] "get" `. 

4. Persistence will respond by sending the device object, an example of which can be seen below in `esp-uploaded-example`, to ` /deviceInfo/confirm/[name] `. 

5. Crouton uses the device object to fill out the dashboard display cards.

Here's what all_devices.json looks like with two device objects:

```
{
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
	},
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
	}
}

```


#### List of Currently Connected Devices

Persistence keeps a running list of all_devices who have a device_status of "connected" ...

active_device_list:
``` ["crouton-demo-new", "esp-uploaded-example"] ```

... and a list of devices that are "connected" and have "type:esp" (this is only for use by the uploader).

active_device_list_esp:
``` ["esp-uploaded-example"] ```


#### Remembering States

Within Clod, when a user sends a device a command, a MQTT message is sent to the ` /[path]/control/[name]/[endpoint] ` topic. All devices receive the command, do whatever they are programmed to do, and then return the message to the `/[path]/confirm/[name]/[endpoint] ` topic. Persistence listens and stores all messages that come in on the confirm topics. Persistence is always available to reply to devices requesting their last known states, whether during the startup process or any other reason. It will reply by sending a message to every endpoint's control topic. 

* As an example, imagine a device programmed with a single endpoint that toggled a switch. By default, the switch is `off`. The user toggles the switch `on`, causing a message to be sent: ` /[path]/control/[name]/[endpoint] "on" `

* The device loses power, so it will startup with the default state of `off`. But that's not what the user intends.

* Instead, the device asks persistence for the last state: ``` /persistence/control/[name] "request states" ```. 

* Persistence replies with exactly the same message that a user would trigger: ` /[path]/control/[name]/[endpoint] "on" `

* The device doesn't know or care that the message came from persistence, it just responds as it normally would to any message on the control channel by doing whatever it was programmed to do.

* If the user wasn't around when the device was interrupted, it will have no idea that this persistence bit happened. The switch is just `on` as intended.


#### ESP Startup Process

1. On startup, esp devices ask persistence for its states by publishing to ``` /persistence/control/[name] "request states" ```. 

2. Persistence checks active_devices for the name key.
  
  * If found, it returns the endpoint states in a series of ` /[path]/control/[name]/[endpoint] ` messages. One for each endpoint within the device.

  * If not found, it sends `/deviceInfo/control/[name] "no states" `. If this happens, something went wrong during the upload process.

4. The device sets endpoints accordingly and starts to function according to the sketch.

5. If the esp disconnects from the MQTT broker or loses power, this process will repeat.


#### Non-ESP Startup Process

1. On startup, devices ask persistence for its states by publishing to ``` /persistence/control/[name] "request states" ```. 

2. Persistence checks active_devices for the name key.
  
  * If found, it sends the entire device object to `/deviceInfo/control/[name] `

  * If not found, it sends `/deviceInfo/control/[name] "no states" `. The device then sends its internally stored device object to ` /deviceInfo/confirm/[name] `. See example clients for more details.

4. The device sets endpoints accordingly and starts to function as programmed.

5. If the device disconnects from the MQTT broker or loses power, this process will repeat.


#### IP Verification

The uploader script needs to know the device's IP address to function properly. Therefore, every time a device restarts or re-connects to the MQTT broker, it should verify the IP address stored in all_devices is accurate.

* Device sends persistence its IP: ` /persistence/control/[name]/ip "192.168.1.99" `

* Persistence checks to see if it matches and updates all_devices if necessary.

  * Return ` /persistence/confirm/[name]/ip "no change" ` if IP matched.

  * Return ` /persistence/confirm/[name]/ip "192.168.1.99" ` if IP did not match.


#### LWT messages

Devices should be programmed to send an LWT message to ` /[location path]/errors/[name] `. Persistence will mark the device as disconnected within all_devices and remove it from the active lists. Depending on the circumstances, persistence may also delete the device from all_devices.


Scheduler
---------

The scheduler sends normal MQTT commands to endpoints at specified times. It can be used through the dashboard or by sending a message to the /schedule topic. It does not interract with all_devices or the active lists. All data is stored in schedule_data.json.

example schedule_data:

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


#### Command Syntax
On recepit of a message to /schedule/#, the scheduler gets information about the endpoint from the rest of the message topic, and parses the message payload to create the schedule. The example message will ask the scheduler to lock the "backDoorLock" endpoint every night at 6pm. To change it to every night at 7pm, simply send another message to the same topic with a payload of "every night at 7pm."
```
/schedule/[path]/[action type]/[device name]/[endPoint name]/[value]
```
```
example schedule message:
topic: /schedule/house/downstairs/office/toggle/crouton-demo/backDoorLock/off 
payload: "every night at 6pm"
```

#### Action Types and Values
* *toggle*: Toggles a Simple Toggle card. Accepts true/false or on/off as values.
* *button*: Presses a Simple Button card. Does not require a value.
* *slide_to*: Moves a Simple Slider card to the value.
* *slide_above*: Moves a Simple Slider card to the value, unless the current value is higher.
* *slide_below*: Moves a Simple Slider card to the value, unless the current value is lower.

**Note**: slide_above and slide_below are not yet supported.

#### Removing Schedules
* *clear*: deletes a previously created schedule.
* *clearall*: deletes all active schedules. Should be sent to /schedule/clearall/ topic.

To delete a schedule, send a message to:
```
/schedule/[path]/ clear /[device name]/[endPoint name]/[value]
```
To delete all active schedules send a message to:
```
/schedule/clearall
```

**Note**: If you use the scheduler, you cannot use any of the action type keywords in a path, device_name, or endpoints.

#### Dashboard Interface
The schedule page is a more visual way to add, edit, or delete schedules. Currently active schedules will always be displayed above the form. You can only set one schedule per endpoint, to edit/overwrite an existing schedule, re-enter it by using the form.

If an endpoint was added earlier from the dashboard on the connections page, it's name is the card title converted to camelCase. It's good practice to name all of your endpoints in camelCase.

**Note**: The dashboard interface doesn't do anything more than format and send a message to the scheduler. 

#### Plain Language Parsing

Plain language schedules are parsed using later.js. A complete guide to text parsing can be found [here](http://bunkat.github.io/later/parsers.html#text).

#### Schedule Objects
You can also place your own JSON schedules in the message payload. Later.js has a complete guide to forming schedule objects [here](http://bunkat.github.io/later/schedules.html).

**Note**: Later.js is listed as a dependency in the bower file. You will not have to install it separately.

The scheduler connects to the MQTT broker from the information stored in the /public/common/mqtt_broker_config.json file.
