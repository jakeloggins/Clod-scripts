#!/usr/bin/node

var jsonfile = require('jsonfile'),
	fs = require('fs'),
	mqtt = require('mqtt');

var mqtt_config = require('./mqtt_broker_config.json');
mqtt_config.clientId = "persistence";
mqtt_config.will = {
  "topic": "/persistence/error",
  "payload": "persistence disconnected",
  "qos": 2
};
var client = mqtt.connect(mqtt_config);

// where states are stored and accessed on reconnect
/*var all_devices_file = './public/common/all_devices.json';
var active_device_list_file = './public/common/active_device_list.json';
var active_init_list_file = './public/common/active_init_list.json';
var active_device_list_esp_file = './public/common/active_device_list_esp.json';
*/
var all_devices_file = './all_devices.json';
var active_device_list_file = './active_device_list.json';
var active_init_list_file = './active_init_list.json';
var active_device_list_esp_file = './active_device_list_esp.json';

// comprehensive object containing all active devices
var all_devices = {};
var active_init_list = {};
var active_device_list = [];
var active_device_list_esp = [];

function slowfeed(topic, message) {
	client.publish(topic, message);
}

function listadd(device_name, device_type) {

	console.log("adding...", device_name, "type...", device_type);

	// add to active_device_list
	index = active_device_list.indexOf(device_name);
	if (index == -1) { 
		active_device_list.push(device_name);
		jsonfile.writeFile(active_device_list_file, active_device_list);
	}

	// if type esp, also add to active_device_list_esp
	if (device_type == "esp") {
		index = active_device_list_esp.indexOf(device_name);
		if (index == -1) { 
			active_device_list_esp.push(device_name);
			jsonfile.writeFile(active_device_list_esp_file, active_device_list_esp);
		}
	}

}

function listremove(device_name, device_type) {
	
	console.log("removing...", device_name, "type...", device_type);

	index = active_device_list.indexOf(device_name);
	if (index != -1) {
		active_device_list.splice(index, 1);
		jsonfile.writeFile(active_device_list_file, active_device_list);
	}

	// if type esp, also remove from active_device_list_esp
	if (device_type == "esp") {
		index = active_device_list_esp.indexOf(device_name);
		if (index != -1) {
			active_device_list_esp.splice(index, 1);
			jsonfile.writeFile(active_device_list_esp_file, active_device_list_esp);
		}
	}
}

function listupdate() {
	// makes sure that nothing in active device lists is not also in all_devices

	for (key in active_device_list) {
		if (!(active_device_list[key] in all_devices)) {
			listremove(active_device_list[key], "esp"); // stipulate that it's esp so it will be removed from both lists
		}
	}
	for (key in active_device_list_esp) {
		if (!(active_device_list_esp[key] in all_devices)) {
			listremove(active_device_list_esp[key], "esp");
		}	
	}

}


function startup() {
	
	// try all device file and active device list files

	try {
		// does file exist
		fs.accessSync(all_devices_file, fs.R_OK | fs.W_OK);
		stored = require(all_devices_file);
		all_devices = stored;

		// grab the active device list file
		fs.accessSync(active_device_list_file, fs.R_OK | fs.W_OK);
		stored_device_list = require(active_device_list_file);
		active_device_list = stored_device_list;

		console.log("active devices files found");
		// subscribe to every device path
		for (key in all_devices) {
			path = all_devices[key]["deviceInfo"]["path"].toString().concat("/#");
			client.subscribe(path);
		};

	}
	catch(error) {
		// file does not exist so write empty file
		jsonfile.writeFile(all_devices_file, all_devices, {spaces: 2});
		jsonfile.writeFile(active_device_list_file, active_device_list, {spaces: 2});

		fs.chmod(all_devices_file, 0766);
		fs.chmod(active_device_list_file, 0766);

		console.log("caught error, new blank active device files created");
	}

	// try init list
	try {
		fs.accessSync(active_init_list_file, fs.R_OK | fs.W_OK);
		stored = require(active_init_list_file);
		active_init_list = stored;
		console.log("init list file found");
	}
	catch(error) {
		jsonfile.writeFile(active_init_list_file, active_init_list, {spaces: 2});
		fs.chmod(active_init_list_file, 0766);
		console.log("init list file not found, file created")
	}


	// try active_device_list_esp
	try {
		fs.accessSync(active_device_list_esp_file, fs.R_OK | fs.W_OK);
		stored_device_list_esp = require(active_device_list_esp_file);
		active_device_list_esp = stored_device_list_esp;
		console.log("active device list ESP file found");
	}
	catch(error) {
		jsonfile.writeFile(active_device_list_esp_file, active_device_list_esp, {spaces: 2});
		fs.chmod(active_device_list_esp_file, 0766);
		console.log("active device list ESP file not found, file created")
	}

	listupdate();

	console.log(all_devices);		
};

