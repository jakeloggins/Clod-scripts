import paho.mqtt.client as mqtt
import time
import json
import random
import os
import threading
import re


def updateValue(endpoint,valueKey,value):
    global device
    global j

    if j != "{ }":
        device["deviceInfo"]["endPoints"][endpoint]["values"][valueKey] = value

def resetValues():
    global counter
    global barDoor
    global barDoorDelay
    global drinks
    global drinksDelay
    global occup
    global occupDelay
    global temp
    global tempDelay
    global tempArray

    counter = 0
    barDoor = 34
    barDoorDelay = 5
    drinks = 0
    drinksDelay = int(random.random()*5)
    occup = 76
    occupDelay = int(random.random()*30)
    temp = 0
    tempDelay = 3
    tempArray = [60,62,61,62,63,65,68,67,68,71,69,65,66,62,61]

#callback when we recieve a connack
def on_connect(client, userdata, flags, rc):
    global connectionStatus
    connectionStatus = "should be up and running :)"
    print("Connected with result code " + str(rc))
    startup()

#callback when we receive a published message from the server
def on_message(client, userdata, msg):
    global device
    global json
    global j
    global clientName
    global deviceJson
    global device_path
    # print(msg.topic + ": " + str(msg.payload))

    # new parsing method
    # syntax: 
        # global: / global / path / command / function
        # device setup: / deviceInfo / name / command
        # normal: path / command / name / endpoint
    command = re.search('confirm|control|log|errors', msg.topic).group(0)
    parse_command = re.split('/confirm/|/control/|/log/|/errors/', msg.topic)
    before_command = filter(None, parse_command[0].split("/"))
    # after command is not needed for deviceInfo, handled in global and normal instead

    ### Global Commands
    if (before_command[0] == "global") & (command == "control"):
        after_command = filter(None, parse_command[1].split("/"))
        
        # verify global command scope is within device path scope
        device_path_split = filter(None, device_path.split("/"))
        device_path_split[:0] = ["global"]

        if len(before_command) <= len(device_path_split):
            for d, g in zip(device_path_split,before_command):
                if d == g:
                    scope_match = True
                else:
                    scope_match = False
                    break

            if scope_match == True:
                # look for function matches              
                for key in device["deviceInfo"]["endPoints"]:
                    try:
                        function_match = after_command[0] == device["deviceInfo"]["endPoints"][key]["function"]
                    except KeyError:
                        function_match = False

                    # update value of function matches
                    if function_match == True:
                        client.publish(device_path+"/confirm/"+clientName+"/"+key, str(msg.payload))
                        
                        newJson = json.loads(msg.payload)
                        for item, value in newJson.iteritems():
                            updateValue(key,item,value)

    
    ### Device Setup Commands
    # (ignore get message b/c persistence takes care of it)
    elif (before_command[0] == "deviceInfo") & (command == "control"):
        
        ## if no states, use what is stored as default within the code, and send that back on confirm
        # answer a get request by sending the device JSON

        if str(msg.payload) == "no states":
            newJson = json.dumps(device)
            client.publish("/deviceInfo/"+clientName+"/confirm", newJson)

            # subscribe to appropriate endpoints
            for key in device["deviceInfo"]["endPoints"]:
                #print key
                client.subscribe(str(device["deviceInfo"]["path"])+"/control/"+clientName+"/"+str(key))



        elif str(msg.payload) == "get":
            print "do nothing"

        ## record the entire device object, and send it back on confirm
        # if no get request, grab the sent JSON and send it back
        else:
            # get and store the JSON
            #print "message payload.."
            #print msg.payload            

            j = msg.payload
            device = json.loads(j)
            #print "after loads ..."
            #print device

            deviceJson = json.dumps(device)
            #print "after dumps..."
            #print deviceJson


            ## subscribe to the right endpoints
            # subscribe to the appropriate endpoint channels
            for key in device["deviceInfo"]["endPoints"]:
                #print key
                
                #client.subscribe("/inbox/"+clientName+"/"+str(key))
                client.subscribe(device_path+"/control/"+clientName+"/"+str(key))
            
            client.publish("/deviceInfo/confirm/"+clientName, deviceJson)

    ### Normal Commands
    else:
        after_command = filter(None, parse_command[1].split("/"))
        name = after_command[0]
        address = after_command[1]
        #currently only echoing to simulate turning on the lights successfully
        #turn on light here and if success, do the following..

        #client.publish("/outbox/"+clientName+"/"+address, str(msg.payload))
        client.publish(device_path+"/confirm/"+name+"/"+address, str(msg.payload))

        newJson = json.loads(msg.payload)
        for key, value in newJson.iteritems():
            updateValue(address,key,value)


    # if box == "inbox" and address == "reset":
    #     #initial values
    #     global crouton
    #     global deviceJson

    #     # global counter
    #     # global barDoor
    #     # global barDoorDelay
    #     # global drinks
    #     # global drinksDelay
    #     # global occup
    #     # global occupDelay

    #     resetValues()
    #     deviceJson = json.dumps(device)
    #     client.publish("/outbox/"+clientName+"/drinks", '{"value":0}')
    #     client.publish("/outbox/"+clientName+"/barDoor", '{"value":34}')
    #     client.publish("/outbox/"+clientName+"/danceLights", '{"value":true}')
    #     client.publish("/outbox/"+clientName+"/backDoorLock", '{"value":false}')
    #     client.publish("/outbox/"+clientName+"/barLightLevel", '{"value":30}')
    #     client.publish("/outbox/"+clientName+"/customMessage", '{"value":"Happy Hour is NOW!"}')
    #     client.publish("/outbox/"+clientName+"/discoLights", '{"red":0,"green":0,"blue":0}')
    #     client.publish("/outbox/"+clientName+"/occupancy", '{"series":[76]}')

    #     updateValue("drinks","value",0)
    #     updateValue("barDoor","value",34)
    #     updateValue("danceLights","value",True)
    #     updateValue("backDoorLock","value",False)
    #     updateValue("barLightLevel","value",30)
    #     updateValue("customMessage","value","Happy Hour is NOW!")
    #     updateValue("occupancy","series",[76])
    #     print "Reseting values...."

