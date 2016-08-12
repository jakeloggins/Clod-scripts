#!/usr/bin/node

var jsonfile = require('jsonfile'),
	mqtt = require('mqtt'),
	fs = require('fs');

var mqtt_config = require('./mqtt_broker_config.json');
mqtt_config.clientId = "uploader";
mqtt_config.will = {
  "topic": "/uploader/error",
  "payload": "uploader disconnected",
  "qos": 2
};
var client = mqtt.connect(mqtt_config);

var exec = require('child_process').exec;
var child;
var success = false;
var retry_flag = false;
var attempts = 0;
var default_dir;

var global_topic;
var global_payload = {};

// script is located in /home/clod/Clod-scripts

var default_platformio_loc = '../.platformio/';
var override_platformio_loc = '../../../boot/platformio.json'; // future feature - allow the user to specify where platformio was installed

var user_wifi_login = '../../../boot/wifilogin.json';

function startup() {
	
	// find out where platformio is installed - reserved for future advanced user settings

	try {
		// does file exist
		fs.accessSync(override_platformio_loc, fs.R_OK | fs.W_OK);
		platformio_loc_obj = require(override_platformio_loc);
		platformio_loc = platformio_loc_obj.loc;

		console.log("override file found, path to platformio stored");

	}
	catch(error) {
		// file does not exist so just use default
		platformio_loc = default_platformio_loc;
		console.log("no override, using default path to platformio");
	}


	// get wifi login information from boot

	try {
		// does file exist
		fs.accessSync(user_wifi_login, fs.R_OK | fs.W_OK);
		user_wifi_obj = require(override_platformio_loc);
		console.log("user wifi login stored from boot");

		// write to wifilogin.h
		wifilogin_loc = platformio_loc;
		wifilogin_loc += "/lib/wifilogin/wifilogin.h";

		wifilogin_h_string += "const char* ssid = \"";
		wifilogin_h_string += user_wifi_obj.ssid;
		wifilogin_h_sting += "\";\n";

		wifilogin_h_string += "const char* password = \"";
		wifilogin_h_string += user_wifi_obj.password;
		wifilogin_h_sting += "\";\n";


		try { 
			fs.writeFileSync(wifilogin_loc, wifilogin_h_string);
			console.log("The platformio wifilogin library file was saved!");
		}
		catch(err) {
			console.log(err);
		}



	}
	catch(err) {
		// file does not exist so just use default
		console.log(err);
		console.log("WARNING: no boot/wifilogin,json file found, uploaded sketches may not connect to wifi");
	}





	
};


function compile() {
	child = exec('platformio run --target upload');
}

function retry() {
	onMSG(global_topic, global_payload);
}

