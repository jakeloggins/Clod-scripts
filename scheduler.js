var jsonfile = require('jsonfile'),
	later = require('later'),
	util = require('util'), // not sure if I need this
	fs = require('fs'),
	mqtt = require('mqtt');

var mqtt_config = require('./mqtt_broker_config.json');
mqtt_config.clientId = "scheduler";
mqtt_config.will = {
  "topic": "/schedule/error",
  "payload": "scheduler disconnected",
  "qos": 2
};
var client = mqtt.connect(mqtt_config);


// where schedules are stored and accessed on reconnect
var file = './schedule_data.json';

// comprehensive object containing all schedules and later.setInterval functions for clearing
var active = {};

function startup() {
	try {
		// does file exist
		fs.accessSync(file, fs.R_OK | fs.W_OK);

		stored = require(file);

		// place stored schedules in active and rebuild later setIntervals
		for (var key in stored){
			active[key] = {}; // append endpoint but don't erase other endpoints

			for (endpoint in stored[key]) {
				// get everything but interval from stored
				var schedule = stored[key][endpoint]["schedule"],
					plain_language = stored[key][endpoint]["plain_language"],
					action = stored[key][endpoint]["action"],
					path = stored[key][endpoint]["path"],
					device_name = key,
					value = stored[key][endpoint]["value"];

				active[key][endpoint] = {
					"interval": later.setInterval(sendMSG.bind(null, action, path, device_name, endpoint, value), schedule),
					"schedule": schedule,
					"plain_language": plain_language,
					"action": action,
					"path": path,
					"value": value,
				};
			};
		};
	}
	catch(error) {
		// file does not exist so write empty file
		jsonfile.writeFile(file, active, {spaces: 2});
	}

	console.log(active);
		
};

function onMSG(topic, payload) {

	// only process if there's a valid action in the path
	action_match = topic.match(/toggle|button|slide_to|slide_above|slide_below|clearall|clear\b/);
	if (action_match != null) {

		// actually store the action
		action = topic.toString().match(/toggle|button|slide_to|slide_above|slide_below|clearall|clear\b/).toString();

		// a message sent to schedule/clearall will dump everything
		if (action == "clearall") {
			active = {};
		}
		else {
			// parse topic for path, device_name, endPoint, action, and value from message topic
			// topic format: /schedule/[path]/[action]/[device_name]/[endPoint]/[value]
			// topic = "/schedule/house/upstairs/guest/toggle/pi/nightlight/off";	
			parse_action = topic.toString().split(/toggle|button|slide_to|slide_above|slide_below|clear/);
			before_action = parse_action[0].toString().split("/").filter(Boolean);
			after_action = parse_action[1].toString().split("/").filter(Boolean);

			// create variables
			path = parse_action[0].toString().split("/schedule").filter(Boolean).toString();
			device_name = after_action[0].toString();
			endpoint = after_action[1].toString();

			// on clear message
			if (action == "clear") {
				// delete endpoint
				delete active[device_name][endpoint];

				// delete device if no more endpoints
				num_endpoints = Object.keys(active[device_name]).length;
				if (num_endpoints == 0) {
					delete active[device_name];
				}

			} else {
				// parse payload from raw text or completed schedule object
				if (payload.charAt(0) == "{") {
					schedule = payload;
					plain_language = "N/A";
				}
				else {
					schedule = later.parse.text(payload);
					plain_language = payload;
				}

				// special treatment for actions with no value
				if (action == "button") {
					value = "";
				} else {
					value = after_action[2].toString();
				}

				// check to see if endpoint already exists, if so, clear it's setInterval
				for (key in active) {
					if (key == device_name) {
						for (old_endpoint in active[key]) {
							if (old_endpoint == endpoint) {
								active[key][endpoint].interval.clear();
							}
						};
					}
				};

				// if there is no device name, 
				if (!active.hasOwnProperty(device_name)) {
					active[device_name] = {};
				}

				// append to active
				active[device_name][endpoint] = {
					"interval": later.setInterval(sendMSG.bind(null, action, path, device_name, endpoint, value), schedule),
					"schedule": schedule,
					"plain_language": plain_language,
					"action": action,
					"path": path,
					"value": value,
				};
			}
		}


		//write all of active into JSON file
		jsonfile.writeFile(file, active, {spaces: 2});
	}
}


function sendMSG(action, path, device_name, endpoint, value) {
	// note: path will have enclosing slashes already included
    send_topic = path.concat("control/").concat(device_name).concat("/").concat(endpoint);
	payload_obj = {};

	switch(action) {
    
	    case "toggle":
			// value can only be true or false
			if (value == "on") {
				payload_obj.value = true;
			}
			else {
				payload_obj.value = false;
			}
			// -- complex way (for global schedule commands later: 
				// get device_name, endpoint, path from stored JSON active device list
				// if card type is a slider, message payload should be value: 0
				// if card type is toggle, message payload should be false
	        break;

	    case "button":
			// button action
			payload_obj.value = true;
	        break;

	    case "slide_to":
			// slide_to(path, device_name, endpoint, value)
			payload_obj.value = value;
	        break;

	    case "slide_above":
			// --slide_above(path, device_name, endpoint, value)
				// -- complex way:
					// get last known value from JSON active device list
					// if current value is already above the desired [value], 
						// do nothing
					// if current value is below the desired [value], 
						// send value: [value] in msg payload
	        break;

	    case "slide_below":
			// --slide below(path, device_name, endpoint, value)
				// -- complex way:
					// get last known value from JSON active device list
					// if current value is already above the desired [value], 
						// send value: [value] in msg payload
					// if current value is below the desired [value], 
						// do nothing
	        break;

	} 

	send_payload = JSON.stringify(payload_obj);

	client.publish(send_topic, JSON.stringify(payload_obj));

};


// start program
startup();

client.on('connect', function () {
  client.subscribe('/schedule/#');
  client.publish('/schedule/', 'node scheduler connected');
  console.log("node scheduler connected");
});

//client.on('message', onMSG(topic, message));

client.on('message', function (topic, payload) {
	onMSG(topic, payload.toString());
});