def startup():
    global client
    global device
    global clientName
    global deviceJson
    global device_path

    client.will_set(device_path+'/errors/'+clientName, 'failed', 0, False)

    client.subscribe("/deviceInfo/control/"+clientName)
    #client.publish("/deviceInfo/confirm/"+clientName, deviceJson) #for autoreconnect
    client.subscribe("/global/#") # to receive global commands

    ## send request states
    ## /persistence/control/[name] "request states". 
    client.publish("/persistence/control/"+clientName, "request states")

    # no longer needed b/c this is handled in device setup commands
    # if j != "{ }":
    #     for key in device["deviceInfo"]["endPoints"]:
    #         #print key
    #         client.subscribe(str(device["deviceInfo"]["path"])+"/control/"+clientName+"/"+str(key))


def on_disconnect(client, userdata, rc):
    global connectionStatus
    if rc != 0:
        print("Broker disconnection")
        connectionStatus = "is currently Down :(. Download the local python version instead!"
    time.sleep(10)
    client.reconnect()

def update_values():
    global clientName
    global deviceJson
    global crouton
    global client
    global connectionStatus
    global device
    global device_path

    global counter
    global barDoor
    global barDoorDelay
    global drinks
    global drinksDelay
    global occup
    global occupDelay
    global temp
    global tempDelay
    global tempArray

    #barDoor
    if(counter >= barDoorDelay):
        barDoor = barDoor + 1 #increment value by one
        #client.publish(device["deviceInfo"]["path"]+"/confirm/"+clientName+"/barDoor", '{"value":'+str(barDoor)+'}')
        client.publish(device_path+"/confirm/"+clientName+"/barDoor", '{"value":'+str(barDoor)+'}')
        barDoorDelay = counter + 5 #wait 5 seconds for next increment
        updateValue("barDoor","value",barDoor)
        # print "barDoor is now: " + str(barDoor)

    #drinks
    if(counter >= drinksDelay):
        drinks = drinks + 1 #increment value by one
        client.publish(device_path+"/confirm/"+clientName+"/drinks", '{"value":'+str(drinks)+'}')
        drinksDelay = counter + int(random.random()*5) #wait 5 seconds for next increment
        updateValue("drinks","value",drinks)
        # print "drinks is now: " + str(drinks)

    #temperature
    if(counter >= tempDelay):
        if(temp == 15):
            temp = 0
        client.publish(device_path+"/confirm/"+clientName+"/temperature", '{"update": {"labels":['+str(counter)+'],"series":[['+str(tempArray[temp])+']]}}')
        tempDelay = counter + 1 #wait 5 seconds for next increment
        temp = temp + 1

    #occupany
    if(counter >= occupDelay):
        if(occup == 76):
            occup = 78
        else:
            occup = 76
        client.publish(device_path+"/confirm/"+clientName+"/occupancy", '{"series":['+str(occup)+']}')
        occupDelay = counter + int(random.random()*5) #wait 5 seconds for next increment
        updateValue("occupancy","series",occup)
        # print "drinks is now: " + str(drinks)

    counter = counter + 1
    if counter > 5000:
        resetValues()

    threading.Timer(1, update_values).start()