function onMSG(topic, payload) {

	// get mqtt message from /uploader/control

		// current name of esp device
		// current IP address of esp device
		// esp board type
		// sketch to upload
		// mqtt base path of esp device
		// crouton card name
		// crouton card display type

		/* - example JSON to be passed around
		{
		  "deviceInfo": {
			"current_ip": "192.168.1.141",
		    "espInfo": {
		   		"chipID": "16013813",
				"board_type": "esp01_1m",
				"platform": "espressif",
				"flash_size": 1048576,
				"real_size": 1048576,
				"boot_version": 4,
		    	"upload_sketch": "basic_esp8266",
		    },
		    "device_name": "floodlightMonitor",
		    "status": "good",
		    "path": "/backyard/floodlight/",
		    "card_display_choice": "custom",
		    "endPoints": {
		      "lastTimeTriggered": {
		        "title": "Last Time Triggered",
		        "card-type": "crouton-simple-input",
		        "values": {
		          "value": "n/a"
		        }
		      },
		      "alertEmail": {
		        "title": "Alert Email",
		        "card-type": "crouton-simple-input",
		        "values": {
		          "value": "whatever@gmail.com"
		        }
		      }
		    }
		  }	
		}
		*/

	// no topic parsing is requried beyond the command

	// only process if there's a valid command in the path
	command_match = topic.match(/control|confirm|log|errors/);
	if (command_match != null) {
		// actually store the command
		command = topic.toString().match(/control|confirm|log|errors/).toString();
		if (command == "control") {

			// reset everything for retry attempts
			global_topic = topic;
			global_payload = payload;
			success = false;
			// change working directory to home
			process.chdir(default_dir);


			// get the JSON payload
			payload_obj = JSON.parse(payload);


			process.chdir('../Clod-sketch-library/sketches/' + payload_obj.deviceInfo.espInfo.upload_sketch);

			// if init_config
			if (payload_obj.deviceInfo.espInfo.upload_sketch == "Initial_Config") {


				def_string = "String board_type = \"";
				def_string += payload_obj.deviceInfo.espInfo.board_type;
				def_string += "\"\;\n";
				def_string += "String platform = \"";
				def_string += payload_obj.deviceInfo.espInfo.platform;
				def_string += "\"\;\n";


				// write definitional file
				def_file_string = process.cwd() + '/src/ESPBoardDefs.h';

				try { 
					fs.writeFileSync(def_file_string, def_string);
					console.log("The init_config def file was saved!");
				}
				catch(err) {
					console.log(err);
				}

			}
			// regular sketch process
			else {


				// grab default endpoints
					if (payload_obj.deviceInfo.card_display_choice == "custom") {
				    		// just use user provided payload object
					    	// publish object to deviceInfo/confirm/[name] so that the esp will grab it when it starts up

					    	// grab the custom endpoints file that has been edited by the GUI

				    	} else {
				    		// get default_endpoints.json from sketch file and add/overwrite them to the payload_obj
							try {
								// does file exist
								//default_endpoints_file = './sketches/' + payload_obj.deviceInfo.espInfo.upload_sketch + '/default_endpoints.json';
								default_endpoints_file = process.cwd() + './default_endpoints.json';
								//default_endpoints_file = './default_endpoints.json';
								console.log("attempting...", default_endpoints_file);
								fs.accessSync(default_endpoints_file, fs.R_OK | fs.W_OK);
								stored = require(default_endpoints_file);
								default_endpoints = stored;
								console.log("default endpoints found");

								// add/overwrite to payload_obj
								payload_obj.deviceInfo.endPoints = default_endpoints;
								
								console.log("stored..", stored);
								console.log("default_endpoints..", default_endpoints);


							}
							catch(error) {
								console.log("default endpoints not found. sending error.")
								console.log(error);
								
								// -------------------
								// send failed message
								// -------------------
									upload_path = "/uploader/confirm/"
						    		upload_path += payload_obj.deviceInfo.device_name_key;
									client.publish('/uploader/confirm', 'failed');

							    	attempts = 0;
							    	global_payload = {};
							    	global_topic = '';
							}


				    	}

				
				// assign pin numbers based on board type
				// using board types from platform io
				switch(payload_obj.deviceInfo.espInfo.board_type) {
					case "esp01_1m":
						def_string = "#define PIN_A 2\n";
						break;
					case "esp01":
						def_string = "#define PIN_A 2\n";
						break;
					case "esp07":
						def_string = 
							'#define PIN_A 4\n' +
							'#define PIN_B 5\n' +
							'#define PIN_C 12\n' +
							'#define PIN_D 13\n';
						break;
					case "esp12e":
						def_string = 
							'#define PIN_A 4\n' +
							'#define PIN_B 5\n' +
							'#define PIN_C 12\n' +
							'#define PIN_D 13\n';
						break;
					case "esp_wroom_02":
						def_string = 
							'#define PIN_A 4\n' +
							'#define PIN_B 5\n' +
							'#define PIN_C 12\n' +
							'#define PIN_D 13\n';
						break;
					default:
						def_string = "#define PIN_A 2\n";
				}

				// include the device name in the definition file
				name_string = 'String thisDeviceName = \"';
				name_string += payload_obj.deviceInfo.device_name_key.concat("\";\n");
				def_string += name_string;

				// include the device path in the definition file
				path_string = 'String thisDevicePath = \"';
				path_string += payload_obj.deviceInfo.path.concat("\";\n");
				def_string += path_string;


				// include the subscribe device path string in the definition file
				subscribe_string = "String subscribe_path = \"";
				subscribe_string += payload_obj.deviceInfo.path.concat("/#\";\n");
				def_string += subscribe_string;


				// include the endpoint lookup function
					// write the start of the function
					fn_string = "String lookup(String endpoint_key) \{\n";
					
					// for each endpoint write the if or else if statement

					i = 0;
					for (key in payload_obj.deviceInfo.endPoints) {
						endpoint_obj = payload_obj.deviceInfo.endPoints[key];
						//console.log(key);
						//console.log(endpoint_obj.static_endpoint_id);

						i++;

						if (i == 1) {
							fn_string += "	if (endpoint_key == \"";
							fn_string += key;	
							fn_string += "\") \{\n";
							fn_string += "		return \"";
							fn_string += endpoint_obj.static_endpoint_id;
							fn_string += "\"\;\n";
							fn_string += "	\}\n";

						}
						else {
							fn_string += "	else if (endpoint_key == \"";
							fn_string += key;	
							fn_string += "\") \{\n";
							fn_string += "		return \"";
							fn_string += endpoint_obj.static_endpoint_id;
							fn_string += "\"\;\n";
							fn_string += "	\}\n";
						}


					}

					// end the function
					fn_string += "\}\n";

					// append everything to the string
					def_string += fn_string;

				// write definitional file
					//def_file_string = './sketches/' + payload_obj.deviceInfo.espInfo.upload_sketch + '/src/namepins.h';
					def_file_string = process.cwd() + '/src/namepins.h';

					try { 
						fs.writeFileSync(def_file_string, def_string);
						console.log("The def file was saved!");
					}
					catch(err) {
						console.log(err);
					}

			}

			// write platform io ini file
				//ini_file_string = './sketches/' + payload_obj.deviceInfo.espInfo.upload_sketch + '/platformio.ini';
				ini_file_string = process.cwd() + '/platformio.ini';

				ini_string = 
					'[env:' + payload_obj.deviceInfo.espInfo.board_type + ']\n' +
					'platform = espressif\n' +
					'framework = arduino\n' +
					'board = ' + payload_obj.deviceInfo.espInfo.board_type + '\n' +
					'upload_port = ' + payload_obj.deviceInfo.current_ip + '\n';


				try {
					fs.writeFileSync(ini_file_string, ini_string);
					console.log("The ini file was saved!");
				}
				catch(err) {
					console.log(err);
				}


			// send platformio compile command line message with IP address, recipe, and definition file
			
			// source file main.cpp goes in the src folder
			// libraries for multiple sketches go in .platformio folder within home directory
			// libraries for project only go in lib folder within [upload_sketch] directory

			// -- delete this if test works
			// change working directory to selected upload sketch
			/*
			console.log(process.cwd());
			process.chdir('./sketches/' + payload_obj.deviceInfo.espInfo.upload_sketch);
			console.log(process.cwd());
			*/

			// appends file for storing output
			var stderr_log_opt = { flags: 'a' };
			var stderr_log_stream = fs.createWriteStream('uploader_stderr.log', stderr_log_opt);

			var stdout_log_opt = { flags: 'a' };
			var stdout_log_stream = fs.createWriteStream('uploader_stdout.log', stdout_log_opt);

			// compile, listen for errors, retry up to 3 times and return response
			// if error, retry a few times and then return /uploader/confirm "fail - reason"
			// if no error, send /uploader/confirm message "success"


			compile();

			child.stdout.pipe(stdout_log_stream);
			child.stderr.pipe(stderr_log_stream);
			
			child.stdout.on('data', function(data) {
			    //console.log('stdout: ' + data);
			});

			child.stderr.on('data', function(data) {
			    //console.log('sterr: ' + data);
			    if (data.match(/\[INFO\]: Result: OK/)) {
			    	success = true;
			    } 
			});

			child.on('close', function() {
			    console.log('closing');
			    attempts += 1;
			    console.log(attempts);
			    if (!success) {

			    	if (attempts < 3) {
				    	console.log("retrying..");
				    	upload_msg = 'retry attempt #';
					    upload_msg += attempts.toString();
					    upload_path = "/uploader/confirm/"
					    upload_path += payload_obj.deviceInfo.device_name_key;	
					    client.publish(upload_path, upload_msg);
				    	retry_flag = true;

			    	} else {
				    	console.log("failed, sending error message")

				    	// -------------------
				    	// send failed message
				    	// -------------------
					    	upload_path = "/uploader/confirm/"
						    upload_path += payload_obj.deviceInfo.device_name_key;	
					    	client.publish(upload_path, 'failed');

					    	attempts = 0;
					    	global_payload = {};
					    	global_topic = '';
			    		
			    	}
			    }
			    else {

			    	send_path = "/deviceInfo/confirm/";
			    	send_path += payload_obj.deviceInfo.device_name_key;

			    	
			    	// -------------------------------
			    	// send success message and object
			    	// -------------------------------
			    		payload_obj_str = JSON.stringify(payload_obj);
				    	client.publish(send_path, payload_obj_str);
				    	upload_path = "/uploader/confirm/"
				    	upload_path += payload_obj.deviceInfo.device_name_key;
				    	upload_obj = {};
				    	upload_obj.device_name = payload_obj.deviceInfo.device_name;
				    	upload_obj.upload_sketch = payload_obj.deviceInfo.espInfo.upload_sketch;
				    	upload_obj.result = "success";
				    	upload_obj_str = JSON.stringify(upload_obj);
				    	client.publish(upload_path, upload_obj_str);

				    	attempts = 0;
				    	global_payload = {};
				    	global_topic = '';
			    	
			    }
			});

		}
	}
	//console.log("end of onMSG")
	if (retry_flag == true) {
		retry_flag = false;
		retry();
	}
}

// start program
startup();

default_dir = process.cwd();


client.on('connect', function () {
  client.publish('/uploader/confirm', 'uploader connected');
  client.subscribe('/uploader/#');
  console.log("uploader connected");
});

client.on('message', function (topic, payload) {
	onMSG(topic, payload.toString());
});