function onMSG(topic, payload) {

	// only process if there's a valid command in the path
	command_match = topic.match(/control|confirm|log|errors/);
	if (command_match != null) {

		// actually store the command
		command = topic.toString().match(/control|confirm|log|errors/).toString();

		// parse topic for path, device_name, endPoint, command, and value from message topic
		// topic format: /schedule/[path]/[command]/[device_name]/[endPoint]/[value]
		// topic = "/schedule/house/upstairs/guest/toggle/pi/nightlight/off";
        parse_command = topic.toString().split(/confirm|control|log|errors/);
        before_command = parse_command[0].toString().split("/").filter(Boolean);
        after_command = parse_command[1].toString().split("/").filter(Boolean);
        
        // GLOBAL - CHECK SCOPE AND PROCESS
        if (before_command[0] == "global") {
        	global_path = parse_command[0].toString().split("/global").filter(Boolean).toString();

        	// - note: no need for JSON parse and stringify here because we are not evaluating anything in the payload or adding anything to it. 
        	// - it simply ecaluates the topic and decides whether or not to forward the payload to the arduino

			// check all devices for any active arduinos within scope
			for (key in all_devices) {

				// grab device platform
				device_platform = all_devices[key]["deviceInfo"]["platform"];

				// check path for scope
				device_path = all_devices[key]["deviceInfo"]["path"];
				split_device_path = device_path.split("/").filter(Boolean);
				split_global_path = global_path.split("/").filter(Boolean);

	    		// example
	    			// global path: /house/upstairs/bedroom
	    			// device path: /house/upstairs/bedroom/closet
	    				// global command is for anything within the bedroom. The device in the bedroom closet is within the bedroom. 
	    				// So it will match house, upstairs, bedroom, and then exit true state.
	    		// example 2
	    			// global path: /house/upstairs/bedroom/closet
	    			// device path: /house/upstairs/bedroom
	    				// global command is for anything within the bedroom closet. The device is in the bedroom, which is not within the bedroom closet. 
	    				// No comparison will be made because the length of global path (4), is larger than the device path (3)
	    		// example 3
	    			// global path: /house/upstairs/bedroom
	    			// device path: /house/upstairs/hallway
	    				// the device is not in the bedroom, so it will match house, upstairs, return false and exit.

				// device path cannot be within scope if global path length is larger
				if (split_global_path.length <= split_device_path.length) {		
					i = 0;
					// each element of device path should match the element of global path, until global path is finished
					while (i < split_global_path.length) {
						if (split_device_path[i] == split_global_path[i]) {
							scope_match = true;
						}
						else {
							scope_match = false;
							break;
						}
						i++;
					};
				}

				if (scope_match) {
			        // loop through endpoints and look for function matches
	        		for (endpoint in all_devices[key]["deviceInfo"]["endPoints"]) {
		        		// look for function matches if scope matched
		        		if (after_command[0] == all_devices["deviceInfo"]["endPoints"][endpoint]["function"]) {

		        			if (device_platform == "arduino") {
				        		// send a control message with the payload and wait 300ms so arduino has time to process
								send_path = device_path.toString().concat("/control/").concat(key).concat("/").concat(endpoint);
								setTimeout(slowfeed, 300, send_path, payload);

		        			} else {
		        				// send a control message with the payload and wait 100ms so other devices have time to process
								send_path = device_path.toString().concat("/control/").concat(key).concat("/").concat(endpoint);
								setTimeout(slowfeed, 100, send_path, payload);
		        				
		        			}

		                   
		        		}        			
	        		};
				}
        	};
        }
        
        // PERSISTENCE - RESPOND TO DEVICE START UP
        // NEW FORMAT: /persistence/[command]/[name]/[chipid]
        // /persistence/[command]/[name]/ip - "[ip address string]"
        else if (before_command[0] == "persistence") {
        	device_name = after_command[0].toString();
        	second_identifier = after_command[1].toString();
        	if (command == "control") {
        		// RESPOND TO DEVICE START UP
        		if (payload == "request states") {
					// illusion of persistence. device powers off, powers back up, is told to move endpoints to last known user inputs
					// thus, dashboard values are still accurate and re-sync
					console.log("received states request from..", device_name);

					match_flag = false;
					for (key in all_devices) {
						if (key == device_name) {

							// grab device platform and path
							device_type = all_devices[key]["deviceInfo"]["type"];
							device_path = all_devices[key]["deviceInfo"]["path"];

							// mark as connected and add to lists
							all_devices[key]["deviceInfo"]["device_status"] = "connected";
							listadd(device_name, device_type);

							// send series of control messages to arduino, for every active endpoint, with 300ms delay
							if (device_type == "esp") {
								for (endpoint in all_devices[key]["deviceInfo"]["endPoints"]) {
									// send a control message with the payload and wait 300ms so arduino has time to process
									send_path = device_path.toString().concat("/control/").concat(key).concat("/").concat(endpoint);
									//console.log(send_path);
									payload_obj = all_devices[key]["deviceInfo"]["endPoints"][endpoint]["values"];
									payload_obj_str = JSON.stringify(payload_obj);

									setTimeout(slowfeed, 300, send_path, payload_obj_str);
								};
								match_flag = true;
								break;
							} else {
								// send the entire device obj at once
								send_path = "/deviceInfo/control/".concat(device_name.toString());
								payload_obj = all_devices[device_name];
								payload_obj_str = JSON.stringify(payload_obj);
								client.publish(send_path, payload_obj_str);
								match_flag = true;
								break;
							}
						}
						else {
							// set match flag
							match_flag = false;
						}

						// possible to lookup based on chipID
					};
					
					// if there were no states, so send "no states" to /deviceInfo/name/control
					if (!match_flag) {
						send_path = "/deviceInfo/control/".concat(device_name.toString());
						client.publish(send_path, "no states");							
					}

        		}
        		// GENERATE LIST FOR CROUTON
        		else if (payload == "get list") {
        			name_list = Object.keys(all_devices);
        			client.publish("/persistence/confirm", name_list.toString());

        		}

        		else if (second_identifier == "ip") {
        			ip_addr_str = payload.toString();
        			send_path = "/persistence/confirm/";
        			send_path += device_name;
        			send_path += "/ip";
        			// when a device announces a different IP on connect, update it on all_devices
        			if (all_devices[device_name]["deviceInfo"]["current_ip"] != ip_addr_str) {
	        			all_devices[device_name]["deviceInfo"]["current_ip"] = ip_addr_str;
	        			jsonfile.writeFile(all_devices_file, all_devices);
	        			client.publish(send_path, ip_addr_str);
        			}
        			else {
        				client.publish(send_path, "no change");
        			}
        		}



        		// GENERATE NAME 
        		// -- future feature for when device names can be changed
        		// -- this allows device on power interruption to get and store its name rather than the initial one created with the definitional file
	        	
	        	// -- NOTE: don't think this is possible anymore

	        	//else if (payload = "get name") {

					// if newly uploaded device, it won't know its name
					// look for an espInfo object
					//if (all_devices[key]["deviceInfo"]["espInfo"]) {
						// now try to match the second_identifier to the chipID from here
						//console.log(all_devices[key].deviceInfo.espInfo.chipID);
							// if you get a match, let the device know what it's name is
					//}

	        	//}



        	}
        }

        // DEVICE INFO - MANAGE DEVICE INFO REQUESTS
        else if (before_command[0] == "deviceInfo") {
        	device_name = after_command[0].toString();

        	// CROUTON REQUESTS TO ADD TO DASHBOARD
        	if (command == "control") {
        		if (payload == "get") {
					// look for name in all_devices
						// if there is a device name, 
						if (all_devices.hasOwnProperty(device_name)) {
							console.log("has own property");
							// verify it is still connected
							if (all_devices[device_name]["deviceInfo"]["device_status"] == "connected") {
								// send JSON so that dashboard adds cards properly
								send_path = "/deviceInfo/confirm/".concat(device_name);
								payload_obj = all_devices[device_name];
								payload_obj_str = JSON.stringify(payload_obj);
								client.publish(send_path, payload_obj_str);
								console.log("control and get..", all_devices);
							}
						}
        		}
        	}

        	// deviceInfo and confirm - store all
        	else if (command == "confirm") {
        		device_name = after_command[0].toString();

        		// grab the object
        		payload_obj = JSON.parse(payload);

        		//  if it has a chipID, loop through all_devices and delete any other device with a match
        		if (payload_obj.deviceInfo.espInfo.chipID) {
        			for (key in all_devices) {
        				if (all_devices[key]["deviceInfo"]["espInfo"]["chipID"] == payload_obj.deviceInfo.espInfo.chipID) {
        					if (key != device_name) {
	        					delete all_devices[key];
	        					listremove(key, "esp"); // stipulating that it's esp b/c otherwise would not be in this loop
	        					console.log("removed ", key, " had same chipID");
        					}
        				}
        			}
        		}

        		// if it has an IP, loop through all_devices and delete any other device with a match
        		if (payload_obj.deviceInfo.current_ip) {
        			for (key in all_devices) {
        				if (all_devices[key]["deviceInfo"]["current_ip"] == payload_obj.deviceInfo.current_ip) {
        					if (key != device_name) {
	        					delete all_devices[key];
	        					listremove(key, all_device[key]["deviceInfo"]["type"]);
	        					console.log("removed ", key, " had same IP");
	        				}
        				}
        			}
        		}

        		// mark as connected and add to lists
        		payload_obj.deviceInfo.device_status = "connected";
        		listadd(device_name, payload_obj.deviceInfo.type);

        		// add to broader all_devices json database
        		all_devices[device_name] = payload_obj;
        		jsonfile.writeFile(all_devices_file, all_devices);

        		console.log("payload..", payload);
        		console.log("deviceInfo and confirm..", all_devices);

        		// if there is no path in the device obj, add "/default/"
        		if (all_devices[device_name]["deviceInfo"]["path"].toString() == null) {
        			all_devices[device_name]["deviceInfo"]["path"] = "/default";
        		}

        		// subscribe to path
				path = all_devices[device_name]["deviceInfo"]["path"].toString().concat("/#");
				client.subscribe(path);
        	}
        }

    	// ADD NEW ESP CHIP TO ACTIVE INIT LIST
    	// example of JSON
			/*{
			  "16013813": {
				"current_ip": "192.168.1.141",
				"type": "esp",
			    "espInfo": {
			   		"chipID": "16013813",
					"board_type": "esp01_1m",
					"platform": "espressif",
					"flash_size": 1048576,
					"real_size": 1048576,
					"boot_version": 4
			    }
			  }
			}
			*/
        // INIT - MANAGE LISTS FROM NEWLY ADDED ESP CHIPS
        // init/[COMMAND]/[CHIPID]
        else if (before_command[0] == "init") {
        	device_name = after_command[0].toString();
        	if (command == "control") {
        		// get JSON
        		init_obj = JSON.parse(payload);
        		
        		// since the key is the chipID, it's fine to just overwrite each time, no need to remove "old" devices
        		
        		console.log("received new device..");
        		console.log(JSON.stringify(init_obj));
        		// store in active_init_list
        		active_init_list[device_name] = init_obj[device_name];
        		// write into file
        		jsonfile.writeFile(active_init_list_file, active_init_list);



        	}
        	// REMOVE ESP CHIP IF DISCONNECTED
        	// example: init/errors/CHIPID
        	else if (command == "errors") {
        		// remove chip ID from active_init_list
        		delete active_init_list[device_name];
        		// save file
        		jsonfile.writeFile(active_init_list_file, active_init_list);

        		// since init config sketch auto sends the last known settings to persistence each time it reconnects, it doesn't matter that we delete the info from here each time

        	}
        }

        // UPLOADER - 
        else if (before_command[0] == "uploader") {
        	// do nothing
        }

        // SCHEDULER - 
        else if (before_command[0] == "scheduler") {
        	// do nothing
        }

        // ERRORS - HANDLE LWT DISCONNECTS
        else if (command == "errors") {
        	// ex: /errors/NAME "disconnected"
        	
        	// grab device name
        	device_name = after_command.toString();

        	// mark as device_status - disconnected
        	all_devices[device_name]["deviceInfo"]["device_status"] = "disconnected";

        	// remove from lists


    		listremove(device_name, all_devices[device_name]["deviceInfo"]["type"]);
				/*index = active_device_list.indexOf(device_name);
				if (index != -1) {
					active_device_list.splice(index, 1);
	    			jsonfile.writeFile(active_device_list_file, active_device_list);
				}

				// if type esp, also remove from active_device_list_esp
				index = active_device_list_esp.indexOf(device_name);
				if (index != -1) {
					active_device_list_esp.splice(index, 1);
	    			jsonfile.writeFile(active_device_list_esp_file, active_device_list_esp);
				}*/


        	// record in files
        	jsonfile.writeFile(all_devices_file, all_devices);
        	

        	console.log(device_name, " disconnected");

        	// -- future feature - send alert
        }

        // CONFIRM - UPDATE ENDPOINT STATES IN JSON
        else if (command == "confirm") {

        	device_name = after_command[0].toString();

        	if (typeof after_command[1] != 'undefined') {
        		endpoint = after_command[1].toString();

				// append to all_devices, which will also overwrite if it already exists
				payload_obj = JSON.parse(payload);
				for (key in payload_obj) {
				   if (payload_obj.hasOwnProperty(key)) {
				   	// line chart card sends values wrapped in update object, check for it and strip it out
				   	if (key == "update") {
				   		for (k in payload_obj["update"]) {
				   			all_devices[device_name]["deviceInfo"]["endPoints"][endpoint]["values"][key] = payload_obj[k];
				   			//console.log("update..", payload_obj["update"][k]);
				   		};
				   	} else {
						all_devices[device_name]["deviceInfo"]["endPoints"][endpoint]["values"][key] = payload_obj[key];
						//console.log(payload_obj[key]);

				   	}

				   }
				};
				
				jsonfile.writeFile(all_devices_file, all_devices, {spaces: 2});
        	}

        }
        /*
        else if (command == "control") {
        	// -- future feature
        	// listen for corresponding confirm, possibly send alert if nothing is answered 
        	// (this will catch when arduino maintains MQTT connection but is nevertheless no longer properly responding to messages)
        }
		*/


	}
}

// start program
startup();

client.on('connect', function () {
  client.subscribe('/deviceInfo/#');
  client.subscribe('/global/#');
  client.subscribe('/persistence/#');
  client.subscribe('/init/#');
  client.publish('/persistence', 'persistence connected');
  console.log("persistence connected");
});

//client.on('message', onMSG(topic, message));

client.on('message', function (topic, payload) {
	onMSG(topic, payload.toString());
});