if __name__ == '__main__':
    port = int(os.getenv("PORT", 8888))

    global clientName
    global deviceJson
    global crouton
    global client
    global connectionStatus

    # global barDoor
    # global barDoorDelay
    # global drinks
    # global drinksDelay
    # global counter
    # global occup
    # global occupDelay

    clientName = "crouton-demo-new"

    # new path structure: /*path*/ *command type*/*clientName*/*endPoint key* 
    # command types: confirm, control, errors, log
    # dashboard subscribes to *path*/confirm/device name/endpoint
    # dashboard publishes to *path*/control/device name/endpoint
    # last will and testament is sent to *path*/errors/device name
    # log data, if needed, can be sent to *path*/log/device name

    # global commands can be sent to / global / *path* or *path fragment* / *command type* / *function*
    # ex: /global/house/upstairs/control/lights {"value": false}
    # will turn off all device endpoints located at path /house/upstairs/# with a "function": "lights" within their endpoint

    #device setup
    #j = "{ }"
    j = """
    {
        "deviceInfo": {
            "current_ip": "192.168.1.160",
            "type":"python script on pi",
            "device_status":"good",
            "device_name":"crouton-demo-new",
            "device_name_key": "crouton-demo-new",
            "description":"Kroobar's IOT devices",
            "color":"#4D90FE",
            "path":"/house/downstairs/office/test",
            "card_display_choice": "default",
            "endPoints": {
                "barDoor": {
                    "units": "people entered",
                    "values": {
                        "value": 34
                    },
                    "card-type": "crouton-simple-text",
                    "title": "Bar Main Door"
                },
                "drinks": {
                    "units": "drinks",
                    "values": {
                        "value": 0
                    },
                    "card-type": "crouton-simple-text",
                    "title": "Drinks Ordered"
                },
                "danceLights": {
                    "values": {
                        "value": true
                    },
                    "labels":{
                        "true": "ON",
                        "false": "OFF"
                    },
                    "card-type": "crouton-simple-toggle",
                    "title": "Dance Floor Lights",
                    "function": "toggle"
                },
                "backDoorLock": {
                    "values": {
                        "value": false
                    },
                    "labels":{
                        "true": "Locked",
                        "false": "Unlocked"
                    },
                    "icons": {
                        "true": "lock",
                        "false": "lock"
                    },
                    "card-type": "crouton-simple-toggle",
                    "title": "Employee Door",
                    "function": "toggle"
                },
                "lastCall": {
                    "values": {
                        "value": true
                    },
                    "icons": {
                        "icon": "bell"
                    },
                    "card-type": "crouton-simple-button",
                    "title": "Last Call Bell"
                },
                "reset": {
                    "values": {
                        "value": true
                    },
                    "icons": {
                        "icon": "cutlery"
                    },
                    "card-type": "crouton-simple-button",
                    "title": "Reset Cards"
                },
                "customMessage": {
                    "values": {
                        "value": "Happy Hour is NOW!"
                    },
                    "card-type": "crouton-simple-input",
                    "title": "Billboard Message"
                },
                "barLightLevel": {
                    "values": {
                        "value": 30
                    },
                    "min": 0,
                    "max": 100,
                    "units": "percent",
                    "card-type": "crouton-simple-slider",
                    "title": "Bar Light Brightness"
                },
                "discoLights": {
                    "values": {
                        "red": 0,
                        "green": 0,
                        "blue": 0
                    },
                    "min": 0,
                    "max": 255,
                    "card-type": "crouton-rgb-slider",
                    "title": "RGB Lights"
                },
                "drinksOrdered": {
                    "values": {
                        "labels": ["Scotch","Shiner","Rum & Coke","Margarita", "Other"],
                        "series": [10,20,30,10,30]
                    },
                    "total": 100,
                    "centerSum": false,
                    "card-type": "crouton-chart-donut",
                    "title": "Drinks Ordered"
                },
                "occupancy": {
                    "values": {
                        "labels": [],
                        "series": [76]
                    },
                    "total": 100,
                    "centerSum": true,
                    "units": "%",
                    "card-type": "crouton-chart-donut",
                    "title": "Occupancy"
                },
                "temperature": {
                    "values": {
                        "labels": [1],
                        "series": [[60]],
                        "update": ""
                    },
                    "max": 11,
                    "low": 58,
                    "high": 73,
                    "card-type": "crouton-chart-line",
                    "title": "Temperature (F)"
                }
            },
            "description": "Kroobar's IOT devices"
        }
    }

    """
    device = json.loads(j)
    # for now, clientName is static, located above
    #device["deviceInfo"]["name"] = clientName
    deviceJson = json.dumps(device)


    print "Client Name is: " + clientName

    client = mqtt.Client(clientName)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    client.username_pw_set("","")

    if j != "{ }":
        device_path = str(device["deviceInfo"]["path"])
        client.will_set(device_path+'/errors/'+clientName, 'failed', 0, False)
    else:
        device_path = "/default"

    client.connect("localhost", 1883, 60)


    ### Simulated device logic below

    #initial values
    resetValues()

    client.loop_start()
    update_values()
