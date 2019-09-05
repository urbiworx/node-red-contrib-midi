/**
 * Copyright 2016 Urbiworx, Nathanaël Lécaudé
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";

    const isWindows = (process.platform === "win32");

    const midi = require('midi');
        
    var virtualInput;
    var virtualOutput;
    var virtualPortsOpen = false;
    if(!isWindows){
        virtualInput = new midi.input();
        virtualOutput = new midi.output();
        virtualInput.openVirtualPort("to Node-RED");
        virtualOutput.openVirtualPort("from Node-RED");
        virtualPortsOpen = true;
    }

    var inputPortID = {};
    var outputPortID = {};

    const checkInterval = 2000;

    const midiTypes = {
        '8': 'noteoff',
        '9': 'noteon',
        '10': 'polyat',
        '11': 'controlchange',
        '12': 'programchange',
        '13': 'channelat',
        '14': 'pitchbend'
    };
    Object.freeze(midiTypes);

    var findPortByName = function(midiIO,name,successCallback){
        let portCount = midiIO.getPortCount();
        // attempt with the suffix id
        for(let i=0;i<portCount;i++){
            let iterName = midiIO.getPortName(i);
            if( iterName === name ){
                if(successCallback) successCallback(i);
                return true;
            }
        }

        //try to find without suffix 
        let shortName = name.replace(/ [0-9]+$/,'');
        
        for(let i=0;i<portCount;i++){
            let iterName = midiIO.getPortName(i).replace(/ [0-9]+$/,'');
            if( iterName === shortName ){
                if(successCallback) successCallback(i);
                return true;
            }
        }
        return false;
    }

    var checkConnection = function(lastConnection,node,midiIO){
        let portCount = midiIO.getPortCount();
        
        let connected = midiIO.isPortOpen() &&  Number.isInteger(node.portId) && portCount > node.portId  && node.portName==midiIO.getPortName(node.portId);
        
        //if no longer availble attempt reconnection
        if(!connected){
            
            midiIO.closePort();
            findPortByName(midiIO,node.portName,function(i){ 
                midiIO.openPort(i);                
                node.portId = i; 
                node.portName = midiIO.getPortName(i);    
            });
            
        }
        
        
        if(connected!=lastConnection){
            if(connected){                
                node.status({fill:"green",shape:"dot",text:"connected"});
            }
            else {
                node.status({fill:"red",shape:"dot",text:"disconnected"});
            }    
        }
        node.connectionCheckTimeout = setTimeout(checkConnection, checkInterval, connected, node, midiIO);
    };

    function MidiInputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        if(!inputPortID[node.id])
            inputPortID[node.id] = new midi.Input();

        if (!virtualPortsOpen && !isWindows ) {
            virtualPortsOpen = true;
            virtualInput = new midi.input();
            virtualOutput = new midi.output();
            virtualInput.openVirtualPort("to Node-RED");
            virtualOutput.openVirtualPort("from Node-RED");
        }

        node.portName = config.midiname;
        
        node.parseMidi = function(deltaTime, message) {

            var msg = {};
            msg.midi = {};
            msg.midi.raw = message.slice();
            msg.payload = message.splice(1);

            msg.midi.deltaTime = deltaTime;
            msg.midi.channel = (message & 0xF) + 1;
            msg.midi.type = midiTypes[message >> 4];
            msg.midi.data = msg.payload;

            msg.topic = inputPortID[node.id].getPortName(parseInt(node.portId));
            return msg;
        };

        node.processInput = function(deltaTime, message) {
            node.send(node.parseMidi(deltaTime, message));
        };
        
        node.processVirtualInput = function(deltaTime, message) {
            if (node.portName === 'from Node-RED') {
                node.send(node.parseMidi(deltaTime, message));
            }
        };
        if (node.portName === "from Node-RED") {
            virtualInput.on('message', node.processVirtualInput);
        } else {
            inputPortID[node.id].on('message', node.processInput);
        }

        var connectionCheckTimeout;

        checkConnection(true,node,inputPortID[node.id]);
        

        node.on("close", function() {
                       
            if(node.connectionCheckTimeout){
                clearTimeout(connectionCheckTimeout);
            }
            if (virtualPortsOpen) {
                virtualPortsOpen = false;
                virtualInput.closePort();
                virtualOutput.closePort();
            }
            inputPortID[node.id].removeAllListeners("message");
            inputPortID[node.id].closePort();            
            
        });

        RED.httpAdmin.get('/midi/input/ports/' + node.id + '/current', function(req, res, next) {
            res.end(JSON.stringify(node.portName)); //inputPortID[node.id]
            return;
        });
    }
    RED.nodes.registerType("midi in", MidiInputNode);

    function MidiOutputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        if(!outputPortID[node.id])
            outputPortID[node.id] = new midi.output();

        if (!virtualPortsOpen && !isWindows) {
            virtualPortsOpen = true;
            virtualInput = new midi.input();
            virtualOutput = new midi.output();
            virtualInput.openVirtualPort("to Node-RED");
            virtualOutput.openVirtualPort("from Node-RED");
        }

        node.portName = config.midiname;
        checkConnection(true,node,outputPortID[node.id]);

        node.on("input", function(msg) {
            if (msg.midi) {
                var message = [];
                var channel = msg.midi.channel || 1;
                var type;
                for (var key in midiTypes) {
                    if (midiTypes[key] == msg.midi.type) {
                        type = key;
                    }
                }
                var statusByte = type << 4 | (channel - 1);
                message.push(statusByte);
                message = message.concat(msg.midi.data);

                msg.payload = message;
            }

            if (node.portName === 'to Node-RED') {
                virtualOutput.sendMessage(msg.payload);
                outputPortID[node.id].sendMessage(msg.payload);
            } else {
                outputPortID[node.id].sendMessage(msg.payload);
            }
        });

        node.on("close", function() {
            
            outputPortID[node.id].closePort();
            
            if (virtualPortsOpen) {
                virtualPortsOpen = false;
                virtualInput.closePort();
                virtualOutput.closePort();
            }
            
        });

        RED.httpAdmin.get('/midi/output/ports/' + node.id + '/current', function(req, res, next) {
            res.end(JSON.stringify(node.portName));
            return;
        });
    }
    RED.nodes.registerType("midi out", MidiOutputNode);

    RED.httpAdmin.get('/midi/input/ports', function(req, res, next) {
        var configInput = new midi.input();
        configInput.on('message', function(message, deltaTime) {
            return;
        });
        var portCount = configInput.getPortCount();
        var portNames = [];

        for (var i = 0; i < portCount; i++) {
            portNames.push(configInput.getPortName(i));
        }
        configInput.closePort();
        res.end(JSON.stringify(portNames));
        return;
    });

    RED.httpAdmin.get('/midi/output/ports', function(req, res, next) {
        var configOutput = new midi.output();
        var portCount = configOutput.getPortCount();
        var portNames = [];

        for (var i = 0; i < portCount; i++) {
            portNames.push(configOutput.getPortName(i));
        }
        configOutput.closePort();
        res.end(JSON.stringify(portNames));
        return;
    });
};
