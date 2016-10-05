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

    var midi = require('midi');

    console.log('RED INIT !');

    var virtualInput = new midi.input();
    virtualInput.openVirtualPort("to Node-RED");

    var virtualOutput = new midi.output();
    virtualOutput.openVirtualPort("from Node-RED");

    var inputPortID = {};
    var outputPortID = {};

    var midiTypes = {
        '8': 'noteoff',
        '9': 'noteon',
        '10': 'polyat',
        '11': 'controlchange',
        '12': 'programchange',
        '13': 'channelat',
        '14': 'pitchbend'
    };

    function MidiInputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.input = new midi.input();

        inputPortID[node.id] = parseInt(config.midiport);
        node.portName = node.input.getPortName(parseInt(inputPortID[node.id]));

        node.parseMidi = function(deltaTime, message) {
            var msg = {};
            msg.midi = {};
            msg.midi.raw = message.slice();
            msg.payload = message.splice(1);

            msg.midi.deltaTime = deltaTime;
            msg.midi.channel = (message & 0xF) + 1;
            msg.midi.type = midiTypes[message >> 4];
            msg.midi.data = msg.payload;

            msg.topic = node.input.getPortName(parseInt(config.midiport));
            return msg;
        };

        node.processInput = function(deltaTime, message) {
            var msg = node.parseMidi(deltaTime, message);
            node.send(msg);
        };

        node.processVirtualInput = function(deltaTime, message) {
            if (node.portName === 'from Node-RED') {
                var msg = node.parseMidi(deltaTime, message);
                node.send(msg);
            }
        };

        node.input.on('message', node.processInput);
        virtualInput.on('message', node.processVirtualInput);

        node.warn(`Opening port ${inputPortID[node.id]}`);
        node.warn(node.portName);

        node.input.openPort(inputPortID[node.id]);

        node.on("close", function() {
            node.input.closePort();
            //virtualInput.closePort();
            delete inputPortID[node.id];
        });

        RED.httpAdmin.get('/midi/input/ports/' + node.id + '/current', function(req, res, next) {
            res.end(JSON.stringify(inputPortID[node.id]));
            return;
        });
    }
    RED.nodes.registerType("midi in", MidiInputNode);

    function MidiOutputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.output = new midi.output();
        outputPortID[node.id] = parseInt(config.midiport);
        node.warn('hello ' + outputPortID[node.id]);
        node.portName = node.output.getPortName(outputPortID[node.id]);
        node.warn('portname: ' + node.portName);

        node.output.openPort(outputPortID[node.id]);

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
            } else {
                node.output.sendMessage(msg.payload);
            }
        });

        node.on("close", function() {
            node.output.closePort();
            //virtualOutput.closePort();
            delete outputPortID[node.id];
        });

        RED.httpAdmin.get('/midi/output/ports/' + node.id + '/current', function(req, res, next) {
            res.end(JSON.stringify(outputPortID[node.id]));
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
