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

    var midiPort = null;

    function MidiInputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.input = new midi.input();
        node.portCount = node.input.getPortCount();
        node.portNames = [];
        midiPort = config.midiport;

        for (var i = 0; i < node.portCount; i++) {
            node.portNames.push(node.input.getPortName(i));
            node.warn(node.input.getPortName(i));
        }

        node.input.on('message', function(deltaTime, message) {
            node.send({payload: message});
        });

        node.input.openPort(parseInt(midiPort));

        node.on("close", function() {
            node.input.closePort();
        });

        RED.httpAdmin.get('/midi/input/ports', function(req, res, next) {
            res.end(JSON.stringify(node.portNames));
            return;
        });

        RED.httpAdmin.get('/midi/input/ports/' + node.id + '/current', function(req, res, next) {
            res.end(JSON.stringify(midiPort));
            return;
        });
    }
    RED.nodes.registerType("midi in", MidiInputNode);
};
